const DataLoader = require("dataloader");
const User = require("../models/user");
const Employer = require("../models/employer");
const Freelancer = require("../models/freelancer");
const Badge = require("../models/Badge");
const JobListing = require("../models/job_listing");

/**
 * Creates DataLoader instances scoped to a single request.
 * Each request gets fresh loaders to avoid stale data across requests.
 */
function createLoaders() {
  return {
    // Batch-load users by userId (string UUID)
    userByUserId: new DataLoader(async (userIds) => {
      const users = await User.find({ userId: { $in: userIds } })
        .select("userId name email picture role rating location aboutMe subscription")
        .lean();
      const map = {};
      users.forEach((u) => (map[u.userId] = u));
      return userIds.map((id) => map[id] || null);
    }),

    // Batch-load users by roleId
    userByRoleId: new DataLoader(async (roleIds) => {
      const users = await User.find({ roleId: { $in: roleIds } })
        .select("userId roleId name email picture role")
        .lean();
      const map = {};
      users.forEach((u) => (map[u.roleId] = u));
      return roleIds.map((id) => map[id] || null);
    }),

    // Batch-load employers by employerId
    employerByEmployerId: new DataLoader(async (employerIds) => {
      const employers = await Employer.find({ employerId: { $in: employerIds } }).lean();
      const map = {};
      employers.forEach((e) => (map[e.employerId] = e));
      return employerIds.map((id) => map[id] || null);
    }),

    // Batch-load badges by badgeId (ObjectId)
    badgeById: new DataLoader(async (badgeIds) => {
      const badges = await Badge.find({ _id: { $in: badgeIds } }).lean();
      const map = {};
      badges.forEach((b) => (map[String(b._id)] = b));
      return badgeIds.map((id) => map[String(id)] || null);
    }),

    // Batch-load job listings by jobId
    jobByJobId: new DataLoader(async (jobIds) => {
      const jobs = await JobListing.find({ jobId: { $in: jobIds } })
        .select("jobId title")
        .lean();
      const map = {};
      jobs.forEach((j) => (map[j.jobId] = j));
      return jobIds.map((id) => map[id] || null);
    }),

    // Batch-load freelancers by freelancerId
    freelancerByFreelancerId: new DataLoader(async (freelancerIds) => {
      const freelancers = await Freelancer.find({ freelancerId: { $in: freelancerIds } }).lean();
      const map = {};
      freelancers.forEach((f) => (map[f.freelancerId] = f));
      return freelancerIds.map((id) => map[id] || null);
    }),

    // Batch-load freelancers by userId
    freelancerByUserId: new DataLoader(async (userIds) => {
      const freelancers = await Freelancer.find({ userId: { $in: userIds } }).lean();
      const map = {};
      freelancers.forEach((f) => (map[f.userId] = f));
      return userIds.map((id) => map[id] || null);
    }),
  };
}

module.exports = { createLoaders };

