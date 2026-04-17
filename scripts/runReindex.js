const mongoose = require("mongoose");
const connectDB = require("../database");
const { reindexAll } = require("../services/solrIndexer");

async function run() {
  try {
    await connectDB;
    console.log("Starting Solr reindex...");
    const stats = await reindexAll();
    console.log("Reindex complete:", stats);
  } catch (err) {
    console.error("Reindex failed:", err);
  } finally {
    process.exit(0);
  }
}

run();
