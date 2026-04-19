/**
 * ============================================================
 *  REPAIR FREELANCER ASSIGNMENTS SCRIPT
 *  Finds jobs with milestones but no freelancer and assigns one.
 *  Run: node scripts/repairFreelancerAssignments.js
 * ============================================================
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Load Environment Variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Models
const User = require("../models/user");
const Freelancer = require("../models/freelancer");
const JobListing = require("../models/job_listing");

async function main() {
  const connectionString = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/milestone";
  
  console.log(`[REPAIR] Connecting to ${connectionString}...`);
  
  try {
    await mongoose.connect(connectionString, {
      serverSelectionTimeoutMS: 20000,
    });
    console.log("[OK] Connected to MongoDB");

    // 1. Find a Freelancer to assign
    const freelancerUser = await User.findOne({ role: "Freelancer" });
    if (!freelancerUser) {
      console.error("[ERROR] No user with role 'Freelancer' found. Cannot repair.");
      process.exit(1);
    }

    const freelancer = await Freelancer.findOne({ userId: freelancerUser.userId });
    if (!freelancer) {
      console.error(`[ERROR] Freelancer record not found for user ${freelancerUser.userId}`);
      process.exit(1);
    }

    const flId = freelancer.freelancerId;
    console.log(`[INFO] Using Freelancer: ${freelancerUser.name} (${flId}) for repair.`);

    // 2. Find jobs with milestones but no assigned freelancer
    const jobsToRepair = await JobListing.find({
      "milestones.0": { $exists: true }, // has at least one milestone
      $or: [
        { "assignedFreelancer.freelancerId": null },
        { "assignedFreelancer": { $exists: false } }
      ]
    });

    console.log(`[INFO] Found ${jobsToRepair.length} jobs needing freelancer assignment.`);

    if (jobsToRepair.length === 0) {
      console.log("[OK] No jobs need repair.");
      return;
    }

    // 3. Update jobs
    const result = await JobListing.updateMany(
      {
        _id: { $in: jobsToRepair.map(j => j._id) }
      },
      {
        $set: {
          assignedFreelancer: {
            freelancerId: flId,
            startDate: new Date(),
            status: "working"
          }
        }
      }
    );

    console.log(`[OK] Successfully repaired ${result.modifiedCount} jobs.`);

  } catch (error) {
    console.error("[ERROR] Repair failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("[REPAIR] Disconnected from MongoDB.");
    process.exit(0);
  }
}

main();
