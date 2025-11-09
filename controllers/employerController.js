const JobListing = require("../models/job_listing");
const JobApplication = require("../models/job_application");
const User = require("../models/user");
const Employer = require("../models/employer");
const Freelancer = require("../models/freelancer");
const { v4: uuidv4 } = require("uuid");
const { uploadToCloudinary } = require("../middleware/pdfUpload");

// Get all job listings for the logged-in employer
exports.getJobListings = async (req, res) => {
  try {
    const employerId = req.session.user?.roleId;

    if (!employerId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const jobListings = await JobListing.find({ employerId }).sort({
      postedDate: -1,
    });

    return res.json({
      success: true,
      data: jobListings,
    });
  } catch (error) {
    console.error("Get job listings error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch job listings",
    });
  }
};

// Create a new job listing
exports.createJobListing = async (req, res) => {
  try {
    const employerId = req.session.user?.roleId;

    if (!employerId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const {
      title,
      budget,
      location,
      jobType,
      experienceLevel,
      remote,
      applicationDeadline,
      description,
      imageUrl,
      milestones,
    } = req.body;

    // Validate required fields
    if (
      !title ||
      !budget ||
      !jobType ||
      !experienceLevel ||
      !applicationDeadline ||
      !description
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    const newJob = new JobListing({
      jobId: uuidv4(),
      employerId,
      title,
      budget,
      location: location || "",
      jobType,
      experienceLevel,
      remote: remote || false,
      applicationDeadline,
      description,
      imageUrl: imageUrl || "/assets/company_logo.jpg",
      milestones: milestones || [],
      postedDate: new Date(),
      status: "open",
    });

    await newJob.save();

    return res.status(201).json({
      success: true,
      message: "Job listing created successfully",
      data: newJob,
    });
  } catch (error) {
    console.error("Create job listing error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create job listing",
    });
  }
};

// Delete a job listing
exports.deleteJobListing = async (req, res) => {
  try {
    const employerId = req.session.user?.roleId;
    const { jobId } = req.params;

    if (!employerId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // Find and delete the job listing
    const job = await JobListing.findOne({ jobId, employerId });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job listing not found",
      });
    }

    await JobListing.deleteOne({ jobId, employerId });

    return res.json({
      success: true,
      message: "Job listing deleted successfully",
    });
  } catch (error) {
    console.error("Delete job listing error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to delete job listing",
    });
  }
};

// Get single job listing details
exports.getJobById = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await JobListing.findOne({ jobId });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job listing not found",
      });
    }

    return res.json({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error("Get job by ID error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch job listing",
    });
  }
};

// Update a job listing
exports.updateJobListing = async (req, res) => {
  try {
    const employerId = req.session.user?.roleId;
    const { jobId } = req.params;

    if (!employerId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const {
      title,
      budget,
      location,
      jobType,
      experienceLevel,
      remote,
      applicationDeadline,
      description,
      imageUrl,
      milestones,
    } = req.body;

    // Validate required fields
    if (
      !title ||
      !budget ||
      !jobType ||
      !experienceLevel ||
      !applicationDeadline ||
      !description
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    // Find and update the job listing
    const updatedJob = await JobListing.findOneAndUpdate(
      { jobId, employerId },
      {
        title,
        budget,
        location: location || "",
        jobType,
        experienceLevel,
        remote: remote || false,
        applicationDeadline,
        description,
        imageUrl: imageUrl || "/assets/company_logo.jpg",
        milestones: milestones || [],
      },
      { new: true, runValidators: true }
    );

    if (!updatedJob) {
      return res.status(404).json({
        success: false,
        error: "Job listing not found",
      });
    }

    return res.json({
      success: true,
      message: "Job listing updated successfully",
      data: updatedJob,
    });
  } catch (error) {
    console.error("Update job listing error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update job listing",
    });
  }
};

exports.getJobApplications = async (req, res) => {
  try {
    const userData =
      (await getUserData(req.session.user.id)) || req.session.user;

    res.render("Abhishek/job_applications", {
      user: userData,
      activePage: "job_applications",
    });
  } catch (error) {
    console.error("Error fetching job applications:", error.message);
    res.status(500).send("Error fetching job applications: " + error.message);
  }
};

exports.getJobApplicationsAPI = async (req, res) => {
  try {
    const employerId = req.session?.user?.roleId;
    if (!employerId) {
      return res.status(401).json({
        success: false,
        message: "Employer roleId not found in session"
      });
    }

    const jobs = await JobListing.find({ employerId }).lean();
    const jobIds = jobs.map((job) => job.jobId);

    const applications = await JobApplication.find({
      jobId: { $in: jobIds },
    }).lean();

    const freelancerIds = [
      ...new Set(applications.map((app) => app.freelancerId)),
    ];
    const users = await User.find({ roleId: { $in: freelancerIds } })
      .select("roleId name picture")
      .lean();

    const applicationsWithDetails = applications.map((application) => {
      const job = jobs.find((job) => job.jobId === application.jobId);
      const user = users.find(
        (user) => user.roleId === application.freelancerId
      );
      return {
        ...application,
        jobTitle: job?.title || "Unknown Job",
        freelancerName: user?.name || "Unknown Freelancer",
        freelancerPicture: user?.picture || null,
      };
    });

    res.json({
      success: true,
      data: {
        applications: applicationsWithDetails,
        stats: {
          total: applicationsWithDetails.length,
          pending: applicationsWithDetails.filter(app => app.status === 'Pending').length,
          accepted: applicationsWithDetails.filter(app => app.status === 'Accepted').length,
          rejected: applicationsWithDetails.filter(app => app.status === 'Rejected').length
        }
      }
    });
  } catch (error) {
    console.error("Error fetching job applications API:", error.message);
    res.status(500).json({
      success: false,
      message: "Error fetching job applications: " + error.message
    });
  }
};

exports.acceptJobApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const employerId = req.session.user.roleId;
    if (!employerId) {
      throw new Error("Employer roleId not found in session");
    }

    const application = await JobApplication.findOne({ applicationId });
    if (!application) {
      throw new Error("Application not found");
    }

    const job = await JobListing.findOne({ jobId: application.jobId });
    if (!job || job.employerId !== employerId) {
      throw new Error("Not authorized to modify this application");
    }

    await JobApplication.findOneAndUpdate(
      { applicationId },
      { $set: { status: "Accepted" } }
    );

    await JobListing.findOneAndUpdate(
      { jobId: application.jobId },
      {
        $set: {
          "assignedFreelancer.freelancerId": application.freelancerId,
          "assignedFreelancer.startDate": new Date(),
          "assignedFreelancer.status": "working",
          status: "closed",
        },
      }
    );

    res.json({ success: true, message: "Application accepted successfully" });
  } catch (error) {
    console.error("Error accepting job application:", error.message);
    res.status(500).send("Error accepting job application: " + error.message);
  }
};

exports.rejectJobApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const employerId = req.session?.user?.roleId;
    if (!employerId) {
      throw new Error("Employer roleId not found in session");
    }

    const application = await JobApplication.findOne({ applicationId });
    if (!application) {
      throw new Error("Application not found");
    }

    const job = await JobListing.findOne({ jobId: application.jobId });
    if (!job || job.employerId !== employerId) {
      throw new Error("Not authorized to modify this application");
    }

    await JobApplication.findOneAndUpdate(
      { applicationId },
      { $set: { status: "Rejected" } }
    );

    res.json({ success: true, message: "Application rejected successfully" });
  } catch (error) {
    console.error("Error rejecting job application:", error.message);
    res.status(500).send("Error rejecting job application: " + error.message);
  }
};

exports.getSubscription = async (req, res) => {
  try {
    const userId = req.session.user.id;
    if (!userId) {
      throw new Error("User ID not found in session");
    }

    const user = await User.findOne({ userId }).lean();
    if (!user) {
      throw new Error("User not found");
    }

    res.render("Abhishek/subscription", {
      user: {
        name: user.name,
        picture: user.picture,
        role: user.role,
        subscription: user.subscription || "Basic",
      },
      activePage: "subscription",
    });
  } catch (error) {
    console.error("Error fetching subscription:", error.message);
    res.status(500).send("Error fetching subscription: " + error.message);
  }
};

exports.upgradeSubscription = async (req, res) => {
  try {
    const user = req.session.user;
    const userId = req.session.user.id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Not logged in" });
    }
    // Update the user's subscription to "Premium"
    await User.updateOne({ userId }, { $set: { subscription: "Premium" } });
    req.session.user.subscription = "Premium";
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.purchaseSubscription = async (req, res) => {
  try {
    const { planType, amount } = req.body;
    const userId = req.session.user.id;

    if (!planType) {
      return res.status(400).json({
        success: false,
        message: 'Plan type is required'
      });
    }

    // Validate plan type
    const validPlans = ['Basic', 'Premium', 'Free'];
    if (!validPlans.includes(planType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan type'
      });
    }

    // For Premium plans, redirect to payment
    if (planType === 'Premium') {
      return res.json({
        success: true,
        requiresPayment: true,
        amount: amount || 868,
        redirectUrl: `/employerD/payment?plan=${planType}&amount=${amount || 868}`
      });
    }

    // For Basic/Free plans, update immediately
    await Employer.findByIdAndUpdate(userId, {
      subscription: planType
    });

    // Update session
    req.session.user.subscription = planType;

    res.json({
      success: true,
      message: `Successfully switched to ${planType} plan`,
      requiresPayment: false
    });

  } catch (error) {
    console.error('Error purchasing subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during subscription purchase',
      error: error.message
    });
  }
};