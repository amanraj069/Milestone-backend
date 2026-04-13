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

  adminPayments: async (_parent, { first = 25, after = null }, { session }) => {
    requireAdmin(session);

    const normalizedFirst = Math.min(100, Math.max(1, Number(first) || 25));
    const cursor = after ? decodePaymentCursor(after) : null;
    if (after && !cursor) {
      throw new Error("Invalid cursor");
    }

    const paymentStatuses = ["paid", "not-paid", "in-progress"];
    const cursorMatch = cursor
      ? {
          $or: [
            { updatedAt: { $lt: cursor.updatedAt } },
            { updatedAt: cursor.updatedAt, _id: { $lt: cursor.jobObjectId } },
            {
              updatedAt: cursor.updatedAt,
              _id: cursor.jobObjectId,
              "milestones.milestoneId": { $lt: cursor.milestoneId },
            },
          ],
        }
      : {};

    const [totalAgg, paymentRows, summaryAgg] = await Promise.all([
      JobListing.aggregate([
        { $match: { "milestones.status": { $in: paymentStatuses } } },
        { $unwind: "$milestones" },
        { $match: { "milestones.status": { $in: paymentStatuses } } },
        { $count: "total" },
      ]),
      JobListing.aggregate([
        { $match: { "milestones.status": { $in: paymentStatuses } } },
        { $unwind: "$milestones" },
        { $match: { "milestones.status": { $in: paymentStatuses } } },
        ...(cursor ? [{ $match: cursorMatch }] : []),
        { $sort: { updatedAt: -1, _id: -1, "milestones.milestoneId": -1 } },
        { $limit: normalizedFirst + 1 },
        {
          $project: {
            _id: 1,
            jobId: 1,
            title: 1,
            employerId: 1,
            assignedFreelancer: 1,
            updatedAt: 1,
            milestoneId: "$milestones.milestoneId",
            milestoneDescription: "$milestones.description",
            milestonePayment: "$milestones.payment",
            milestoneStatus: "$milestones.status",
          },
        },
      ]),
      JobListing.aggregate([
        { $match: { "milestones.status": { $in: paymentStatuses } } },
        { $unwind: "$milestones" },
        { $match: { "milestones.status": { $in: paymentStatuses } } },
        {
          $group: {
            _id: "$milestones.status",
            amount: { $sum: { $toDouble: "$milestones.payment" } },
          },
        },
      ]),
    ]);

    const total = totalAgg[0]?.total || 0;
    const summary = {
      paidTotal: 0,
      pendingTotal: 0,
      inProgressTotal: 0,
    };
    summaryAgg.forEach((item) => {
      if (item._id === "paid") summary.paidTotal = item.amount || 0;
      if (item._id === "not-paid") summary.pendingTotal = item.amount || 0;
      if (item._id === "in-progress") summary.inProgressTotal = item.amount || 0;
    });

    const hasNextPage = paymentRows.length > normalizedFirst;
    const rows = hasNextPage ? paymentRows.slice(0, normalizedFirst) : paymentRows;

    if (!rows.length) {
      return {
        edges: [],
        pageInfo: { hasNextPage: false, endCursor: null },
        total,
        summary,
      };
    }

    const empIds = [...new Set(rows.map((r) => r.employerId).filter(Boolean))];
    const flIds = [
      ...new Set(
        rows
          .map((r) => r.assignedFreelancer?.freelancerId)
          .filter(Boolean),
      ),
    ];

    const [employers, freelancers] = await Promise.all([
      Employer.find({ employerId: { $in: empIds } })
        .select("employerId companyName userId")
        .lean(),
      Freelancer.find({ freelancerId: { $in: flIds } })
        .select("freelancerId userId")
        .lean(),
    ]);

    const employerMap = new Map(employers.map((e) => [e.employerId, e]));
    const freelancerMap = new Map(freelancers.map((f) => [f.freelancerId, f]));

    const allUserIds = [
      ...new Set([
        ...employers.map((e) => e.userId),
        ...freelancers.map((f) => f.userId),
      ]),
    ];
    const users = await User.find({ userId: { $in: allUserIds } })
      .select("userId name")
      .lean();
    const userMap = new Map(users.map((u) => [u.userId, u]));

    const edges = rows.map((row) => {
      const employer = employerMap.get(row.employerId);
      const employerUser = employer ? userMap.get(employer.userId) : null;
      const freelancer = freelancerMap.get(row.assignedFreelancer?.freelancerId);
      const freelancerUser = freelancer ? userMap.get(freelancer.userId) : null;

      const status =
        row.milestoneStatus === "paid"
          ? "Paid"
          : row.milestoneStatus === "in-progress"
            ? "In Progress"
            : "Pending";

      return {
        node: {
          jobId: row.jobId,
          jobTitle: row.title,
          milestoneId: row.milestoneId,
          milestoneDescription: row.milestoneDescription,
          amount: parseFloat(row.milestonePayment) || 0,
          status,
          employerName: employerUser?.name || "Unknown",
          companyName: employer?.companyName || "Unknown",
          freelancerName: freelancerUser?.name || "Unknown",
          date: row.updatedAt?.toISOString?.() || row.updatedAt,
        },
        cursor: encodePaymentCursor({
          updatedAt: row.updatedAt,
          jobObjectId: String(row._id),
          milestoneId: String(row.milestoneId || ""),
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
      summary,
    };
  },

  // ──────────────────────────────────────────────
  //  USERS
  // ──────────────────────────────────────────────

  adminUsers: async (_parent, { first = 25, after = null }, { session }) => {
    requireAdmin(session);

    const safeFirst = Math.min(100, Math.max(1, Number(first) || 25));
    const baseFilter = { role: { $ne: "" } };
    const cursor = after ? decodeCursor(after) : null;

    const queryFilter = cursor
      ? {
          ...baseFilter,
          $or: [
            { createdAt: { $lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
          ],
        }
      : baseFilter;

    const [usersRaw, total] = await Promise.all([
      User.find(queryFilter)
        .select("_id userId name email role subscription picture location rating createdAt subscriptionDuration subscriptionExpiryDate")
        .sort({ createdAt: -1, _id: -1 })
        .limit(safeFirst + 1)
        .lean(),
      User.countDocuments(baseFilter),
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
        cursor: encodeCursor({
          createdAt: u.createdAt,
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

  // ──────────────────────────────────────────────
  //  FREELANCERS LIST
  // ──────────────────────────────────────────────

  adminFreelancers: async (_parent, { first = 25, after = null }, { session }) => {
    requireAdmin(session);

    const normalizedFirst = Math.min(100, Math.max(1, first || 25));
    const cursor = after ? decodeCursor(after) : null;
    const query = {};

    if (after && !cursor) {
      throw new Error("Invalid cursor");
    }

    if (cursor) {
      query.$or = [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
      ];
    }

    const [total, slice] = await Promise.all([
      Freelancer.countDocuments({}),
      Freelancer.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .limit(normalizedFirst + 1)
        .select("freelancerId userId skills createdAt")
        .lean(),
    ]);

    const hasNextPage = slice.length > normalizedFirst;
    const freelancers = hasNextPage ? slice.slice(0, normalizedFirst) : slice;

    if (!freelancers.length) {
      return {
        edges: [],
        pageInfo: { hasNextPage: false, endCursor: null },
        total,
      };
    }

    const freelancerUserIds = freelancers.map((f) => f.userId);
    const roleIds = freelancers.map((f) => f.freelancerId);

    const [users, applicationCounts, activeJobs] = await Promise.all([
      User.find({ userId: { $in: freelancerUserIds } })
        .select("userId name email phone picture location rating createdAt subscription subscriptionDuration subscriptionExpiryDate")
        .lean(),
      JobApplication.aggregate([
        { $match: { freelancerId: { $in: roleIds } } },
        { $group: { _id: "$freelancerId", count: { $sum: 1 } } },
      ]),
      JobListing.find({
        "assignedFreelancer.freelancerId": { $in: roleIds },
        "assignedFreelancer.status": "working",
      })
        .select("assignedFreelancer.freelancerId")
        .lean(),
    ]);

    const userMap = new Map(users.map((u) => [u.userId, u]));
    const applicationMap = Object.fromEntries(
      applicationCounts.map((item) => [item._id, item.count]),
    );
    const workingFreelancerIds = new Set(
      activeJobs.map((job) => job.assignedFreelancer.freelancerId),
    );

    const edges = freelancers.map((freelancer) => {
      const user = userMap.get(freelancer.userId);
      return {
        node: {
          freelancerId: freelancer.freelancerId,
          userId: freelancer.userId,
          name: user?.name || "N/A",
          email: user?.email || "N/A",
          phone: user?.phone || "N/A",
          picture: user?.picture || "",
          location: user?.location || "N/A",
          rating: user?.rating || 0,
          skills: freelancer.skills?.length || 0,
          subscription: user?.subscription || "Basic",
          isPremium: user?.subscription === "Premium",
          subscriptionDuration: user?.subscriptionDuration || null,
          subscriptionExpiryDate:
            user?.subscriptionExpiryDate?.toISOString?.() ||
            user?.subscriptionExpiryDate ||
            null,
          applicationsCount: applicationMap[freelancer.freelancerId] || 0,
          isCurrentlyWorking: workingFreelancerIds.has(freelancer.freelancerId),
          joinedDate:
            (user?.createdAt || freelancer.createdAt)?.toISOString?.() || null,
        },
        cursor: encodeCursor({
          createdAt: freelancer.createdAt,
          id: String(freelancer._id),
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
      resume: freelancer.resume || "",
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

  adminEmployers: async (_parent, { first = 25, after = null }, { session }) => {
    requireAdmin(session);

    const normalizedFirst = Math.min(100, Math.max(1, first || 25));
    const cursor = after ? decodeCursor(after) : null;
    const query = {};

    if (after && !cursor) {
      throw new Error("Invalid cursor");
    }

    if (cursor) {
      query.$or = [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
      ];
    }

    const [total, slice] = await Promise.all([
      Employer.countDocuments({}),
      Employer.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .limit(normalizedFirst + 1)
        .select(
          "employerId userId companyName currentFreelancers previouslyWorkedFreelancers createdAt",
        )
        .lean(),
    ]);

    const hasNextPage = slice.length > normalizedFirst;
    const employers = hasNextPage ? slice.slice(0, normalizedFirst) : slice;

    if (!employers.length) {
      return {
        edges: [],
        pageInfo: { hasNextPage: false, endCursor: null },
        total,
      };
    }

    const employerUserIds = employers.map((e) => e.userId);
    const empIds = employers.map((e) => e.employerId);

    const [users, jobCounts] = await Promise.all([
      User.find({ userId: { $in: employerUserIds } })
        .select("userId name email phone picture location rating createdAt subscription subscriptionDuration subscriptionExpiryDate")
        .lean(),
      JobListing.aggregate([
        { $match: { employerId: { $in: empIds } } },
        { $group: { _id: "$employerId", count: { $sum: 1 } } },
      ]),
    ]);

    const userMap = new Map(users.map((u) => [u.userId, u]));
    const jobCountMap = Object.fromEntries(
      jobCounts.map((item) => [item._id, item.count]),
    );

    const edges = employers.map((employer) => {
      const user = userMap.get(employer.userId);
      const currentHires = employer.currentFreelancers?.length || 0;
      const pastHires = employer.previouslyWorkedFreelancers?.length || 0;

      return {
        node: {
          employerId: employer.employerId,
          userId: employer.userId,
          name: user?.name || "N/A",
          email: user?.email || "N/A",
          phone: user?.phone || "N/A",
          picture: user?.picture || "",
          location: user?.location || "N/A",
          companyName: employer.companyName || "N/A",
          rating: user?.rating || 0,
          subscription: user?.subscription || "Basic",
          isPremium: user?.subscription === "Premium",
          subscriptionDuration: user?.subscriptionDuration || null,
          subscriptionExpiryDate:
            user?.subscriptionExpiryDate?.toISOString?.() || null,
          jobListingsCount: jobCountMap[employer.employerId] || 0,
          hiredCount: currentHires + pastHires,
          currentHires,
          pastHires,
          joinedDate:
            (user?.createdAt || employer.createdAt)?.toISOString?.() || null,
        },
        cursor: encodeCursor({
          createdAt: employer.createdAt,
          id: String(employer._id),
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
