/**
 * Fallback Search Service
 *
 * When Solr is unreachable the API falls back to a basic MongoDB
 * text search.  Results are returned in the same shape as the Solr
 * search response but with `degraded: true` so the frontend can
 * display a banner.
 *
 * NOTE: MongoDB text search requires a text index on the queried
 * fields.  We create the indexes below if they don't already exist.
 */

const JobListing = require("../models/job_listing");
const Blog = require("../models/blog");

/* ------------------------------------------------------------------ */
/*  Ensure MongoDB text indexes exist                                  */
/* ------------------------------------------------------------------ */

let indexesEnsured = false;

async function ensureTextIndexes() {
  if (indexesEnsured) return;
  try {
    // Job Listing: text index on title + description.text + skills
    await JobListing.collection.createIndex(
      {
        title: "text",
        "description.text": "text",
        "description.skills": "text",
        location: "text",
      },
      {
        name: "fallback_text_idx",
        weights: { title: 3, "description.skills": 2, "description.text": 1, location: 1 },
        background: true,
      },
    );

    // Blog: text index on title + tagline + content
    await Blog.collection.createIndex(
      {
        title: "text",
        tagline: "text",
      },
      {
        name: "fallback_text_idx",
        weights: { title: 3, tagline: 1 },
        background: true,
      },
    );

    indexesEnsured = true;
    console.log("[Fallback] MongoDB text indexes ensured.");
  } catch (err) {
    // Index may already exist — that's fine
    if (err.code !== 85 && err.code !== 86) {
      console.error("[Fallback] Failed to create text indexes:", err.message);
    }
    indexesEnsured = true; // Don't retry endlessly
  }
}

/* ------------------------------------------------------------------ */
/*  Fallback search                                                    */
/* ------------------------------------------------------------------ */

/**
 * Execute a basic MongoDB text search.
 *
 * @param {object} opts  - Same shape as solrSearch.search()
 * @returns {object}     - Same response shape + `degraded: true`
 */
async function fallbackSearch({
  type = "jobs",
  q = "",
  page = 1,
  limit = 10,
  filters = {},
  sort = "relevance",
}) {
  await ensureTextIndexes();

  const rows = Math.min(Math.max(1, limit), 50);
  const skip = (Math.max(1, page) - 1) * rows;

  const Model = type === "blogs" ? Blog : JobListing;
  const query = {};

  // Text search
  if (q && q.trim()) {
    query.$text = { $search: q.trim() };
  }

  // Basic filters
  if (type === "jobs") {
    query.status = filters.status || "open";
    if (filters.jobType) query.jobType = filters.jobType;
    if (filters.experienceLevel) query.experienceLevel = filters.experienceLevel;
    if (filters.remote !== undefined && filters.remote !== "") {
      query.remote = filters.remote === true || filters.remote === "true";
    }
    if (filters.budgetMin || filters.budgetMax) {
      query.budget = {};
      if (filters.budgetMin) query.budget.$gte = Number(filters.budgetMin);
      if (filters.budgetMax) query.budget.$lte = Number(filters.budgetMax);
    }
  } else {
    query.status = filters.status || "published";
    if (filters.category) query.category = filters.category;
  }

  // Sort
  let mongoSort = {};
  if (q && q.trim()) {
    mongoSort = { score: { $meta: "textScore" } };
  }
  switch (sort) {
    case "date_desc":
      mongoSort = { ...mongoSort, createdAt: -1 };
      break;
    case "date_asc":
      mongoSort = { ...mongoSort, createdAt: 1 };
      break;
    case "budget_desc":
      mongoSort = { ...mongoSort, budget: -1 };
      break;
    case "budget_asc":
      mongoSort = { ...mongoSort, budget: 1 };
      break;
    default:
      // relevance — textScore is already set above
      break;
  }

  // Execute
  const [docs, total] = await Promise.all([
    Model.find(query)
      .sort(mongoSort)
      .skip(skip)
      .limit(rows)
      .lean(),
    Model.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / rows);

  // Map to a consistent result shape
  const results = docs.map((doc) => {
    if (type === "blogs") {
      return {
        id: doc.blogId,
        doc_type: "blog",
        title: doc.title,
        description: (doc.content || []).map((s) => s.description).join(" "),
        category: doc.category,
        author: doc.author,
        slug: doc.slug,
        imageUrl: doc.imageUrl,
        postedDate: doc.createdAt,
        highlights: {},
      };
    }
    return {
      id: doc.jobId,
      doc_type: "job",
      title: doc.title,
      description: doc.description?.text || "",
      skills: doc.description?.skills || [],
      jobType: doc.jobType,
      experienceLevel: doc.experienceLevel,
      budget: doc.budget,
      remote: doc.remote,
      location: doc.location,
      imageUrl: doc.imageUrl,
      postedDate: doc.postedDate,
      highlights: {},
    };
  });

  return {
    results,
    total,
    page: Math.max(1, page),
    totalPages,
    facets: {}, // No facets in degraded mode
    degraded: true,
  };
}

module.exports = { fallbackSearch };
