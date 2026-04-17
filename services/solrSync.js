/**
 * Solr Sync — Mongoose Middleware Hooks
 *
 * Automatically keeps the Solr index in sync with MongoDB by hooking
 * into Mongoose post-save / post-update / post-delete middleware.
 *
 * All hooks are fire-and-forget: they never block the main request
 * and silently log errors if Solr is unavailable.
 *
 * Call `registerSolrHooks()` once at startup to attach the hooks.
 */

const mongoose = require("mongoose");
const { indexJob, indexBlog, deleteDocument } = require("./solrIndexer");

/**
 * Register Mongoose middleware hooks to sync data with Solr.
 * Safe to call multiple times — hooks are idempotent.
 */
function registerSolrHooks() {
  const JobListing = mongoose.model("Job_Listing");
  const Blog = mongoose.model("Blog");

  // ── Job Listing Hooks ────────────────────────────────

  // After create / save
  JobListing.schema.post("save", function (doc) {
    indexJob(doc).catch((err) =>
      console.error("[SolrSync] Job save hook error:", err.message),
    );
  });

  // After findOneAndUpdate
  JobListing.schema.post("findOneAndUpdate", async function (doc) {
    if (doc) {
      indexJob(doc).catch((err) =>
        console.error("[SolrSync] Job update hook error:", err.message),
      );
    }
  });

  // After findOneAndDelete
  JobListing.schema.post("findOneAndDelete", function (doc) {
    if (doc) {
      deleteDocument("jobs", doc.jobId).catch((err) =>
        console.error("[SolrSync] Job delete hook error:", err.message),
      );
    }
  });

  // After deleteOne (instance method)
  JobListing.schema.post("deleteOne", { document: true, query: false }, function (doc) {
    if (doc) {
      deleteDocument("jobs", doc.jobId).catch((err) =>
        console.error("[SolrSync] Job deleteOne hook error:", err.message),
      );
    }
  });

  // ── Blog Hooks ───────────────────────────────────────

  Blog.schema.post("save", function (doc) {
    indexBlog(doc).catch((err) =>
      console.error("[SolrSync] Blog save hook error:", err.message),
    );
  });

  Blog.schema.post("findOneAndUpdate", async function (doc) {
    if (doc) {
      indexBlog(doc).catch((err) =>
        console.error("[SolrSync] Blog update hook error:", err.message),
      );
    }
  });

  Blog.schema.post("findOneAndDelete", function (doc) {
    if (doc) {
      deleteDocument("blogs", doc.blogId).catch((err) =>
        console.error("[SolrSync] Blog delete hook error:", err.message),
      );
    }
  });

  Blog.schema.post("deleteOne", { document: true, query: false }, function (doc) {
    if (doc) {
      deleteDocument("blogs", doc.blogId).catch((err) =>
        console.error("[SolrSync] Blog deleteOne hook error:", err.message),
      );
    }
  });

  console.log("[SolrSync] Mongoose hooks registered for Job_Listing and Blog.");
}

module.exports = { registerSolrHooks };
