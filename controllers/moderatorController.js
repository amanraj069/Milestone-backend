const Complaint = require("../models/complaint");
const User = require("../models/user");
const Moderator = require("../models/moderator");
const JobListing = require("../models/job_listing");
const JobApplication = require("../models/job_application");
const Freelancer = require("../models/freelancer");
const Employer = require("../models/employer");
const { uploadToCloudinary } = require("../middleware/imageUpload");

// Get moderator profile data
exports.getModeratorProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const moderatorId = req.session.user.roleId;

    const user = await User.findOne({ userId }).lean();
    const moderator = await Moderator.findOne({ moderatorId }).lean();

    if (!user || !moderator) {
      return res.status(404).json({
        success: false,
        error: "Profile not found",
      });
    }

    res.json({
      success: true,
      data: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        picture: user.picture,
        location: user.location,
        role: user.role,
        aboutMe: user.aboutMe,
        socialMedia: user.socialMedia,
        subscription: user.subscription,
      },
    });
  } catch (error) {
    console.error("Error fetching moderator profile:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch profile",
    });
  }
};

// Update moderator profile
exports.updateModeratorProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { name, email, phone, location, profileImageUrl, about } = req.body;

    // Update User fields
    const userUpdate = {};
    if (name) userUpdate.name = name;
    if (email) userUpdate.email = email;
    if (phone) userUpdate.phone = phone;
    if (location) userUpdate.location = location;
    if (profileImageUrl) userUpdate.picture = profileImageUrl;
    if (about) userUpdate.aboutMe = about;

    const updatedUser = await User.findOneAndUpdate({ userId }, userUpdate, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Update session
    if (name) req.session.user.name = name;
    if (email) req.session.user.email = email;
    if (phone) req.session.user.phone = phone;
    if (profileImageUrl) req.session.user.picture = profileImageUrl;

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        location: updatedUser.location,
        picture: updatedUser.picture,
        aboutMe: updatedUser.aboutMe,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to update profile",
    });
  }
};

// Upload profile picture
exports.uploadProfilePicture = async (req, res) => {
  try {
    const userId = req.session.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No image file provided",
      });
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer);

    // Update user profile picture
    const updatedUser = await User.findOneAndUpdate(
      { userId },
      { picture: result.secure_url },
      { new: true },
    ).lean();

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Update session
    req.session.user.picture = result.secure_url;

    res.json({
      success: true,
      message: "Profile picture uploaded successfully",
      data: {
        picture: updatedUser.picture,
      },
    });
  } catch (error) {
    console.error("Error uploading profile picture:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to upload profile picture",
    });
  }
};

// Get all complaints (Moderator only)
exports.getAllComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({}).sort({ createdAt: -1 }).lean();

    // Get complainant userIds for chat functionality
    const complainantIds = [...new Set(complaints.map((c) => c.complainantId))];

    // Fetch users based on roleId (complainantId could be freelancerId or employerId)
    const complainantUsers = await User.find({
      roleId: { $in: complainantIds },
    })
      .select("userId roleId")
      .lean();

    // Add complainant userId to each complaint
    const complaintsWithUserId = complaints.map((complaint) => {
      const complainantUser = complainantUsers.find(
        (user) => user.roleId === complaint.complainantId,
      );
      const result = {
        ...complaint,
        complainantUserId: complainantUser?.userId || null,
      };
      return result;
    });

    res.json({
      success: true,
      complaints: complaintsWithUserId,
      total: complaintsWithUserId.length,
    });
  } catch (error) {
    console.error("Error fetching all complaints:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch complaints",
    });
  }
};

// Update complaint status (Moderator only)
exports.updateComplaintStatus = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { status, moderatorNotes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: "Status is required",
      });
    }

    const validStatuses = ["Pending", "Under Review", "Resolved", "Rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status value",
      });
    }

    const updateData = {
      status,
      updatedAt: new Date(),
    };

    if (moderatorNotes !== undefined) {
      updateData.moderatorNotes = moderatorNotes;
    }

    if (status === "Resolved") {
      updateData.resolvedAt = new Date();
    }

    const complaint = await Complaint.findOneAndUpdate(
      { complaintId },
      updateData,
      { new: true },
    ).lean();

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: "Complaint not found",
      });
    }

    // Add complainantUserId for chat functionality
    const complainantUser = await User.findOne({
      roleId: complaint.complainantId,
    })
      .select("userId")
      .lean();

    const complaintWithUserId = {
      ...complaint,
      complainantUserId: complainantUser?.userId || null,
    };

    res.json({
      success: true,
      complaint: complaintWithUserId,
      message: "Complaint updated successfully",
    });
  } catch (error) {
    console.error("Error updating complaint:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to update complaint",
    });
  }
};

// Get complaint by ID (Moderator only)
exports.getComplaintById = async (req, res) => {
  try {
    const { complaintId } = req.params;

    const complaint = await Complaint.findOne({ complaintId }).lean();

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: "Complaint not found",
      });
    }

    res.json({
      success: true,
      complaint,
    });
  } catch (error) {
    console.error("Error fetching complaint:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch complaint",
    });
  }
};

// Upload profile picture
exports.uploadProfilePicture = async (req, res) => {
  try {
    const userId = req.session.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No image file provided",
      });
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer);

    // Update user profile picture
    const updatedUser = await User.findOneAndUpdate(
      { userId },
      { picture: result.secure_url },
      { new: true },
    ).lean();

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Update session
    req.session.user.picture = result.secure_url;

    res.json({
      success: true,
      message: "Profile picture uploaded successfully",
      data: {
        picture: updatedUser.picture,
      },
    });
  } catch (error) {
    console.error("Error uploading profile picture:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to upload profile picture",
    });
  }
};

// Get moderator dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    // Get total users count (excluding moderators)
    const totalUsers = await User.countDocuments({
      role: { $ne: "Moderator" },
    });

    // Get active jobs count (status: open)
    const activeJobs = await JobListing.countDocuments({ status: "open" });

    // Get completed tasks/applications count
    const completedTasks = await JobApplication.countDocuments({
      status: "completed",
    });

    // Calculate uptime percentage (mock calculation)
    const uptime = 98;

    res.json({
      success: true,
      data: {
        totalUsers,
        activeJobs,
        completedTasks,
        uptime,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch dashboard statistics",
    });
  }
};

// Get recent activities
exports.getRecentActivities = async (req, res) => {
  try {
    const activities = [];

    // Get recently resolved complaints (using resolvedAt timestamp)
    const resolvedComplaints = await Complaint.find({
      status: "Resolved",
      resolvedAt: { $exists: true, $ne: null },
    })
      .sort({ resolvedAt: -1 })
      .limit(5)
      .lean();

    resolvedComplaints.forEach((complaint) => {
      activities.push({
        type: "complaint",
        title: `Resolved complaint: ${complaint.subject}`,
        time: getTimeAgo(complaint.resolvedAt),
        timestamp: complaint.resolvedAt,
        icon: "complaint",
      });
    });

    // Get recently approved job listings
    // Track jobs that have status "open", "active", or "in-progress" (approved jobs)
    // Also track jobs where a freelancer was assigned (job approved and freelancer accepted)
    const recentJobs = await JobListing.find({
      $or: [
        { status: { $in: ["open", "active", "in-progress"] } },
        { "assignedFreelancer.freelancerId": { $exists: true, $ne: null } },
      ],
    })
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();

    recentJobs.forEach((job) => {
      // Use assignedFreelancer.startDate if available (when freelancer was accepted)
      // Otherwise use updatedAt (when job was approved/updated)
      const timestamp = job.assignedFreelancer?.startDate || job.updatedAt;
      const activityTitle = job.assignedFreelancer?.freelancerId
        ? `Job approved & freelancer assigned: ${job.title}`
        : `Job approved: ${job.title}`;

      activities.push({
        type: "job",
        title: activityTitle,
        time: getTimeAgo(timestamp),
        timestamp: timestamp,
        icon: "job",
      });
    });

    // Sort all activities by timestamp (most recent first)
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Return only the 4 most recent activities
    const sortedActivities = activities.slice(0, 4).map((activity) => ({
      type: activity.type,
      title: activity.title,
      time: activity.time,
      icon: activity.icon,
    }));

    res.json({
      success: true,
      data: sortedActivities,
    });
  } catch (error) {
    console.error("Error fetching recent activities:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch recent activities",
    });
  }
};

function getTimeAgo(date) {
  const now = new Date();
  const diffInMs = now - new Date(date);
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInHours < 1) {
    return "Just now";
  } else if (diffInHours < 24) {
    return `${diffInHours} hours ago`;
  } else if (diffInDays === 1) {
    return "Yesterday";
  } else if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  } else {
    return new Date(date).toLocaleDateString();
  }
}

// Get all freelancers (Moderator only)
exports.getAllFreelancers = async (req, res) => {
  try {
    const freelancers = await Freelancer.find({}).lean();

    const freelancerIds = freelancers.map((f) => f.userId);
    const users = await User.find({ userId: { $in: freelancerIds } })
      .select("userId name email phone picture location rating createdAt")
      .lean();

    const freelancersWithDetails = freelancers.map((freelancer) => {
      const user = users.find((u) => u.userId === freelancer.userId);
      return {
        freelancerId: freelancer.freelancerId,
        userId: freelancer.userId,
        name: user?.name || "N/A",
        email: user?.email || "N/A",
        phone: user?.phone || "N/A",
        picture: user?.picture || "",
        location: user?.location || "N/A",
        rating: user?.rating || 0,
        skills: freelancer.skills?.length || 0,
        portfolioCount: freelancer.portfolio?.length || 0,
        joinedDate: user?.createdAt || freelancer.createdAt,
      };
    });

    res.json({
      success: true,
      freelancers: freelancersWithDetails,
      total: freelancersWithDetails.length,
    });
  } catch (error) {
    console.error("Error fetching freelancers:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch freelancers",
    });
  }
};

// Delete freelancer (Moderator only)
exports.deleteFreelancer = async (req, res) => {
  try {
    const { freelancerId } = req.params;

    const freelancer = await Freelancer.findOne({ freelancerId }).lean();

    if (!freelancer) {
      return res.status(404).json({
        success: false,
        error: "Freelancer not found",
      });
    }

    // Delete freelancer
    await Freelancer.deleteOne({ freelancerId });

    // Delete associated user account
    await User.deleteOne({ userId: freelancer.userId });

    res.json({
      success: true,
      message: "Freelancer deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting freelancer:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to delete freelancer",
    });
  }
};

// Get all employers (Moderator only)
exports.getAllEmployers = async (req, res) => {
  try {
    const employers = await Employer.find({}).lean();

    const employerIds = employers.map((e) => e.userId);
    const users = await User.find({ userId: { $in: employerIds } })
      .select("userId name email phone picture location rating createdAt")
      .lean();

    const employersWithDetails = employers.map((employer) => {
      const user = users.find((u) => u.userId === employer.userId);
      return {
        employerId: employer.employerId,
        userId: employer.userId,
        name: user?.name || "N/A",
        email: user?.email || "N/A",
        phone: user?.phone || "N/A",
        picture: user?.picture || "",
        companyName: employer.companyName || "N/A",
        jobsPosted: employer.jobsPosted?.length || 0,
        currentFreelancers: employer.currentFreelancers?.length || 0,
        joinedDate: user?.createdAt || employer.createdAt,
      };
    });

    res.json({
      success: true,
      employers: employersWithDetails,
      total: employersWithDetails.length,
    });
  } catch (error) {
    console.error("Error fetching employers:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch employers",
    });
  }
};

// Delete employer (Moderator only)
exports.deleteEmployer = async (req, res) => {
  try {
    const { employerId } = req.params;

    const employer = await Employer.findOne({ employerId }).lean();

    if (!employer) {
      return res.status(404).json({
        success: false,
        error: "Employer not found",
      });
    }

    // Delete employer
    await Employer.deleteOne({ employerId });

    // Delete associated user account
    await User.deleteOne({ userId: employer.userId });

    res.json({
      success: true,
      message: "Employer deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting employer:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to delete employer",
    });
  }
};

// Get all job listings (Moderator only)
exports.getAllJobListings = async (req, res) => {
  try {
    const jobs = await JobListing.find({}).lean();

    const employerIds = jobs.map((job) => job.employerId);
    const employers = await Employer.find({ employerId: { $in: employerIds } })
      .select("employerId companyName")
      .lean();
    const userIds = employers.map((e) => e.userId);
    const users = await User.find({ userId: { $in: userIds } })
      .select("userId name")
      .lean();

    const jobsWithDetails = jobs.map((job) => {
      const employer = employers.find((e) => e.employerId === job.employerId);
      const user = users.find((u) => u.userId === employer?.userId);
      return {
        jobId: job.jobId,
        title: job.title,
        employerName: user?.name || "Unknown",
        companyName: employer?.companyName || "Unknown Company",
        budget: job.budget,
        jobType: job.jobType,
        experienceLevel: job.experienceLevel,
        status: job.status,
        location: job.location || "Remote",
        postedDate: job.postedDate,
        applicationDeadline: job.applicationDeadline,
        skills: job.description?.skills || [],
        description: job.description,
        assignedFreelancer: job.assignedFreelancer,
      };
    });

    res.json({
      success: true,
      jobs: jobsWithDetails,
      total: jobsWithDetails.length,
    });
  } catch (error) {
    console.error("Error fetching job listings:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch job listings",
    });
  }
};

// Delete job listing (Moderator only)
exports.deleteJobListing = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await JobListing.findOne({ jobId }).lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job listing not found",
      });
    }

    // Delete job listing
    await JobListing.deleteOne({ jobId });

    res.json({
      success: true,
      message: "Job listing deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting job listing:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to delete job listing",
    });
  }
};
