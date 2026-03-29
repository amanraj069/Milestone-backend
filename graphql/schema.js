const { buildSchema } = require("graphql");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const User = require("../models/user");
const JobListing = require("../models/job_listing");
const JobApplication = require("../models/job_application");

const schema = buildSchema(`
  type Query {
    health: String!
    chatConversations(limit: Int = 20, offset: Int = 0): [ChatConversation!]!
    messagesWithUser(userId: String!, limit: Int = 50, offset: Int = 0): MessageResult!
    employerApplications(status: String = "all", sort: String = "premium_oldest", limit: Int = 50, offset: Int = 0): EmployerApplicationResult!
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
};

module.exports = {
  schema,
  resolvers,
};
