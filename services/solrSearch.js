/**
 * Solr Search Service
 *
 * Builds eDisMax queries with faceting, filtering, highlighting,
 * and pagination.  Returns a normalised response shape that the
 * API layer forwards directly to the frontend.
 */

const solrClient = require("../config/solr");

/* ------------------------------------------------------------------ */
/*  Default field boosts per core                                      */
/* ------------------------------------------------------------------ */

const FIELD_BOOSTS = {
  jobs: "title^3 skills^2 description^1.5 location^1",
  blogs: "title^3 tagline^1.5 description^1.2 author^1",
};

const PHRASE_BOOSTS = {
  jobs: "title^5 description^2",
  blogs: "title^5 description^2",
};

/* ------------------------------------------------------------------ */
/*  Facet configuration per core                                       */
/* ------------------------------------------------------------------ */

const FACET_FIELDS = {
  jobs: ["jobType", "experienceLevel", "remote", "skills_facet"],
  blogs: ["category", "featured"],
};

/* ------------------------------------------------------------------ */
/*  Sort mapping                                                       */
/* ------------------------------------------------------------------ */

const SORT_MAP = {
  relevance: "score desc",
  date_desc: "postedDate desc",
  date_asc: "postedDate asc",
  budget_desc: "budget desc",
  budget_asc: "budget asc",
  views_desc: "views desc",
  likes_desc: "likes desc",
};

/* ------------------------------------------------------------------ */
/*  Main search function                                               */
/* ------------------------------------------------------------------ */

/**
 * Execute a search against a Solr core.
 *
 * @param {object} opts
 * @param {"jobs"|"blogs"} opts.type     - Which core to search
 * @param {string}         opts.q        - User query string
 * @param {number}         opts.page     - 1-indexed page number
 * @param {number}         opts.limit    - Results per page (max 50)
 * @param {object}         opts.filters  - Filter object (see below)
 * @param {string}         opts.sort     - Sort key from SORT_MAP
 *
 * Filters (all optional):
 *   - category        {string}
 *   - jobType         {string}
 *   - experienceLevel {string}
 *   - remote          {boolean}
 *   - budgetMin       {number}
 *   - budgetMax       {number}
 *   - status          {string}   – defaults to "open" for jobs, "published" for blogs
 *
 * @returns {object}  { results, total, page, totalPages, facets, highlights }
 */
async function search({
  type = "jobs",
  q = "*",
  page = 1,
  limit = 10,
  filters = {},
  sort = "relevance",
}) {
  const core = solrClient.cores[type] || solrClient.cores.jobs;
  const rows = Math.min(Math.max(1, limit), 50);
  const start = (Math.max(1, page) - 1) * rows;

  // Base params
  const params = {
    q: q && q.trim() ? q.trim() : "*:*",
    defType: "edismax",
    qf: FIELD_BOOSTS[type] || FIELD_BOOSTS.jobs,
    pf: PHRASE_BOOSTS[type] || PHRASE_BOOSTS.jobs,
    mm: "75%",
    tie: 0.1,
    start,
    rows,
    sort: SORT_MAP[sort] || SORT_MAP.relevance,
    fl: "*,score",

    // Highlighting
    hl: "true",
    "hl.fl": "title,description,tagline",
    "hl.tag.pre": "<mark>",
    "hl.tag.post": "</mark>",
    "hl.snippets": 3,
    "hl.fragsize": 150,
    "hl.method": "unified",

    // Faceting
    facet: "true",
    "facet.mincount": 1,
  };

  // Add facet fields
  const facetFields = FACET_FIELDS[type] || FACET_FIELDS.jobs;
  params["facet.field"] = facetFields;

  // ── Boost queries ─────────────────────────────────
  // Boosted jobs rank higher
  if (type === "jobs") {
    params.bq = "isBoosted:true^2";
  }

  // ── Filter queries ────────────────────────────────
  const fq = [];

  // Default status filter
  if (!filters.status) {
    fq.push(type === "jobs" ? "status:open" : "status:published");
  } else {
    fq.push(`status:${filters.status}`);
  }

  if (filters.category) {
    fq.push(`category:"${filters.category}"`);
  }
  if (filters.jobType) {
    fq.push(`jobType:"${filters.jobType}"`);
  }
  if (filters.experienceLevel) {
    fq.push(`experienceLevel:"${filters.experienceLevel}"`);
  }
  if (filters.remote !== undefined && filters.remote !== "") {
    fq.push(`remote:${filters.remote}`);
  }
  if (filters.featured !== undefined && filters.featured !== "") {
    fq.push(`featured:${filters.featured}`);
  }

  // Budget range
  if (filters.budgetMin || filters.budgetMax) {
    const min = filters.budgetMin || "*";
    const max = filters.budgetMax || "*";
    fq.push(`budget:[${min} TO ${max}]`);
  }

  if (fq.length > 0) {
    params.fq = fq;
  }

  // ── Execute query ──────────────────────────────────
  const raw = await solrClient.query(core, params);

  // ── Normalise response ─────────────────────────────
  const docs = raw.response?.docs || [];
  const total = raw.response?.numFound || 0;
  const totalPages = Math.ceil(total / rows);

  // Merge highlighting into documents
  const highlighting = raw.highlighting || {};
  const results = docs.map((doc) => ({
    ...doc,
    highlights: highlighting[doc.id] || {},
  }));

  // Normalise facets: { fieldName: { value: count, ... } }
  const rawFacets = raw.facet_counts?.facet_fields || {};
  const facets = {};
  for (const [field, values] of Object.entries(rawFacets)) {
    facets[field] = {};
    // Solr returns facets as interleaved [value, count, value, count, ...]
    for (let i = 0; i < values.length; i += 2) {
      facets[field][values[i]] = values[i + 1];
    }
  }

  return {
    results,
    total,
    page: Math.max(1, page),
    totalPages,
    facets,
  };
}

/* ------------------------------------------------------------------ */
/*  Suggest / Autocomplete                                             */
/* ------------------------------------------------------------------ */

/**
 * Get autocomplete suggestions from Solr.
 * @param {"jobs"|"blogs"} type  - Core to query
 * @param {string}         query - Partial user input
 * @returns {string[]}     Array of suggestion strings
 */
async function suggest(type = "jobs", query = "") {
  if (!query || query.trim().length < 2) return [];
  const core = solrClient.cores[type] || solrClient.cores.jobs;
  return solrClient.suggest(core, query.trim());
}

module.exports = { search, suggest };
