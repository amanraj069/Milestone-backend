const Feedback = require("../models/Feedback");
const JobListing = require("../models/job_listing");
const JobApplication = require("../models/job_application");
const UserBadge = require("../models/UserBadge");
const User = require("../models/user");
const Blog = require("../models/blog");

const resolvers = {
  Query: {
    // ──────────────────────────────────────────────
    //  FEEDBACK QUERIES (replacing N+1 REST endpoints)
    // ──────────────────────────────────────────────

    /**
     * GET /api/feedback/job/:jobId
     * Before: per-feedback User.findOne (N+1)
     * After:  DataLoader batches all fromUserId lookups
     */
    feedbacksForJob: async (_parent, { jobId }, { session, loaders }) => {
      if (!session?.user) throw new Error("Unauthorized: Please log in");

      const job = await JobListing.findOne({ jobId });
      if (!job) throw new Error("Job not found");

      const currentUserRoleId = session.user.roleId;
      const isParticipant =
        job.employerId === currentUserRoleId ||
        (job.assignedFreelancer &&
          job.assignedFreelancer.freelancerId === currentUserRoleId);

      if (!isParticipant && session.user.role !== "Moderator") {
        throw new Error("Access denied");
      }

      const feedbacks = await Feedback.find({ jobId })
        .sort({ createdAt: -1 })
        .lean();

      // Use DataLoader to batch-resolve fromUser for all feedbacks
      return feedbacks.map((fb) => ({
        ...fb,
        _id: String(fb._id),
        createdAt: fb.createdAt?.toISOString?.() || fb.createdAt,
        // Store metadata for the Feedback resolver to use
        _anonymous: fb.anonymous,
        _isModerator: session.user.role === "Moderator",
      }));
    },

    /**
     * GET /api/feedback/user/:userId
     * Before: per-feedback User.findOne (N+1)
     * After:  DataLoader batches
     */
    feedbacksForUser: async (
      _parent,
      { userId, page = 1, limit = 20 },
      { session, loaders }
    ) => {
      const skip = (page - 1) * limit;

      const [feedbacks, total] = await Promise.all([
        Feedback.find({ toUserId: userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Feedback.countDocuments({ toUserId: userId }),
      ]);

      return {
        feedbacks: feedbacks.map((fb) => ({
          ...fb,
          _id: String(fb._id),
          createdAt: fb.createdAt?.toISOString?.() || fb.createdAt,
          _anonymous: fb.anonymous,
          _isModerator: false,
        })),
        total,
        page,
        limit,
      };
    },

    /**
     * GET /api/feedback/public/user/:userId
     * Before: per-feedback User.findOne + per-feedback JobListing.findOne (2N+1)
     * After:  DataLoader batches both
     */
    publicFeedbacksForUser: async (
      _parent,
      { userId, page = 1, limit = 20 },
      { loaders }
    ) => {
      const skip = (page - 1) * limit;

      const [feedbacks, total] = await Promise.all([
        Feedback.find({ toUserId: userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Feedback.countDocuments({ toUserId: userId }),
      ]);

      return {
        feedbacks: feedbacks.map((fb) => ({
          ...fb,
          _id: String(fb._id),
          createdAt: fb.createdAt?.toISOString?.() || fb.createdAt,
          _anonymous: fb.anonymous,
          _isModerator: false,
          _isPublic: true,
        })),
        total,
        page,
        limit,
      };
    },

    /**
     * GET /api/feedback/stats/:userId and /api/feedback/public/stats/:userId
     * These don't have N+1 (they use aggregation) but included for completeness
     */
    feedbackStats: async (_parent, { userId }) => {
      return _computeFeedbackStats(userId);
    },

    publicFeedbackStats: async (_parent, { userId }) => {
      return _computeFeedbackStats(userId);
    },

    // ──────────────────────────────────────────────
    //  QUIZ BADGES (replacing .populate())
    // ──────────────────────────────────────────────

    /**
     * GET /api/quizzes/users/:userId/badges
     * Before: .populate("badgeId") — Mongoose does a separate query per badge
     * After:  DataLoader batches all badge ID lookups
     */
    userBadges: async (_parent, { userId }, { session, loaders }) => {
      if (!session?.user || String(session.user.id) !== String(userId)) {
        throw new Error("Forbidden");
      }

      const userBadges = await UserBadge.find({ userId }).lean();

      // Batch-load all badges via DataLoader
      const badgeIds = userBadges.map((ub) => ub.badgeId);
      const badges = await Promise.all(
        badgeIds.map((id) => loaders.badgeById.load(String(id)))
      );

      return userBadges.map((ub, i) => ({
        badge: badges[i],
        awardedAt: ub.awardedAt?.toISOString?.() || ub.awardedAt,
      }));
    },

    // ──────────────────────────────────────────────
    //  FREELANCER ACTIVE JOBS
    // ──────────────────────────────────────────────

    /**
     * GET /api/freelancer/active_job/api
     * Before: per-job Employer.findOne (N+1)
     * After:  DataLoader batches employer lookups
     */
    freelancerActiveJobs: async (_parent, _args, { session, loaders }) => {
      if (!session?.user) throw new Error("Unauthorized: Please log in");
      if (session.user.role !== "Freelancer")
        throw new Error("Access denied. Freelancer access required.");

      const freelancerId = session.user.roleId;

      const activeJobs = await JobListing.find({
        "assignedFreelancer.freelancerId": freelancerId,
        "assignedFreelancer.status": "working",
      }).lean();

      // Batch-load all employers and employer users via DataLoader
      const employerIds = activeJobs
        .map((job) => job.employerId)
        .filter(Boolean);

      const [employers, employerUsers] = await Promise.all([
        Promise.all(
          employerIds.map((id) => loaders.employerByEmployerId.load(id))
        ),
        Promise.all(employerIds.map((id) => loaders.userByRoleId.load(id))),
      ]);

      const employerMap = {};
      employerIds.forEach((id, i) => (employerMap[id] = employers[i]));

      const userMap = {};
      employerIds.forEach((id, i) => (userMap[id] = employerUsers[i]));

      return activeJobs.map((job) => {
        const paidAmount = job.milestones
          .filter((m) => m.status === "paid")
          .reduce((sum, m) => sum + (parseFloat(m.payment) || 0), 0);

        const totalBudget = parseFloat(job.budget) || 0;
        const progress =
          totalBudget > 0
            ? Math.min(Math.round((paidAmount / totalBudget) * 100), 100)
            : 0;

        const employer = employerMap[job.employerId];
        const companyName =
          employer && employer.companyName && employer.companyName.trim()
            ? employer.companyName
            : "Unknown Company";

        const user = userMap[job.employerId];

        const startDate = job.assignedFreelancer?.startDate;
        const daysSinceStart = startDate
          ? Math.floor(
              (Date.now() - new Date(startDate).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : 0;

        return {
          id: job.jobId,
          title: job.title,
          company: companyName,
          logo: job.imageUrl || "/assets/company_logo.jpg",
          deadline: job.applicationDeadline
            ? new Date(job.applicationDeadline).toLocaleDateString()
            : "No deadline",
          price: job.budget
            ? `Rs.${parseFloat(job.budget).toFixed(2)}`
            : "Not specified",
          totalBudget,
          paidAmount,
          progress,
          tech: job.description?.skills || [],
          employerUserId: user?.userId || "",
          description: job.description?.text || "",
          milestones: job.milestones || [],
          milestonesCount: (job.milestones || []).length,
          completedMilestones: (job.milestones || []).filter(
            (m) => m.status === "paid"
          ).length,
          daysSinceStart,
          startDate: startDate
            ? new Date(startDate).toLocaleDateString()
            : "Not set",
          startDateRaw: startDate
            ? new Date(startDate).toISOString()
            : null,
        };
      });
    },

    // ──────────────────────────────────────────────
    //  FREELANCER JOB HISTORY
    // ──────────────────────────────────────────────

    /**
     * GET /api/freelancer/job_history/api
     * Before: per-job Employer.findOne + per-job User.findOne (2N+1)
     * After:  DataLoader batches employer + user lookups;
     *         feedback already bulk-fetched
     */
    freelancerJobHistory: async (_parent, _args, { session, loaders }) => {
      if (!session?.user) throw new Error("Unauthorized: Please log in");
      if (session.user.role !== "Freelancer")
        throw new Error("Access denied. Freelancer access required.");

      const freelancerId = session.user.roleId;
      const userId = session.user.id;

      const historyJobs = await JobListing.find({
        "assignedFreelancer.freelancerId": freelancerId,
        "assignedFreelancer.status": { $in: ["finished", "left"] },
      }).lean();

      // Bulk fetch feedback (already batched in the REST version)
      const jobIds = historyJobs.map((j) => j.jobId);
      const feedbacks = await Feedback.find({
        jobId: { $in: jobIds },
        toUserId: userId,
        toRole: "Freelancer",
      }).lean();
      const feedbackByJob = {};
      feedbacks.forEach((fb) => (feedbackByJob[fb.jobId] = fb.rating));

      // Batch-load employers and employer users via DataLoader
      const employerIds = historyJobs
        .map((job) => job.employerId)
        .filter(Boolean);
      const uniqueEmployerIds = [...new Set(employerIds)];

      const [employers, employerUsers] = await Promise.all([
        Promise.all(
          uniqueEmployerIds.map((id) => loaders.employerByEmployerId.load(id))
        ),
        Promise.all(
          uniqueEmployerIds.map((id) => loaders.userByRoleId.load(id))
        ),
      ]);

      const employerMap = {};
      uniqueEmployerIds.forEach((id, i) => (employerMap[id] = employers[i]));
      const userMap = {};
      uniqueEmployerIds.forEach(
        (id, i) => (userMap[id] = employerUsers[i])
      );

      return historyJobs.map((job) => {
        const paidAmount = job.milestones
          .filter((m) => m.status === "paid")
          .reduce((sum, m) => sum + (parseFloat(m.payment) || 0), 0);

        const employer = employerMap[job.employerId];
        const companyName = employer ? employer.companyName : "Unknown Company";

        let employerUserId = employer?.userId || "";
        if (!employerUserId) {
          const employerUser = userMap[job.employerId];
          employerUserId = employerUser?.userId || "";
        }

        const startDate = job.assignedFreelancer?.startDate;
        const daysSinceStart = startDate
          ? Math.floor(
              (Date.now() - new Date(startDate).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : 0;

        const totalBudget = parseFloat(job.budget) || 0;

        return {
          id: job.jobId,
          _id: job.jobId,
          title: job.title,
          company: companyName,
          logo: job.imageUrl || "/assets/company_logo.jpg",
          status: job.assignedFreelancer.status,
          tech: job.description?.skills || [],
          employerUserId,
          date: `${
            job.assignedFreelancer.startDate
              ? new Date(
                  job.assignedFreelancer.startDate
                ).toLocaleDateString()
              : "Unknown"
          } - ${
            job.updatedAt
              ? new Date(job.updatedAt).toLocaleDateString()
              : "Unknown"
          }`,
          price: paidAmount ? `Rs.${paidAmount.toFixed(2)}` : "Not paid",
          paidAmount,
          totalBudget,
          rating:
            feedbackByJob[job.jobId] ||
            job.assignedFreelancer.employerRating ||
            null,
          startDate: startDate
            ? new Date(startDate).toLocaleDateString()
            : "Not set",
          startDateRaw: startDate
            ? new Date(startDate).toISOString()
            : null,
          endDateRaw: job.assignedFreelancer.endDate
            ? new Date(job.assignedFreelancer.endDate).toISOString()
            : job.updatedAt
            ? new Date(job.updatedAt).toISOString()
            : null,
          daysSinceStart,
          description: job.description?.text || "",
          milestones: job.milestones || [],
          milestonesCount: (job.milestones || []).length,
          completedMilestones: (job.milestones || []).filter(
            (m) => m.status === "paid"
          ).length,
          progress: Math.round(
            job.milestones.length > 0
              ? (job.milestones.filter((m) => m.status === "paid").length /
                  job.milestones.length) *
                  100
              : 0
          ),
          cancelReason: job.assignedFreelancer.cancelReason || null,
        };
      });
    },

    // ──────────────────────────────────────────────
    //  FREELANCER APPLICATIONS
    // ──────────────────────────────────────────────

    /**
     * GET /api/freelancer/applications
     * Before: bulk JobListing.find + bulk Employer.find (already batched in REST)
     * GraphQL version keeps the same batching but lets clients pick fields
     */
    freelancerApplications: async (_parent, _args, { session, loaders }) => {
      if (!session?.user) throw new Error("Unauthorized: Please log in");
      if (session.user.role !== "Freelancer")
        throw new Error("Access denied. Freelancer access required.");

      const freelancerId = session.user.roleId;

      const applications = await JobApplication.find({ freelancerId })
        .sort({ appliedDate: -1 })
        .lean();

      // Batch-load jobs
      const jobIds = applications.map((app) => app.jobId);
      const jobs = await Promise.all(
        [...new Set(jobIds)].map((id) => loaders.jobByJobId.load(id))
      );

      // We need full job data for the response, so fetch separately
      const fullJobs = await JobListing.find({
        jobId: { $in: jobIds },
      }).lean();
      const jobMap = {};
      fullJobs.forEach((job) => (jobMap[job.jobId] = job));

      // Batch-load employers
      const employerIds = fullJobs
        .map((job) => job.employerId)
        .filter(Boolean);
      const uniqueEmployerIds = [...new Set(employerIds)];

      const employers = await Promise.all(
        uniqueEmployerIds.map((id) => loaders.employerByEmployerId.load(id))
      );
      const employerMap = {};
      uniqueEmployerIds.forEach(
        (id, i) => (employerMap[id] = employers[i])
      );

      const result = applications.map((app) => {
        const job = jobMap[app.jobId] || {};
        const employer = employerMap[job.employerId] || {};

        return {
          applicationId: app.applicationId,
          jobId: app.jobId,
          jobTitle: job.title || "N/A",
          company: employer.companyName || "Unknown",
          logo: employer.logo || null,
          appliedDate: app.appliedDate?.toISOString?.() || app.appliedDate,
          status: app.status,
          coverMessage: app.coverMessage,
          resumeLink: app.resumeLink,
          budget: job.budget || 0,
          location: job.location || "N/A",
          jobType: job.jobType || "N/A",
          skillsRequired: job.skillsRequired || [],
          experienceLevel: job.experienceLevel || "N/A",
        };
      });

      return {
        applications: result,
        stats: {
          total: result.length,
          pending: result.filter((a) => a.status === "Pending").length,
          accepted: result.filter((a) => a.status === "Accepted").length,
          rejected: result.filter((a) => a.status === "Rejected").length,
        },
      };
    },

    // ──────────────────────────────────────────────
    //  PUBLIC BLOG DETAIL
    // ──────────────────────────────────────────────

    /**
     * Replaces multiple REST calls used by blog detail page:
     * - GET /api/blogs/:blogId
     * - GET /api/blogs/latest
     * - GET /api/blogs/featured
     * Returns blog + recentBlogs + featuredBlog in one query.
     */

    publicBlogDetail: async (_parent, { blogId }) => {
      const blog = await Blog.findOne({ blogId, status: "published" }).lean();
      if (!blog) {
        throw new Error("Blog not found");
      }

      await Blog.updateOne({ blogId }, { $inc: { views: 1 } });

      const [updatedBlog, recentBlogs, featuredBlog] = await Promise.all([
        Blog.findOne({ blogId, status: "published" }).lean(),
        Blog.find({
          status: "published",
          blogId: { $ne: blogId },
        })
          .sort({ createdAt: -1 })
          .limit(3)
          .lean(),
        Blog.findOne({
          status: "published",
          featured: true,
          blogId: { $ne: blogId },
        })
          .sort({ createdAt: -1 })
          .lean(),
      ]);

      return {
        blog: updatedBlog,
        recentBlogs,
        featuredBlog: featuredBlog || null,
      };
    },
  },

  // ──────────────────────────────────────────────
  //  FIELD RESOLVERS (lazy resolution via DataLoader)
  // ──────────────────────────────────────────────

  Feedback: {
    fromUser: async (feedback, _args, { loaders }) => {
      // If anonymous and not moderator, return anonymous
      if (feedback._anonymous && !feedback._isModerator) {
        return { name: "Anonymous", picture: null, role: null };
      }

      if (!feedback.fromUserId) {
        return { name: "Unknown User", picture: null, role: null };
      }

      const user = await loaders.userByUserId.load(feedback.fromUserId);
      if (!user) return { name: "Unknown User", picture: null, role: null };

      return {
        name: user.name,
        picture: user.picture,
        role: user.role,
      };
    },

    jobTitle: async (feedback, _args, { loaders }) => {
      if (!feedback.jobId || !feedback._isPublic) return null;
      const job = await loaders.jobByJobId.load(feedback.jobId);
      return job?.title || "Unknown Project";
    },
  },
};

// Helper: compute feedback stats (used by both authenticated and public)
async function _computeFeedbackStats(userId) {
  const stats = await Feedback.aggregate([
    { $match: { toUserId: userId } },
    {
      $group: {
        _id: null,
        totalFeedbacks: { $sum: 1 },
        averageRating: { $avg: "$rating" },
        ratings: { $push: "$rating" },
      },
    },
  ]);

  if (stats.length === 0) {
    return {
      totalFeedbacks: 0,
      averageRating: 0,
      ratingDistribution: { one: 0, two: 0, three: 0, four: 0, five: 0 },
    };
  }

  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  stats[0].ratings.forEach((r) => (dist[r] = (dist[r] || 0) + 1));

  return {
    totalFeedbacks: stats[0].totalFeedbacks,
    averageRating: Math.round(stats[0].averageRating * 10) / 10,
    ratingDistribution: {
      one: dist[1],
      two: dist[2],
      three: dist[3],
      four: dist[4],
      five: dist[5],
    },
  };
}

module.exports = resolvers;
