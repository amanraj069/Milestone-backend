/**
 * Solr Indexer Service
 *
 * Transforms Mongoose documents into Solr documents and pushes them
 * into the appropriate core.  Provides single-doc and bulk operations.
 */

const solrClient = require("../config/solr");
const JobListing = require("../models/job_listing");
const Blog = require("../models/blog");

/* ------------------------------------------------------------------ */
/*  Transformers — Mongoose doc → Solr doc                             */
/* ------------------------------------------------------------------ */

/**
 * Convert a Mongoose JobListing document to a Solr-indexable object.
 */
function jobToSolrDoc(job) {
  return {
    id: job.jobId,
    doc_type: "job",
    title: job.title || "",
    description: job.description?.text || "",
    skills: job.description?.skills || [],
    category: job.jobType || "", // jobType doubles as category for jobs
    status: job.status || "open",
    budget: job.budget || 0,
    jobType: job.jobType || "",
    experienceLevel: job.experienceLevel || "",
    remote: !!job.remote,
    location: job.location || "",
    location_str: job.location || "",
    postedDate: job.postedDate
      ? new Date(job.postedDate).toISOString()
      : new Date().toISOString(),
    applicationDeadline: job.applicationDeadline
      ? new Date(job.applicationDeadline).toISOString()
      : null,
    employerId: job.employerId || "",
    imageUrl: job.imageUrl || "",
    isBoosted: !!job.isBoosted,
    applicants: job.applicants || 0,
  };
}

/**
 * Convert a Mongoose Blog document to a Solr-indexable object.
 */
function blogToSolrDoc(blog) {
  return {
    id: blog.blogId,
    doc_type: "blog",
    title: blog.title || "",
    description: (blog.content || [])
      .map((section) => `${section.heading || ""} ${section.description || ""}`)
      .join(" "),
    tagline: blog.tagline || "",
    category: blog.category || "Other",
    status: blog.status || "published",
    author: blog.author || "",
    slug: blog.slug || "",
    imageUrl: blog.imageUrl || "",
    readTime: blog.readTime || 5,
    views: blog.views || 0,
    likes: blog.likes || 0,
    featured: !!blog.featured,
    postedDate: blog.createdAt
      ? new Date(blog.createdAt).toISOString()
      : new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  Single-document operations                                         */
/* ------------------------------------------------------------------ */

/**
 * Index a single job listing into Solr.
 * @param {object} jobDoc - Mongoose job document (or plain object)
 */
async function indexJob(jobDoc) {
  try {
    const solrDoc = jobToSolrDoc(jobDoc);
    await solrClient.update(solrClient.cores.jobs, solrDoc);
    console.log(`[Solr] Indexed job: ${solrDoc.id}`);
  } catch (err) {
    console.error(`[Solr] Failed to index job ${jobDoc.jobId}:`, err.message);
  }
}

/**
 * Index a single blog post into Solr.
 * @param {object} blogDoc - Mongoose blog document
 */
async function indexBlog(blogDoc) {
  try {
    const solrDoc = blogToSolrDoc(blogDoc);
    await solrClient.update(solrClient.cores.blogs, solrDoc);
    console.log(`[Solr] Indexed blog: ${solrDoc.id}`);
  } catch (err) {
    console.error(
      `[Solr] Failed to index blog ${blogDoc.blogId}:`,
      err.message,
    );
  }
}

/**
 * Delete a document from a Solr core by ID.
 * @param {"jobs"|"blogs"} coreKey - Which core to target
 * @param {string}         id      - Document ID
 */
async function deleteDocument(coreKey, id) {
  try {
    const core = solrClient.cores[coreKey];
    await solrClient.deleteById(core, id);
    console.log(`[Solr] Deleted ${coreKey} doc: ${id}`);
  } catch (err) {
    console.error(`[Solr] Failed to delete ${coreKey} doc ${id}:`, err.message);
  }
}

/* ------------------------------------------------------------------ */
/*  Bulk reindex operations                                            */
/* ------------------------------------------------------------------ */

const BATCH_SIZE = 500;

/**
 * Reindex ALL job listings from MongoDB into Solr.
 */
async function reindexAllJobs() {
  const core = solrClient.cores.jobs;
  console.log("[Solr] Starting full job reindex...");

  // Clear existing data
  await solrClient.deleteAll(core);

  let skip = 0;
  let indexed = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const jobs = await JobListing.find()
      .skip(skip)
      .limit(BATCH_SIZE)
      .lean();

    if (jobs.length === 0) break;

    const solrDocs = jobs.map(jobToSolrDoc);
    await solrClient.updateBatch(core, solrDocs);

    indexed += solrDocs.length;
    skip += BATCH_SIZE;
    console.log(`[Solr] Indexed ${indexed} jobs so far...`);
  }

  await solrClient.commit(core);
  console.log(`[Solr] Job reindex complete. Total: ${indexed} documents.`);
  return indexed;
}

/**
 * Reindex ALL blog posts from MongoDB into Solr.
 */
async function reindexAllBlogs() {
  const core = solrClient.cores.blogs;
  console.log("[Solr] Starting full blog reindex...");

  await solrClient.deleteAll(core);

  let skip = 0;
  let indexed = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const blogs = await Blog.find()
      .skip(skip)
      .limit(BATCH_SIZE)
      .lean();

    if (blogs.length === 0) break;

    const solrDocs = blogs.map(blogToSolrDoc);
    await solrClient.updateBatch(core, solrDocs);

    indexed += solrDocs.length;
    skip += BATCH_SIZE;
    console.log(`[Solr] Indexed ${indexed} blogs so far...`);
  }

  await solrClient.commit(core);
  console.log(`[Solr] Blog reindex complete. Total: ${indexed} documents.`);
  return indexed;
}

/**
 * Reindex everything.
 * @returns {{ jobs: number, blogs: number }}
 */
async function reindexAll() {
  const [jobs, blogs] = await Promise.all([
    reindexAllJobs(),
    reindexAllBlogs(),
  ]);
  return { jobs, blogs };
}

module.exports = {
  indexJob,
  indexBlog,
  deleteDocument,
  reindexAllJobs,
  reindexAllBlogs,
  reindexAll,
  // Expose transformers for testing
  jobToSolrDoc,
  blogToSolrDoc,
};
