require("dotenv").config();
const mongoose = require("mongoose");

const User = require("../models/user");
const Question = require("../models/Question");
const Complaint = require("../models/complaint");
const JobListing = require("../models/job_listing");

function findStageName(plan) {
  if (!plan) return "UNKNOWN";

  if (plan.stage) return plan.stage;

  if (Array.isArray(plan.inputStages) && plan.inputStages.length > 0) {
    return findStageName(plan.inputStages[0]);
  }

  if (plan.inputStage) return findStageName(plan.inputStage);

  if (plan.queryPlan) return findStageName(plan.queryPlan);

  if (Array.isArray(plan.shards) && plan.shards.length > 0) {
    return findStageName(plan.shards[0].winningPlan || plan.shards[0]);
  }

  return "UNKNOWN";
}

function collectStageNames(plan, out = []) {
  if (!plan) return out;

  if (plan.stage) {
    out.push(plan.stage);
  }

  if (plan.inputStage) {
    collectStageNames(plan.inputStage, out);
  }

  if (Array.isArray(plan.inputStages)) {
    plan.inputStages.forEach((entry) => collectStageNames(entry, out));
  }

  if (plan.queryPlan) {
    collectStageNames(plan.queryPlan, out);
  }

  if (Array.isArray(plan.shards)) {
    plan.shards.forEach((shard) => {
      collectStageNames(shard.winningPlan || shard, out);
    });
  }

  return out;
}

function extractWinningStage(explain) {
  const qp = explain?.queryPlanner;
  if (!qp) return "UNKNOWN";

  if (qp.winningPlan) {
    return findStageName(qp.winningPlan);
  }

  if (qp.winningPlan?.queryPlan) {
    return findStageName(qp.winningPlan.queryPlan);
  }

  return "UNKNOWN";
}

function summarizeExplain(name, explain) {
  const stage = extractWinningStage(explain);
  const allStages = collectStageNames(explain?.queryPlanner?.winningPlan || {});
  const stats = explain?.executionStats || {};
  const nReturned = stats.nReturned ?? 0;
  const totalDocsExamined = stats.totalDocsExamined ?? 0;
  const executionTimeMillis = stats.executionTimeMillis ?? 0;
  const docsExaminedPerRow = nReturned > 0 ? totalDocsExamined / nReturned : totalDocsExamined;
  const usesIndex =
    allStages.includes("IXSCAN") ||
    allStages.includes("DISTINCT_SCAN") ||
    allStages.includes("IDHACK");

  return {
    name,
    stage,
    allStages,
    nReturned,
    totalDocsExamined,
    executionTimeMillis,
    docsExaminedPerRow: Number(docsExaminedPerRow.toFixed(2)),
    usesIndex,
  };
}

function printReportRow(row) {
  console.log(" ");
  console.log(`Query: ${row.name}`);
  console.log(`Winning stage: ${row.stage}`);
  console.log(`Plan stages: ${row.allStages.join(" -> ") || "UNKNOWN"}`);
  console.log(`Uses index path: ${row.usesIndex ? "YES" : "NO"}`);
  console.log(`nReturned: ${row.nReturned}`);
  console.log(`totalDocsExamined: ${row.totalDocsExamined}`);
  console.log(`docsExaminedPerRow: ${row.docsExaminedPerRow}`);
  console.log(`executionTimeMillis: ${row.executionTimeMillis}`);

  if (!row.usesIndex) {
    console.log("Action: Add/adjust compound index for this query pattern.");
  } else if (row.docsExaminedPerRow > 5) {
    console.log("Action: Index exists but scan is still wide; tighten filter/projection or index order.");
  } else {
    console.log("Action: Query plan looks healthy.");
  }
}

async function run() {
  const mongoUri = process.env.MONGO_URL;
  if (!mongoUri) {
    throw new Error(
      "Set MONGO_URL before running explain checklist.",
    );
  }

  await mongoose.connect(mongoUri);

  try {
    const rows = [];

    // 1) Public jobs feed query
    const publicJobsExplain = await JobListing.find({ status: "open" })
      .sort({ postedDate: -1 })
      .limit(20)
      .select("jobId postedDate status employerId")
      .explain("executionStats");
    rows.push(summarizeExplain("Public jobs feed", publicJobsExplain));

    // 2) Question list query (use a sample jobId when available)
    const sampleQuestion = await Question.findOne({}, { jobId: 1 }).lean();
    if (sampleQuestion?.jobId) {
      const questionExplain = await Question.find({ jobId: sampleQuestion.jobId })
        .sort({ createdAt: -1 })
        .limit(20)
        .select("questionId jobId createdAt askerId")
        .explain("executionStats");
      rows.push(summarizeExplain("Question list by jobId", questionExplain));
    } else {
      console.log("Skipping question explain: no Question documents found.");
    }

    // 3) User lookup by roleId (sample existing roleId)
    const sampleUser = await User.findOne(
      { roleId: { $exists: true, $ne: "" } },
      { roleId: 1 },
    ).lean();
    if (sampleUser?.roleId) {
      const roleLookupExplain = await User.findOne({ roleId: sampleUser.roleId })
        .select("userId roleId name picture")
        .explain("executionStats");
      rows.push(summarizeExplain("User roleId lookup", roleLookupExplain));
    } else {
      console.log("Skipping roleId explain: no users with roleId found.");
    }

    // 4) Admin complaints queue query
    const complaintExplain = await Complaint.find({ status: "Pending" })
      .sort({ updatedAt: -1 })
      .limit(20)
      .select("complaintId status updatedAt complainantId")
      .explain("executionStats");
    rows.push(summarizeExplain("Admin complaints queue", complaintExplain));

    console.log("\n=== EXPLAIN CHECKLIST REPORT ===");
    rows.forEach(printReportRow);

    const allHealthy = rows.every((row) => row.usesIndex && row.docsExaminedPerRow <= 5);
    console.log(" ");
    console.log(`Overall status: ${allHealthy ? "PASS" : "NEEDS ATTENTION"}`);
    console.log("Checklist:");
    console.log("- Winning plan should be index-backed (IXSCAN/FETCH). ");
    console.log("- totalDocsExamined should stay close to nReturned.");
    console.log("- executionTimeMillis should be monitored before/after index changes.");
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error("Explain checklist failed:", error.message);
  process.exitCode = 1;
});
