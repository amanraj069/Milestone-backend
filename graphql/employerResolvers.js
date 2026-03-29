const JobListing = require("../models/job_listing");
const User = require("../models/user");
const JobApplication = require("../models/job_application");

const requireEmployer = (context) => {
  const user = context.session?.user;
  if (!user || user.role !== "Employer" || !user.roleId) {
    throw new Error("Unauthorized: Employer access required");
  }
  return user.roleId;
};

const employerResolvers = {
  // ──────────────────────────────────────────────
  //  EMPLOYER DASHBOARD STATS
  // ──────────────────────────────────────────────
  employerDashboardStats: async (_, __, context) => {
    const employerId = requireEmployer(context);

    // Count active jobs (status: open)
    const activeJobs = await JobListing.countDocuments({
      employerId,
      status: "open",
    });

    // Count current freelancers working
    const currentFreelancers = await JobListing.countDocuments({
      employerId,
      "assignedFreelancer.status": "working",
    });

    return {
      activeJobs,
      currentFreelancers,
    };
  },

  // ──────────────────────────────────────────────
  //  EMPLOYER TRANSACTIONS
  // ──────────────────────────────────────────────
  employerTransactions: async (_, __, context) => {
    const employerId = requireEmployer(context);

    // Find all jobs with assigned freelancers (working or finished)
    const jobs = await JobListing.find({
      employerId,
      "assignedFreelancer.freelancerId": { $ne: null },
      "assignedFreelancer.status": { $in: ["working", "finished"] },
    }).lean();

    if (jobs.length === 0) {
      return { data: [] };
    }

    // Get freelancer details via User model
    const freelancerIds = jobs.map((job) => job.assignedFreelancer.freelancerId);
    
    // roleId in User corresponds to freelancerId
    const users = await User.find({ roleId: { $in: freelancerIds } })
      .select("roleId name email picture")
      .lean();

    // Build transaction data
    const transactions = jobs.map((job) => {
      const user = users.find((u) => u.roleId === job.assignedFreelancer.freelancerId);

      // Calculate payment progress
      const totalBudget = job.budget || 0;
      const milestones = job.milestones || [];
      const paidAmount = milestones
        .filter((m) => m.status === "paid")
        .reduce((sum, m) => sum + (parseFloat(m.payment) || 0), 0);
      const paymentPercentage = totalBudget > 0 ? Math.round((paidAmount / totalBudget) * 100) : 0;

      // Calculate project completion
      const completedMilestones = milestones.filter((m) => m.status === "paid").length;
      const projectCompletion = milestones.length > 0
        ? Math.round((completedMilestones / milestones.length) * 100)
        : 0;

      // Count pending requests
      const pendingRequests = milestones.filter((m) => m.requested && m.status !== "paid").length;

      return {
        jobId: job.jobId,
        jobTitle: job.title,
        freelancerId: job.assignedFreelancer.freelancerId,
        freelancerName: user?.name || "Unknown",
        freelancerPicture: user?.picture || "",
        freelancerEmail: user?.email || "",
        status: job.assignedFreelancer.status,
        startDate: job.assignedFreelancer.startDate,
        endDate: job.assignedFreelancer.endDate,
        totalBudget,
        paidAmount,
        paymentPercentage,
        projectCompletion,
        milestonesCount: milestones.length,
        completedMilestones,
        pendingRequests,
      };
    });

    return { data: transactions };
  },

  // ──────────────────────────────────────────────
  //  EMPLOYER TRANSACTION DETAIL
  // ──────────────────────────────────────────────
  employerTransactionDetail: async (_, { jobId }, context) => {
    const employerId = requireEmployer(context);

    // Find the job
    const job = await JobListing.findOne({
      jobId,
      employerId,
    }).lean();

    if (!job) {
      throw new Error("Job not found");
    }

    if (!job.assignedFreelancer || !job.assignedFreelancer.freelancerId) {
      throw new Error("No freelancer assigned to this job");
    }

    // Get freelancer details
    const user = await User.findOne({
      roleId: job.assignedFreelancer.freelancerId,
    })
      .select("roleId name email picture")
      .lean();

    // Calculate payment progress
    const totalBudget = job.budget || 0;
    const milestones = job.milestones || [];
    const paidAmount = milestones
      .filter((m) => m.status === "paid")
      .reduce((sum, m) => sum + (parseFloat(m.payment) || 0), 0);
    const paymentPercentage = totalBudget > 0 ? Math.round((paidAmount / totalBudget) * 100) : 0;

    // Calculate project completion
    const completedMilestones = milestones.filter((m) => m.status === "paid").length;
    const projectCompletion = milestones.length > 0
        ? Math.round((completedMilestones / milestones.length) * 100)
        : 0;

    return {
      jobId: job.jobId,
      jobTitle: job.title,
      freelancerId: job.assignedFreelancer.freelancerId,
      freelancerName: user?.name || "Unknown",
      freelancerPicture: user?.picture || "",
      freelancerEmail: user?.email || "",
      status: job.assignedFreelancer.status,
      startDate: job.assignedFreelancer.startDate,
      endDate: job.assignedFreelancer.endDate,
      totalBudget,
      paidAmount,
      paymentPercentage,
      projectCompletion,
      milestones: milestones.map((m, index) => ({
        milestoneId: m.milestoneId,
        sno: index + 1,
        description: m.description,
        payment: parseFloat(m.payment) || 0,
        deadline: m.deadline,
        status: m.status,
        requested: m.requested || false,
      })),
    };
  },

  // ──────────────────────────────────────────────
  //  EMPLOYER APPLICATIONS
  // ──────────────────────────────────────────────
  employerApplications: async (_, { status, sort, limit, offset }, context) => {
    const employerId = requireEmployer(context);

    const statusFilter = status || "all";
    const sortMode = sort || "premium_oldest";
    
    // Support limit and offset for pagination (even if default is 500/0)
    const hasPagination = typeof limit === 'number' && limit > 0;
    const actualLimit = hasPagination ? Math.min(limit, 500) : null;
    const actualOffset = typeof offset === 'number' && offset >= 0 ? offset : 0;

    const jobs = await JobListing.find({ employerId })
      .select("jobId title")
      .lean();
    const jobIds = jobs.map((job) => job.jobId);

    if (!jobIds.length) {
      return {
        applications: [],
        stats: { total: 0, pending: 0, accepted: 0, rejected: 0 }
      };
    }

    const applicationQuery = {
      jobId: { $in: jobIds },
    };

    if (statusFilter !== "all") {
      applicationQuery.status = statusFilter;
    }

    const applications = await JobApplication.find(applicationQuery).lean();

    const freelancerIds = [...new Set(applications.map((app) => app.freelancerId))];

    const users = await User.find({ roleId: { $in: freelancerIds } })
      .select("roleId userId name picture email phone rating subscription")
      .lean();

    const jobMap = new Map(jobs.map((job) => [job.jobId, job]));
    const userMap = new Map(users.map((user) => [user.roleId, user]));

    const applicationsWithDetails = applications.map((application) => {
      const user = userMap.get(application.freelancerId);
      const job = jobMap.get(application.jobId);

      return {
        ...application,
        freelancerUserId: user?.userId || null,
        freelancerName: user?.name || "Unknown Freelancer",
        freelancerPicture: user?.picture || null,
        freelancerEmail: user?.email || null,
        freelancerPhone: user?.phone || null,
        skillRating: user?.rating || 0,
        jobTitle: job?.title || "Unknown Job",
        isPremium: user?.subscription === "Premium",
      };
    });

    if (sortMode === "newest") {
      applicationsWithDetails.sort((a, b) => new Date(b.appliedDate) - new Date(a.appliedDate));
    } else if (sortMode === "oldest") {
      applicationsWithDetails.sort((a, b) => new Date(a.appliedDate) - new Date(b.appliedDate));
    } else {
      // Default / premium_oldest: give premium users priority, then sort by application date
      applicationsWithDetails.sort((a, b) => {
        if (a.isPremium && !b.isPremium) return -1;
        if (!a.isPremium && b.isPremium) return 1;
        return new Date(a.appliedDate) - new Date(b.appliedDate);
      });
    }

    const totalApplications = applicationsWithDetails.length;
    const paginatedApplications = hasPagination
      ? applicationsWithDetails.slice(actualOffset, actualOffset + actualLimit)
      : applicationsWithDetails;

    return {
      applications: paginatedApplications,
      stats: {
        total: totalApplications,
        pending: applicationsWithDetails.filter((app) => app.status === "Pending").length,
        accepted: applicationsWithDetails.filter((app) => app.status === "Accepted").length,
        rejected: applicationsWithDetails.filter((app) => app.status === "Rejected").length,
      }
    };
  },
};

module.exports = employerResolvers;
