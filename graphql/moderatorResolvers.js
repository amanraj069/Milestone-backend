const moderatorController = require("../controllers/moderatorController");
const blogController = require("../controllers/blogController");
const quizController = require("../controllers/quizController");

function requireModerator(session) {
  if (!session?.user || session.user.role !== "Moderator") {
    throw new Error("Access denied. Moderator access required.");
  }
}

function encodeCursor(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

function decodeCursor(cursorValue) {
  if (!cursorValue) return null;
  try {
    return JSON.parse(Buffer.from(cursorValue, "base64").toString("utf8"));
  } catch (_error) {
    return null;
  }
}

async function invokeController(controllerFn, { session, query = {}, params = {}, body = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = { session, query, params, body };
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        if (this.statusCode >= 400 || payload?.success === false) {
          const err = new Error(payload?.message || payload?.error || "Request failed");
          err.statusCode = this.statusCode;
          err.payload = payload;
          reject(err);
          return;
        }
        resolve(payload);
      },
    };

    Promise.resolve(controllerFn(req, res)).catch(reject);
  });
}

function toConnection(items, page, hasNextPage, endCursorPayload) {
  const edges = (items || []).map((node, index) => ({
    node,
    cursor: encodeCursor({ page, index }),
  }));

  return {
    edges,
    pageInfo: {
      hasNextPage: Boolean(hasNextPage),
      endCursor: hasNextPage ? encodeCursor(endCursorPayload || { page }) : null,
    },
  };
}

function pageFromCursor(after) {
  const decoded = decodeCursor(after);
  if (!decoded || !Number.isFinite(decoded.page)) return 1;
  return Math.max(1, Number(decoded.page) + 1);
}

function normalizedPage(page, after) {
  if (Number.isFinite(Number(page)) && Number(page) > 0) {
    return Number(page);
  }
  return pageFromCursor(after);
}

const moderatorResolvers = {
  moderatorBlogs: async (
    _parent,
    {
      first = 25,
      after = null,
      page = null,
      search = "",
      searchBy = "title",
      categoryIn = null,
      featuredIn = null,
      sortBy = "createdAt",
      sortOrder = "desc",
    },
    { session },
  ) => {
    requireModerator(session);

    const requestedPage = normalizedPage(page, after);
    const limit = Math.min(100, Math.max(1, Number(first) || 25));

    const category = Array.isArray(categoryIn) && categoryIn.length
      ? categoryIn[0]
      : "all";

    let featured = "all";
    if (Array.isArray(featuredIn) && featuredIn.length) {
      const normalized = String(featuredIn[0]).toLowerCase();
      if (normalized === "featured" || normalized === "non-featured") {
        featured = normalized;
      }
    }

    const normalizedSortBy = sortBy === "title"
      ? sortOrder === "asc" ? "title-asc" : "title-desc"
      : sortOrder === "asc" ? "date-asc" : "date-desc";

    const payload = await invokeController(blogController.getModeratorBlogs, {
      session,
      query: {
        page: requestedPage,
        limit,
        search,
        searchBy,
        category,
        featured,
        sortBy: normalizedSortBy,
      },
    });

    const blogs = payload.blogs || [];
    const connection = toConnection(
      blogs,
      requestedPage,
      payload.pagination?.hasNextPage,
      { page: requestedPage },
    );

    return {
      ...connection,
      total: payload.total || 0,
    };
  },

  moderatorBlogsMeta: async (_parent, _args, { session }) => {
    requireModerator(session);
    const payload = await invokeController(blogController.getModeratorBlogs, {
      session,
      query: { page: 1, limit: 1 },
    });

    return {
      summary: payload.summary || { totalBlogs: 0, publishedBlogs: 0, featuredBlogs: 0 },
      filterOptions: payload.filterOptions || { categories: [], featured: [] },
    };
  },

  moderatorQuizzes: async (
    _parent,
    { first = 25, after = null, page = null, search = "", sortBy = "newest" },
    { session },
  ) => {
    requireModerator(session);

    const requestedPage = normalizedPage(page, after);
    const limit = Math.min(100, Math.max(1, Number(first) || 25));

    const payload = await invokeController(quizController.listQuizzes, {
      session,
      query: { page: requestedPage, limit, search, sortBy },
    });

    const data = payload.data || {};
    const quizzes = data.quizzes || [];
    const connection = toConnection(quizzes, requestedPage, data.pagination?.hasNextPage, { page: requestedPage });

    return {
      ...connection,
      total: data.total || 0,
    };
  },

  moderatorQuizzesMeta: async (_parent, _args, { session }) => {
    requireModerator(session);
    const payload = await invokeController(quizController.listQuizzes, {
      session,
      query: { page: 1, limit: 1 },
    });

    const data = payload.data || {};
    return {
      summary: data.summary || { totalQuizzes: 0, totalQuestions: 0, avgPassingScore: 0 },
      filterOptions: data.filterOptions || { skills: [] },
    };
  },

  moderatorQuizAttempts: async (
    _parent,
    { quizId, first = 20, after = null, page = null },
    { session },
  ) => {
    requireModerator(session);

    const requestedPage = normalizedPage(page, after);
    const limit = Math.min(100, Math.max(1, Number(first) || 20));

    const payload = await invokeController(quizController.getQuizAttempts, {
      session,
      params: { id: quizId },
      query: { page: requestedPage, limit },
    });

    const data = payload.data || {};
    const attempts = data.attempts || [];
    const connection = toConnection(attempts, requestedPage, data.pagination?.hasNextPage, { page: requestedPage });

    return {
      ...connection,
      total: data.totalAttempts || 0,
      quizTitle: data.quizTitle || "",
      skillName: data.skillName || "",
      passingScore: data.passingScore || 0,
      passedAttempts: data.passedAttempts || 0,
    };
  },

  moderatorFreelancers: async (
    _parent,
    {
      first = 25,
      after = null,
      page = null,
      search = "",
      sortBy = "recent",
      nameIn = null,
      emailIn = null,
      phoneIn = null,
      ratingIn = null,
      subscribedIn = null,
      durationIn = null,
    },
    { session },
  ) => {
    requireModerator(session);
    const requestedPage = normalizedPage(page, after);
    const limit = Math.min(100, Math.max(1, Number(first) || 25));

    const payload = await invokeController(moderatorController.getAllFreelancers, {
      session,
      query: {
        page: requestedPage,
        limit,
        search,
        sortBy,
        nameIn,
        emailIn,
        phoneIn,
        ratingIn,
        subscribedIn,
        durationIn,
      },
    });

    const items = payload.freelancers || [];
    const connection = toConnection(items, requestedPage, payload.pagination?.hasNextPage, { page: requestedPage });

    return {
      ...connection,
      total: payload.total || 0,
    };
  },

  moderatorFreelancersMeta: async (_parent, _args, { session }) => {
    requireModerator(session);
    const payload = await invokeController(moderatorController.getAllFreelancers, {
      session,
      query: { page: 1, limit: 1 },
    });

    return {
      filterOptions: payload.filterOptions || {
        names: [], emails: [], phones: [], ratings: [], subscribed: [], durations: [],
      },
    };
  },

  moderatorEmployers: async (
    _parent,
    {
      first = 25,
      after = null,
      page = null,
      search = "",
      sortBy = "recent",
      nameIn = null,
      companyIn = null,
      emailIn = null,
      phoneIn = null,
      ratingIn = null,
      subscribedIn = null,
      durationIn = null,
    },
    { session },
  ) => {
    requireModerator(session);
    const requestedPage = normalizedPage(page, after);
    const limit = Math.min(100, Math.max(1, Number(first) || 25));

    const payload = await invokeController(moderatorController.getAllEmployers, {
      session,
      query: {
        page: requestedPage,
        limit,
        search,
        sortBy,
        nameIn,
        companyIn,
        emailIn,
        phoneIn,
        ratingIn,
        subscribedIn,
        durationIn,
      },
    });

    const items = payload.employers || [];
    const connection = toConnection(items, requestedPage, payload.pagination?.hasNextPage, { page: requestedPage });

    return {
      ...connection,
      total: payload.total || 0,
    };
  },

  moderatorEmployersMeta: async (_parent, _args, { session }) => {
    requireModerator(session);
    const payload = await invokeController(moderatorController.getAllEmployers, {
      session,
      query: { page: 1, limit: 1 },
    });

    return {
      filterOptions: payload.filterOptions || {
        names: [], companies: [], emails: [], phones: [], ratings: [], subscribed: [], durations: [],
      },
    };
  },

  moderatorJobListings: async (
    _parent,
    {
      first = 25,
      after = null,
      page = null,
      search = "",
      sortBy = "recent",
      titleIn = null,
      companyIn = null,
      typeIn = null,
      statusIn = null,
    },
    { session },
  ) => {
    requireModerator(session);
    const requestedPage = normalizedPage(page, after);
    const limit = Math.min(100, Math.max(1, Number(first) || 25));

    const payload = await invokeController(moderatorController.getAllJobListings, {
      session,
      query: {
        page: requestedPage,
        limit,
        search,
        sortBy,
        titleIn,
        companyIn,
        typeIn,
        statusIn,
      },
    });

    const items = payload.jobs || [];
    const connection = toConnection(items, requestedPage, payload.pagination?.hasNextPage, { page: requestedPage });

    return {
      ...connection,
      total: payload.total || 0,
    };
  },

  moderatorJobListingsMeta: async (_parent, _args, { session }) => {
    requireModerator(session);
    const payload = await invokeController(moderatorController.getAllJobListings, {
      session,
      query: { page: 1, limit: 1 },
    });

    return {
      filterOptions: payload.filterOptions || { titles: [], companies: [], types: [], statuses: [] },
    };
  },

  moderatorApprovals: async (
    _parent,
    {
      first = 25,
      after = null,
      page = null,
      status = "all",
      search = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      nameIn = null,
      emailIn = null,
      companyIn = null,
      locationIn = null,
      statusIn = null,
    },
    { session },
  ) => {
    requireModerator(session);
    const requestedPage = normalizedPage(page, after);
    const limit = Math.min(100, Math.max(1, Number(first) || 25));

    const payload = await invokeController(moderatorController.getPendingApprovals, {
      session,
      query: {
        page: requestedPage,
        limit,
        status,
        search,
        sortBy,
        sortOrder,
        nameIn,
        emailIn,
        companyIn,
        locationIn,
        statusIn,
      },
    });

    const items = payload.pendingApprovals || [];
    const connection = toConnection(items, requestedPage, payload.pagination?.hasNextPage, { page: requestedPage });

    return {
      ...connection,
      total: payload.count || 0,
    };
  },

  moderatorApprovalsMeta: async (_parent, _args, { session }) => {
    requireModerator(session);
    const payload = await invokeController(moderatorController.getPendingApprovals, {
      session,
      query: { page: 1, limit: 1, status: "all" },
    });

    return {
      filterOptions: payload.filterOptions || { names: [], emails: [], companies: [], locations: [], statuses: [] },
    };
  },

  moderatorComplaints: async (
    _parent,
    {
      first = 25,
      after = null,
      page = null,
      search = "",
      sortBy = "date",
      sortOrder = "desc",
      complainantTypeIn = null,
      againstIn = null,
      jobIn = null,
      statusIn = null,
      priorityIn = null,
      typeIn = null,
    },
    { session },
  ) => {
    requireModerator(session);
    const requestedPage = normalizedPage(page, after);
    const limit = Math.min(100, Math.max(1, Number(first) || 25));

    const payload = await invokeController(moderatorController.getAllComplaints, {
      session,
      query: {
        page: requestedPage,
        limit,
        search,
        sortBy,
        sortOrder,
        complainantTypeIn,
        againstIn,
        jobIn,
        statusIn,
        priorityIn,
        typeIn,
      },
    });

    const items = payload.complaints || [];
    const connection = toConnection(items, requestedPage, payload.pagination?.hasNextPage, { page: requestedPage });

    return {
      ...connection,
      total: payload.total || 0,
    };
  },

  moderatorComplaintsMeta: async (_parent, _args, { session }) => {
    requireModerator(session);
    const payload = await invokeController(moderatorController.getAllComplaints, {
      session,
      query: { page: 1, limit: 1 },
    });

    return {
      summary: payload.stats || { total: 0, pending: 0, underReview: 0, resolved: 0, rejected: 0 },
      filterOptions: payload.filterOptions || {
        complainantTypes: [], against: [], jobs: [], statuses: [], priorities: [], types: [],
      },
    };
  },

  moderatorDeleteBlog: async (_parent, { blogId }, { session }) => {
    requireModerator(session);

    const payload = await invokeController(blogController.deleteBlog, {
      session,
      params: { blogId },
    });

    return {
      success: Boolean(payload?.success),
      message: payload?.message || "Blog deleted successfully",
    };
  },
};

module.exports = moderatorResolvers;
