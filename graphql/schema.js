const { buildSchema } = require("graphql");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const User = require("../models/user");
const JobListing = require("../models/job_listing");
const JobApplication = require("../models/job_application");
const Freelancer = require("../models/freelancer");
const Feedback = require("../models/Feedback");

const schema = buildSchema(`
  type Query {
    health: String!
    chatConversations(limit: Int = 20, offset: Int = 0): [ChatConversation!]!
    messagesWithUser(userId: String!, limit: Int = 50, offset: Int = 0): MessageResult!
    employerApplications(status: String = "all", sort: String = "premium_oldest", limit: Int = 50, offset: Int = 0): EmployerApplicationResult!
    employerTransactionDetail(jobId: String!): EmployerTransactionDetail
    employerApplicationDetail(applicationId: String!): EmployerApplicationDetail
  }

  type ChatConversation {
    conversationId: String!
    participant: ChatParticipant!
    lastMessage: LastMessage
    unreadCount: Int!
    updatedAt: String
  }

  type ChatParticipant {
    userId: String!
    name: String
    picture: String
    role: String
  }

  type LastMessage {
    messageId: String
    text: String
    sender: String
    timestamp: String
  }

  type ChatMessage {
    messageId: String!
    conversationId: String!
    from: String!
    to: String!
    messageData: String!
    isRead: Boolean!
    createdAt: String
    updatedAt: String
  }

  type MessageResult {
    conversationId: String
    messages: [ChatMessage!]!
    total: Int!
    hasMore: Boolean!
  }

  type EmployerApplication {
    applicationId: String!
    jobId: String!
    freelancerId: String!
    status: String!
    appliedDate: String
    coverMessage: String
    resumeLink: String
    freelancerUserId: String
    freelancerName: String
    freelancerPicture: String
    freelancerEmail: String
    freelancerPhone: String
    skillRating: Float
    jobTitle: String
    isPremium: Boolean!
  }

  type ApplicationStats {
    total: Int!
    pending: Int!
    accepted: Int!
    rejected: Int!
  }

  type EmployerApplicationResult {
    applications: [EmployerApplication!]!
    stats: ApplicationStats!
    total: Int!
    hasMore: Boolean!
  }

  type TransactionMilestone {
    milestoneId: String!
    sno: Int!
    description: String
    payment: Float!
    deadline: String
    status: String
    requested: Boolean!
  }

  type EmployerTransactionDetail {
    jobId: String!
    jobTitle: String
    freelancerId: String
    freelancerName: String
    freelancerPicture: String
    freelancerEmail: String
    status: String
    startDate: String
    endDate: String
    totalBudget: Float!
    paidAmount: Float!
    paymentPercentage: Int!
    projectCompletion: Int!
    milestones: [TransactionMilestone!]!
  }

  type PortfolioItem {
    title: String
    description: String
    image: String
    link: String
  }

  type FeedbackReview {
    feedbackId: String
    fromUserId: String
    fromUserName: String
    fromUserPicture: String
    rating: Int
    comment: String
    tags: [String!]!
    createdAt: String
  }

  type JobDescriptionDetail {
    text: String
    responsibilities: [String!]!
    requirements: [String!]!
    skills: [String!]!
  }

  type JobMatchSignals {
    matchScore: Int!
    matchedSkills: [String!]!
    missingSkills: [String!]!
    hasPortfolio: Boolean!
    hasResume: Boolean!
    feedbackCount: Int!
    averageFeedbackRating: Float!
  }

  type EmployerApplicationDetail {
    applicationId: String!
    jobId: String!
    freelancerId: String!
    freelancerUserId: String
    status: String!
    appliedDate: String
    coverMessage: String
    resumeLink: String
    freelancerName: String
    freelancerPicture: String
    freelancerEmail: String
    freelancerPhone: String
    freelancerRating: Float
    skillRating: Float
    isPremium: Boolean!
    freelancerAbout: String
    freelancerSkills: [String!]!
    freelancerPortfolio: [PortfolioItem!]!
    jobTitle: String
    jobDescription: JobDescriptionDetail
    feedbackReviews: [FeedbackReview!]!
    feedbackTotal: Int!
    jobMatch: JobMatchSignals!
  }
`);

const getSessionUser = (context) => {
  const user = context?.req?.session?.user;
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
};

const toIsoString = (value) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const objectIdToIsoString = (value) => {
  if (!value || typeof value.getTimestamp !== "function") {
    return null;
  }
  return toIsoString(value.getTimestamp());
};

const resolvers = {
  health: () => "ok",

  chatConversations: async ({ limit = 20, offset = 0 }, context) => {
    const user = getSessionUser(context);
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
          .filter(Boolean),
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
      latestMessages.map((entry) => [entry._id, entry]),
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

  messagesWithUser: async ({ userId, limit = 50, offset = 0 }, context) => {
    const user = getSessionUser(context);
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

  employerApplications: async (
    { status = "all", sort = "premium_oldest", limit = 50, offset = 0 },
    context,
  ) => {
    const user = getSessionUser(context);
    const employerId = user.roleId;
    if (!employerId) {
      throw new Error("Employer roleId not found in session");
    }

    const boundedLimit = Math.max(1, Math.min(limit, 100));
    const safeOffset = Math.max(0, offset);

    const jobs = await JobListing.find({ employerId }).select("jobId title").lean();
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

    const query = { jobId: { $in: jobIds } };
    if (status !== "all") {
      query.status = status;
    }

    const applications = await JobApplication.find(query).lean();

    const freelancerIds = [
      ...new Set(applications.map((app) => app.freelancerId)),
    ];

    const users = await User.find({ roleId: { $in: freelancerIds } })
      .select("roleId userId name picture email phone rating subscription")
      .lean();

    const jobMap = new Map(jobs.map((job) => [job.jobId, job]));
    const userMap = new Map(users.map((entry) => [entry.roleId, entry]));

    const enriched = applications.map((application) => {
      const freelancer = userMap.get(application.freelancerId);
      const job = jobMap.get(application.jobId);

      return {
        ...application,
        freelancerUserId: freelancer?.userId || null,
        freelancerName: freelancer?.name || "Unknown Freelancer",
        freelancerPicture: freelancer?.picture || null,
        freelancerEmail: freelancer?.email || null,
        freelancerPhone: freelancer?.phone || null,
        skillRating: Number(freelancer?.rating || 0),
        jobTitle: job?.title || "Unknown Job",
        isPremium: freelancer?.subscription === "Premium",
      };
    });

    if (sort === "newest") {
      enriched.sort((a, b) => new Date(b.appliedDate) - new Date(a.appliedDate));
    } else if (sort === "oldest") {
      enriched.sort((a, b) => new Date(a.appliedDate) - new Date(b.appliedDate));
    } else {
      enriched.sort((a, b) => {
        if (a.isPremium && !b.isPremium) return -1;
        if (!a.isPremium && b.isPremium) return 1;
        return new Date(a.appliedDate) - new Date(b.appliedDate);
      });
    }

    const total = enriched.length;
    const paginated = enriched.slice(safeOffset, safeOffset + boundedLimit);

    return {
      applications: paginated,
      stats: {
        total,
        pending: enriched.filter((app) => app.status === "Pending").length,
        accepted: enriched.filter((app) => app.status === "Accepted").length,
        rejected: enriched.filter((app) => app.status === "Rejected").length,
      },
      total,
      hasMore: safeOffset + paginated.length < total,
    };
  },

  employerTransactionDetail: async ({ jobId }, context) => {
    const user = getSessionUser(context);
    const employerId = user.roleId;
    if (!employerId) {
      throw new Error("Unauthorized");
    }

    const job = await JobListing.findOne({ jobId, employerId }).lean();
    if (!job) {
      throw new Error("Job not found");
    }

    if (!job.assignedFreelancer || !job.assignedFreelancer.freelancerId) {
      throw new Error("No freelancer assigned to this job");
    }

    const freelancerUser = await User.findOne({
      roleId: job.assignedFreelancer.freelancerId,
    })
      .select("roleId name email picture")
      .lean();

    const totalBudget = Number(job.budget) || 0;
    const milestones = Array.isArray(job.milestones) ? job.milestones : [];
    const paidAmount = milestones
      .filter((milestone) => milestone.status === "paid")
      .reduce(
        (sum, milestone) => sum + (Number.parseFloat(milestone.payment) || 0),
        0,
      );
    const paymentPercentage =
      totalBudget > 0 ? Math.round((paidAmount / totalBudget) * 100) : 0;
    const completedMilestones = milestones.filter(
      (milestone) => milestone.status === "paid",
    ).length;
    const projectCompletion =
      milestones.length > 0
        ? Math.round((completedMilestones / milestones.length) * 100)
        : 0;

    return {
      jobId: job.jobId,
      jobTitle: job.title,
      freelancerId: job.assignedFreelancer.freelancerId,
      freelancerName: freelancerUser?.name || "Unknown",
      freelancerPicture: freelancerUser?.picture || "",
      freelancerEmail: freelancerUser?.email || "",
      status: job.assignedFreelancer.status,
      startDate: toIsoString(job.assignedFreelancer.startDate),
      endDate: toIsoString(job.assignedFreelancer.endDate),
      totalBudget,
      paidAmount,
      paymentPercentage,
      projectCompletion,
      milestones: milestones.map((milestone, index) => ({
        milestoneId: milestone.milestoneId,
        sno: index + 1,
        description: milestone.description,
        payment: Number.parseFloat(milestone.payment) || 0,
        deadline: milestone.deadline,
        status: milestone.status,
        requested: Boolean(milestone.requested),
      })),
    };
  },

  employerApplicationDetail: async ({ applicationId }, context) => {
    const user = getSessionUser(context);
    const employerId = user.roleId;
    if (!employerId) {
      throw new Error("Unauthorized");
    }

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
      freelancerSkills.map((skill) => String(skill).trim().toLowerCase()),
    );

    const matchedSkills = jobSkills.filter((skill) =>
      normalizedFreelancerSkillSet.has(String(skill).trim().toLowerCase()),
    );

    const missingSkills = jobSkills.filter(
      (skill) =>
        !normalizedFreelancerSkillSet.has(String(skill).trim().toLowerCase()),
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
      resumeLink: application.resumeLink || freelancerProfile?.resume || "",
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
        hasResume: Boolean(application.resumeLink || freelancerProfile?.resume),
        feedbackCount: feedbackTotal,
        averageFeedbackRating: avgFeedbackRating,
      },
    };
  },
};

module.exports = {
  schema,
  resolvers,
};
