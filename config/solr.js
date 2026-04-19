/**
 * Solr Client — Axios-based HTTP client for Apache Solr.
 *
 * Wraps the Solr REST API with convenience methods for querying,
 * updating, deleting, and fetching suggestions.  Uses axios (already
 * a project dependency) instead of the unmaintained solr-client package.
 */

const axios = require("axios");

const SOLR_BASE_URL = process.env.SOLR_BASE_URL || "http://localhost:8983/solr";
const SOLR_CORE_JOBS = process.env.SOLR_CORE_JOBS || "jobs";
const SOLR_CORE_BLOGS = process.env.SOLR_CORE_BLOGS || "blogs";

// Timeout for all Solr requests (ms)
const SOLR_TIMEOUT = 10000;

/**
 * Build the full URL for a Solr core + handler.
 * @param {string} core  - Solr core name ("jobs" | "blogs")
 * @param {string} handler - Request handler path (e.g. "/select", "/update")
 */
const coreUrl = (core, handler = "") =>
  `${SOLR_BASE_URL}/${core}${handler}`;

/**
 * Create a pre-configured axios instance for Solr requests.
 */
const solrHttp = axios.create({
  timeout: SOLR_TIMEOUT,
  headers: { "Content-Type": "application/json" },
});

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

const solrClient = {
  /** Core names exposed for convenience */
  cores: { jobs: SOLR_CORE_JOBS, blogs: SOLR_CORE_BLOGS },

  /**
   * Execute a SELECT query against a Solr core.
   * @param {string} core   - Core name
   * @param {object} params - Solr query params (q, fq, fl, rows, start, …)
   * @returns {object}      - Raw Solr response body
   */
  async query(core, params = {}) {
    const { data } = await solrHttp.get(coreUrl(core, "/select"), { params });
    return data;
  },

  /**
   * Index one or many documents.
   * @param {string}       core - Core name
   * @param {object|array} docs - Single doc or array of docs
   */
  async update(core, docs) {
    const payload = Array.isArray(docs) ? docs : [docs];
    await solrHttp.post(coreUrl(core, "/update/json/docs?commit=true"), payload);
  },

  /**
   * Index documents without auto-commit (for bulk operations).
   * Call commit() afterwards.
   */
  async updateBatch(core, docs) {
    const payload = Array.isArray(docs) ? docs : [docs];
    await solrHttp.post(coreUrl(core, "/update/json/docs"), payload);
  },

  /**
   * Hard commit pending changes.
   */
  async commit(core) {
    await solrHttp.post(coreUrl(core, "/update"), { commit: {} });
  },

  /**
   * Delete a document by its unique ID.
   * @param {string} core - Core name
   * @param {string} id   - Document ID to delete
   */
  async deleteById(core, id) {
    await solrHttp.post(coreUrl(core, "/update"), {
      delete: { id },
      commit: {},
    });
  },

  /**
   * Delete all documents in a core. Use with care!
   * @param {string} core - Core name
   */
  async deleteAll(core) {
    await solrHttp.post(coreUrl(core, "/update"), {
      delete: { query: "*:*" },
      commit: {},
    });
  },

  /**
   * Fetch autocomplete suggestions.
   * @param {string} core  - Core name
   * @param {string} query - Partial query string
   * @param {number} count - Max suggestions (default 8)
   * @returns {string[]}   - Array of suggestion strings
   */
  async suggest(core, query, count = 8) {
    const { data } = await solrHttp.get(coreUrl(core, "/suggest"), {
      params: {
        "suggest.q": query,
        "suggest.count": count,
      },
    });

    // Extract suggestions from the nested Solr response
    const suggesterResult =
      data?.suggest?.mileSuggester?.[query]?.suggestions || [];
    
    // Robust deduplication: strip <b> tags, trim, and lowercase for comparing uniqueness
    const seen = new Set();
    const uniqueTerms = [];
    const queryLower = query.trim().toLowerCase();
    
    for (const s of suggesterResult) {
      const rawText = (s.term || "").replace(/<\/?b>/g, "").trim().toLowerCase();
      
      // Do not suggest the exact word the user already typed
      if (rawText === queryLower) continue;
      
      if (!seen.has(rawText)) {
        seen.add(rawText);
        // keep the original formatted string
        uniqueTerms.push(s.term);
      }
    }
    return uniqueTerms;
  },

  /**
   * Ping a Solr core to check if it's alive.
   * @param {string} core - Core name
   * @returns {boolean}
   */
  async ping(core) {
    try {
      const { data } = await solrHttp.get(coreUrl(core, "/admin/ping"), {
        timeout: 3000,
      });
      return data?.status === "OK";
    } catch {
      return false;
    }
  },
};

module.exports = solrClient;
