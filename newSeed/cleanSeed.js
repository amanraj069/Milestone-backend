/**
 * ============================================================
 *  CLEANUP SCRIPT - Removes all seeded demo data
 *  Run:  node newSeed/cleanSeed.js
 * ============================================================
 *
 *  WARNING: This deletes ALL data from the following collections:
 *      - Job Listings, Job Applications
 *      - Complaints, Feedback, Rating Audits
 *      - Blogs, Quizzes, Attempts, Badges, UserBadges
 *      - Questions, Notifications
 *      - Conversations, Messages
 *
 *  It does NOT delete users (Employer, Freelancer, Moderator, Admin).
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: require("path").resolve(__dirname, "../.env") });

const JobListing = require("../models/job_listing");
const JobApplication = require("../models/job_application");
const Complaint = require("../models/complaint");
const Blog = require("../models/blog");
const Quiz = require("../models/Quiz");
const Attempt = require("../models/Attempt");
const Badge = require("../models/Badge");
const UserBadge = require("../models/UserBadge");
const Feedback = require("../models/Feedback");
const Question = require("../models/Question");
const Notification = require("../models/Notification");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const RatingAudit = require("../models/RatingAudit");

async function clean() {
  const connectionString =
    process.env.MONGO_URL || "mongodb://127.0.0.1:27017/milestone";
  await mongoose.connect(connectionString, {
    serverSelectionTimeoutMS: 20000,
  });
  console.log("[OK] Connected to MongoDB\n");

  const collections = [
    { model: JobListing, name: "Job Listings" },
    { model: JobApplication, name: "Job Applications" },
    { model: Complaint, name: "Complaints" },
    { model: Blog, name: "Blogs" },
    { model: Quiz, name: "Quizzes" },
    { model: Attempt, name: "Attempts" },
    { model: Badge, name: "Badges" },
    { model: UserBadge, name: "UserBadges" },
    { model: Feedback, name: "Feedbacks" },
    { model: Question, name: "Questions" },
    { model: Notification, name: "Notifications" },
    { model: Conversation, name: "Conversations" },
    { model: Message, name: "Messages" },
    { model: RatingAudit, name: "Rating Audits" },
  ];

  for (const { model, name } of collections) {
    const result = await model.deleteMany({});
    console.log(`   [DELETED] ${name}: ${result.deletedCount} documents deleted`);
  }

  console.log("\n[OK] All seeded data has been cleaned up.");
  console.log("   Users (Employer, Freelancer, Moderator, Admin) are preserved.\n");

  await mongoose.disconnect();
  process.exit(0);
}

clean().catch((err) => {
  console.error("[ERROR] Cleanup failed:", err);
  process.exit(1);
});
