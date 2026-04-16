const JobListing = require("../models/job_listing");
const JobApplication = require("../models/job_application");
const User = require("../models/user");
const Employer = require("../models/employer");
const Freelancer = require("../models/freelancer");
const Complaint = require("../models/complaint");
const Payment = require("../models/Payment");
const { v4: uuidv4 } = require("uuid");
const { uploadToCloudinary } = require("../middleware/pdfUpload");
const {
  uploadToCloudinary: uploadImageToCloudinary,
} = require("../middleware/imageUpload");

function parseLocationCoordinates(raw) {
  if (!raw || typeof raw !== "object") return null;
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

// Get all job listings for the logged-in employer
exports.getJobListings = async (req, res) => {
  try {
    const employerId = req.session.user?.roleId;
    const {
      search = "",
      searchFeature = "all",
      jobType = "All Jobs",
      sortBy = "newest-posted",
      page = 1,
      limit = 25,
    } = req.query;

    if (!employerId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const safeLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
    const safePage = Math.max(1, Number(page) || 1);
    const safeSkip = (safePage - 1) * safeLimit;
    const searchText = String(search || "").trim();
    const searchRegex = searchText
      ? new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : null;

    const baseQuery = { employerId };

    if (jobType === "Remote") {
      baseQuery.$or = [{ remote: true }, { jobType: { $regex: /remote/i } }];
    } else if (jobType !== "All Jobs") {
      baseQuery.jobType = { $regex: new RegExp(String(jobType).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") };
    }

    if (searchRegex) {
      const searchConditions = [];
      if (searchFeature === "jobRole") {
        searchConditions.push({ title: searchRegex });
      } else if (searchFeature === "skills") {
        searchConditions.push({ "description.skills": { $elemMatch: { $regex: searchRegex } } });
      } else if (searchFeature === "location") {
        searchConditions.push({ location: searchRegex });
      } else {
        searchConditions.push({ title: searchRegex });
        searchConditions.push({ location: searchRegex });
        searchConditions.push({ "description.skills": { $elemMatch: { $regex: searchRegex } } });
      }
      baseQuery.$and = [...(baseQuery.$and || []), { $or: searchConditions }];
    }

    const sortMap = {
      "oldest-posted": { postedDate: 1, _id: 1 },
      "newest-posted": { postedDate: -1, _id: -1 },
      "budget-high-low": { budget: -1, _id: -1 },
      "budget-low-high": { budget: 1, _id: 1 },
    };
    const dbSort = sortMap[sortBy] || sortMap["newest-posted"];

    const [jobListings, total] = await Promise.all([
      JobListing.find(baseQuery)
        .sort(dbSort)
        .skip(safeSkip)
        .limit(safeLimit)
        .lean(),
      JobListing.countDocuments(baseQuery),
    ]);

    // Add application counts with a single grouped query (avoids N+1)
    const jobIds = jobListings.map((job) => job.jobId);
    const applicationCounts = await JobApplication.aggregate([
      { $match: { jobId: { $in: jobIds } } },
      { $group: { _id: "$jobId", count: { $sum: 1 } } },
    ]);

    const applicationCountMap = {};
    applicationCounts.forEach((item) => {
      applicationCountMap[item._id] = item.count;
    });

    const jobListingsWithCount = jobListings.map((job) => ({
      ...job,
      applicationCount: applicationCountMap[job.jobId] || 0,
    }));

    const totalPages = Math.ceil(total / safeLimit) || 1;

    return res.json({
      success: true,
      data: {
        listings: jobListingsWithCount,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages,
          hasNextPage: safePage < totalPages,
          hasPrevPage: safePage > 1,
        },
      },
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
      locationCoordinates,
      jobType,
      experienceLevel,
      remote,
      applicationDeadline,
      description,
      imageUrl,
      milestones,
      isBoosted,
      applicationCap,
      paymentDetails,
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

    // --- Fee calculation ---
    // Platform fee: 2% normal, 4% if boosted
    const platformFeeRate = isBoosted ? 4 : 2;

    // Application cap fee: based on cap tier
    // null/unlimited -> 2%, <=50 -> 1.5%, <=25 -> 1%, <=10 -> 0.5%
    let applicationCapFeeRate = 2;
    if (applicationCap !== null && applicationCap !== undefined) {
      const cap = parseInt(applicationCap);
      if (cap <= 10) applicationCapFeeRate = 0.5;
      else if (cap <= 25) applicationCapFeeRate = 1;
      else if (cap <= 50) applicationCapFeeRate = 1.5;
      else applicationCapFeeRate = 2;
    }

    const totalFeeRate = platformFeeRate + applicationCapFeeRate;
    const platformFeeAmount = parseFloat(
      ((totalFeeRate / 100) * parseFloat(budget)).toFixed(2),
    );

    const newJob = new JobListing({
      jobId: uuidv4(),
      employerId,
      title,
      budget,
      location: location || "",
      locationCoordinates: parseLocationCoordinates(locationCoordinates),
      jobType,
      experienceLevel,
      remote: remote || false,
      applicationDeadline,
      description,
      imageUrl: imageUrl || "/assets/company_logo.jpg",
      milestones: milestones || [],
      postedDate: new Date(),
      status: "open",
      platformFeeRate,
      applicationCap: applicationCap !== undefined ? applicationCap : null,
      applicationCapFeeRate,
      platformFeeAmount,
      isBoosted: isBoosted || false,
      boostExpiresAt: null, // boost lasts the full duration of the job posting
    });

    await newJob.save();

    // Link payment record to this user/job if Razorpay details provided
    if (paymentDetails?.razorpayOrderId) {
      const userId = req.session.user?.id;
      await Payment.findOneAndUpdate(
        { razorpayOrderId: paymentDetails.razorpayOrderId },
        { $set: { userId, "metadata.jobId": newJob.jobId } },
      );
    }

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
      locationCoordinates,
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
        locationCoordinates: parseLocationCoordinates(locationCoordinates),
        jobType,
        experienceLevel,
        remote: remote || false,
        applicationDeadline,
        description,
        imageUrl: imageUrl || "/assets/company_logo.jpg",
        milestones: milestones || [],
      },
      { new: true, runValidators: true },
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

// ────────────────────────────────────────────────────────────
// Helper: compute cap fee rate from cap value
// ────────────────────────────────────────────────────────────
function computeCapFeeRate(applicationCap) {
  if (applicationCap === null || applicationCap === undefined) return 2;
  const cap = parseInt(applicationCap);
  if (cap <= 10) return 0;
  if (cap <= 25) return 0.5;
  if (cap <= 50) return 1;
  return 2;
}

// Preview fee before posting/boosting (no auth side-effects)
exports.getFeePreview = async (req, res) => {
  try {
    const { budget, isBoosted, applicationCap } = req.query;

    if (!budget || isNaN(parseFloat(budget))) {
      return res
        .status(400)
        .json({ success: false, error: "Valid budget is required" });
    }

    const platformFeeRate = isBoosted === "true" ? 4 : 2;
    const applicationCapFeeRate = computeCapFeeRate(
      applicationCap === "null" ? null : applicationCap,
    );
    const totalFeeRate = platformFeeRate + applicationCapFeeRate;
    const platformFeeAmount = parseFloat(
      ((totalFeeRate / 100) * parseFloat(budget)).toFixed(2),
    );

    return res.json({
      success: true,
      platformFeeRate,
      applicationCapFeeRate,
      totalFeeRate,
      platformFeeAmount,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Boost an existing job listing (charges the extra 2% on top of base fee)
exports.boostJobListing = async (req, res) => {
  try {
    const employerId = req.session.user?.roleId;
    const { jobId } = req.params;
    const { paymentDetails } = req.body;

    if (!employerId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const job = await JobListing.findOne({ jobId, employerId });
    if (!job) {
      return res
        .status(404)
        .json({ success: false, error: "Job listing not found" });
    }

    if (job.isBoosted) {
      return res.status(400).json({
        success: false,
        error:
          "This job is already boosted. The boost is active for the full lifetime of the job posting.",
      });
    }

    // Recalculate fees with boost
    const platformFeeRate = 4;
    const applicationCapFeeRate = computeCapFeeRate(job.applicationCap);
    const totalFeeRate = platformFeeRate + applicationCapFeeRate;
    const platformFeeAmount = parseFloat(
      ((totalFeeRate / 100) * job.budget).toFixed(2),
    );

    job.isBoosted = true;
    job.boostExpiresAt = null; // boost lasts for the full duration of the job posting
    job.platformFeeRate = platformFeeRate;
    job.platformFeeAmount = platformFeeAmount;
    await job.save();

    // Link payment record to this user/job if Razorpay details provided
    if (paymentDetails?.razorpayOrderId) {
      const userId = req.session.user?.id;
      await Payment.findOneAndUpdate(
        { razorpayOrderId: paymentDetails.razorpayOrderId },
        { $set: { userId, "metadata.jobId": jobId } },
      );
    }

    return res.json({
      success: true,
      message: "Job listing boosted successfully",
      data: {
        jobId: job.jobId,
        isBoosted: true,
        boostExpiresAt: null,
        platformFeeRate,
        applicationCapFeeRate,
        totalFeeRate,
        platformFeeAmount,
      },
    });
  } catch (error) {
    console.error("Boost job listing error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to boost job listing" });
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
        message: "Employer roleId not found in session",
      });
    }

    const statusFilter = req.query.status || "all";
    const sortMode = req.query.sort || "premium_oldest";
    const rawLimit = Number.parseInt(req.query.limit, 10);
    const rawPage = Number.parseInt(req.query.page, 10);
    const hasPagination = Number.isInteger(rawLimit) && rawLimit > 0;
    const limit = hasPagination ? Math.min(rawLimit, 100) : null;
    const page = hasPagination
      ? Number.isInteger(rawPage) && rawPage > 0
        ? rawPage
        : 1
      : null;

    const jobs = await JobListing.find({ employerId })
      .select("jobId title")
      .lean();
    const jobIds = jobs.map((job) => job.jobId);

    if (!jobIds.length) {
      return res.json({
        success: true,
        data: {
          applications: [],
          stats: {
            total: 0,
            pending: 0,
            accepted: 0,
            rejected: 0,
          },
          pagination: hasPagination
            ? {
                page,
                limit,
                total: 0,
                hasMore: false,
              }
            : undefined,
        },
      });
    }

    const applicationQuery = {
      jobId: { $in: jobIds },
    };

    if (statusFilter !== "all") {
      applicationQuery.status = statusFilter;
    }

    const applications = await JobApplication.find(applicationQuery).lean();

    const freelancerIds = [
      ...new Set(applications.map((app) => app.freelancerId)),
    ];

    const users = await User.find({ roleId: { $in: freelancerIds } })
      .select("roleId name picture email phone rating subscription")
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
        isPremium: user?.subscription === "Premium" || false,
      };
    });

    if (sortMode === "newest") {
      applicationsWithDetails.sort(
        (a, b) => new Date(b.appliedDate) - new Date(a.appliedDate),
      );
    } else if (sortMode === "oldest") {
      applicationsWithDetails.sort(
        (a, b) => new Date(a.appliedDate) - new Date(b.appliedDate),
      );
    } else {
      applicationsWithDetails.sort((a, b) => {
        if (a.isPremium && !b.isPremium) return -1;
        if (!a.isPremium && b.isPremium) return 1;
        return new Date(a.appliedDate) - new Date(b.appliedDate);
      });
    }

    const totalApplications = applicationsWithDetails.length;
    const paginatedApplications = hasPagination
      ? applicationsWithDetails.slice((page - 1) * limit, page * limit)
      : applicationsWithDetails;

    res.json({
      success: true,
      data: {
        applications: paginatedApplications,
        stats: {
          total: totalApplications,
          pending: applicationsWithDetails.filter(
            (app) => app.status === "Pending",
          ).length,
          accepted: applicationsWithDetails.filter(
            (app) => app.status === "Accepted",
          ).length,
          rejected: applicationsWithDetails.filter(
            (app) => app.status === "Rejected",
          ).length,
        },
        pagination: hasPagination
          ? {
              page,
              limit,
              total: totalApplications,
              hasMore: page * limit < totalApplications,
            }
          : undefined,
      },
    });
  } catch (error) {
    console.error("Error fetching job applications API:", error.message);
    res.status(500).json({
      success: false,
      message: "Error fetching job applications: " + error.message,
    });
  }
};

exports.getPendingApplicationsCount = async (req, res) => {
  try {
    const employerId = req.session?.user?.roleId;
    if (!employerId) {
      return res.status(401).json({
        success: false,
        message: "Employer roleId not found in session",
      });
    }

    const jobs = await JobListing.find({ employerId }).select("jobId").lean();
    const jobIds = jobs.map((job) => job.jobId);

    if (jobIds.length === 0) {
      return res.json({
        success: true,
        count: 0,
      });
    }

    const count = await JobApplication.countDocuments({
      jobId: { $in: jobIds },
      status: "Pending",
    });

    return res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("Error fetching pending applications count:", error.message);
    return res.status(500).json({
      success: false,
      message: "Error fetching pending applications count: " + error.message,
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
      { $set: { status: "Accepted" } },
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
      },
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
      { $set: { status: "Rejected" } },
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
    const { duration, paymentDetails } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not logged in" });
    }

    // Calculate expiry date
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + (duration || 1));

    // Update the user's subscription to "Premium" with duration
    await User.updateOne(
      { userId },
      {
        $set: {
          subscription: "Premium",
          subscriptionDuration: duration || null,
          subscriptionExpiryDate: expiryDate,
        },
      },
    );

    // Link payment record to this user if Razorpay details provided
    if (paymentDetails?.razorpayOrderId) {
      await Payment.findOneAndUpdate(
        { razorpayOrderId: paymentDetails.razorpayOrderId },
        { $set: { userId } },
      );
    }

    req.session.user.subscription = "Premium";
    req.session.user.subscriptionDuration = duration || null;
    req.session.user.subscriptionExpiryDate = expiryDate;

    res.json({
      success: true,
      message: "Successfully upgraded to Premium",
      duration: duration,
      expiryDate: expiryDate,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.downgradeSubscription = async (req, res) => {
  try {
    const userId = req.session.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not logged in" });
    }
    // Update the user's subscription to "Basic" and clear duration
    await User.updateOne(
      { userId },
      {
        $set: { subscription: "Basic" },
        $unset: { subscriptionDuration: "", subscriptionExpiryDate: "" },
      },
    );

    req.session.user.subscription = "Basic";
    delete req.session.user.subscriptionDuration;
    delete req.session.user.subscriptionExpiryDate;

    res.json({ success: true, message: "Successfully downgraded to Basic" });
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
        message: "Plan type is required",
      });
    }

    // Validate plan type
    const validPlans = ["Basic", "Premium", "Free"];
    if (!validPlans.includes(planType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan type",
      });
    }

    // For Premium plans, redirect to payment
    if (planType === "Premium") {
      return res.json({
        success: true,
        requiresPayment: true,
        amount: amount || 868,
        redirectUrl: `/employerD/payment?plan=${planType}&amount=${
          amount || 868
        }`,
      });
    }

    // For Basic/Free plans, update immediately
    await Employer.findByIdAndUpdate(userId, {
      subscription: planType,
    });

    // Update session
    req.session.user.subscription = planType;

    res.json({
      success: true,
      message: `Successfully switched to ${planType} plan`,
      requiresPayment: false,
    });
  } catch (error) {
    console.error("Error purchasing subscription:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during subscription purchase",
      error: error.message,
    });
  }
};

// Get current freelancers working for employer
exports.getCurrentFreelancers = async (req, res) => {
  try {
    const employerId = req.session.user?.roleId;
    const {
      search = "",
      sortBy = "rating-high-low",
      page = 1,
      limit = 25,
      nameIn,
      jobRoleIn,
    } = req.query;

    if (!employerId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const safeLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
    const safePage = Math.max(1, Number(page) || 1);
    const safeSkip = (safePage - 1) * safeLimit;
    const searchText = String(search || "").trim();
    const searchRegex = searchText
      ? new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : null;

    const cleanNameIn = Array.isArray(nameIn)
      ? nameIn.map((value) => String(value || "").trim()).filter(Boolean)
      : typeof nameIn === "string"
        ? nameIn.split(",").map((value) => String(value || "").trim()).filter(Boolean)
        : [];

    const cleanJobRoleIn = Array.isArray(jobRoleIn)
      ? jobRoleIn.map((value) => String(value || "").trim()).filter(Boolean)
      : typeof jobRoleIn === "string"
        ? jobRoleIn.split(",").map((value) => String(value || "").trim()).filter(Boolean)
        : [];

    const sortMap = {
      "rating-high-low": { "freelancerUser.rating": -1, _id: -1 },
      "rating-low-high": { "freelancerUser.rating": 1, _id: 1 },
      "working-since-oldest": { daysSinceStart: -1, _id: -1 },
      "working-since-newest": { daysSinceStart: 1, _id: 1 },
      "name-a-z": { "freelancerUser.name": 1, _id: 1 },
      "name-z-a": { "freelancerUser.name": -1, _id: -1 },
    };
    const dbSort = sortMap[sortBy] || sortMap["rating-high-low"];

    const basePipeline = [
      {
        $match: {
          employerId,
          "assignedFreelancer.status": "working",
          "assignedFreelancer.freelancerId": { $exists: true, $ne: null },
        },
      },
      {
        $project: {
          _id: 1,
          jobId: 1,
          title: 1,
          description: 1,
          assignedFreelancer: 1,
        },
      },
      {
        $lookup: {
          from: "users",
          let: { freelancerRoleId: "$assignedFreelancer.freelancerId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$roleId", "$$freelancerRoleId"] },
                    { $eq: ["$role", "Freelancer"] },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                userId: 1,
                roleId: 1,
                name: 1,
                email: 1,
                phone: 1,
                picture: 1,
                rating: 1,
              },
            },
          ],
          as: "freelancerUser",
        },
      },
      {
        $unwind: {
          path: "$freelancerUser",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          daysSinceStart: {
            $cond: [
              { $ifNull: ["$assignedFreelancer.startDate", false] },
              {
                $dateDiff: {
                  startDate: "$assignedFreelancer.startDate",
                  endDate: "$$NOW",
                  unit: "day",
                },
              },
              0,
            ],
          },
        },
      },
    ];

    const extraMatch = {};
    if (searchRegex) {
      extraMatch.$or = [
        { "freelancerUser.name": searchRegex },
        { title: searchRegex },
      ];
    }
    if (cleanNameIn.length) {
      extraMatch["freelancerUser.name"] = { $in: cleanNameIn };
    }
    if (cleanJobRoleIn.length) {
      extraMatch.title = { $in: cleanJobRoleIn };
    }
    if (Object.keys(extraMatch).length) {
      basePipeline.push({ $match: extraMatch });
    }

    const [aggregateResult] = await JobListing.aggregate([
      ...basePipeline,
      {
        $facet: {
          rows: [
            { $sort: dbSort },
            { $skip: safeSkip },
            { $limit: safeLimit },
            {
              $project: {
                _id: 0,
                freelancerId: "$assignedFreelancer.freelancerId",
                userId: "$freelancerUser.userId",
                name: { $ifNull: ["$freelancerUser.name", "Unknown"] },
                email: { $ifNull: ["$freelancerUser.email", ""] },
                phone: { $ifNull: ["$freelancerUser.phone", ""] },
                picture: { $ifNull: ["$freelancerUser.picture", ""] },
                rating: { $ifNull: ["$freelancerUser.rating", 0] },
                jobId: "$jobId",
                jobTitle: "$title",
                jobDescription: {
                  $ifNull: ["$description.text", { $ifNull: ["$description", ""] }],
                },
                startDate: "$assignedFreelancer.startDate",
                daysSinceStart: { $ifNull: ["$daysSinceStart", 0] },
                hasRated: { $ifNull: ["$assignedFreelancer.rated", false] },
                employerRating: "$assignedFreelancer.employerRating",
              },
            },
          ],
          count: [{ $count: "total" }],
          stats: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                avgRating: { $avg: { $ifNull: ["$freelancerUser.rating", 0] } },
                avgDays: { $avg: { $ifNull: ["$daysSinceStart", 0] } },
              },
            },
          ],
          filterNames: [
            {
              $group: {
                _id: "$freelancerUser.name",
              },
            },
          ],
          filterRoles: [
            {
              $group: {
                _id: "$title",
              },
            },
          ],
        },
      },
    ]);

    const rows = aggregateResult?.rows || [];
    const total = aggregateResult?.count?.[0]?.total || 0;
    const statsRow = aggregateResult?.stats?.[0] || {
      total: 0,
      avgRating: 0,
      avgDays: 0,
    };

    const totalPages = Math.ceil(total / safeLimit) || 1;
    const names = (aggregateResult?.filterNames || [])
      .map((entry) => entry?._id)
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b)));
    const jobRoles = (aggregateResult?.filterRoles || [])
      .map((entry) => entry?._id)
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b)));

    return res.json({
      success: true,
      data: {
        freelancers: rows,
        stats: {
          total: statsRow.total || 0,
          avgRating: Number((statsRow.avgRating || 0).toFixed(1)),
          avgDays: Math.round(statsRow.avgDays || 0),
          successRate: 92,
        },
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages,
          hasNextPage: safePage < totalPages,
          hasPrevPage: safePage > 1,
        },
        filterOptions: {
          names,
          jobRoles,
        },
      },
    });
  } catch (error) {
    console.error("Get current freelancers error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch current freelancers",
    });
  }
};

// Get work history (previously worked freelancers)
exports.getWorkHistory = async (req, res) => {
  try {
    const employerId = req.session.user?.roleId;
    const {
      search = "",
      searchFeature = "all",
      sortBy = "date-desc",
      page = 1,
      limit = 25,
      statusIn,
    } = req.query;

    if (!employerId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const safeLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
    const safePage = Math.max(1, Number(page) || 1);
    const safeSkip = (safePage - 1) * safeLimit;
    const searchText = String(search || "").trim();
    const searchRegex = searchText
      ? new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : null;

    const requestedStatuses = Array.isArray(statusIn)
      ? statusIn
      : typeof statusIn === "string"
        ? statusIn.split(",")
        : [];
    const cleanStatuses = requestedStatuses
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    const statusConstraint = cleanStatuses.length
      ? cleanStatuses
      : ["finished", "left"];

    const searchMatch = {};
    if (searchRegex) {
      if (searchFeature === "name") {
        searchMatch["freelancerUser.name"] = searchRegex;
      } else if (searchFeature === "jobRole") {
        searchMatch.title = searchRegex;
      } else if (searchFeature === "location") {
        searchMatch["freelancerUser.location"] = searchRegex;
      } else {
        searchMatch.$or = [
          { "freelancerUser.name": searchRegex },
          { title: searchRegex },
          { "freelancerUser.location": searchRegex },
        ];
      }
    }

    const sortMap = {
      "date-desc": { "assignedFreelancer.endDate": -1, _id: -1 },
      "date-asc": { "assignedFreelancer.endDate": 1, _id: 1 },
      "name-asc": { "freelancerUser.name": 1, _id: 1 },
      "name-desc": { "freelancerUser.name": -1, _id: -1 },
      "rating-desc": { "freelancerUser.rating": -1, _id: -1 },
      "rating-asc": { "freelancerUser.rating": 1, _id: 1 },
    };
    const dbSort = sortMap[sortBy] || sortMap["date-desc"];

    const basePipeline = [
      {
        $match: {
          employerId,
          "assignedFreelancer.status": { $in: statusConstraint },
          "assignedFreelancer.freelancerId": { $exists: true, $ne: null },
        },
      },
      {
        $project: {
          _id: 1,
          jobId: 1,
          title: 1,
          description: 1,
          assignedFreelancer: 1,
        },
      },
      {
        $lookup: {
          from: "users",
          let: { freelancerRoleId: "$assignedFreelancer.freelancerId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$roleId", "$$freelancerRoleId"] },
                    { $eq: ["$role", "Freelancer"] },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                userId: 1,
                roleId: 1,
                name: 1,
                email: 1,
                phone: 1,
                picture: 1,
                rating: 1,
                location: 1,
              },
            },
          ],
          as: "freelancerUser",
        },
      },
      {
        $unwind: {
          path: "$freelancerUser",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          completedDate: "$assignedFreelancer.endDate",
          workDays: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$assignedFreelancer.startDate", false] },
                  { $ifNull: ["$assignedFreelancer.endDate", false] },
                ],
              },
              {
                $dateDiff: {
                  startDate: "$assignedFreelancer.startDate",
                  endDate: "$assignedFreelancer.endDate",
                  unit: "day",
                },
              },
              0,
            ],
          },
        },
      },
    ];

    if (Object.keys(searchMatch).length) {
      basePipeline.push({ $match: searchMatch });
    }

    const [aggregateResult] = await JobListing.aggregate([
      ...basePipeline,
      {
        $facet: {
          rows: [
            { $sort: dbSort },
            { $skip: safeSkip },
            { $limit: safeLimit },
            {
              $project: {
                _id: 0,
                userId: "$freelancerUser.userId",
                freelancerId: "$assignedFreelancer.freelancerId",
                name: { $ifNull: ["$freelancerUser.name", "Unknown"] },
                email: { $ifNull: ["$freelancerUser.email", ""] },
                phone: { $ifNull: ["$freelancerUser.phone", ""] },
                location: { $ifNull: ["$freelancerUser.location", ""] },
                picture: { $ifNull: ["$freelancerUser.picture", ""] },
                rating: { $ifNull: ["$freelancerUser.rating", 0] },
                jobId: "$jobId",
                jobTitle: "$title",
                jobDescription: {
                  $ifNull: ["$description.text", { $ifNull: ["$description", ""] }],
                },
                startDate: "$assignedFreelancer.startDate",
                endDate: "$assignedFreelancer.endDate",
                completedDate: "$assignedFreelancer.endDate",
                status: "$assignedFreelancer.status",
              },
            },
          ],
          count: [{ $count: "total" }],
          stats: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                avgRating: { $avg: { $ifNull: ["$freelancerUser.rating", 0] } },
                avgDays: { $avg: { $ifNull: ["$workDays", 0] } },
                finishedCount: {
                  $sum: {
                    $cond: [{ $eq: ["$assignedFreelancer.status", "finished"] }, 1, 0],
                  },
                },
              },
            },
          ],
        },
      },
    ]);

    const rows = aggregateResult?.rows || [];
    const total = aggregateResult?.count?.[0]?.total || 0;
    const statsRow = aggregateResult?.stats?.[0] || {
      total: 0,
      avgRating: 0,
      avgDays: 0,
      finishedCount: 0,
    };
    const totalPages = Math.ceil(total / safeLimit) || 1;
    const successRate =
      statsRow.total > 0
        ? Math.round((statsRow.finishedCount / statsRow.total) * 100)
        : 0;

    return res.json({
      success: true,
      data: {
        freelancers: rows,
        stats: {
          total: statsRow.total || 0,
          avgRating: Number((statsRow.avgRating || 0).toFixed(1)),
          avgDays: Math.round(statsRow.avgDays || 0),
          successRate,
        },
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages,
          hasNextPage: safePage < totalPages,
          hasPrevPage: safePage > 1,
        },
        filterOptions: {
          statuses: ["finished", "left"],
        },
      },
    });
  } catch (error) {
    console.error("Get work history error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch work history",
    });
  }
};

// Rate a freelancer
exports.rateFreelancer = async (req, res) => {
  try {
    const employerId = req.session.user?.roleId;
    const { jobId } = req.params;
    const { rating, review } = req.body;

    console.log("Rate freelancer - employerId:", employerId);
    console.log("Rate freelancer - jobId:", jobId);
    console.log("Rate freelancer - rating:", rating);

    if (!employerId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: "Rating must be between 1 and 5",
      });
    }

    // Find the job
    const job = await JobListing.findOne({
      jobId,
      employerId,
      "assignedFreelancer.status": { $in: ["working", "finished", "left"] },
    });

    console.log("Found job:", job ? "yes" : "no");
    if (job) {
      console.log("Job status:", job.assignedFreelancer.status);
      console.log("Job employerId:", job.employerId);
    }

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found or freelancer not assigned",
      });
    }

    // Update the job with rating
    job.assignedFreelancer.employerRating = rating;
    job.assignedFreelancer.employerReview = review || "";
    job.assignedFreelancer.rated = true;
    await job.save();

    // Calculate and update freelancer's overall rating
    const freelancerId = job.assignedFreelancer.freelancerId;
    const allRatedJobs = await JobListing.find({
      "assignedFreelancer.freelancerId": freelancerId,
      "assignedFreelancer.status": { $in: ["finished", "left"] },
      "assignedFreelancer.employerRating": { $exists: true, $ne: null },
    }).select("assignedFreelancer.employerRating");

    if (allRatedJobs.length > 0) {
      const totalRating = allRatedJobs.reduce(
        (sum, job) => sum + job.assignedFreelancer.employerRating,
        0,
      );
      const averageRating = totalRating / allRatedJobs.length;

      // Update freelancer's rating in User model
      await User.findOneAndUpdate(
        { roleId: freelancerId },
        { rating: parseFloat(averageRating.toFixed(1)) },
        { new: true },
      );
    }

    return res.json({
      success: true,
      message: "Freelancer rated successfully",
    });
  } catch (error) {
    console.error("Rate freelancer error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to rate freelancer",
    });
  }
};

// Rate a freelancer
exports.rateFreelancer = async (req, res) => {
  try {
    const employerId = req.session.user?.roleId;
    const { jobId } = req.params;
    const { rating, review } = req.body;

    console.log("Rate freelancer - employerId:", employerId);
    console.log("Rate freelancer - jobId:", jobId);
    console.log("Rate freelancer - rating:", rating);

    if (!employerId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: "Rating must be between 1 and 5",
      });
    }

    // Find the job
    const job = await JobListing.findOne({
      jobId,
      employerId,
      "assignedFreelancer.status": { $in: ["working", "finished", "left"] },
    });

    console.log("Found job:", job ? "yes" : "no");
    if (job) {
      console.log("Job status:", job.assignedFreelancer.status);
      console.log("Job employerId:", job.employerId);
    }

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found or freelancer not assigned",
      });
    }

    // Update the job with rating
    job.assignedFreelancer.employerRating = rating;
    job.assignedFreelancer.employerReview = review || "";
    job.assignedFreelancer.rated = true;
    await job.save();

    // Calculate and update freelancer's overall rating
    const freelancerId = job.assignedFreelancer.freelancerId;
    const allRatedJobs = await JobListing.find({
      "assignedFreelancer.freelancerId": freelancerId,
      "assignedFreelancer.status": { $in: ["finished", "left"] },
      "assignedFreelancer.employerRating": { $exists: true, $ne: null },
    }).select("assignedFreelancer.employerRating");

    if (allRatedJobs.length > 0) {
      const totalRating = allRatedJobs.reduce(
        (sum, job) => sum + job.assignedFreelancer.employerRating,
        0,
      );
      const averageRating = totalRating / allRatedJobs.length;

      // Update freelancer's rating in User model
      await User.findOneAndUpdate(
        { roleId: freelancerId },
        { rating: parseFloat(averageRating.toFixed(1)) },
        { new: true },
      );
    }

    return res.json({
      success: true,
      message: "Freelancer rated successfully",
    });
  } catch (error) {
    console.error("Rate freelancer error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to rate freelancer",
    });
  }
};

// Create a new complaint (Employer)
exports.createComplaint = async (req, res) => {
  try {
    const employerId = req.session.user.roleId;
    const userId = req.session.user.id;
    const {
      jobId,
      freelancerId,
      complaintType,
      priority,
      subject,
      description,
    } = req.body;

    // Validate input
    if (!jobId || !freelancerId || !complaintType || !subject || !description) {
      return res.status(400).json({
        success: false,
        error: "All fields are required",
      });
    }

    if (subject.length < 10 || subject.length > 200) {
      return res.status(400).json({
        success: false,
        error: "Subject must be between 10 and 200 characters",
      });
    }

    if (description.length < 50) {
      return res.status(400).json({
        success: false,
        error: "Description must be at least 50 characters",
      });
    }

    // Get job details
    const job = await JobListing.findOne({ jobId }).lean();
    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    // Verify that the employer owns this job
    if (job.employerId !== employerId) {
      return res.status(403).json({
        success: false,
        error: "You can only file complaints for your own jobs",
      });
    }

    // Get employer details
    const employerUser = await User.findOne({ userId }).lean();
    const employer = await Employer.findOne({ employerId }).lean();
    if (!employerUser) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Get freelancer details
    const freelancerUser = await User.findOne({ roleId: freelancerId }).lean();
    const freelancerName = freelancerUser?.name || "Unknown Freelancer";

    const employerName = employer?.companyName || employerUser.name;

    // Create new complaint
    const newComplaint = new Complaint({
      complainantType: "Employer",
      complainantId: employerId,
      complainantName: employerName,
      freelancerId,
      freelancerName,
      jobId,
      jobTitle: job.title,
      employerId,
      employerName,
      complaintType,
      priority: priority || "Medium",
      subject,
      description,
      status: "Pending",
    });

    await newComplaint.save();

    res.json({
      success: true,
      message: "Complaint submitted successfully",
      data: {
        complaintId: newComplaint.complaintId,
      },
    });
  } catch (error) {
    console.error("Error creating employer complaint:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to submit complaint",
    });
  }
};

// Get employer's complaints
exports.getEmployerComplaints = async (req, res) => {
  try {
    const employerId = req.session.user.roleId;

    const complaints = await Complaint.find({
      complainantId: employerId,
      complainantType: "Employer",
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      complaints,
      total: complaints.length,
    });
  } catch (error) {
    console.error("Error fetching employer complaints:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch complaints",
    });
  }
};

// Get employer profile
exports.getEmployerProfile = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const employerId = req.session.user?.roleId;

    if (!userId || !employerId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // Get user data
    const user = await User.findOne({ userId }).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Get employer data
    const employer = await Employer.findOne({ employerId }).lean();

    return res.json({
      success: true,
      data: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        location: user.location,
        role: user.role,
        picture: user.picture,
        aboutMe: user.aboutMe,
        socialMedia: user.socialMedia,
        rating: user.rating,
        subscription: user.subscription,
      },
      employer: {
        companyName: employer?.companyName || "",
        websiteLink: employer?.websiteLink || "",
        companyDetails: employer?.companyDetails || {
          companyName: "",
          companyPAN: "",
          billingAddress: "",
          accountsPayableEmail: "",
          taxIdentificationNumber: "",
          proofOfAddressUrl: "",
          officialBusinessEmail: "",
          companyLogoUrl: "",
          isSubmitted: false,
          submittedAt: null,
        },
      },
    });
  } catch (error) {
    console.error("Get employer profile error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch profile",
    });
  }
};

// Update employer profile
exports.updateEmployerProfile = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const employerId = req.session.user?.roleId;

    if (!userId || !employerId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const {
      name,
      email,
      phone,
      location,
      websiteLink,
      aboutMe,
      picture,
      socialMedia,
    } = req.body;

    // Update user data
    const updateUserData = {
      name,
      phone,
      location,
      aboutMe,
      socialMedia,
    };

    // Only update picture if provided
    if (picture) {
      updateUserData.picture = picture;
    }

    await User.findOneAndUpdate({ userId }, updateUserData, {
      new: true,
      runValidators: true,
    });

    // Update employer data
    await Employer.findOneAndUpdate(
      { employerId },
      {
        websiteLink,
      },
      { new: true, runValidators: true },
    );

    // Update session
    req.session.user.name = name;
    req.session.user.phone = phone;
    req.session.user.location = location;
    req.session.user.aboutMe = aboutMe;
    if (picture) {
      req.session.user.picture = picture;
    }

    return res.json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Update employer profile error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update profile",
    });
  }
};

// Get employer company verification details
exports.getEmployerCompanyDetails = async (req, res) => {
  try {
    const employerId = req.session.user?.roleId;

    if (!employerId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const employer = await Employer.findOne({ employerId }).lean();

    if (!employer) {
      return res.status(404).json({
        success: false,
        error: "Employer profile not found",
      });
    }

    return res.json({
      success: true,
      data: employer.companyDetails || {
        companyName: "",
        companyPAN: "",
        billingAddress: "",
        accountsPayableEmail: "",
        taxIdentificationNumber: "",
        proofOfAddressUrl: "",
        officialBusinessEmail: "",
        companyLogoUrl: "",
        isSubmitted: false,
        submittedAt: null,
      },
      isApproved: req.session.user?.isApproved === true,
    });
  } catch (error) {
    console.error("Get employer company details error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch company details",
    });
  }
};

// Save employer company verification details
exports.updateEmployerCompanyDetails = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const employerId = req.session.user?.roleId;

    if (!userId || !employerId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const user = await User.findOne({ userId }).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    if (user.isApproved) {
      return res.status(403).json({
        success: false,
        error: "Company details cannot be edited after approval",
      });
    }

    const {
      companyName,
      companyPAN,
      billingAddress,
      accountsPayableEmail,
      taxIdentificationNumber,
      proofOfAddressUrl,
      officialBusinessEmail,
      companyLogoUrl,
    } = req.body;

    const requiredFields = [
      companyName,
      companyPAN,
      billingAddress,
      accountsPayableEmail,
      taxIdentificationNumber,
      proofOfAddressUrl,
      officialBusinessEmail,
      companyLogoUrl,
    ];

    if (requiredFields.some((value) => !String(value || "").trim())) {
      return res.status(400).json({
        success: false,
        error: "All company details are required",
      });
    }

    const updatedEmployer = await Employer.findOneAndUpdate(
      { employerId },
      {
        companyName: String(companyName || "").trim(),
        companyDetails: {
          companyName: String(companyName || "").trim(),
          companyPAN: String(companyPAN || "").trim(),
          billingAddress: String(billingAddress || "").trim(),
          accountsPayableEmail: String(accountsPayableEmail || "").trim(),
          taxIdentificationNumber: String(taxIdentificationNumber || "").trim(),
          proofOfAddressUrl: String(proofOfAddressUrl || "").trim(),
          officialBusinessEmail: String(officialBusinessEmail || "").trim(),
          companyLogoUrl: String(companyLogoUrl || "").trim(),
          isSubmitted: true,
          submittedAt: new Date(),
        },
      },
      { new: true, runValidators: true },
    ).lean();

    if (!updatedEmployer) {
      return res.status(404).json({
        success: false,
        error: "Employer profile not found",
      });
    }

    return res.json({
      success: true,
      message: "Company details saved successfully",
      data: updatedEmployer.companyDetails,
    });
  } catch (error) {
    console.error("Update employer company details error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update company details",
    });
  }
};

// Upload employer company logo
exports.uploadCompanyLogo = async (req, res) => {
  try {
    const employerId = req.session.user?.roleId;

    if (!employerId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    // Store locally under /uploads/verification_doc
    const imageUrl = `/uploads/verification_doc/${req.file.filename}`;

    return res.json({
      success: true,
      imageUrl,
      message: "Company logo uploaded successfully",
    });
  } catch (error) {
    console.error("Upload company logo error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to upload company logo",
    });
  }
};

// Upload proof of address document (PDF)
exports.uploadCompanyProofDocument = async (req, res) => {
  try {
    const employerId = req.session.user?.roleId;

    if (!employerId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    // The file has been written to disk by multer (uploadVerification).
    // Return a local URL served from /uploads/verification_doc
    console.log("Uploaded proof file:", req.file);
    const fileUrl = `/uploads/verification_doc/${req.file.filename}`;

    return res.json({
      success: true,
      fileUrl,
      message: "Proof of address uploaded successfully",
    });
  } catch (error) {
    console.error("Upload company proof document error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to upload proof of address",
    });
  }
};

// Upload employer profile image
exports.uploadEmployerImage = async (req, res) => {
  try {
    const userId = req.session.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    // Upload image buffer to Cloudinary (memory upload)
    try {
      const result = await uploadImageToCloudinary(req.file.buffer);
      const imageUrl = result.secure_url;

      await User.findOneAndUpdate(
        { userId },
        { picture: imageUrl },
        { new: true },
      );

      // Update session
      req.session.user.picture = imageUrl;

      return res.json({
        success: true,
        imageUrl,
        message: "Image uploaded successfully",
      });
    } catch (err) {
      console.error(
        "Cloudinary image upload failed, falling back to local storage:",
        err?.message || err,
      );
      // fallback: if multer saved file locally (unlikely for profile upload), return local path
      if (req.file && req.file.filename) {
        const fallbackUrl = `/uploads/verification_doc/${req.file.filename}`;
        req.session.user.picture = fallbackUrl;
        await User.findOneAndUpdate(
          { userId },
          { picture: fallbackUrl },
          { new: true },
        );
        return res.json({
          success: true,
          imageUrl: fallbackUrl,
          message: "Image uploaded (local fallback)",
        });
      }
      return res
        .status(500)
        .json({ success: false, error: "Failed to upload image" });
    }
  } catch (error) {
    console.error("Upload employer image error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to upload image",
    });
  }
};

// Get employer dashboard stats
exports.getEmployerDashboardStats = async (req, res) => {
  try {
    const employerId = req.session.user?.roleId;

    if (!employerId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

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

    return res.json({
      success: true,
      data: {
        activeJobs,
        currentFreelancers,
      },
    });
  } catch (error) {
    console.error("Get employer dashboard stats error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch dashboard stats",
    });
  }
};

// Get all transactions (jobs with assigned freelancers - working or finished)
exports.getTransactions = async (req, res) => {
  try {
    const employerId = req.session.user?.roleId;

    if (!employerId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // Find all jobs with assigned freelancers (working or finished)
    const jobs = await JobListing.find({
      employerId,
      "assignedFreelancer.freelancerId": { $ne: null },
      "assignedFreelancer.status": { $in: ["working", "finished"] },
    }).lean();

    if (jobs.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    // Get freelancer details
    const freelancerIds = jobs.map(
      (job) => job.assignedFreelancer.freelancerId,
    );
    const users = await User.find({ roleId: { $in: freelancerIds } })
      .select("roleId name email picture")
      .lean();

    // Build transaction data
    const transactions = jobs.map((job) => {
      const user = users.find(
        (u) => u.roleId === job.assignedFreelancer.freelancerId,
      );

      // Calculate payment progress
      const totalBudget = job.budget || 0;
      const milestones = job.milestones || [];
      const paidAmount = milestones
        .filter((m) => m.status === "paid")
        .reduce((sum, m) => sum + (parseFloat(m.payment) || 0), 0);
      const paymentPercentage =
        totalBudget > 0 ? Math.round((paidAmount / totalBudget) * 100) : 0;

      // Calculate project completion
      const completedMilestones = milestones.filter(
        (m) => m.status === "paid",
      ).length;
      const projectCompletion =
        milestones.length > 0
          ? Math.round((completedMilestones / milestones.length) * 100)
          : 0;

      // Count pending requests
      const pendingRequests = milestones.filter(
        (m) => m.requested && m.status !== "paid",
      ).length;

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

    return res.json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch transactions",
    });
  }
};

// Get transaction details for a specific job
exports.getTransactionDetails = async (req, res) => {
  try {
    const employerId = req.session.user?.roleId;
    const { jobId } = req.params;

    if (!employerId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // Find the job
    const job = await JobListing.findOne({
      jobId,
      employerId,
    }).lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    if (!job.assignedFreelancer || !job.assignedFreelancer.freelancerId) {
      return res.status(404).json({
        success: false,
        error: "No freelancer assigned to this job",
      });
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
    const paymentPercentage =
      totalBudget > 0 ? Math.round((paidAmount / totalBudget) * 100) : 0;

    // Calculate project completion
    const completedMilestones = milestones.filter(
      (m) => m.status === "paid",
    ).length;
    const projectCompletion =
      milestones.length > 0
        ? Math.round((completedMilestones / milestones.length) * 100)
        : 0;

    return res.json({
      success: true,
      data: {
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
      },
    });
  } catch (error) {
    console.error("Get transaction details error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch transaction details",
    });
  }
};

// Pay a milestone
exports.payMilestone = async (req, res) => {
  try {
    const employerId = req.session.user?.roleId;
    const { jobId, milestoneId } = req.params;

    if (!employerId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // Find and update the job
    const job = await JobListing.findOne({
      jobId,
      employerId,
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    // Find the milestone
    const milestoneIndex = job.milestones.findIndex(
      (m) => m.milestoneId === milestoneId,
    );
    if (milestoneIndex === -1) {
      return res.status(404).json({
        success: false,
        error: "Milestone not found",
      });
    }

    // Update milestone status to paid and reset requested
    job.milestones[milestoneIndex].status = "paid";
    job.milestones[milestoneIndex].completionPercentage = 100;
    job.milestones[milestoneIndex].requested = false;

    // Check if all milestones are paid
    const allMilestonesPaid = job.milestones.every((m) => m.status === "paid");

    // If all milestones are paid, mark job as completed
    if (allMilestonesPaid && job.milestones.length > 0) {
      job.status = "completed";
      job.assignedFreelancer.status = "finished";
      job.assignedFreelancer.endDate = new Date();
    }

    await job.save();

    // Calculate updated stats
    const milestones = job.milestones;
    const totalBudget = job.budget || 0;
    const paidAmount = milestones
      .filter((m) => m.status === "paid")
      .reduce((sum, m) => sum + (parseFloat(m.payment) || 0), 0);
    const paymentPercentage =
      totalBudget > 0 ? Math.round((paidAmount / totalBudget) * 100) : 0;
    const completedMilestones = milestones.filter(
      (m) => m.status === "paid",
    ).length;
    const projectCompletion =
      milestones.length > 0
        ? Math.round((completedMilestones / milestones.length) * 100)
        : 0;

    return res.json({
      success: true,
      message: allMilestonesPaid
        ? "Milestone paid and job marked as completed"
        : "Milestone paid successfully",
      data: {
        paidAmount,
        paymentPercentage,
        projectCompletion,
        completedMilestones,
        milestonesCount: milestones.length,
        jobCompleted: allMilestonesPaid,
      },
    });
  } catch (error) {
    console.error("Pay milestone error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to pay milestone",
    });
  }
};
