const JobListing = require("../models/job_listing");
const { v4: uuidv4 } = require("uuid");

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
