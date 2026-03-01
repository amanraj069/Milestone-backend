const JobListing = require("../models/job_listing");
const Employer = require("../models/employer");
const Freelancer = require("../models/freelancer");
const User = require("../models/user");
const JobApplication = require("../models/job_application");
const Question = require("../models/Question");

exports.getHome = (req, res) => {
  let dashboardRoute = "";
  if (req.session && req.session.user) {
    switch (req.session.user.role) {
      case "Moderator":
        dashboardRoute = "/moderatorD/profile";
        break;
      case "Employer":
        dashboardRoute = "/employerD/profile";
        break;
      case "Freelancer":
        dashboardRoute = "/freelancerD/profile";
        break;
    }
  }
  return res.json({ user: req.session?.user || null, dashboardRoute });
};

exports.getPublicJobs = async (req, res) => {
  try {
    const jobs = await JobListing.find({ status: "open" })
      .sort({ postedDate: -1 })
      .lean();

    // Get all employer IDs
    const employerIds = [...new Set(jobs.map((job) => job.employerId))];

    // Get employers with their user data to check subscription
    const employers = await Employer.find({
      employerId: { $in: employerIds },
    }).lean();
    const User = require("../models/user");
    const employerUserIds = employers.map((emp) => emp.userId);
    const users = await User.find({ userId: { $in: employerUserIds } }).lean();

    // Create a map of employerId to subscription status
    const subscriptionMap = {};
    employers.forEach((emp) => {
      const user = users.find((u) => u.userId === emp.userId);
      subscriptionMap[emp.employerId] = user?.subscription === "Premium";
    });

    const formattedJobs = jobs.map((job) => ({
      jobId: job.jobId,
      employerId: job.employerId,
      title: job.title,
      imageUrl: job.imageUrl || "/assets/company_logo.jpg",
      budget: {
        amount: job.budget,
        period: job.jobType === "contract" ? "fixed" : "monthly",
      },
      location: job.location || "Remote",
      jobType: job.jobType,
      experienceLevel: job.experienceLevel,
      remote: job.remote,
      postedDate: job.postedDate,
      description: {
        skills: job.description?.skills || [],
      },
      applicationCount: job.applicants || 0,
      isSponsored: subscriptionMap[job.employerId] || false,
    }));

    return res.json({ success: true, jobs: formattedJobs });
  } catch (error) {
    console.error("Error fetching public jobs:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch jobs",
      error: error.message,
    });
  }
};

exports.getJobDetail = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await JobListing.findOne({ jobId }).lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Get employer details
    const employer = await Employer.findOne({
      employerId: job.employerId,
    }).lean();
    const companyName = employer?.companyName || "Company Name Not Available";

    // Get questions count for this job
    const questionsCount = await Question.countDocuments({ jobId });

    // Check if user has applied (only if user is logged in as freelancer)
    let hasApplied = false;
    if (req.session?.user && req.session.user.role === "Freelancer") {
      const freelancerId = req.session.user.roleId;
      hasApplied =
        job.applications?.some((app) => app.freelancerId === freelancerId) ||
        false;
    }

    // Format the job data
    const formattedJob = {
      jobId: job.jobId,
      employerId: job.employerId,
      title: job.title,
      imageUrl: job.imageUrl || "/assets/company_logo.jpg",
      companyName,
      budget: {
        amount: job.budget,
        period: job.jobType === "contract" ? "fixed" : "monthly",
      },
      location: job.location || "Remote",
      jobType: job.jobType,
      experienceLevel: job.experienceLevel,
      remote: job.remote,
      postedDate: job.postedDate,
      applicationDeadline: job.applicationDeadline,
      description: {
        text: job.description?.text || "",
        responsibilities: job.description?.responsibilities || [],
        requirements: job.description?.requirements || [],
        skills: job.description?.skills || [],
      },
      milestones: job.milestones || [],
      applicationCount: job.applicants || 0,
      questionsCount,
      hasApplied,
    };

    return res.json({
      success: true,
      job: formattedJob,
      user: req.session?.user || null,
    });
  } catch (error) {
    console.error("Error fetching job detail:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch job details",
      error: error.message,
    });
  }
};

exports.getFreelancerPublicProfile = async (req, res) => {
  try {
    const { freelancerId } = req.params;

    // Find freelancer by freelancerId
    const freelancer = await Freelancer.findOne({ freelancerId }).lean();
    if (!freelancer) {
      return res.status(404).json({
        success: false,
        error: "Freelancer not found",
      });
    }

    // Find user data
    const user = await User.findOne({ roleId: freelancerId }).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User profile not found",
      });
    }

    // Get job applications count
    const applicationsCount = await JobApplication.countDocuments({
      freelancerId,
    });

    // Get completed jobs count
    const completedJobsCount = await JobApplication.countDocuments({
      freelancerId,
      status: "Accepted",
    });

    res.json({
      success: true,
      data: {
        freelancerId: freelancer.freelancerId,
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        picture: user.picture,
        location: user.location,
        aboutMe: user.aboutMe,
        rating: user.rating || 0,
        subscription: user.subscription || "Basic",
        resume: freelancer.resume,
        skills: freelancer.skills || [],
        experience: freelancer.experience || [],
        education: freelancer.education || [],
        portfolio: freelancer.portfolio || [],
        statistics: {
          applicationsCount,
          completedJobsCount,
          memberSince: user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching freelancer public profile:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch freelancer profile",
    });
  }
};

// Get all applicants for a specific job (Public)
exports.getJobApplicants = async (req, res) => {
  try {
    const { jobId } = req.params;

    // Check if job exists
    const job = await JobListing.findOne({ jobId }).lean();
    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job listing not found",
      });
    }

    // Get all applications for this job
    const applications = await JobApplication.find({ jobId }).lean();

    // Get user details for all applicants using roleId (freelancerId)
    const freelancerIds = applications.map((app) => app.freelancerId);
    const users = await User.find({ roleId: { $in: freelancerIds } })
      .select("roleId name email picture phone rating")
      .lean();

    // Combine application data with user details
    const applicantsWithDetails = applications.map((app) => {
      const user = users.find((u) => u.roleId === app.freelancerId);
      return {
        applicationId: app.applicationId,
        freelancerId: app.freelancerId,
        name: user?.name || "Unknown",
        email: user?.email || "N/A",
        picture: user?.picture || "/assets/default-avatar.png",
        phone: user?.phone || "N/A",
        rating: user?.rating || 0,
        appliedDate: app.appliedDate,
        status: app.status,
        coverMessage: app.coverMessage,
        resumeLink: app.resumeLink,
      };
    });

    res.json({
      success: true,
      job: {
        jobId: job.jobId,
        title: job.title,
      },
      applicants: applicantsWithDetails,
      total: applicantsWithDetails.length,
    });
  } catch (error) {
    console.error("Error fetching job applicants:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch job applicants",
    });
  }
};

