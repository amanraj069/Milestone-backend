const Feedback = require("../models/Feedback");
const JobListing = require("../models/job_listing");
const JobApplication = require("../models/job_application");
const UserBadge = require("../models/UserBadge");
const User = require("../models/user");
const Freelancer = require("../models/freelancer");
const Employer = require("../models/employer");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const adminResolvers = require("./adminResolvers");
const employerResolvers = require("./employerResolvers");
const moderatorResolvers = require("./moderatorResolvers");
const Blog = require("../models/blog");

const SHARED_RESUME_URL = "/uploads/resumes/shared-resume.pdf";

const { moderatorDeleteBlog, ...moderatorQueryResolvers } = moderatorResolvers;

const toIsoString = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const objectIdToIsoString = (value) => {
  if (!value || typeof value.getTimestamp !== "function") return null;
  return toIsoString(value.getTimestamp());
};

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
    //  CHAT QUERIES
    // ──────────────────────────────────────────────

    chatConversations: async (
      _parent,
      { limit = 20, offset = 0 },
      { session }
    ) => {
      const user = session?.user;
      if (!user) throw new Error("Unauthorized: Please log in");

      const boundedLimit = Math.max(1, Math.min(limit, 100));
      const safeOffset = Math.max(0, offset);

      const conversations = await Conversation.find({
        participants: user.id,
      })
        .sort({ updatedAt: -1 })
        .skip(safeOffset)
        .limit(boundedLimit)
        .lean();

      const otherUserIds = [
        ...new Set(
          conversations
            .map((conv) => conv.participants.find((p) => p !== user.id))
            .filter(Boolean)
        ),
      ];

      const users = await User.find({ userId: { $in: otherUserIds } })
        .select("userId name picture role")
        .lean();

      const conversationIds = conversations.map((conv) => conv.conversationId);
      const latestMessages = conversationIds.length
        ? await Message.aggregate([
            { $match: { conversationId: { $in: conversationIds } } },
            {
              $addFields: {
                eventTime: { $ifNull: ["$createdAt", "$timestamp"] },
              },
            },
            { $sort: { eventTime: -1, _id: -1 } },
            {
              $group: {
                _id: "$conversationId",
                messageId: { $first: "$messageId" },
                text: { $first: "$messageData" },
                sender: { $first: "$from" },
                timestamp: { $first: "$eventTime" },
              },
            },
          ])
        : [];

      const userMap = new Map(users.map((entry) => [entry.userId, entry]));
      const latestMessageMap = new Map(
        latestMessages.map((entry) => [entry._id, entry])
      );

      return conversations.map((conv) => {
        const otherUserId = conv.participants.find((p) => p !== user.id);
        const participant = userMap.get(otherUserId);
        const unreadCount =
          conv.unreadCount && typeof conv.unreadCount === "object"
            ? conv.unreadCount[user.id] || 0
            : 0;
        const latestMessage = latestMessageMap.get(conv.conversationId);
        const fallbackLastMessage = conv.lastMessage || null;
        const normalizedTimestamp =
          toIsoString(latestMessage?.timestamp) ||
          toIsoString(fallbackLastMessage?.timestamp) ||
          toIsoString(conv.updatedAt) ||
          toIsoString(conv.createdAt);
        const normalizedLastMessage = conv.lastMessage
          ? {
              messageId:
                latestMessage?.messageId || fallbackLastMessage?.messageId || null,
              text: latestMessage?.text || fallbackLastMessage?.text || "",
              sender: latestMessage?.sender || fallbackLastMessage?.sender || null,
              timestamp: normalizedTimestamp,
            }
          : latestMessage
          ? {
              messageId: latestMessage.messageId || null,
              text: latestMessage.text || "",
              sender: latestMessage.sender || null,
              timestamp: normalizedTimestamp,
            }
          : null;

        return {
          conversationId: conv.conversationId,
          participant: participant || {
            userId: otherUserId,
            name: "Unknown User",
            picture:
              "https://cdn.pixabay.com/photo/2018/04/18/18/56/user-3331256_1280.png",
            role: "Unknown",
          },
          lastMessage: normalizedLastMessage,
          unreadCount,
          updatedAt: normalizedTimestamp || toIsoString(conv.updatedAt),
        };
      });
    },

    messagesWithUser: async (
      _parent,
      { userId, limit = 50, offset = 0 },
      { session }
    ) => {
      const user = session?.user;
      if (!user) throw new Error("Unauthorized: Please log in");

      const boundedLimit = Math.max(1, Math.min(limit, 100));
      const safeOffset = Math.max(0, offset);

      const conversation = await Conversation.findOne({
        participants: { $all: [user.id, userId] },
      }).lean();

      if (!conversation) {
        return {
          conversationId: null,
          messages: [],
          total: 0,
          hasMore: false,
        };
      }

      const total = await Message.countDocuments({
        conversationId: conversation.conversationId,
      });

      const messages = await Message.find({
        conversationId: conversation.conversationId,
      })
        .sort({ createdAt: 1 })
        .skip(safeOffset)
        .limit(boundedLimit)
        .lean();

      const normalizedMessages = messages.map((message) => {
        const createdAtIso =
          toIsoString(message.createdAt) ||
          toIsoString(message.timestamp) ||
          toIsoString(message.updatedAt) ||
          objectIdToIsoString(message._id);
        const updatedAtIso =
          toIsoString(message.updatedAt) ||
          toIsoString(message.createdAt) ||
          toIsoString(message.timestamp) ||
          objectIdToIsoString(message._id);

        return {
          ...message,
          createdAt: createdAtIso,
          updatedAt: updatedAtIso,
        };
      });

      return {
        conversationId: conversation.conversationId,
        messages: normalizedMessages,
        total,
        hasMore: safeOffset + messages.length < total,
      };
    },

    // ──────────────────────────────────────────────
    //  FREELANCER ACTIVE JOBS
    // ──────────────────────────────────────────────

    /**
     * GET /api/freelancer/active_job/api
     * Before: per-job Employer.findOne (N+1)
     * After:  DataLoader batches employer lookups
     */
    freelancerActiveJobs: async (
      _parent,
      { search = "", sortBy = "newest", page = 1, limit = 25 },
      { session, loaders }
    ) => {
      if (!session?.user) throw new Error("Unauthorized: Please log in");
      if (session.user.role !== "Freelancer")
        throw new Error("Access denied. Freelancer access required.");

      const freelancerId = session.user.roleId;
      const safeLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
      const safePage = Math.max(1, Number(page) || 1);
      const safeSkip = (safePage - 1) * safeLimit;
      const searchText = String(search || "").trim();
      const searchRegex = searchText
        ? new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
        : null;

      const query = {
        "assignedFreelancer.freelancerId": freelancerId,
        "assignedFreelancer.status": "working",
      };
      if (searchRegex) {
        query.$or = [
          { title: searchRegex },
          { "description.text": searchRegex },
          { "description.skills": { $elemMatch: { $regex: searchRegex } } },
        ];
      }

      const sortMap = {
        newest: { "assignedFreelancer.startDate": -1, _id: -1 },
        oldest: { "assignedFreelancer.startDate": 1, _id: 1 },
        "budget-high": { budget: -1, _id: -1 },
        "budget-low": { budget: 1, _id: 1 },
        "progress-high": { updatedAt: -1, _id: -1 },
        "progress-low": { updatedAt: 1, _id: 1 },
        "days-high": { "assignedFreelancer.startDate": 1, _id: 1 },
        "days-low": { "assignedFreelancer.startDate": -1, _id: -1 },
      };
      const sortSpec = sortMap[sortBy] || sortMap.newest;

      const [activeJobs, total] = await Promise.all([
        JobListing.find(query).sort(sortSpec).skip(safeSkip).limit(safeLimit).lean(),
        JobListing.countDocuments(query),
      ]);

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

      const jobs = activeJobs.map((job) => {
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

      const totalPages = Math.ceil(total / safeLimit) || 1;
      return {
        jobs,
        total,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages,
          hasNextPage: safePage < totalPages,
          hasPrevPage: safePage > 1,
        },
      };
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
    freelancerJobHistory: async (
      _parent,
      {
        search = "",
        sortBy = "newest",
        statusIn = null,
        employerIn = null,
        jobTitleIn = null,
        page = 1,
        limit = 25,
      },
      { session, loaders }
    ) => {
      if (!session?.user) throw new Error("Unauthorized: Please log in");
      if (session.user.role !== "Freelancer")
        throw new Error("Access denied. Freelancer access required.");

      const freelancerId = session.user.roleId;
      const userId = session.user.id;
      const safeLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
      const safePage = Math.max(1, Number(page) || 1);
      const safeSkip = (safePage - 1) * safeLimit;
      const searchText = String(search || "").trim();
      const searchRegex = searchText
        ? new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
        : null;
      const cleanStatusIn = Array.isArray(statusIn)
        ? statusIn.map((value) => String(value)).filter(Boolean)
        : [];
      const cleanEmployerIn = Array.isArray(employerIn)
        ? employerIn.map((value) => String(value)).filter(Boolean)
        : [];
      const cleanJobTitleIn = Array.isArray(jobTitleIn)
        ? jobTitleIn.map((value) => String(value)).filter(Boolean)
        : [];

      const query = {
        "assignedFreelancer.freelancerId": freelancerId,
        "assignedFreelancer.status": cleanStatusIn.length
          ? { $in: cleanStatusIn }
          : { $in: ["finished", "left"] },
      };

      if (cleanJobTitleIn.length) {
        query.title = { $in: cleanJobTitleIn };
      }

      if (cleanEmployerIn.length) {
        const employerDocs = await Employer.find({
          companyName: { $in: cleanEmployerIn },
        })
          .select("employerId")
          .lean();
        const employerIds = employerDocs
          .map((entry) => entry.employerId)
          .filter(Boolean);
        query.employerId = { $in: employerIds };
      }

      if (searchRegex) {
        query.$or = [
          { title: searchRegex },
          { "description.text": searchRegex },
          { "description.skills": { $elemMatch: { $regex: searchRegex } } },
        ];
      }

      const sortMap = {
        newest: { "assignedFreelancer.endDate": -1, updatedAt: -1, _id: -1 },
        oldest: { "assignedFreelancer.endDate": 1, updatedAt: 1, _id: 1 },
        "earned-high": { budget: -1, _id: -1 },
        "earned-low": { budget: 1, _id: 1 },
      };
      const sortSpec = sortMap[sortBy] || sortMap.newest;

      const [historyJobs, total, statusOptions, employerIdOptions, jobTitleOptions] = await Promise.all([
        JobListing.find(query).sort(sortSpec).skip(safeSkip).limit(safeLimit).lean(),
        JobListing.countDocuments(query),
        JobListing.distinct("assignedFreelancer.status", {
          "assignedFreelancer.freelancerId": freelancerId,
          "assignedFreelancer.status": { $in: ["finished", "left"] },
        }),
        JobListing.distinct("employerId", query),
        JobListing.distinct("title", query),
      ]);

      const employerOptionDocs = employerIdOptions.length
        ? await Employer.find({ employerId: { $in: employerIdOptions } })
            .select("companyName")
            .lean()
        : [];

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

      const jobs = historyJobs.map((job) => {
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

      const employerNames = [...new Set(employerOptionDocs.map((entry) => entry.companyName).filter(Boolean))]
        .sort((a, b) => String(a).localeCompare(String(b)));
      const jobTitles = (jobTitleOptions || [])
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
        .sort((a, b) => String(a).localeCompare(String(b)));
      const totalPages = Math.ceil(total / safeLimit) || 1;

      return {
        jobs,
        total,
        filterOptions: {
          statuses: (statusOptions || []).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b))),
          employers: employerNames,
          jobTitles,
        },
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages,
          hasNextPage: safePage < totalPages,
          hasPrevPage: safePage > 1,
        },
      };
    },

    // ──────────────────────────────────────────────
    //  EMPLOYER APPLICATIONS
    // ──────────────────────────────────────────────

    /**
     * GET /api/employer/job_applications/all (GraphQL equivalent)
     */
    employerApplications: async (
      _parent,
      {
        status = "all",
        sort = "premium_oldest",
        limit = 25,
        offset = 0,
        page = null,
        search = "",
        freelancerIn = null,
        jobIn = null,
        statusIn = null,
        ratingIn = null,
      },
      { session }
    ) => {
      if (!session?.user) throw new Error("Unauthorized: Please log in");
      if (session.user.role !== "Employer")
        throw new Error("Access denied. Employer access required.");

      const employerId = session.user.roleId;
      if (!employerId) {
        throw new Error("Employer roleId not found in session");
      }

      const boundedLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
      const safePage = Number.isFinite(Number(page)) && Number(page) > 0
        ? Number(page)
        : Math.floor(Math.max(0, Number(offset) || 0) / boundedLimit) + 1;
      const safeOffset = (safePage - 1) * boundedLimit;
      const searchText = String(search || "").trim();
      const searchRegex = searchText
        ? new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
        : null;
      const cleanFreelancerIn = Array.isArray(freelancerIn)
        ? freelancerIn.map((value) => String(value)).filter(Boolean)
        : [];
      const cleanJobIn = Array.isArray(jobIn)
        ? jobIn.map((value) => String(value)).filter(Boolean)
        : [];
      const cleanStatusIn = Array.isArray(statusIn)
        ? statusIn.map((value) => String(value)).filter(Boolean)
        : [];
      const cleanRatingIn = Array.isArray(ratingIn)
        ? ratingIn.map((value) => Number(value)).filter((value) => Number.isFinite(value))
        : [];

      const jobs = await JobListing.find({ employerId })
        .select("jobId title")
        .lean();
      const jobIds = jobs.map((job) => job.jobId);

      if (!jobIds.length) {
        return {
          applications: [],
          stats: {
            total: 0,
            pending: 0,
            accepted: 0,
            rejected: 0,
          },
          total: 0,
          hasMore: false,
        };
      }

      const matchQuery = { jobId: { $in: jobIds } };
      if (status && status !== "all") {
        matchQuery.status = status;
      }
      if (cleanStatusIn.length) {
        matchQuery.status = { $in: cleanStatusIn };
      }

      const sortStage =
        sort === "newest"
          ? { appliedDate: -1, _id: -1 }
          : sort === "oldest"
          ? { appliedDate: 1, _id: 1 }
          : sort === "name_asc"
          ? { freelancerName: 1, _id: 1 }
          : sort === "name_desc"
          ? { freelancerName: -1, _id: -1 }
          : sort === "rating_desc"
          ? { skillRating: -1, _id: -1 }
          : sort === "rating_asc"
          ? { skillRating: 1, _id: 1 }
          : { isPremium: -1, appliedDate: 1, _id: 1 };

      const [facet] = await JobApplication.aggregate([
        { $match: matchQuery },
        {
          $lookup: {
            from: "users",
            localField: "freelancerId",
            foreignField: "roleId",
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
          $lookup: {
            from: "job_listings",
            localField: "jobId",
            foreignField: "jobId",
            as: "job",
          },
        },
        {
          $unwind: {
            path: "$job",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            freelancerName: "$freelancerUser.name",
            freelancerEmail: "$freelancerUser.email",
            freelancerPhone: "$freelancerUser.phone",
            freelancerPicture: "$freelancerUser.picture",
            freelancerUserId: "$freelancerUser.userId",
            skillRating: { $ifNull: ["$freelancerUser.rating", 0] },
            isPremium: { $eq: ["$freelancerUser.subscription", "Premium"] },
            jobTitle: "$job.title",
          },
        },
        ...(searchRegex
          ? [
              {
                $match: {
                  $or: [
                    { freelancerName: searchRegex },
                    { freelancerEmail: searchRegex },
                    { jobTitle: searchRegex },
                  ],
                },
              },
            ]
          : []),
        ...(cleanFreelancerIn.length
          ? [{ $match: { freelancerName: { $in: cleanFreelancerIn } } }]
          : []),
        ...(cleanJobIn.length
          ? [{ $match: { jobTitle: { $in: cleanJobIn } } }]
          : []),
        ...(cleanRatingIn.length
          ? [{ $match: { skillRating: { $in: cleanRatingIn } } }]
          : []),
        {
          $facet: {
            rows: [
              { $sort: sortStage },
              { $skip: safeOffset },
              { $limit: boundedLimit },
              {
                $project: {
                  _id: 0,
                  applicationId: 1,
                  jobId: 1,
                  freelancerId: 1,
                  status: 1,
                  appliedDate: { $ifNull: ["$appliedDate", "$createdAt"] },
                  coverMessage: 1,
                  resumeLink: 1,
                  freelancerUserId: 1,
                  freelancerName: { $ifNull: ["$freelancerName", "Unknown Freelancer"] },
                  freelancerPicture: "$freelancerPicture",
                  freelancerEmail: "$freelancerEmail",
                  freelancerPhone: "$freelancerPhone",
                  skillRating: 1,
                  jobTitle: { $ifNull: ["$jobTitle", "Unknown Job"] },
                  isPremium: 1,
                },
              },
            ],
            total: [{ $count: "count" }],
            stats: [
              {
                $group: {
                  _id: "$status",
                  count: { $sum: 1 },
                },
              },
            ],
            filterOptions: [
              {
                $group: {
                  _id: null,
                  freelancers: { $addToSet: "$freelancerName" },
                  jobs: { $addToSet: "$jobTitle" },
                  statuses: { $addToSet: "$status" },
                  ratings: { $addToSet: "$skillRating" },
                },
              },
            ],
          },
        },
      ]);

      const rows = facet?.rows || [];
      const total = facet?.total?.[0]?.count || 0;
      const statsMap = Object.fromEntries((facet?.stats || []).map((row) => [row._id, row.count]));
      const totalPages = Math.ceil(total / boundedLimit) || 1;
      const optionBucket = facet?.filterOptions?.[0] || {};

      return {
        applications: rows,
        stats: {
          total,
          pending: statsMap.Pending || 0,
          accepted: statsMap.Accepted || 0,
          rejected: statsMap.Rejected || 0,
        },
        total,
        hasMore: safeOffset + rows.length < total,
        filterOptions: {
          freelancers: (optionBucket.freelancers || []).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b))),
          jobs: (optionBucket.jobs || []).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b))),
          statuses: (optionBucket.statuses || []).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b))),
          ratings: (optionBucket.ratings || []).map((value) => Number(value)).filter((value) => Number.isFinite(value)).sort((a, b) => a - b),
        },
        pagination: {
          page: safePage,
          limit: boundedLimit,
          total,
          totalPages,
          hasNextPage: safePage < totalPages,
          hasPrevPage: safePage > 1,
        },
      };
    },

    employerApplicationDetail: async (
      _parent,
      { applicationId },
      { session }
    ) => {
      const user = session?.user;
      if (!user || !user.roleId) {
        throw new Error("Unauthorized");
      }

      const employerId = user.roleId;
      const application = await JobApplication.findOne({ applicationId }).lean();
      if (!application) {
        throw new Error("Application not found");
      }

      const job = await JobListing.findOne({
        jobId: application.jobId,
        employerId,
      }).lean();

      if (!job) {
        throw new Error("Application does not belong to this employer");
      }

      const freelancerUser = await User.findOne({ roleId: application.freelancerId })
        .select("userId roleId name picture email phone rating subscription aboutMe")
        .lean();

      const freelancerProfile = await Freelancer.findOne({
        freelancerId: application.freelancerId,
      })
        .select("skills portfolio resume")
        .lean();

      const feedbacks = freelancerUser?.userId
        ? await Feedback.find({ toUserId: freelancerUser.userId })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean()
        : [];

      const feedbackTotal = freelancerUser?.userId
        ? await Feedback.countDocuments({ toUserId: freelancerUser.userId })
        : 0;

      const feedbackStats = freelancerUser?.userId
        ? await Feedback.aggregate([
            { $match: { toUserId: freelancerUser.userId } },
            {
              $group: {
                _id: null,
                averageRating: { $avg: "$rating" },
              },
            },
          ])
        : [];

      const reviewerIds = [...new Set(feedbacks.map((entry) => entry.fromUserId))];
      const reviewers = reviewerIds.length
        ? await User.find({ userId: { $in: reviewerIds } })
            .select("userId name picture")
            .lean()
        : [];
      const reviewerMap = new Map(reviewers.map((entry) => [entry.userId, entry]));

      const jobSkills = Array.isArray(job.description?.skills)
        ? job.description.skills
        : [];
      const freelancerSkills = Array.isArray(freelancerProfile?.skills)
        ? freelancerProfile.skills
        : [];

      const normalizedFreelancerSkillSet = new Set(
        freelancerSkills.map((skill) => String(skill).trim().toLowerCase())
      );

      const matchedSkills = jobSkills.filter((skill) =>
        normalizedFreelancerSkillSet.has(String(skill).trim().toLowerCase())
      );

      const missingSkills = jobSkills.filter(
        (skill) =>
          !normalizedFreelancerSkillSet.has(String(skill).trim().toLowerCase())
      );

      const matchScore =
        jobSkills.length > 0
          ? Math.round((matchedSkills.length / jobSkills.length) * 100)
          : 0;

      const avgFeedbackRating =
        feedbackStats.length > 0
          ? Number((feedbackStats[0].averageRating || 0).toFixed(1))
          : 0;

      return {
        applicationId: application.applicationId,
        jobId: application.jobId,
        freelancerId: application.freelancerId,
        freelancerUserId: freelancerUser?.userId || null,
        status: application.status,
        appliedDate: toIsoString(application.appliedDate),
        coverMessage: application.coverMessage || "",
        resumeLink: SHARED_RESUME_URL,
        freelancerName: freelancerUser?.name || "Unknown Freelancer",
        freelancerPicture: freelancerUser?.picture || null,
        freelancerEmail: freelancerUser?.email || null,
        freelancerPhone: freelancerUser?.phone || null,
        freelancerRating: Number(freelancerUser?.rating || 0),
        skillRating: Number(freelancerUser?.rating || 0),
        isPremium: freelancerUser?.subscription === "Premium",
        freelancerAbout: freelancerUser?.aboutMe || "",
        freelancerSkills,
        freelancerPortfolio: Array.isArray(freelancerProfile?.portfolio)
          ? freelancerProfile.portfolio
          : [],
        jobTitle: job.title,
        jobDescription: {
          text: job.description?.text || "",
          responsibilities: Array.isArray(job.description?.responsibilities)
            ? job.description.responsibilities
            : [],
          requirements: Array.isArray(job.description?.requirements)
            ? job.description.requirements
            : [],
          skills: jobSkills,
        },
        feedbackReviews: feedbacks.map((entry) => ({
          feedbackId: entry.feedbackId,
          fromUserId: entry.fromUserId,
          fromUserName: entry.anonymous
            ? "Anonymous"
            : reviewerMap.get(entry.fromUserId)?.name || "Unknown User",
          fromUserPicture: entry.anonymous
            ? null
            : reviewerMap.get(entry.fromUserId)?.picture || null,
          rating: entry.rating,
          comment: entry.comment || "",
          tags: Array.isArray(entry.tags) ? entry.tags : [],
          createdAt: toIsoString(entry.createdAt),
        })),
        feedbackTotal,
        jobMatch: {
          matchScore,
          matchedSkills,
          missingSkills,
          hasPortfolio: Array.isArray(freelancerProfile?.portfolio)
            ? freelancerProfile.portfolio.length > 0
            : false,
          hasResume: true,
          feedbackCount: feedbackTotal,
          averageFeedbackRating: avgFeedbackRating,
        },
      };
    },

    // ──────────────────────────────────────────────
    //  FREELANCER APPLICATIONS
    // ──────────────────────────────────────────────

    /**
     * GET /api/freelancer/applications
     * Before: bulk JobListing.find + bulk Employer.find (already batched in REST)
     * GraphQL version keeps the same batching but lets clients pick fields
     */
    // ── Admin dashboard queries (delegated to adminResolvers.js) ──
    ...adminResolvers,
    ...moderatorQueryResolvers,
    ...employerResolvers,

    freelancerApplications: async (_parent, args, { session }) => {
      if (!session?.user) throw new Error("Unauthorized: Please log in");
      if (session.user.role !== "Freelancer")
        throw new Error("Access denied. Freelancer access required.");

      const {
        search = "",
        sortBy = "date-newest",
        statusIn = null,
        jobTypeIn = null,
        page = 1,
        limit = 25,
      } = args || {};

      const freelancerId = session.user.roleId;
      const safeLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
      const safePage = Math.max(1, Number(page) || 1);
      const safeSkip = (safePage - 1) * safeLimit;
      const searchText = String(search || "").trim();
      const searchRegex = searchText
        ? new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
        : null;
      const cleanStatusIn = Array.isArray(statusIn)
        ? statusIn.map((value) => String(value)).filter(Boolean)
        : [];
      const cleanJobTypeIn = Array.isArray(jobTypeIn)
        ? jobTypeIn.map((value) => String(value)).filter(Boolean)
        : [];

      const baseMatch = { freelancerId };
      if (cleanStatusIn.length) {
        baseMatch.status = { $in: cleanStatusIn };
      }

      const sortMap = {
        "date-newest": { appliedDate: -1, _id: -1 },
        "date-oldest": { appliedDate: 1, _id: 1 },
        "budget-high": { budget: -1, _id: -1 },
        "budget-low": { budget: 1, _id: 1 },
        status: { status: 1, _id: 1 },
      };
      const dbSort = sortMap[sortBy] || sortMap["date-newest"];

      const pipeline = [
        { $match: baseMatch },
        {
          $lookup: {
            from: "job_listings",
            localField: "jobId",
            foreignField: "jobId",
            as: "job",
          },
        },
        {
          $unwind: {
            path: "$job",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "employers",
            localField: "job.employerId",
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
          $addFields: {
            jobTitle: { $ifNull: ["$job.title", "N/A"] },
            company: { $ifNull: ["$employer.companyName", "Unknown"] },
            jobType: { $ifNull: ["$job.jobType", "N/A"] },
            budget: { $toDouble: { $ifNull: ["$job.budget", 0] } },
            location: { $ifNull: ["$job.location", "N/A"] },
            experienceLevel: { $ifNull: ["$job.experienceLevel", "N/A"] },
            skillsRequired: {
              $cond: [
                { $isArray: "$job.skillsRequired" },
                "$job.skillsRequired",
                {
                  $cond: [
                    { $isArray: "$job.description.skills" },
                    "$job.description.skills",
                    [],
                  ],
                },
              ],
            },
            logo: "$employer.logo",
          },
        },
      ];

      if (cleanJobTypeIn.length) {
        pipeline.push({ $match: { jobType: { $in: cleanJobTypeIn } } });
      }

      if (searchRegex) {
        pipeline.push({
          $match: {
            $or: [{ jobTitle: searchRegex }, { company: searchRegex }],
          },
        });
      }

      const [facet] = await JobApplication.aggregate([
        ...pipeline,
        {
          $facet: {
            rows: [
              { $sort: dbSort },
              { $skip: safeSkip },
              { $limit: safeLimit },
              {
                $project: {
                  _id: 0,
                  applicationId: 1,
                  jobId: 1,
                  jobTitle: 1,
                  company: 1,
                  logo: 1,
                  appliedDate: { $ifNull: ["$appliedDate", "$createdAt"] },
                  status: 1,
                  coverMessage: 1,
                  resumeLink: 1,
                  budget: 1,
                  location: 1,
                  jobType: 1,
                  skillsRequired: 1,
                  experienceLevel: 1,
                },
              },
            ],
            total: [{ $count: "count" }],
            stats: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
            jobTypeOptions: [{ $group: { _id: "$jobType" } }],
          },
        },
      ]);

      const result = facet?.rows || [];
      const total = facet?.total?.[0]?.count || 0;
      const totalPages = Math.ceil(total / safeLimit) || 1;
      const statsMap = Object.fromEntries(((facet?.stats || [])).map((row) => [row._id, row.count]));
      const jobTypeOptions = (facet?.jobTypeOptions || [])
        .map((row) => row?._id)
        .filter(Boolean)
        .sort((a, b) => String(a).localeCompare(String(b)));

      return {
        applications: result,
        stats: {
          total,
          pending: statsMap.Pending || 0,
          accepted: statsMap.Accepted || 0,
          rejected: statsMap.Rejected || 0,
        },
        total,
        filterOptions: {
          statuses: ["Pending", "Accepted", "Rejected"],
          jobTypes: (jobTypeOptions || []).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b))),
        },
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages,
          hasNextPage: safePage < totalPages,
          hasPrevPage: safePage > 1,
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

  Mutation: {
    moderatorDeleteBlog: async (_parent, args, context) =>
      moderatorDeleteBlog(_parent, args, context),
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
