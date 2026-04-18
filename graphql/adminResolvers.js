/**
 * Admin Dashboard GraphQL Resolvers
 *
 * Mirrors the logic from adminController.js but exposes it
 * through GraphQL so the frontend can request only the fields it needs.
 * DataLoaders are used where appropriate for batching.
 */
const User = require("../models/user");
const Employer = require("../models/employer");
const Freelancer = require("../models/freelancer");
const JobListing = require("../models/job_listing");
const JobApplication = require("../models/job_application");
const Complaint = require("../models/complaint");
const Feedback = require("../models/Feedback");
const Quiz = require("../models/Quiz");
const Attempt = require("../models/Attempt");
const Blog = require("../models/blog");
const Moderator = require("../models/moderator");
const Subscription = require("../models/subscription");

const SHARED_RESUME_URL = "/uploads/resumes/shared-resume.pdf";

// ── Helpers ─────────────────────────────────────

function requireAdmin(session) {
  if (!session?.user || session.user.role !== "Admin") {
    throw new Error("Access denied. Admin access required.");
  }
}

function getTimeAgo(date) {
  const now = new Date();
  const diffInMs = now - new Date(date);
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInHours < 1) return "Just now";
  if (diffInHours < 24) return `${diffInHours} hours ago`;
  if (diffInDays === 1) return "Yesterday";
  if (diffInDays < 7) return `${diffInDays} days ago`;
  return new Date(date).toLocaleDateString();
}

function calculatePlatformFee(durationDays, applicantCount) {
  let rate = 5;
  if (durationDays <= 7) rate += 2;
  else if (durationDays <= 15) rate += 1;
  else if (durationDays <= 30) rate += 0;
  else if (durationDays <= 60) rate -= 0.5;
  else rate -= 1;
  if (applicantCount <= 5) rate -= 0.5;
  else if (applicantCount <= 15) rate += 0;
  else if (applicantCount <= 30) rate += 0.5;
  else rate += 1;
  return Math.max(2, Math.min(8, Math.round(rate * 10) / 10));
}

function encodeCursor(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

function decodeCursor(cursor) {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    if (!parsed?.createdAt || !parsed?.id) return null;
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id: parsed.id };
  } catch (_error) {
    return null;
  }
}

function encodePaymentCursor(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

function decodePaymentCursor(cursor) {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    if (!parsed?.updatedAt || !parsed?.jobObjectId || !parsed?.milestoneId) {
      return null;
    }
    const updatedAt = new Date(parsed.updatedAt);
    if (Number.isNaN(updatedAt.getTime())) return null;
    return {
      updatedAt,
      jobObjectId: parsed.jobObjectId,
      milestoneId: parsed.milestoneId,
    };
  } catch (_error) {
    return null;
  }
}

function encodePlatformFeeCursor(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

function decodePlatformFeeCursor(cursor) {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    if (!parsed?.postedDate || !parsed?.id) return null;
    const postedDate = new Date(parsed.postedDate);
    if (Number.isNaN(postedDate.getTime())) return null;
    return { postedDate, id: parsed.id };
  } catch (_error) {
    return null;
  }
}

function escapeRegex(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueSorted(values, numeric = false) {
  const uniqueValues = Array.from(
    new Set(values.filter((value) => value !== undefined && value !== null && value !== "")),
  );

  if (numeric) {
    return uniqueValues
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
  }

  return uniqueValues
    .map((value) => String(value))
    .sort((a, b) => a.localeCompare(b));
}

// ── Query Resolvers ─────────────────────────────

const adminResolvers = {
  // ──────────────────────────────────────────────
  //  DASHBOARD OVERVIEW
  // ──────────────────────────────────────────────

  adminDashboardOverview: async (_parent, _args, { session }) => {
    requireAdmin(session);

    const [
      totalUsers, totalFreelancers, totalEmployers, totalModerators, totalAdmins,
      totalJobs, activeJobs, completedJobs, closedJobs,
      totalApplications, pendingApplications, acceptedApplications, rejectedApplications,
      totalComplaints, pendingComplaints, resolvedComplaints,
      premiumUsers, basicUsers,
      totalQuizzes, totalAttempts, totalBlogs, totalFeedbacks,
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: "" } }),
      User.countDocuments({ role: "Freelancer" }),
      User.countDocuments({ role: "Employer" }),
      User.countDocuments({ role: "Moderator" }),
      User.countDocuments({ role: "Admin" }),
      JobListing.countDocuments(),
      JobListing.countDocuments({ status: { $in: ["open", "active", "in-progress"] } }),
      JobListing.countDocuments({ status: "completed" }),
      JobListing.countDocuments({ status: "closed" }),
      JobApplication.countDocuments(),
      JobApplication.countDocuments({ status: "Pending" }),
      JobApplication.countDocuments({ status: "Accepted" }),
      JobApplication.countDocuments({ status: "Rejected" }),
      Complaint.countDocuments(),
      Complaint.countDocuments({ status: "Pending" }),
      Complaint.countDocuments({ status: "Resolved" }),
      User.countDocuments({ subscription: "Premium" }),
      User.countDocuments({ subscription: "Basic", role: { $ne: "" } }),
      Quiz.countDocuments(),
      Attempt.countDocuments(),
      Blog.countDocuments(),
      Feedback.countDocuments(),
    ]);

    const [revenueData, budgetData, avgRatingData] = await Promise.all([
      JobListing.aggregate([
        { $unwind: "$milestones" },
        { $match: { "milestones.status": "paid" } },
        { $group: { _id: null, totalRevenue: { $sum: { $toDouble: "$milestones.payment" } }, totalPaidMilestones: { $sum: 1 } } },
      ]),
      JobListing.aggregate([
        { $group: { _id: null, totalBudget: { $sum: "$budget" } } },
      ]),
      Feedback.aggregate([
        { $group: { _id: null, avgRating: { $avg: "$rating" } } },
      ]),
    ]);

    return {
      users: { total: totalUsers, freelancers: totalFreelancers, employers: totalEmployers, moderators: totalModerators, admins: totalAdmins, premium: premiumUsers, basic: basicUsers },
      jobs: { total: totalJobs, active: activeJobs, completed: completedJobs, closed: closedJobs },
      applications: { total: totalApplications, pending: pendingApplications, accepted: acceptedApplications, rejected: rejectedApplications },
      complaints: { total: totalComplaints, pending: pendingComplaints, resolved: resolvedComplaints },
      revenue: { total: revenueData[0]?.totalRevenue || 0, totalBudget: budgetData[0]?.totalBudget || 0, paidMilestones: revenueData[0]?.totalPaidMilestones || 0 },
      quizzes: { total: totalQuizzes, attempts: totalAttempts },
      blogs: { total: totalBlogs },
      feedback: { total: totalFeedbacks, avgRating: avgRatingData[0] ? Math.round(avgRatingData[0].avgRating * 10) / 10 : 0 },
    };
  },

  // ──────────────────────────────────────────────
  //  DASHBOARD REVENUE
  // ──────────────────────────────────────────────

  adminDashboardRevenue: async (_parent, _args, { session }) => {
    requireAdmin(session);

    const PREMIUM_MONTHLY_PRICE = 868;
    const now = new Date();
    const monthsRange = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const shortMonth = d.toLocaleString("en-IN", { month: "short" });
      monthsRange.push({
        year: d.getFullYear(), month: d.getMonth() + 1,
        label: shortMonth + " '" + String(d.getFullYear()).slice(-2),
        startDate: d, endDate: endOfMonth,
      });
    }

    const premiumUsers = await User.find(
      { subscription: "Premium" },
      { subscriptionDuration: 1, subscriptionExpiryDate: 1, createdAt: 1 },
    ).lean();

    const allJobs = await JobListing.find({})
      .select("jobId budget postedDate applicationDeadline applicants status title employerId")
      .lean();

    const jobIds = allJobs.map((j) => j.jobId);
    const appCounts = await JobApplication.aggregate([
      { $match: { jobId: { $in: jobIds } } },
      { $group: { _id: "$jobId", count: { $sum: 1 } } },
    ]);
    const appCountMap = {};
    appCounts.forEach((a) => { appCountMap[a._id] = a.count; });

    const employerIds = [...new Set(allJobs.map((j) => j.employerId))];
    const employers = await Employer.find({ employerId: { $in: employerIds } })
      .select("employerId companyName userId").lean();
    const employerUserIds = employers.map((e) => e.userId);
    const employerUsers = await User.find({ userId: { $in: employerUserIds } })
      .select("userId name").lean();

    const jobFees = allJobs.map((job) => {
      const postedDate = new Date(job.postedDate);
      const deadline = new Date(job.applicationDeadline);
      const durationDays = Math.max(1, Math.ceil((deadline - postedDate) / (1000 * 60 * 60 * 24)));
      const applicantCount = appCountMap[job.jobId] || job.applicants || 0;
      const feeRate = calculatePlatformFee(durationDays, applicantCount);
      const feeAmount = (job.budget || 0) * (feeRate / 100);
      const employer = employers.find((e) => e.employerId === job.employerId);
      const empUser = employerUsers.find((u) => u.userId === employer?.userId);
      return {
        jobId: job.jobId, title: job.title, budget: job.budget,
        durationDays, applicantCount, feeRate,
        feeAmount: Math.round(feeAmount * 100) / 100,
        postedDate: job.postedDate, status: job.status,
        employerName: empUser?.name || "Unknown",
        companyName: employer?.companyName || "Unknown",
      };
    });

    const monthlyData = monthsRange.map((m) => {
      let subRevenue = 0;
      premiumUsers.forEach((u) => {
        if (u.subscriptionExpiryDate && u.subscriptionDuration) {
          const expiry = new Date(u.subscriptionExpiryDate);
          const startDate = new Date(expiry);
          startDate.setMonth(startDate.getMonth() - (u.subscriptionDuration || 1));
          if (startDate <= m.endDate && expiry >= m.startDate) subRevenue += PREMIUM_MONTHLY_PRICE;
        } else {
          if (new Date(u.createdAt) <= m.endDate) subRevenue += PREMIUM_MONTHLY_PRICE;
        }
      });

      let platformFeeRevenue = 0;
      const monthJobs = jobFees.filter((j) => {
        const pd = new Date(j.postedDate);
        return pd >= m.startDate && pd <= m.endDate;
      });
      monthJobs.forEach((j) => { platformFeeRevenue += j.feeAmount; });

      return {
        label: m.label, year: m.year, month: m.month,
        subscriptionRevenue: Math.round(subRevenue * 100) / 100,
        platformFeeRevenue: Math.round(platformFeeRevenue * 100) / 100,
        totalRevenue: Math.round((subRevenue + platformFeeRevenue) * 100) / 100,
        jobsPosted: monthJobs.length,
      };
    });

    const totalSubscriptionRevenue = monthlyData.reduce((s, m) => s + m.subscriptionRevenue, 0);
    const totalPlatformFees = monthlyData.reduce((s, m) => s + m.platformFeeRevenue, 0);
    const totalRevenue = totalSubscriptionRevenue + totalPlatformFees;
    const thisMonth = monthlyData[monthlyData.length - 1];
    const lastMonth = monthlyData.length >= 2 ? monthlyData[monthlyData.length - 2] : null;
    const revenueGrowth = lastMonth && lastMonth.totalRevenue > 0
      ? ((thisMonth.totalRevenue - lastMonth.totalRevenue) / lastMonth.totalRevenue) * 100 : 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalJobCount, completedJobs, totalApplications, acceptedApplications, recentJobCount, recentAppCount, activeUsers, totalUsers, premiumCount] = await Promise.all([
      JobListing.countDocuments(),
      JobListing.countDocuments({ status: "completed" }),
      JobApplication.countDocuments(),
      JobApplication.countDocuments({ status: "Accepted" }),
      JobListing.countDocuments({ postedDate: { $gte: thirtyDaysAgo } }),
      JobApplication.countDocuments({ appliedDate: { $gte: thirtyDaysAgo } }),
      User.countDocuments({ role: { $ne: "" }, updatedAt: { $gte: thirtyDaysAgo } }),
      User.countDocuments({ role: { $ne: "" } }),
      User.countDocuments({ subscription: "Premium" }),
    ]);

    const recentFeeJobs = jobFees
      .filter((j) => j.feeAmount > 0)
      .sort((a, b) => new Date(b.postedDate) - new Date(a.postedDate))
      .slice(0, 10);

    return {
      monthlyRevenue: monthlyData,
      totals: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        subscriptionRevenue: Math.round(totalSubscriptionRevenue * 100) / 100,
        platformFees: Math.round(totalPlatformFees * 100) / 100,
        thisMonthRevenue: thisMonth.totalRevenue,
        revenueGrowth: Math.round(revenueGrowth * 10) / 10,
      },
      engagement: {
        jobCompletionRate: totalJobCount > 0 ? Math.round((completedJobs / totalJobCount) * 100) : 0,
        hireRate: totalApplications > 0 ? Math.round((acceptedApplications / totalApplications) * 100) : 0,
        activeUsers, totalUsers, premiumUsers: premiumCount,
        conversionRate: totalUsers > 0 ? Math.round((premiumCount / totalUsers) * 100 * 10) / 10 : 0,
        recentJobs: recentJobCount, recentApplications: recentAppCount,
        avgJobsPerMonth: totalJobCount > 0 ? Math.round(totalJobCount / 12) : 0,
      },
      recentPlatformFees: recentFeeJobs,
      feeStructure: {
        baseRate: 2,
        description: "Platform fee is 2% for standard jobs and 4% for boosted jobs, plus an application cap fee of 0%–2%",
        range: "2.5% – 6%",
        tiers: {
          platform: [
            { range: "Standard job", modifier: "2%", label: "Standard" },
            { range: "Boosted job", modifier: "4%", label: "Boosted" },
          ],
          applicationCap: [
            { range: "≤ 10 applicants", modifier: "0%", label: "Strict" },
            { range: "≤ 25 applicants", modifier: "+0.5%", label: "Limited" },
            { range: "≤ 50 applicants", modifier: "+1%", label: "Moderate" },
            { range: "Unlimited", modifier: "+2%", label: "Open" },
          ],
        },
      },
    };
  },

  // ──────────────────────────────────────────────
  //  PLATFORM FEE COLLECTIONS (PAGINATED)
  // ──────────────────────────────────────────────

  adminPlatformFeeCollections: async (
    _parent,
    { first = 10, after = null },
    { session },
  ) => {
    requireAdmin(session);

    const normalizedFirst = Math.min(100, Math.max(1, Number(first) || 10));
    const cursor = after ? decodePlatformFeeCursor(after) : null;

    if (after && !cursor) {
      throw new Error("Invalid cursor");
    }

    const baseFilter = { budget: { $gt: 0 } };
    const queryFilter = cursor
      ? {
          ...baseFilter,
          $or: [
            { postedDate: { $lt: cursor.postedDate } },
            { postedDate: cursor.postedDate, _id: { $lt: cursor.id } },
          ],
        }
      : baseFilter;

    const [total, jobsRaw] = await Promise.all([
      JobListing.countDocuments(baseFilter),
      JobListing.find(queryFilter)
        .select(
          "_id jobId title budget postedDate applicationDeadline applicants status employerId",
        )
        .sort({ postedDate: -1, _id: -1 })
        .limit(normalizedFirst + 1)
        .lean(),
    ]);

    const hasNextPage = jobsRaw.length > normalizedFirst;
    const jobs = hasNextPage ? jobsRaw.slice(0, normalizedFirst) : jobsRaw;

    if (!jobs.length) {
      return {
        edges: [],
        pageInfo: { hasNextPage: false, endCursor: null },
        total,
      };
    }

    const jobIds = jobs.map((j) => j.jobId);
    const employerIds = [...new Set(jobs.map((j) => j.employerId))];

    const [appCounts, employers] = await Promise.all([
      JobApplication.aggregate([
        { $match: { jobId: { $in: jobIds } } },
        { $group: { _id: "$jobId", count: { $sum: 1 } } },
      ]),
      Employer.find({ employerId: { $in: employerIds } })
        .select("employerId companyName userId")
        .lean(),
    ]);

    const appCountMap = Object.fromEntries(
      appCounts.map((a) => [a._id, a.count]),
    );
    const employerMap = new Map(employers.map((e) => [e.employerId, e]));

    const employerUserIds = employers.map((e) => e.userId);
    const employerUsers = await User.find({ userId: { $in: employerUserIds } })
      .select("userId name")
      .lean();
    const employerUserMap = new Map(
      employerUsers.map((u) => [u.userId, u.name]),
    );

    const edges = jobs.map((job) => {
      const postedDate = new Date(job.postedDate);
      const deadline = new Date(job.applicationDeadline);
      const durationDays = Math.max(
        1,
        Math.ceil((deadline - postedDate) / (1000 * 60 * 60 * 24)) || 1,
      );
      const applicantCount = appCountMap[job.jobId] || job.applicants || 0;
      const feeRate = calculatePlatformFee(durationDays, applicantCount);
      const feeAmount = Math.round((job.budget || 0) * (feeRate / 100) * 100) / 100;
      const employer = employerMap.get(job.employerId);

      return {
        node: {
          jobId: job.jobId,
          title: job.title,
          budget: job.budget,
          durationDays,
          applicantCount,
          feeRate,
          feeAmount,
          postedDate: job.postedDate,
          status: job.status,
          employerName: employerUserMap.get(employer?.userId) || "Unknown",
          companyName: employer?.companyName || "Unknown",
        },
        cursor: encodePlatformFeeCursor({
          postedDate: job.postedDate,
          id: String(job._id),
        }),
      };
    });

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor: edges.length ? edges[edges.length - 1].cursor : null,
      },
      total,
    };
  },

  // ──────────────────────────────────────────────
  //  PAYMENTS
  // ──────────────────────────────────────────────

  adminPayments: async (
    _parent,
    {
      first = 25,
      after = null,
      search = "",
      jobTitleIn = null,
      milestoneIn = null,
      employerIn = null,
      freelancerIn = null,
      statusIn = null,
      sortBy = "date",
      sortOrder = "desc",
    },
    { session },
  ) => {
    requireAdmin(session);

    const normalizedFirst = Math.min(100, Math.max(1, Number(first) || 25));
    const allowedSortBy = new Set(["date", "amount", "jobTitle"]);
    const normalizedSortBy = allowedSortBy.has(sortBy) ? sortBy : "date";
    const normalizedSortOrder = String(sortOrder).toLowerCase() === "asc" ? "asc" : "desc";
    const sortDir = normalizedSortOrder === "asc" ? 1 : -1;

    const normalizeStatus = (value) => {
      const clean = String(value || "").trim().toLowerCase();
      if (clean === "paid") return "Paid";
      if (clean === "pending" || clean === "not-paid" || clean === "not paid") return "Pending";
      if (clean === "in progress" || clean === "in-progress") return "In Progress";
      return null;
    };

    const cleanJobTitleIn = Array.isArray(jobTitleIn) ? jobTitleIn.filter(Boolean) : [];
    const cleanMilestoneIn = Array.isArray(milestoneIn) ? milestoneIn.filter(Boolean) : [];
    const cleanEmployerIn = Array.isArray(employerIn) ? employerIn.filter(Boolean) : [];
    const cleanFreelancerIn = Array.isArray(freelancerIn) ? freelancerIn.filter(Boolean) : [];
    const cleanStatusIn = Array.isArray(statusIn)
      ? statusIn
          .map((value) => normalizeStatus(value))
          .filter(Boolean)
      : [];

    const andFilters = [];
    if (cleanJobTitleIn.length) andFilters.push({ jobTitle: { $in: cleanJobTitleIn } });
    if (cleanMilestoneIn.length) andFilters.push({ milestoneDescription: { $in: cleanMilestoneIn } });
    if (cleanEmployerIn.length) andFilters.push({ employerName: { $in: cleanEmployerIn } });
    if (cleanFreelancerIn.length) andFilters.push({ freelancerName: { $in: cleanFreelancerIn } });
    if (cleanStatusIn.length) andFilters.push({ paymentStatusLabel: { $in: cleanStatusIn } });

    const searchText = String(search || "").trim();
    if (searchText) {
      const regex = new RegExp(escapeRegex(searchText), "i");
      andFilters.push({
        $or: [
          { jobTitle: regex },
          { milestoneDescription: regex },
          { employerName: regex },
          { freelancerName: regex },
          { companyName: regex },
        ],
      });
    }

    const encodePaymentsCursor = (payload) =>
      Buffer.from(JSON.stringify(payload)).toString("base64");
    const decodePaymentsCursor = (cursorValue) => {
      try {
        const parsed = JSON.parse(Buffer.from(cursorValue, "base64").toString("utf8"));
        if (!parsed?.id || !parsed?.milestoneId || !parsed?.sortBy || !parsed?.sortOrder) {
          return null;
        }
        return parsed;
      } catch (_error) {
        return null;
      }
    };

    const cursor = after ? decodePaymentsCursor(after) : null;
    if (after && !cursor) {
      throw new Error("Invalid cursor");
    }
    if (
      cursor &&
      (cursor.sortBy !== normalizedSortBy || cursor.sortOrder !== normalizedSortOrder)
    ) {
      throw new Error("Invalid cursor for requested sorting");
    }

    const paymentStatuses = ["paid", "not-paid", "in-progress"];
    const commonStages = [
      { $match: { "milestones.status": { $in: paymentStatuses } } },
      { $unwind: "$milestones" },
      { $match: { "milestones.status": { $in: paymentStatuses } } },
      {
        $lookup: {
          from: "employers",
          localField: "employerId",
          foreignField: "employerId",
          as: "employer",
        },
      },
      {
        $unwind: {
          path: "$employer",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "employer.userId",
          foreignField: "userId",
          as: "employerUser",
        },
      },
      {
        $unwind: {
          path: "$employerUser",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "freelancers",
          localField: "assignedFreelancer.freelancerId",
          foreignField: "freelancerId",
          as: "freelancer",
        },
      },
      {
        $unwind: {
          path: "$freelancer",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "freelancer.userId",
          foreignField: "userId",
          as: "freelancerUser",
        },
      },
      {
        $unwind: {
          path: "$freelancerUser",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          jobObjectIdString: { $toString: "$_id" },
          jobTitle: { $ifNull: ["$title", "N/A"] },
          milestoneId: { $ifNull: [{ $toString: "$milestones.milestoneId" }, ""] },
          milestoneDescription: { $ifNull: ["$milestones.description", "N/A"] },
          milestonePaymentValue: {
            $convert: {
              input: "$milestones.payment",
              to: "double",
              onError: 0,
              onNull: 0,
            },
          },
          paymentStatusLabel: {
            $switch: {
              branches: [
                { case: { $eq: ["$milestones.status", "paid"] }, then: "Paid" },
                { case: { $eq: ["$milestones.status", "in-progress"] }, then: "In Progress" },
              ],
              default: "Pending",
            },
          },
          employerName: { $ifNull: ["$employerUser.name", "Unknown"] },
          companyName: { $ifNull: ["$employer.companyName", "Unknown"] },
          freelancerName: { $ifNull: ["$freelancerUser.name", "Unknown"] },
          dateValue: "$updatedAt",
        },
      },
      ...(andFilters.length
        ? [{ $match: andFilters.length === 1 ? andFilters[0] : { $and: andFilters } }]
        : []),
    ];

    const sortFieldMap = {
      date: "dateValue",
      amount: "milestonePaymentValue",
      jobTitle: "jobTitle",
    };
    const sortField = sortFieldMap[normalizedSortBy];
    const dataStages = [...commonStages];

    if (cursor) {
      const cmp = sortDir === 1 ? "$gt" : "$lt";
      const cursorValue =
        normalizedSortBy === "date"
          ? new Date(cursor.sortValue)
          : normalizedSortBy === "amount"
            ? Number(cursor.sortValue) || 0
            : String(cursor.sortValue || "");

      dataStages.push({
        $match: {
          $or: [
            { [sortField]: { [cmp]: cursorValue } },
            {
              [sortField]: cursorValue,
              jobObjectIdString: { [cmp]: String(cursor.id) },
            },
            {
              [sortField]: cursorValue,
              jobObjectIdString: String(cursor.id),
              milestoneId: { [cmp]: String(cursor.milestoneId || "") },
            },
          ],
        },
      });
    }

    dataStages.push(
      { $sort: { [sortField]: sortDir, jobObjectIdString: sortDir, milestoneId: sortDir } },
      { $limit: normalizedFirst + 1 },
      {
        $project: {
          jobId: 1,
          jobTitle: 1,
          milestoneId: 1,
          milestoneDescription: 1,
          amount: "$milestonePaymentValue",
          status: "$paymentStatusLabel",
          employerName: 1,
          companyName: 1,
          freelancerName: 1,
          date: "$dateValue",
          sortFieldValue: `$${sortField}`,
          jobObjectIdString: 1,
        },
      },
    );

    const [totalAgg, paymentRows, summaryAgg] = await Promise.all([
      JobListing.aggregate([...commonStages, { $count: "total" }]),
      JobListing.aggregate(dataStages),
      JobListing.aggregate([
        ...commonStages,
        {
          $group: {
            _id: "$paymentStatusLabel",
            amount: { $sum: "$milestonePaymentValue" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const total = totalAgg[0]?.total || 0;
    const summary = {
      totalTransactions: total,
      paidTotal: 0,
      pendingTotal: 0,
      inProgressTotal: 0,
      paidCount: 0,
      pendingCount: 0,
      inProgressCount: 0,
    };
    summaryAgg.forEach((item) => {
      if (item._id === "Paid") {
        summary.paidTotal = item.amount || 0;
        summary.paidCount = item.count || 0;
      }
      if (item._id === "Pending") {
        summary.pendingTotal = item.amount || 0;
        summary.pendingCount = item.count || 0;
      }
      if (item._id === "In Progress") {
        summary.inProgressTotal = item.amount || 0;
        summary.inProgressCount = item.count || 0;
      }
    });

    const hasNextPage = paymentRows.length > normalizedFirst;
    const rows = hasNextPage ? paymentRows.slice(0, normalizedFirst) : paymentRows;

    const edges = rows.map((row) => ({
      node: {
        jobId: row.jobId,
        jobTitle: row.jobTitle,
        milestoneId: row.milestoneId,
        milestoneDescription: row.milestoneDescription,
        amount: row.amount || 0,
        status: row.status,
        employerName: row.employerName,
        companyName: row.companyName,
        freelancerName: row.freelancerName,
        date: row.date?.toISOString?.() || row.date,
      },
      cursor: encodePaymentsCursor({
        sortBy: normalizedSortBy,
        sortOrder: normalizedSortOrder,
        sortValue:
          normalizedSortBy === "date"
            ? row.date?.toISOString?.() || row.date
            : row.sortFieldValue,
        id: row.jobObjectIdString,
        milestoneId: row.milestoneId,
      }),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor: edges.length ? edges[edges.length - 1].cursor : null,
      },
      total,
      summary,
    };
  },

  adminPaymentsMeta: async (_parent, _args, { session }) => {
    requireAdmin(session);

    const paymentStatuses = ["paid", "not-paid", "in-progress"];
    const baseStages = [
      { $match: { "milestones.status": { $in: paymentStatuses } } },
      { $unwind: "$milestones" },
      { $match: { "milestones.status": { $in: paymentStatuses } } },
      {
        $lookup: {
          from: "employers",
          localField: "employerId",
          foreignField: "employerId",
          as: "employer",
        },
      },
      {
        $unwind: {
          path: "$employer",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "employer.userId",
          foreignField: "userId",
          as: "employerUser",
        },
      },
      {
        $unwind: {
          path: "$employerUser",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "freelancers",
          localField: "assignedFreelancer.freelancerId",
          foreignField: "freelancerId",
          as: "freelancer",
        },
      },
      {
        $unwind: {
          path: "$freelancer",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "freelancer.userId",
          foreignField: "userId",
          as: "freelancerUser",
        },
      },
      {
        $unwind: {
          path: "$freelancerUser",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          jobTitle: { $ifNull: ["$title", "N/A"] },
          milestoneDescription: { $ifNull: ["$milestones.description", "N/A"] },
          milestonePaymentValue: {
            $convert: {
              input: "$milestones.payment",
              to: "double",
              onError: 0,
              onNull: 0,
            },
          },
          paymentStatusLabel: {
            $switch: {
              branches: [
                { case: { $eq: ["$milestones.status", "paid"] }, then: "Paid" },
                { case: { $eq: ["$milestones.status", "in-progress"] }, then: "In Progress" },
              ],
              default: "Pending",
            },
          },
          employerName: { $ifNull: ["$employerUser.name", "Unknown"] },
          freelancerName: { $ifNull: ["$freelancerUser.name", "Unknown"] },
        },
      },
    ];

    const [totalAgg, summaryAgg, optionsAgg] = await Promise.all([
      JobListing.aggregate([...baseStages, { $count: "total" }]),
      JobListing.aggregate([
        ...baseStages,
        {
          $group: {
            _id: "$paymentStatusLabel",
            amount: { $sum: "$milestonePaymentValue" },
            count: { $sum: 1 },
          },
        },
      ]),
      JobListing.aggregate([
        ...baseStages,
        {
          $group: {
            _id: null,
            jobs: { $addToSet: "$jobTitle" },
            milestones: { $addToSet: "$milestoneDescription" },
            employers: { $addToSet: "$employerName" },
            freelancers: { $addToSet: "$freelancerName" },
            statuses: { $addToSet: "$paymentStatusLabel" },
          },
        },
      ]),
    ]);

    const totalTransactions = totalAgg[0]?.total || 0;
    const summary = {
      totalTransactions,
      paidTotal: 0,
      pendingTotal: 0,
      inProgressTotal: 0,
      paidCount: 0,
      pendingCount: 0,
      inProgressCount: 0,
    };

    summaryAgg.forEach((item) => {
      if (item._id === "Paid") {
        summary.paidTotal = item.amount || 0;
        summary.paidCount = item.count || 0;
      }
      if (item._id === "Pending") {
        summary.pendingTotal = item.amount || 0;
        summary.pendingCount = item.count || 0;
      }
      if (item._id === "In Progress") {
        summary.inProgressTotal = item.amount || 0;
        summary.inProgressCount = item.count || 0;
      }
    });

    const options = optionsAgg[0] || {};
    return {
      summary,
      filterOptions: {
        jobs: uniqueSorted(options.jobs || []),
        milestones: uniqueSorted(options.milestones || []),
        employers: uniqueSorted(options.employers || []),
        freelancers: uniqueSorted(options.freelancers || []),
        statuses: uniqueSorted(options.statuses || []),
      },
    };
  },

  // ──────────────────────────────────────────────
  //  USERS
  // ──────────────────────────────────────────────

  adminUsers: async (
    _parent,
    {
      first = 25,
      after = null,
      search = "",
      roleIn = null,
      subscriptionIn = null,
      locationIn = null,
      ratingIn = null,
      sortBy = "createdAt",
      sortOrder = "desc",
    },
    { session },
  ) => {
    requireAdmin(session);

    const safeFirst = Math.min(100, Math.max(1, Number(first) || 25));
    const allowedSortFields = new Set(["createdAt", "name", "rating"]);
    const normalizedSortBy = allowedSortFields.has(sortBy)
      ? sortBy
      : "createdAt";
    const normalizedSortOrder = String(sortOrder).toLowerCase() === "asc"
      ? "asc"
      : "desc";
    const sortDir = normalizedSortOrder === "asc" ? 1 : -1;

    const baseFilter = { role: { $ne: "" } };
    const andFilters = [baseFilter];

    const cleanRoleIn = Array.isArray(roleIn)
      ? roleIn.filter(Boolean)
      : [];
    const cleanSubscriptionIn = Array.isArray(subscriptionIn)
      ? subscriptionIn.filter(Boolean)
      : [];
    const cleanLocationIn = Array.isArray(locationIn)
      ? locationIn.filter(Boolean)
      : [];
    const cleanRatingIn = Array.isArray(ratingIn)
      ? ratingIn
          .map((v) => Number(v))
          .filter((v) => Number.isFinite(v))
      : [];

    if (cleanRoleIn.length) {
      andFilters.push({ role: { $in: cleanRoleIn } });
    }
    if (cleanSubscriptionIn.length) {
      andFilters.push({ subscription: { $in: cleanSubscriptionIn } });
    }
    if (cleanLocationIn.length) {
      andFilters.push({ location: { $in: cleanLocationIn } });
    }
    if (cleanRatingIn.length) {
      andFilters.push({ rating: { $in: cleanRatingIn } });
    }

    const searchText = String(search || "").trim();
    if (searchText) {
      const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      andFilters.push({
        $or: [
          { name: regex },
          { email: regex },
          { location: regex },
        ],
      });
    }

    const encodeUserCursor = (payload) =>
      Buffer.from(JSON.stringify(payload)).toString("base64");
    const decodeUserCursor = (cursorValue) => {
      try {
        const parsed = JSON.parse(
          Buffer.from(cursorValue, "base64").toString("utf8"),
        );
        if (!parsed?.id || !parsed?.sortBy || !parsed?.sortOrder) return null;
        return parsed;
      } catch (_error) {
        return null;
      }
    };

    const cursor = after ? decodeUserCursor(after) : null;
    if (
      cursor &&
      (cursor.sortBy !== normalizedSortBy ||
        cursor.sortOrder !== normalizedSortOrder)
    ) {
      throw new Error("Invalid cursor for requested sorting");
    }

    const preCursorFilter =
      andFilters.length === 1 ? andFilters[0] : { $and: andFilters };
    const queryFilters = [...andFilters];

    if (cursor) {
      const cmp = sortDir === 1 ? "$gt" : "$lt";
      const cursorValue =
        normalizedSortBy === "createdAt"
          ? new Date(cursor.sortValue)
          : cursor.sortValue;

      queryFilters.push({
        $or: [
          { [normalizedSortBy]: { [cmp]: cursorValue } },
          {
            [normalizedSortBy]: cursorValue,
            _id: { [cmp]: cursor.id },
          },
        ],
      });
    }

    const queryFilter =
      queryFilters.length === 1 ? queryFilters[0] : { $and: queryFilters };
    const querySort = { [normalizedSortBy]: sortDir, _id: sortDir };

    const [usersRaw, total] = await Promise.all([
      User.find(queryFilter)
        .select("_id userId name email role subscription picture location rating createdAt subscriptionDuration subscriptionExpiryDate")
        .sort(querySort)
        .limit(safeFirst + 1)
        .lean(),
      User.countDocuments(preCursorFilter),
    ]);

    const hasNextPage = usersRaw.length > safeFirst;
    const users = hasNextPage ? usersRaw.slice(0, safeFirst) : usersRaw;

    if (!users.length) {
      return {
        edges: [],
        pageInfo: { hasNextPage: false, endCursor: null },
        total,
      };
    }

    const userIds = users.map((u) => u.userId);
    const [freelancers, employers, moderators] = await Promise.all([
      Freelancer.find({ userId: { $in: userIds } }).select("userId freelancerId").lean(),
      Employer.find({ userId: { $in: userIds } }).select("userId employerId").lean(),
      Moderator.find({ userId: { $in: userIds } }).select("userId moderatorId").lean(),
    ]);

    const flMap = Object.fromEntries(freelancers.map((f) => [f.userId, f.freelancerId]));
    const empMap = Object.fromEntries(employers.map((e) => [e.userId, e.employerId]));
    const modMap = Object.fromEntries(moderators.map((m) => [m.userId, m.moderatorId]));

    const edges = users.map((u) => {
      let roleId = null, profilePath = null;
      if (u.role === "Freelancer" && flMap[u.userId]) {
        roleId = flMap[u.userId]; profilePath = `/admin/freelancers/${roleId}`;
      } else if (u.role === "Employer" && empMap[u.userId]) {
        roleId = empMap[u.userId]; profilePath = `/admin/employers/${roleId}`;
      } else if (u.role === "Moderator" && modMap[u.userId]) {
        roleId = modMap[u.userId]; profilePath = `/admin/moderators/${roleId}`;
      }
      return {
        node: {
          ...u,
          roleId,
          profilePath,
          createdAt: u.createdAt?.toISOString?.() || u.createdAt,
          subscriptionExpiryDate:
            u.subscriptionExpiryDate?.toISOString?.() ||
            u.subscriptionExpiryDate,
        },
        cursor: encodeUserCursor({
          sortBy: normalizedSortBy,
          sortOrder: normalizedSortOrder,
          sortValue:
            normalizedSortBy === "createdAt"
              ? u.createdAt?.toISOString?.() || u.createdAt
              : u[normalizedSortBy],
          id: String(u._id),
        }),
      };
    });

    const endCursor = edges.length ? edges[edges.length - 1].cursor : null;

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor,
      },
      total,
    };
  },

  adminUsersMeta: async (_parent, _args, { session }) => {
    requireAdmin(session);

    const roleFilter = { role: { $ne: "" } };
    const [
      total,
      freelancers,
      employers,
      moderators,
      admins,
      roles,
      subscriptions,
      locations,
      ratings,
    ] = await Promise.all([
      User.countDocuments(roleFilter),
      User.countDocuments({ role: "Freelancer" }),
      User.countDocuments({ role: "Employer" }),
      User.countDocuments({ role: "Moderator" }),
      User.countDocuments({ role: "Admin" }),
      User.distinct("role", roleFilter),
      User.distinct("subscription", roleFilter),
      User.distinct("location", roleFilter),
      User.distinct("rating", roleFilter),
    ]);

    return {
      summary: {
        total,
        freelancers,
        employers,
        moderators,
        admins,
      },
      filterOptions: {
        roles: uniqueSorted(roles),
        subscriptions: uniqueSorted(subscriptions),
        locations: uniqueSorted(locations),
        ratings: uniqueSorted(ratings, true),
      },
    };
  },

  // ──────────────────────────────────────────────
  //  FREELANCERS LIST
  // ──────────────────────────────────────────────

  adminFreelancers: async (
    _parent,
    {
      first = 25,
      after = null,
      search = "",
      locationIn = null,
      ratingIn = null,
      subscriptionIn = null,
      statusIn = null,
      sortBy = "createdAt",
      sortOrder = "desc",
    },
    { session },
  ) => {
    requireAdmin(session);

    const normalizedFirst = Math.min(100, Math.max(1, Number(first) || 25));
    const allowedSort = new Set(["createdAt", "name", "rating", "applicationsCount"]);
    const normalizedSortBy = allowedSort.has(sortBy) ? sortBy : "createdAt";
    const normalizedSortOrder = String(sortOrder).toLowerCase() === "asc" ? "asc" : "desc";
    const sortDir = normalizedSortOrder === "asc" ? 1 : -1;

    const cleanLocationIn = Array.isArray(locationIn) ? locationIn.filter(Boolean) : [];
    const cleanRatingIn = Array.isArray(ratingIn)
      ? ratingIn.map((value) => Number(value)).filter((value) => Number.isFinite(value))
      : [];
    const cleanSubscriptionIn = Array.isArray(subscriptionIn) ? subscriptionIn.filter(Boolean) : [];
    const cleanStatusIn = Array.isArray(statusIn)
      ? statusIn.map((value) => String(value).toLowerCase()).filter((value) => ["working", "available"].includes(value))
      : [];

    const andConditions = [{ "user.role": "Freelancer" }];

    if (cleanLocationIn.length) {
      andConditions.push({ "user.location": { $in: cleanLocationIn } });
    }
    if (cleanRatingIn.length) {
      andConditions.push({ "user.rating": { $in: cleanRatingIn } });
    }
    if (cleanSubscriptionIn.length) {
      andConditions.push({ "user.subscription": { $in: cleanSubscriptionIn } });
    }

    const searchText = String(search || "").trim();
    if (searchText) {
      const regex = new RegExp(escapeRegex(searchText), "i");
      andConditions.push({
        $or: [
          { "user.name": regex },
          { "user.email": regex },
          { "user.location": regex },
          { "user.phone": regex },
        ],
      });
    }

    const baseMatch = andConditions.length === 1 ? andConditions[0] : { $and: andConditions };

    const encodeFreelancerCursor = (payload) =>
      Buffer.from(JSON.stringify(payload)).toString("base64");
    const decodeFreelancerCursor = (value) => {
      try {
        const parsed = JSON.parse(Buffer.from(value, "base64").toString("utf8"));
        if (!parsed?.id || !parsed?.sortBy || !parsed?.sortOrder) return null;
        return parsed;
      } catch (_error) {
        return null;
      }
    };

    const cursor = after ? decodeFreelancerCursor(after) : null;
    if (
      cursor &&
      (cursor.sortBy !== normalizedSortBy || cursor.sortOrder !== normalizedSortOrder)
    ) {
      throw new Error("Invalid cursor for requested sorting");
    }

    const sortFieldMap = {
      createdAt: "user.createdAt",
      name: "user.name",
      rating: "user.rating",
      applicationsCount: "applicationsCount",
    };
    const sortField = sortFieldMap[normalizedSortBy];

    const commonPipeline = [
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "userId",
          as: "user",
        },
      },
      { $unwind: "$user" },
      { $match: baseMatch },
      {
        $lookup: {
          from: "job_applications",
          let: { freelancerId: "$freelancerId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$freelancerId", "$$freelancerId"] } } },
            { $count: "count" },
          ],
          as: "applicationMeta",
        },
      },
      {
        $lookup: {
          from: "job_listings",
          let: { freelancerId: "$freelancerId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$assignedFreelancer.freelancerId", "$$freelancerId"] },
                    { $eq: ["$assignedFreelancer.status", "working"] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: "activeJobs",
        },
      },
      {
        $addFields: {
          applicationsCount: {
            $ifNull: [{ $arrayElemAt: ["$applicationMeta.count", 0] }, 0],
          },
          isCurrentlyWorking: { $gt: [{ $size: "$activeJobs" }, 0] },
        },
      },
    ];

    if (cleanStatusIn.length) {
      const wantsWorking = cleanStatusIn.includes("working");
      const wantsAvailable = cleanStatusIn.includes("available");
      if (wantsWorking && !wantsAvailable) {
        commonPipeline.push({ $match: { isCurrentlyWorking: true } });
      } else if (!wantsWorking && wantsAvailable) {
        commonPipeline.push({ $match: { isCurrentlyWorking: false } });
      }
    }

    const totalPipeline = [...commonPipeline, { $count: "count" }];

    const dataPipeline = [...commonPipeline];
    if (cursor) {
      const cmp = sortDir === 1 ? "$gt" : "$lt";
      const cursorValue = normalizedSortBy === "createdAt"
        ? new Date(cursor.sortValue)
        : cursor.sortValue;

      dataPipeline.push({
        $match: {
          $or: [
            { [sortField]: { [cmp]: cursorValue } },
            {
              [sortField]: cursorValue,
              freelancerId: { [cmp]: String(cursor.id) },
            },
          ],
        },
      });
    }

    dataPipeline.push(
      { $sort: { [sortField]: sortDir, freelancerId: sortDir } },
      { $limit: normalizedFirst + 1 },
      {
        $project: {
          freelancerId: 1,
          userId: 1,
          skills: 1,
          createdAt: 1,
          applicationsCount: 1,
          isCurrentlyWorking: 1,
          "user.name": 1,
          "user.email": 1,
          "user.phone": 1,
          "user.picture": 1,
          "user.location": 1,
          "user.rating": 1,
          "user.createdAt": 1,
          "user.subscription": 1,
          "user.subscriptionDuration": 1,
          "user.subscriptionExpiryDate": 1,
        },
      },
    );

    const [totalResult, rowsRaw] = await Promise.all([
      Freelancer.aggregate(totalPipeline),
      Freelancer.aggregate(dataPipeline),
    ]);

    const total = totalResult?.[0]?.count || 0;
    const hasNextPage = rowsRaw.length > normalizedFirst;
    const rows = hasNextPage ? rowsRaw.slice(0, normalizedFirst) : rowsRaw;

    const edges = rows.map((freelancer) => ({
      node: {
        freelancerId: freelancer.freelancerId,
        userId: freelancer.userId,
        name: freelancer.user?.name || "N/A",
        email: freelancer.user?.email || "N/A",
        phone: freelancer.user?.phone || "N/A",
        picture: freelancer.user?.picture || "",
        location: freelancer.user?.location || "N/A",
        rating: freelancer.user?.rating || 0,
        skills: freelancer.skills?.length || 0,
        subscription: freelancer.user?.subscription || "Basic",
        isPremium: freelancer.user?.subscription === "Premium",
        subscriptionDuration: freelancer.user?.subscriptionDuration || null,
        subscriptionExpiryDate:
          freelancer.user?.subscriptionExpiryDate?.toISOString?.() ||
          freelancer.user?.subscriptionExpiryDate ||
          null,
        applicationsCount: freelancer.applicationsCount || 0,
        isCurrentlyWorking: !!freelancer.isCurrentlyWorking,
        joinedDate:
          freelancer.user?.createdAt?.toISOString?.() ||
          freelancer.user?.createdAt ||
          freelancer.createdAt?.toISOString?.() ||
          freelancer.createdAt ||
          null,
      },
      cursor: encodeFreelancerCursor({
        sortBy: normalizedSortBy,
        sortOrder: normalizedSortOrder,
        sortValue:
          normalizedSortBy === "createdAt"
            ? freelancer.user?.createdAt?.toISOString?.() || freelancer.user?.createdAt
            : freelancer[normalizedSortBy] ?? freelancer.user?.[normalizedSortBy],
        id: freelancer.freelancerId,
      }),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor: edges.length ? edges[edges.length - 1].cursor : null,
      },
      total,
    };
  },

  adminFreelancersMeta: async (_parent, _args, { session }) => {
    requireAdmin(session);

    const [
      total,
      premium,
      locations,
      ratings,
      subscriptions,
      workingFreelancerIds,
    ] = await Promise.all([
      User.countDocuments({ role: "Freelancer" }),
      User.countDocuments({ role: "Freelancer", subscription: "Premium" }),
      User.distinct("location", { role: "Freelancer" }),
      User.distinct("rating", { role: "Freelancer" }),
      User.distinct("subscription", { role: "Freelancer" }),
      JobListing.distinct("assignedFreelancer.freelancerId", {
        "assignedFreelancer.freelancerId": { $exists: true, $ne: null },
        "assignedFreelancer.status": "working",
      }),
    ]);

    return {
      summary: {
        total,
        working: workingFreelancerIds.length,
        premium,
      },
      filterOptions: {
        locations: uniqueSorted(locations),
        ratings: uniqueSorted(ratings, true),
        subscriptions: uniqueSorted(subscriptions),
        statuses: ["Working", "Available"],
      },
    };
  },

  // ──────────────────────────────────────────────
  //  FREELANCER DETAIL
  // ──────────────────────────────────────────────

  adminFreelancerDetail: async (_parent, { freelancerId }, { session }) => {
    requireAdmin(session);

    const freelancer = await Freelancer.findOne({ freelancerId }).lean();
    if (!freelancer) throw new Error("Freelancer not found");

    const user = await User.findOne({ userId: freelancer.userId })
      .select("userId name email phone picture location rating createdAt subscription subscriptionDuration subscriptionExpiryDate aboutMe")
      .lean();

    const applications = await JobApplication.find({ freelancerId }).lean();
    const jobIds = applications.map((a) => a.jobId);
    const jobs = await JobListing.find({ jobId: { $in: jobIds } })
      .select("jobId title budget status employerId postedDate").lean();
    const empIds = jobs.map((j) => j.employerId);
    const empDocs = await Employer.find({ employerId: { $in: empIds } })
      .select("employerId companyName userId").lean();
    const empUserIds = empDocs.map((e) => e.userId);
    const empUsers = await User.find({ userId: { $in: empUserIds } })
      .select("userId name").lean();

    const activeJob = await JobListing.findOne({
      "assignedFreelancer.freelancerId": freelancerId,
      "assignedFreelancer.status": "working",
    }).select("jobId title").lean();

    const applicationsWithDetails = applications.map((app) => {
      const job = jobs.find((j) => j.jobId === app.jobId);
      const emp = empDocs.find((e) => e.employerId === job?.employerId);
      const empUser = empUsers.find((u) => u.userId === emp?.userId);
      return {
        applicationId: app.applicationId,
        jobTitle: job?.title || "N/A",
        companyName: emp?.companyName || "N/A",
        employerName: empUser?.name || "N/A",
        budget: job?.budget || 0,
        status: app.status,
        appliedDate: app.appliedDate?.toISOString?.() || app.appliedDate,
      };
    });

    return {
      freelancerId: freelancer.freelancerId, userId: freelancer.userId,
      name: user?.name || "N/A", email: user?.email || "N/A",
      phone: user?.phone || "N/A", picture: user?.picture || "",
      location: user?.location || "N/A", aboutMe: user?.aboutMe || "",
      rating: user?.rating || 0, subscription: user?.subscription || "Basic",
      subscriptionDuration: user?.subscriptionDuration || null,
      subscriptionExpiryDate: user?.subscriptionExpiryDate?.toISOString?.() || null,
      joinedDate: (user?.createdAt || freelancer.createdAt)?.toISOString?.() || null,
      skills: freelancer.skills || [],
      experience: (freelancer.experience || []).map((e) => JSON.stringify(e)),
      education: (freelancer.education || []).map((e) => JSON.stringify(e)),
      portfolio: (freelancer.portfolio || []).map((p) => JSON.stringify(p)),
      resume: SHARED_RESUME_URL,
      isCurrentlyWorking: !!activeJob,
      currentJobTitle: activeJob?.title || null,
      applicationsCount: applications.length,
      acceptedCount: applications.filter((a) => a.status === "Accepted").length,
      rejectedCount: applications.filter((a) => a.status === "Rejected").length,
      pendingCount: applications.filter((a) => a.status === "Pending").length,
      recentApplications: applicationsWithDetails.slice(0, 10),
    };
  },

  // ──────────────────────────────────────────────
  //  EMPLOYERS LIST
  // ──────────────────────────────────────────────

  adminEmployers: async (
    _parent,
    {
      first = 25,
      after = null,
      search = "",
      companyIn = null,
      locationIn = null,
      ratingIn = null,
      subscriptionIn = null,
      sortBy = "createdAt",
      sortOrder = "desc",
    },
    { session },
  ) => {
    requireAdmin(session);

    const normalizedFirst = Math.min(100, Math.max(1, Number(first) || 25));
    const allowedSort = new Set(["createdAt", "name", "rating", "jobListingsCount", "hiredCount"]);
    const normalizedSortBy = allowedSort.has(sortBy) ? sortBy : "createdAt";
    const normalizedSortOrder = String(sortOrder).toLowerCase() === "asc" ? "asc" : "desc";
    const sortDir = normalizedSortOrder === "asc" ? 1 : -1;

    const cleanCompanyIn = Array.isArray(companyIn) ? companyIn.filter(Boolean) : [];
    const cleanLocationIn = Array.isArray(locationIn) ? locationIn.filter(Boolean) : [];
    const cleanRatingIn = Array.isArray(ratingIn)
      ? ratingIn.map((value) => Number(value)).filter((value) => Number.isFinite(value))
      : [];
    const cleanSubscriptionIn = Array.isArray(subscriptionIn) ? subscriptionIn.filter(Boolean) : [];

    const andConditions = [{ "user.role": "Employer" }];
    if (cleanCompanyIn.length) {
      andConditions.push({ companyName: { $in: cleanCompanyIn } });
    }
    if (cleanLocationIn.length) {
      andConditions.push({ "user.location": { $in: cleanLocationIn } });
    }
    if (cleanRatingIn.length) {
      andConditions.push({ "user.rating": { $in: cleanRatingIn } });
    }
    if (cleanSubscriptionIn.length) {
      andConditions.push({ "user.subscription": { $in: cleanSubscriptionIn } });
    }

    const searchText = String(search || "").trim();
    if (searchText) {
      const regex = new RegExp(escapeRegex(searchText), "i");
      andConditions.push({
        $or: [
          { "user.name": regex },
          { "user.email": regex },
          { "user.phone": regex },
          { "user.location": regex },
          { companyName: regex },
        ],
      });
    }

    const baseMatch = andConditions.length === 1 ? andConditions[0] : { $and: andConditions };

    const encodeEmployerCursor = (payload) =>
      Buffer.from(JSON.stringify(payload)).toString("base64");
    const decodeEmployerCursor = (value) => {
      try {
        const parsed = JSON.parse(Buffer.from(value, "base64").toString("utf8"));
        if (!parsed?.id || !parsed?.sortBy || !parsed?.sortOrder) return null;
        return parsed;
      } catch (_error) {
        return null;
      }
    };

    const cursor = after ? decodeEmployerCursor(after) : null;
    if (
      cursor &&
      (cursor.sortBy !== normalizedSortBy || cursor.sortOrder !== normalizedSortOrder)
    ) {
      throw new Error("Invalid cursor for requested sorting");
    }

    const sortFieldMap = {
      createdAt: "user.createdAt",
      name: "user.name",
      rating: "user.rating",
      jobListingsCount: "jobListingsCount",
      hiredCount: "hiredCount",
    };
    const sortField = sortFieldMap[normalizedSortBy];

    const commonPipeline = [
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "userId",
          as: "user",
        },
      },
      { $unwind: "$user" },
      { $match: baseMatch },
      {
        $lookup: {
          from: "job_listings",
          let: { employerId: "$employerId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$employerId", "$$employerId"] } } },
            { $count: "count" },
          ],
          as: "jobMeta",
        },
      },
      {
        $addFields: {
          jobListingsCount: {
            $ifNull: [{ $arrayElemAt: ["$jobMeta.count", 0] }, 0],
          },
          currentHires: { $size: { $ifNull: ["$currentFreelancers", []] } },
          pastHires: { $size: { $ifNull: ["$previouslyWorkedFreelancers", []] } },
        },
      },
      {
        $addFields: {
          hiredCount: { $add: ["$currentHires", "$pastHires"] },
        },
      },
    ];

    const totalPipeline = [...commonPipeline, { $count: "count" }];
    const dataPipeline = [...commonPipeline];

    if (cursor) {
      const cmp = sortDir === 1 ? "$gt" : "$lt";
      const cursorValue = normalizedSortBy === "createdAt"
        ? new Date(cursor.sortValue)
        : cursor.sortValue;

      dataPipeline.push({
        $match: {
          $or: [
            { [sortField]: { [cmp]: cursorValue } },
            {
              [sortField]: cursorValue,
              employerId: { [cmp]: String(cursor.id) },
            },
          ],
        },
      });
    }

    dataPipeline.push(
      { $sort: { [sortField]: sortDir, employerId: sortDir } },
      { $limit: normalizedFirst + 1 },
      {
        $project: {
          employerId: 1,
          userId: 1,
          companyName: 1,
          createdAt: 1,
          jobListingsCount: 1,
          hiredCount: 1,
          currentHires: 1,
          pastHires: 1,
          "user.name": 1,
          "user.email": 1,
          "user.phone": 1,
          "user.picture": 1,
          "user.location": 1,
          "user.rating": 1,
          "user.createdAt": 1,
          "user.subscription": 1,
          "user.subscriptionDuration": 1,
          "user.subscriptionExpiryDate": 1,
        },
      },
    );

    const [totalResult, rowsRaw] = await Promise.all([
      Employer.aggregate(totalPipeline),
      Employer.aggregate(dataPipeline),
    ]);

    const total = totalResult?.[0]?.count || 0;
    const hasNextPage = rowsRaw.length > normalizedFirst;
    const rows = hasNextPage ? rowsRaw.slice(0, normalizedFirst) : rowsRaw;

    const edges = rows.map((employer) => ({
      node: {
        employerId: employer.employerId,
        userId: employer.userId,
        name: employer.user?.name || "N/A",
        email: employer.user?.email || "N/A",
        phone: employer.user?.phone || "N/A",
        picture: employer.user?.picture || "",
        location: employer.user?.location || "N/A",
        companyName: employer.companyName || "N/A",
        rating: employer.user?.rating || 0,
        subscription: employer.user?.subscription || "Basic",
        isPremium: employer.user?.subscription === "Premium",
        subscriptionDuration: employer.user?.subscriptionDuration || null,
        subscriptionExpiryDate:
          employer.user?.subscriptionExpiryDate?.toISOString?.() ||
          employer.user?.subscriptionExpiryDate ||
          null,
        jobListingsCount: employer.jobListingsCount || 0,
        hiredCount: employer.hiredCount || 0,
        currentHires: employer.currentHires || 0,
        pastHires: employer.pastHires || 0,
        joinedDate:
          employer.user?.createdAt?.toISOString?.() ||
          employer.user?.createdAt ||
          employer.createdAt?.toISOString?.() ||
          employer.createdAt ||
          null,
      },
      cursor: encodeEmployerCursor({
        sortBy: normalizedSortBy,
        sortOrder: normalizedSortOrder,
        sortValue:
          normalizedSortBy === "createdAt"
            ? employer.user?.createdAt?.toISOString?.() || employer.user?.createdAt
            : employer[normalizedSortBy] ?? employer.user?.[normalizedSortBy],
        id: employer.employerId,
      }),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor: edges.length ? edges[edges.length - 1].cursor : null,
      },
      total,
    };
  },

  adminEmployersMeta: async (_parent, _args, { session }) => {
    requireAdmin(session);

    const [
      total,
      premium,
      companies,
      locations,
      ratings,
      subscriptions,
      totalJobListings,
    ] = await Promise.all([
      User.countDocuments({ role: "Employer" }),
      User.countDocuments({ role: "Employer", subscription: "Premium" }),
      Employer.distinct("companyName", {}),
      User.distinct("location", { role: "Employer" }),
      User.distinct("rating", { role: "Employer" }),
      User.distinct("subscription", { role: "Employer" }),
      JobListing.countDocuments({}),
    ]);

    return {
      summary: {
        total,
        premium,
        totalJobListings,
      },
      filterOptions: {
        companies: uniqueSorted(companies),
        locations: uniqueSorted(locations),
        ratings: uniqueSorted(ratings, true),
        subscriptions: uniqueSorted(subscriptions),
      },
    };
  },

  adminModerators: async (
    _parent,
    {
      first = 25,
      after = null,
      search = "",
      locationIn = null,
      sortBy = "createdAt",
      sortOrder = "desc",
    },
    { session },
  ) => {
    requireAdmin(session);

    const normalizedFirst = Math.min(100, Math.max(1, Number(first) || 25));
    const normalizedSortBy = ["createdAt", "name"].includes(sortBy) ? sortBy : "createdAt";
    const normalizedSortOrder = String(sortOrder).toLowerCase() === "asc" ? "asc" : "desc";
    const sortDir = normalizedSortOrder === "asc" ? 1 : -1;

    const cleanLocationIn = Array.isArray(locationIn) ? locationIn.filter(Boolean) : [];
    const andFilters = [{ role: "Moderator" }];

    if (cleanLocationIn.length) {
      andFilters.push({ location: { $in: cleanLocationIn } });
    }

    const searchText = String(search || "").trim();
    if (searchText) {
      const regex = new RegExp(escapeRegex(searchText), "i");
      andFilters.push({
        $or: [
          { name: regex },
          { email: regex },
          { location: regex },
        ],
      });
    }

    const preCursorFilter = andFilters.length === 1 ? andFilters[0] : { $and: andFilters };

    const encodeModeratorCursor = (payload) =>
      Buffer.from(JSON.stringify(payload)).toString("base64");
    const decodeModeratorCursor = (value) => {
      try {
        const parsed = JSON.parse(Buffer.from(value, "base64").toString("utf8"));
        if (!parsed?.id || !parsed?.sortBy || !parsed?.sortOrder) return null;
        return parsed;
      } catch (_error) {
        return null;
      }
    };

    const cursor = after ? decodeModeratorCursor(after) : null;
    if (
      cursor &&
      (cursor.sortBy !== normalizedSortBy || cursor.sortOrder !== normalizedSortOrder)
    ) {
      throw new Error("Invalid cursor for requested sorting");
    }

    const queryFilters = [...andFilters];
    if (cursor) {
      const cmp = sortDir === 1 ? "$gt" : "$lt";
      const cursorValue = normalizedSortBy === "createdAt"
        ? new Date(cursor.sortValue)
        : cursor.sortValue;

      queryFilters.push({
        $or: [
          { [normalizedSortBy]: { [cmp]: cursorValue } },
          { [normalizedSortBy]: cursorValue, userId: { [cmp]: String(cursor.id) } },
        ],
      });
    }

    const queryFilter = queryFilters.length === 1 ? queryFilters[0] : { $and: queryFilters };
    const [usersRaw, total] = await Promise.all([
      User.find(queryFilter)
        .select("userId roleId name email picture location createdAt")
        .sort({ [normalizedSortBy]: sortDir, userId: sortDir })
        .limit(normalizedFirst + 1)
        .lean(),
      User.countDocuments(preCursorFilter),
    ]);

    const hasNextPage = usersRaw.length > normalizedFirst;
    const users = hasNextPage ? usersRaw.slice(0, normalizedFirst) : usersRaw;

    if (!users.length) {
      return {
        edges: [],
        pageInfo: { hasNextPage: false, endCursor: null },
        total,
      };
    }

    const moderatorDocs = await Moderator.find({ userId: { $in: users.map((user) => user.userId) } })
      .select("moderatorId userId")
      .lean();
    const moderatorByUserId = new Map(
      moderatorDocs.map((moderator) => [moderator.userId, moderator]),
    );

    const [resolvedComplaints, totalComplaints, blogsCreated] = await Promise.all([
      Complaint.countDocuments({
        status: "Resolved",
        resolvedAt: { $exists: true, $ne: null },
      }),
      Complaint.countDocuments({}),
      Blog.countDocuments({}),
    ]);

    const edges = users.map((user) => {
      const moderator = moderatorByUserId.get(user.userId);
      const moderatorId = moderator?.moderatorId || user.roleId || user.userId;

      return {
        node: {
          moderatorId,
          userId: user.userId,
          name: user.name || "N/A",
          email: user.email || "N/A",
          picture: user.picture || "",
          location: user.location || "N/A",
          joinedDate: user.createdAt?.toISOString?.() || user.createdAt || null,
          complaintsResolved: resolvedComplaints,
          totalComplaints: totalComplaints,
          blogsCreated,
        },
        cursor: encodeModeratorCursor({
          sortBy: normalizedSortBy,
          sortOrder: normalizedSortOrder,
          sortValue:
            normalizedSortBy === "createdAt"
              ? user.createdAt?.toISOString?.() || user.createdAt
              : user[normalizedSortBy],
          id: user.userId,
        }),
      };
    });

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor: edges.length ? edges[edges.length - 1].cursor : null,
      },
      total,
    };
  },

  adminModeratorsMeta: async (_parent, _args, { session }) => {
    requireAdmin(session);

    const [total, locations, complaintsResolved, totalComplaints, blogsCreated] = await Promise.all([
      User.countDocuments({ role: "Moderator" }),
      User.distinct("location", { role: "Moderator" }),
      Complaint.countDocuments({
        status: "Resolved",
        resolvedAt: { $exists: true, $ne: null },
      }),
      Complaint.countDocuments({}),
      Blog.countDocuments({}),
    ]);

    return {
      summary: {
        total,
        complaintsResolved,
        totalComplaints,
        blogsCreated,
      },
      filterOptions: {
        locations: uniqueSorted(locations),
      },
    };
  },

  // ──────────────────────────────────────────────
  //  EMPLOYER DETAIL
  // ──────────────────────────────────────────────

  adminEmployerDetail: async (_parent, { employerId }, { session }) => {
    requireAdmin(session);

    const employer = await Employer.findOne({ employerId }).lean();
    if (!employer) throw new Error("Employer not found");

    const user = await User.findOne({ userId: employer.userId })
      .select("userId name email phone picture location rating createdAt subscription subscriptionDuration subscriptionExpiryDate aboutMe")
      .lean();

    const jobs = await JobListing.find({ employerId })
      .select("jobId title budget status jobType experienceLevel postedDate applicationDeadline location assignedFreelancer")
      .lean();

    const jobIds = jobs.map((j) => j.jobId);
    const appCounts = await JobApplication.aggregate([
      { $match: { jobId: { $in: jobIds } } },
      { $group: { _id: "$jobId", count: { $sum: 1 } } },
    ]);
    const appCountMap = {};
    appCounts.forEach((item) => { appCountMap[item._id] = item.count; });

    const currentFLIds = (employer.currentFreelancers || []).map((f) => f.freelancerId);
    const pastFLIds = employer.previouslyWorkedFreelancers || [];
    const allFLIds = [...new Set([...currentFLIds, ...pastFLIds])];

    const flDocs = await Freelancer.find({ freelancerId: { $in: allFLIds } })
      .select("freelancerId userId").lean();
    const flUserIds = flDocs.map((f) => f.userId);
    const flUsers = await User.find({ userId: { $in: flUserIds } })
      .select("userId name email picture rating").lean();

    const buildFL = (id) => {
      const fl = flDocs.find((f) => f.freelancerId === id);
      const u = flUsers.find((u) => u.userId === fl?.userId);
      const currentEntry = (employer.currentFreelancers || []).find((f) => f.freelancerId === id);
      return {
        freelancerId: id, name: u?.name || "N/A",
        email: u?.email || "", picture: u?.picture || "",
        rating: u?.rating || 0,
        startDate: currentEntry?.startDate?.toISOString?.() || currentEntry?.startDate || null,
      };
    };

    return {
      employerId: employer.employerId, userId: employer.userId,
      name: user?.name || "N/A", email: user?.email || "N/A",
      phone: user?.phone || "N/A", picture: user?.picture || "",
      location: user?.location || "N/A", aboutMe: user?.aboutMe || "",
      companyName: employer.companyName || "N/A",
      websiteLink: employer.websiteLink || "",
      rating: user?.rating || 0, subscription: user?.subscription || "Basic",
      subscriptionDuration: user?.subscriptionDuration || null,
      subscriptionExpiryDate: user?.subscriptionExpiryDate?.toISOString?.() || null,
      joinedDate: (user?.createdAt || employer.createdAt)?.toISOString?.() || null,
      jobListingsCount: jobs.length,
      currentHiresCount: currentFLIds.length,
      pastHiresCount: pastFLIds.length,
      jobs: jobs.map((j) => ({
        jobId: j.jobId, title: j.title, budget: j.budget,
        status: j.status, jobType: j.jobType, experienceLevel: j.experienceLevel,
        location: j.location, postedDate: j.postedDate,
        applicationDeadline: j.applicationDeadline,
        applicantsCount: appCountMap[j.jobId] || 0,
        hasAssignedFreelancer: !!j.assignedFreelancer?.freelancerId,
      })),
      currentFreelancers: currentFLIds.map(buildFL),
      pastFreelancers: pastFLIds.map(buildFL),
    };
  },

  // ──────────────────────────────────────────────
  //  STATISTICS
  // ──────────────────────────────────────────────

  adminStatistics: async (_parent, _args, { session }) => {
    requireAdmin(session);

    const [
      userGrowth, jobsByStatus, jobsByType, jobsByExperience,
      applicationsByStatus, complaintsByStatus, complaintsByType,
      complaintsByPriority, topFreelancers, topEmployers,
      avgBudgetByType, subscriptionDist,
    ] = await Promise.all([
      User.aggregate([
        { $match: { role: { $ne: "" } } },
        { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        { $limit: 12 },
      ]),
      JobListing.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      JobListing.aggregate([{ $group: { _id: "$jobType", count: { $sum: 1 } } }]),
      JobListing.aggregate([{ $group: { _id: "$experienceLevel", count: { $sum: 1 } } }]),
      JobApplication.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Complaint.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Complaint.aggregate([{ $group: { _id: "$complaintType", count: { $sum: 1 } } }]),
      Complaint.aggregate([{ $group: { _id: "$priority", count: { $sum: 1 } } }]),
      User.find({ role: "Freelancer" }).sort({ rating: -1 }).limit(10)
        .select("userId name email rating picture subscription").lean(),
      User.find({ role: "Employer" }).sort({ rating: -1 }).limit(10)
        .select("userId name email rating picture subscription").lean(),
      JobListing.aggregate([{
        $group: { _id: "$jobType", avgBudget: { $avg: "$budget" }, maxBudget: { $max: "$budget" }, minBudget: { $min: "$budget" } },
      }]),
      User.aggregate([
        { $match: { role: { $ne: "" } } },
        { $group: { _id: { role: "$role", subscription: "$subscription" }, count: { $sum: 1 } } },
      ]),
    ]);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const [recentSignups, newJobsThisMonth] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo }, role: { $ne: "" } }),
      JobListing.countDocuments({ postedDate: { $gte: thirtyDaysAgo } }),
    ]);

    const mapBucket = (arr) => arr.map((a) => ({ key: a._id || "Unknown", count: a.count }));

    return {
      userGrowth: userGrowth.map((ug) => ({ year: ug._id.year, month: ug._id.month, count: ug.count })),
      jobsByStatus: mapBucket(jobsByStatus),
      jobsByType: mapBucket(jobsByType),
      jobsByExperience: mapBucket(jobsByExperience),
      applicationsByStatus: mapBucket(applicationsByStatus),
      complaintsByStatus: mapBucket(complaintsByStatus),
      complaintsByType: mapBucket(complaintsByType),
      complaintsByPriority: mapBucket(complaintsByPriority),
      topFreelancers, topEmployers,
      avgBudgetByType: avgBudgetByType.map((a) => ({ key: a._id || "Unknown", avgBudget: a.avgBudget, maxBudget: a.maxBudget, minBudget: a.minBudget })),
      subscriptionDist: subscriptionDist.map((s) => ({ role: s._id.role, subscription: s._id.subscription, count: s.count })),
      recentSignups, newJobsThisMonth,
    };
  },

  // ──────────────────────────────────────────────
  //  ACTIVITIES
  // ──────────────────────────────────────────────

  adminActivities: async (_parent, _args, { session }) => {
    requireAdmin(session);

    const activities = [];

    const [recentUsers, resolvedComplaints, recentJobs, recentApplications] = await Promise.all([
      User.find({ role: { $ne: "" } }).sort({ createdAt: -1 }).limit(5).select("name role createdAt").lean(),
      Complaint.find({ status: "Resolved", resolvedAt: { $exists: true, $ne: null } })
        .sort({ resolvedAt: -1 }).limit(5).lean(),
      JobListing.find({}).sort({ postedDate: -1 }).limit(5).select("title postedDate status").lean(),
      JobApplication.find({}).sort({ appliedDate: -1 }).limit(5).lean(),
    ]);

    recentUsers.forEach((u) => activities.push({ type: "user", title: `New ${u.role} registered: ${u.name}`, time: getTimeAgo(u.createdAt), icon: "user", _ts: u.createdAt }));
    resolvedComplaints.forEach((c) => activities.push({ type: "complaint", title: `Complaint resolved: ${c.subject}`, time: getTimeAgo(c.resolvedAt), icon: "complaint", _ts: c.resolvedAt }));
    recentJobs.forEach((j) => activities.push({ type: "job", title: `Job posted: ${j.title}`, time: getTimeAgo(j.postedDate), icon: "job", _ts: j.postedDate }));

    const appJobIds = recentApplications.map((a) => a.jobId);
    const appJobs = await JobListing.find({ jobId: { $in: appJobIds } }).select("jobId title").lean();
    recentApplications.forEach((a) => {
      const job = appJobs.find((j) => j.jobId === a.jobId);
      activities.push({ type: "application", title: `New application for: ${job?.title || "Unknown Job"}`, time: getTimeAgo(a.appliedDate), icon: "application", _ts: a.appliedDate });
    });

    activities.sort((a, b) => new Date(b._ts) - new Date(a._ts));
    return activities.slice(0, 10).map(({ _ts, ...rest }) => rest);
  },
};

module.exports = adminResolvers;
