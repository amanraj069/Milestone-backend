/**
 * Search Routes
 *
 * GET  /api/search          — Full-text search with facets, filters, pagination
 * GET  /api/search/suggest  — Autocomplete suggestions
 * POST /api/admin/reindex   — Trigger a full Solr reindex (admin only)
 */

const express = require("express");
const router = express.Router();
const solrClient = require("../config/solr");
const { search, suggest } = require("../services/solrSearch");
const { fallbackSearch } = require("../services/fallbackSearch");
const { reindexAll } = require("../services/solrIndexer");
const { cacheMiddleware } = require("../middleware/cacheMiddleware");

/**
 * @swagger
 * tags:
 *   - name: REST - Search
 *     description: Solr-powered full-text search endpoints
 *
 * /api/search:
 *   get:
 *     summary: Full-text search with facets and filters
 *     tags: [REST - Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [jobs, blogs]
 *         description: Search type (default jobs)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number (default 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Results per page (default 10, max 50)
 *       - in: query
 *         name: filters
 *         schema:
 *           type: string
 *         description: JSON-encoded filter object
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [relevance, date_desc, date_asc, budget_desc, budget_asc]
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Search results with facets
 *       500:
 *         description: Server error
 *
 * /api/search/suggest:
 *   get:
 *     summary: Autocomplete suggestions
 *     tags: [REST - Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Partial search term
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [jobs, blogs]
 *     responses:
 *       200:
 *         description: Array of suggestion strings
 *
 * /api/admin/reindex:
 *   post:
 *     summary: Trigger a full Solr reindex from MongoDB
 *     tags: [REST - Search]
 *     responses:
 *       200:
 *         description: Reindex completed
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Reindex failed
 */

/* ------------------------------------------------------------------ */
/*  GET /api/search                                                    */
/* ------------------------------------------------------------------ */

router.get("/", cacheMiddleware(30), async (req, res) => {
  try {
    const {
      q = "",
      type = "jobs",
      page = 1,
      limit = 10,
      filters: filtersStr = "{}",
      sort = "relevance",
    } = req.query;

    let filters = {};
    try {
      filters = typeof filtersStr === "string" ? JSON.parse(filtersStr) : filtersStr;
    } catch {
      filters = {};
    }

    const opts = {
      type,
      q,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      filters,
      sort,
    };

    // Try Solr first
    try {
      const result = await search(opts);
      return res.json({
        success: true,
        degraded: false,
        ...result,
      });
    } catch (solrErr) {
      // Solr is down — fall back to MongoDB
      console.error("[Search] Solr unavailable, falling back to MongoDB:", solrErr.message);

      const fallbackResult = await fallbackSearch(opts);
      return res.json({
        success: true,
        ...fallbackResult,
      });
    }
  } catch (err) {
    console.error("[Search] Unexpected error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Search failed",
      error: process.env.NODE_ENV !== "production" ? err.message : undefined,
    });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/search/suggest                                            */
/* ------------------------------------------------------------------ */

router.get("/suggest", async (req, res) => {
  try {
    const { q = "", type = "jobs" } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({ success: true, suggestions: [] });
    }

    const suggestions = await suggest(type, q);
    return res.json({ success: true, suggestions });
  } catch (err) {
    // Suggest is non-critical — return empty on failure
    console.error("[Suggest] Error:", err.message);
    return res.json({ success: true, suggestions: [] });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /api/admin/reindex                                            */
/* ------------------------------------------------------------------ */

// Reindex endpoint — mounted separately in index.js at /api/admin/reindex
const reindexRouter = express.Router();

reindexRouter.post("/reindex", async (req, res) => {
  try {
    // Verify admin/moderator session
    const user = req.session?.user;
    if (!user || !["Admin", "Moderator"].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Admin or Moderator access required.",
      });
    }

    // Check if Solr is reachable
    const alive = await solrClient.ping(solrClient.cores.jobs);
    if (!alive) {
      return res.status(503).json({
        success: false,
        message: "Solr is not reachable. Cannot reindex.",
      });
    }

    console.log(`[Reindex] Manual reindex triggered by ${user.role} ${user.id || user.userId}`);

    const counts = await reindexAll();

    return res.json({
      success: true,
      message: "Reindex completed successfully.",
      indexed: counts,
    });
  } catch (err) {
    console.error("[Reindex] Failed:", err.message);
    return res.status(500).json({
      success: false,
      message: "Reindex failed.",
      error: process.env.NODE_ENV !== "production" ? err.message : undefined,
    });
  }
});

module.exports = { searchRouter: router, reindexRouter };
