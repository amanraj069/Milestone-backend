const JobListing = require("../models/job_listing");
const Employer = require("../models/employer");
const Freelancer = require("../models/freelancer");
const User = require("../models/user");
const JobApplication = require("../models/job_application");
const Question = require("../models/Question");

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const APP_USER_AGENT = "milestone-app/1.0";

async function fetchNominatim(path) {
  const response = await fetch(`${NOMINATIM_BASE_URL}${path}`, {
    headers: {
      "User-Agent": APP_USER_AGENT,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Geocoder error: ${response.status}`);
  }

  return response.json();
}

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

exports.geocode = async (req, res) => {
  try {
    const q = (req.query.q || "").toString().trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit || "1", 10), 1), 5);

    if (!q) {
      return res.status(400).json({ success: false, error: "Query parameter 'q' is required" });
    }

    const data = await fetchNominatim(
      `/search?format=jsonv2&addressdetails=1&limit=${limit}&q=${encodeURIComponent(q)}`,
    );
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Geocode proxy error:", error.message);
    return res.status(500).json({ success: false, error: "Failed to geocode location" });
  }
};

exports.reverseGeocode = async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ success: false, error: "Query parameters 'lat' and 'lon' are required" });
    }

    const data = await fetchNominatim(
      `/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
    );
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Reverse geocode proxy error:", error.message);
    return res.status(500).json({ success: false, error: "Failed to reverse geocode location" });
  }
};

exports.getPublicJobs = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20),
    );
    const skip = (page - 1) * limit;

    const { q } = req.query;

    // Base match conditions (only open jobs and those not capped)
    const matchConditions = [
      { status: "open" },
      {
        $or: [
          { applicationCap: null },
          { applicationCap: { $exists: false } },
          { $expr: { $lt: ["$applicants", "$applicationCap"] } },
        ],
      },
    ];

    // Add search query (title or skills)
    if (q && q.trim()) {
      matchConditions.push({
        $or: [
          { title: { $regex: q.trim(), $options: "i" } },
          { "description.skills": { $regex: q.trim(), $options: "i" } },
        ],
      });
    }

    const publicJobsMatch = { $and: matchConditions };

    const [total, rawJobs] = await Promise.all([
      JobListing.countDocuments(publicJobsMatch),
      JobListing.aggregate([
        { $match: publicJobsMatch },
        {
          $lookup: {
            from: "employers",
            localField: "employerId",
            foreignField: "employerId",
            as: "employer",
          },
        },
        {
          $unwind: {
            path: "$employer",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "employer.userId",
            foreignField: "userId",
            as: "employerUser",
          },
        },
        {
          $unwind: {
            path: "$employerUser",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            isSponsored: { $eq: ["$employerUser.subscription", "Premium"] },
            isBoosted: { $eq: ["$isBoosted", true] },
          },
        },
        {
          $addFields: {
            tier: {
              $switch: {
                branches: [
                  {
                    case: {
                      $and: [
                        { $eq: ["$isSponsored", true] },
                        { $eq: ["$isBoosted", true] },
                      ],
                    },
                    then: 4,
                  },
                  { case: { $eq: ["$isBoosted", true] }, then: 3 },
                  { case: { $eq: ["$isSponsored", true] }, then: 2 },
                ],
                default: 1,
              },
            },
          },
        },
        { $sort: { tier: -1, postedDate: -1, _id: -1 } },
        {
          $project: {
            _id: 0,
            jobId: 1,
            employerId: 1,
            title: 1,
            imageUrl: 1,
            budget: 1,
            jobType: 1,
            location: 1,
            locationCoordinates: 1,
            experienceLevel: 1,
            remote: 1,
            postedDate: 1,
            applicants: 1,
            applicationCap: 1,
            isSponsored: 1,
            isBoosted: 1,
            tier: 1,
            descriptionSkills: "$description.skills",
          },
        },
        { $skip: skip },
        { $limit: limit },
      ]),
    ]);

    const jobs = rawJobs.map((job) => ({
      jobId: job.jobId,
      employerId: job.employerId,
      title: job.title,
      imageUrl: job.imageUrl || "/assets/company_logo.jpg",
      budget: {
        amount: job.budget,
        period: job.jobType === "contract" ? "fixed" : "monthly",
      },
      location: job.location || "Remote",
      locationCoordinates: job.locationCoordinates || null,
      jobType: job.jobType,
      experienceLevel: job.experienceLevel,
      remote: job.remote,
      postedDate: job.postedDate,
      description: {
        skills: Array.isArray(job.descriptionSkills) ? job.descriptionSkills : [],
      },
      applicationCount: job.applicants || 0,
      applicationCap: job.applicationCap || null,
      isSponsored: !!job.isSponsored,
      isBoosted: !!job.isBoosted,
      tier: job.tier || 1,
    }));

    const totalPages = Math.max(1, Math.ceil(total / limit));
    return res.json({
      success: true,
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
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
      const existing = await JobApplication.findOne({
        jobId,
        freelancerId,
      }).lean();
      hasApplied = !!existing;
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
      locationCoordinates: job.locationCoordinates || null,
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
      applicationCap: job.applicationCap || null,
      applicationCapReached: job.applicationCap
        ? (job.applicants || 0) >= job.applicationCap
        : false,
      isBoosted:
        job.isBoosted &&
        job.boostExpiresAt &&
        new Date(job.boostExpiresAt) > new Date(),
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
