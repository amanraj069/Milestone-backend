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
  //  PAYMENTS
  // ──────────────────────────────────────────────

  adminPayments: async (_parent, _args, { session }) => {
    requireAdmin(session);

    const [jobsWithPaid, jobsWithPending] = await Promise.all([
      JobListing.find({ "milestones.status": "paid" })
        .select("jobId title budget employerId milestones assignedFreelancer status updatedAt").lean(),
      JobListing.find({ "milestones.status": { $in: ["not-paid", "in-progress"] } })
        .select("jobId title budget employerId milestones assignedFreelancer status updatedAt").lean(),
    ]);

    const allPaymentJobs = [...jobsWithPaid, ...jobsWithPending];
    const empIds = [...new Set(allPaymentJobs.map((j) => j.employerId))];
    const flIds = [...new Set(allPaymentJobs.filter((j) => j.assignedFreelancer?.freelancerId).map((j) => j.assignedFreelancer.freelancerId))];

    const [employers, freelancers] = await Promise.all([
      Employer.find({ employerId: { $in: empIds } }).select("employerId companyName userId").lean(),
      Freelancer.find({ freelancerId: { $in: flIds } }).select("freelancerId userId").lean(),
    ]);
    const allUserIds = [...employers.map((e) => e.userId), ...freelancers.map((f) => f.userId)];
    const users = await User.find({ userId: { $in: allUserIds } }).select("userId name email").lean();

    const payments = [];

    const processJobs = (jobs, statusFilter, mapStatus) => {
      jobs.forEach((job) => {
        const employer = employers.find((e) => e.employerId === job.employerId);
        const employerUser = users.find((u) => u.userId === employer?.userId);
        const freelancer = freelancers.find((f) => f.freelancerId === job.assignedFreelancer?.freelancerId);
        const freelancerUser = users.find((u) => u.userId === freelancer?.userId);
        job.milestones.filter(statusFilter).forEach((milestone) => {
          payments.push({
            jobId: job.jobId, jobTitle: job.title,
            milestoneId: milestone.milestoneId,
            milestoneDescription: milestone.description,
            amount: parseFloat(milestone.payment) || 0,
            status: mapStatus(milestone),
            employerName: employerUser?.name || "Unknown",
            companyName: employer?.companyName || "Unknown",
            freelancerName: freelancerUser?.name || "Unknown",
            date: job.updatedAt?.toISOString?.() || job.updatedAt,
          });
        });
      });
    };

    processJobs(jobsWithPaid, (m) => m.status === "paid", () => "Paid");
    processJobs(jobsWithPending, (m) => m.status === "not-paid" || m.status === "in-progress",
      (m) => m.status === "in-progress" ? "In Progress" : "Pending");

    payments.sort((a, b) => new Date(b.date) - new Date(a.date));
    return { payments, total: payments.length };
  },

  // ──────────────────────────────────────────────
  //  USERS
  // ──────────────────────────────────────────────

  adminUsers: async (_parent, _args, { session }) => {
    requireAdmin(session);

    const users = await User.find({ role: { $ne: "" } })
      .select("userId name email role subscription picture location rating createdAt subscriptionDuration subscriptionExpiryDate")
      .sort({ createdAt: -1 }).lean();

    const userIds = users.map((u) => u.userId);
    const [freelancers, employers, moderators] = await Promise.all([
      Freelancer.find({ userId: { $in: userIds } }).select("userId freelancerId").lean(),
      Employer.find({ userId: { $in: userIds } }).select("userId employerId").lean(),
      Moderator.find({ userId: { $in: userIds } }).select("userId moderatorId").lean(),
    ]);

    const flMap = Object.fromEntries(freelancers.map((f) => [f.userId, f.freelancerId]));
    const empMap = Object.fromEntries(employers.map((e) => [e.userId, e.employerId]));
    const modMap = Object.fromEntries(moderators.map((m) => [m.userId, m.moderatorId]));

    const result = users.map((u) => {
      let roleId = null, profilePath = null;
      if (u.role === "Freelancer" && flMap[u.userId]) {
        roleId = flMap[u.userId]; profilePath = `/admin/freelancers/${roleId}`;
      } else if (u.role === "Employer" && empMap[u.userId]) {
        roleId = empMap[u.userId]; profilePath = `/admin/employers/${roleId}`;
      } else if (u.role === "Moderator" && modMap[u.userId]) {
        roleId = modMap[u.userId]; profilePath = `/admin/moderators/${roleId}`;
      }
      return {
        ...u, roleId, profilePath,
        createdAt: u.createdAt?.toISOString?.() || u.createdAt,
        subscriptionExpiryDate: u.subscriptionExpiryDate?.toISOString?.() || u.subscriptionExpiryDate,
      };
    });

    return { users: result, total: result.length };
  },

  // ──────────────────────────────────────────────
  //  FREELANCERS LIST
  // ──────────────────────────────────────────────

  adminFreelancers: async (_parent, _args, { session }) => {
    requireAdmin(session);

    const freelancers = await Freelancer.find({}).lean();
    const freelancerUserIds = freelancers.map((f) => f.userId);
    const users = await User.find({ userId: { $in: freelancerUserIds } })
      .select("userId name email phone picture location rating createdAt subscription subscriptionDuration subscriptionExpiryDate")
      .lean();

    const roleIds = freelancers.map((f) => f.freelancerId);
    const [applicationCounts, activeJobs] = await Promise.all([
      JobApplication.aggregate([
        { $match: { freelancerId: { $in: roleIds } } },
        { $group: { _id: "$freelancerId", count: { $sum: 1 } } },
      ]),
      JobListing.find({ "assignedFreelancer.freelancerId": { $in: roleIds }, "assignedFreelancer.status": "working" })
        .select("assignedFreelancer.freelancerId").lean(),
    ]);

    const applicationMap = {};
    applicationCounts.forEach((item) => { applicationMap[item._id] = item.count; });
    const workingFreelancerIds = new Set(activeJobs.map((job) => job.assignedFreelancer.freelancerId));

    const result = freelancers.map((freelancer) => {
      const user = users.find((u) => u.userId === freelancer.userId);
      return {
        freelancerId: freelancer.freelancerId, userId: freelancer.userId,
        name: user?.name || "N/A", email: user?.email || "N/A",
        phone: user?.phone || "N/A", picture: user?.picture || "",
        location: user?.location || "N/A", rating: user?.rating || 0,
        skills: freelancer.skills?.length || 0,
        subscription: user?.subscription || "Basic",
        isPremium: user?.subscription === "Premium",
        subscriptionDuration: user?.subscriptionDuration || null,
        subscriptionExpiryDate: user?.subscriptionExpiryDate?.toISOString?.() || user?.subscriptionExpiryDate || null,
        applicationsCount: applicationMap[freelancer.freelancerId] || 0,
        isCurrentlyWorking: workingFreelancerIds.has(freelancer.freelancerId),
        joinedDate: (user?.createdAt || freelancer.createdAt)?.toISOString?.() || null,
      };
    });

    return { freelancers: result, total: result.length };
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

  adminEmployers: async (_parent, _args, { session }) => {
    requireAdmin(session);

    const employers = await Employer.find({}).lean();
    const employerUserIds = employers.map((e) => e.userId);
    const users = await User.find({ userId: { $in: employerUserIds } })
      .select("userId name email phone picture location rating createdAt subscription subscriptionDuration subscriptionExpiryDate")
      .lean();

    const empIds = employers.map((e) => e.employerId);
    const jobCounts = await JobListing.aggregate([
      { $match: { employerId: { $in: empIds } } },
      { $group: { _id: "$employerId", count: { $sum: 1 } } },
    ]);
    const jobCountMap = {};
    jobCounts.forEach((item) => { jobCountMap[item._id] = item.count; });

    const result = employers.map((employer) => {
      const user = users.find((u) => u.userId === employer.userId);
      const currentHires = employer.currentFreelancers?.length || 0;
      const pastHires = employer.previouslyWorkedFreelancers?.length || 0;
      return {
        employerId: employer.employerId, userId: employer.userId,
        name: user?.name || "N/A", email: user?.email || "N/A",
        phone: user?.phone || "N/A", picture: user?.picture || "",
        location: user?.location || "N/A",
        companyName: employer.companyName || "N/A",
        rating: user?.rating || 0, subscription: user?.subscription || "Basic",
        isPremium: user?.subscription === "Premium",
        subscriptionDuration: user?.subscriptionDuration || null,
        subscriptionExpiryDate: user?.subscriptionExpiryDate?.toISOString?.() || null,
        jobListingsCount: jobCountMap[employer.employerId] || 0,
        hiredCount: currentHires + pastHires, currentHires, pastHires,
        joinedDate: (user?.createdAt || employer.createdAt)?.toISOString?.() || null,
      };
    });

    return { employers: result, total: result.length };
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
