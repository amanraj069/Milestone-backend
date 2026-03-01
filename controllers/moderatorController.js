const Complaint = require("../models/complaint");
const User = require("../models/user");
const Moderator = require("../models/moderator");
const JobListing = require("../models/job_listing");
const JobApplication = require("../models/job_application");
const Freelancer = require("../models/freelancer");
const Employer = require("../models/employer");
const RatingAudit = require("../models/RatingAudit");
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
    
    // Get all unique freelancer and employer IDs to fetch their ratings
    const freelancerIds = [...new Set(complaints.map((c) => c.freelancerId))];
    const employerIds = [...new Set(complaints.map((c) => c.employerId))];

    // Fetch users based on roleId (complainantId could be freelancerId or employerId)
    const complainantUsers = await User.find({
      roleId: { $in: complainantIds },
    })
      .select("userId roleId")
      .lean();
    
    // Fetch freelancers with their ratings
    const freelancers = await User.find({
      roleId: { $in: freelancerIds },
    })
      .select("userId roleId rating email")
      .lean();
    
    // Fetch employers with their ratings
    const employers = await User.find({
      roleId: { $in: employerIds },
    })
      .select("userId roleId rating email")
      .lean();

    // Add complainant userId and user ratings to each complaint
    const complaintsWithUserId = complaints.map((complaint) => {
      const complainantUser = complainantUsers.find(
        (user) => user.roleId === complaint.complainantId,
      );
      
      const freelancer = freelancers.find(
        (user) => user.roleId === complaint.freelancerId,
      );
      
      const employer = employers.find(
        (user) => user.roleId === complaint.employerId,
      );
      
      const result = {
        ...complaint,
        complainantUserId: complainantUser?.userId || null,
        freelancerUserId: freelancer?.userId || null,
        freelancerRating: freelancer?.rating || null,
        freelancerEmail: freelancer?.email || null,
        employerUserId: employer?.userId || null,
        employerRating: employer?.rating || null,
        employerEmail: employer?.email || null,
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

    // Add complainantUserId and user data for chat functionality
    const complainantUser = await User.findOne({
      roleId: complaint.complainantId,
    })
      .select("userId")
      .lean();
    
    // Fetch freelancer and employer ratings
    const freelancer = await User.findOne({
      roleId: complaint.freelancerId,
    })
      .select("userId roleId rating email")
      .lean();
    
    const employer = await User.findOne({
      roleId: complaint.employerId,
    })
      .select("userId roleId rating email")
      .lean();

    const complaintWithUserId = {
      ...complaint,
      complainantUserId: complainantUser?.userId || null,
      freelancerUserId: freelancer?.userId || null,
      freelancerRating: freelancer?.rating || null,
      freelancerEmail: freelancer?.email || null,
      employerUserId: employer?.userId || null,
      employerRating: employer?.rating || null,
      employerEmail: employer?.email || null,
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
      .select(
        "userId name email phone picture location rating createdAt subscription subscriptionDuration subscriptionExpiryDate"
      )
      .lean();

    // Get applications count for each freelancer using roleId
    const roleIds = freelancers.map((f) => f.freelancerId);
    const applicationCounts = await JobApplication.aggregate([
      { $match: { freelancerId: { $in: roleIds } } },
      { $group: { _id: "$freelancerId", count: { $sum: 1 } } },
    ]);

    const applicationMap = {};
    applicationCounts.forEach((item) => {
      applicationMap[item._id] = item.count;
    });

    // Get currently working status (check if freelancer is assigned to any active job)
    const activeJobs = await JobListing.find({
      "assignedFreelancer.freelancerId": { $in: roleIds },
      "assignedFreelancer.status": "working",
    })
      .select("assignedFreelancer.freelancerId")
      .lean();

    const workingFreelancerIds = new Set(
      activeJobs.map((job) => job.assignedFreelancer.freelancerId)
    );

    const freelancersWithDetails = freelancers.map((freelancer) => {
      const user = users.find((u) => u.userId === freelancer.userId);
      const isPremium = user?.subscription === "Premium";
      const isCurrentlyWorking = workingFreelancerIds.has(
        freelancer.freelancerId
      );

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
        subscription: user?.subscription || "Basic",
        isPremium,
        subscriptionDuration: user?.subscriptionDuration || null,
        subscriptionExpiryDate: user?.subscriptionExpiryDate || null,
        applicationsCount: applicationMap[freelancer.freelancerId] || 0,
        isCurrentlyWorking,
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

// Get freelancer applications (Moderator only)
exports.getFreelancerApplications = async (req, res) => {
  try {
    const { freelancerId } = req.params;

    // Check if freelancer exists
    const freelancer = await Freelancer.findOne({ freelancerId }).lean();
    if (!freelancer) {
      return res.status(404).json({
        success: false,
        error: "Freelancer not found",
      });
    }

    // Get all applications for this freelancer
    const applications = await JobApplication.find({ freelancerId }).lean();

    // Get job details for all applications
    const jobIds = applications.map((app) => app.jobId);
    const jobs = await JobListing.find({ jobId: { $in: jobIds } })
      .select("jobId title")
      .lean();

    // Combine application data with job details
    const applicationsWithDetails = applications.map((app) => {
      const job = jobs.find((j) => j.jobId === app.jobId);
      return {
        applicationId: app.applicationId,
        jobId: app.jobId,
        jobTitle: job?.title || "Unknown Job",
        appliedDate: app.appliedDate,
        status: app.status,
      };
    });

    // Sort by applied date (most recent first)
    applicationsWithDetails.sort(
      (a, b) => new Date(b.appliedDate) - new Date(a.appliedDate)
    );

    res.json({
      success: true,
      applications: applicationsWithDetails,
      total: applicationsWithDetails.length,
    });
  } catch (error) {
    console.error("Error fetching freelancer applications:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch freelancer applications",
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
      .select(
        "userId name email phone picture location rating createdAt subscription subscriptionDuration subscriptionExpiryDate"
      )
      .lean();

    // Get job listing counts per employer
    const empIds = employers.map((e) => e.employerId);
    const jobCounts = await JobListing.aggregate([
      { $match: { employerId: { $in: empIds } } },
      { $group: { _id: "$employerId", count: { $sum: 1 } } },
    ]);
    const jobCountMap = {};
    jobCounts.forEach((item) => {
      jobCountMap[item._id] = item.count;
    });

    // Get hired freelancers count (current + previously worked)
    const employersWithDetails = employers.map((employer) => {
      const user = users.find((u) => u.userId === employer.userId);
      const isPremium = user?.subscription === "Premium";
      const currentHires = employer.currentFreelancers?.length || 0;
      const pastHires = employer.previouslyWorkedFreelancers?.length || 0;

      return {
        employerId: employer.employerId,
        userId: employer.userId,
        name: user?.name || "N/A",
        email: user?.email || "N/A",
        phone: user?.phone || "N/A",
        picture: user?.picture || "",
        location: user?.location || "N/A",
        companyName: employer.companyName || "N/A",
        rating: user?.rating || 0,
        subscription: user?.subscription || "Basic",
        isPremium,
        subscriptionDuration: user?.subscriptionDuration || null,
        subscriptionExpiryDate: user?.subscriptionExpiryDate || null,
        jobListingsCount: jobCountMap[employer.employerId] || 0,
        hiredCount: currentHires + pastHires,
        currentHires,
        pastHires,
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

// Get employer job listings (Moderator only)
exports.getEmployerJobListings = async (req, res) => {
  try {
    const { employerId } = req.params;

    // Check if employer exists
    const employer = await Employer.findOne({ employerId }).lean();
    if (!employer) {
      return res.status(404).json({
        success: false,
        error: "Employer not found",
      });
    }

    // Get all job listings for this employer with full details
    const jobs = await JobListing.find({ employerId }).lean();

    const now = new Date();

    const jobsWithDetails = jobs.map((job) => {
      // Real-time status calculation
      let computedStatus = job.status;
      if (
        job.status === "open" &&
        job.applicationDeadline &&
        new Date(job.applicationDeadline) < now
      ) {
        computedStatus = "expired";
      }
      if (job.status === "in-progress" && job.assignedFreelancer?.status === "finished") {
        computedStatus = "completed";
      }

      // Calculate overall progress from milestones
      let overallProgress = 0;
      if (job.milestones && job.milestones.length > 0) {
        const totalPercentage = job.milestones.reduce(
          (sum, m) => sum + (m.completionPercentage || 0),
          0
        );
        overallProgress = Math.round(totalPercentage / job.milestones.length);
      }

      return {
        jobId: job.jobId,
        title: job.title,
        budget: job.budget,
        status: computedStatus,
        originalStatus: job.status,
        jobType: job.jobType,
        experienceLevel: job.experienceLevel,
        location: job.location || "Remote",
        remote: job.remote,
        postedDate: job.postedDate,
        applicationDeadline: job.applicationDeadline,
        description: job.description?.text || "",
        skills: job.description?.skills || [],
        responsibilities: job.description?.responsibilities || [],
        requirements: job.description?.requirements || [],
        startDate: job.assignedFreelancer?.startDate || null,
        endDate: job.assignedFreelancer?.endDate || null,
        hasAssignedFreelancer: !!job.assignedFreelancer?.freelancerId,
        freelancerStatus: job.assignedFreelancer?.status || null,
        milestones: (job.milestones || []).map((m) => ({
          milestoneId: m.milestoneId,
          description: m.description,
          deadline: m.deadline,
          payment: m.payment,
          status: m.status,
          completionPercentage: m.completionPercentage || 0,
        })),
        overallProgress,
        applicants: job.applicants || 0,
      };
    });

    // Sort by posted date (most recent first)
    jobsWithDetails.sort(
      (a, b) => new Date(b.postedDate) - new Date(a.postedDate)
    );

    res.json({
      success: true,
      jobListings: jobsWithDetails,
      total: jobsWithDetails.length,
    });
  } catch (error) {
    console.error("Error fetching employer job listings:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch employer job listings",
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

    // Get applicant counts for all jobs
    const jobIds = jobs.map((job) => job.jobId);
    const applicantCounts = await JobApplication.aggregate([
      { $match: { jobId: { $in: jobIds } } },
      { $group: { _id: "$jobId", count: { $sum: 1 } } },
    ]);

    const applicantMap = {};
    applicantCounts.forEach((item) => {
      applicantMap[item._id] = item.count;
    });

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
        applicantsCount: applicantMap[job.jobId] || 0,
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

// Get applicants for a specific job (Moderator only)
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
        picture: user?.picture || "",
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

//RATING ADJUSTMENT (Moderator)

exports.adjustUserRating = async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const { adjustment, reason, complaintId } = req.body;

    if (!targetUserId || adjustment === undefined || !reason) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: targetUserId, adjustment, reason",
      });
    }

    const adjustmentNum = parseFloat(adjustment);
    if (isNaN(adjustmentNum) || adjustmentNum < -4.0 || adjustmentNum > 0.5) {
      return res.status(400).json({
        success: false,
        error: "Adjustment must be between -4.0 and +0.5",
      });
    }

    if (Math.abs(adjustmentNum * 10 % 1) > 0.001) {
      return res.status(400).json({
        success: false,
        error: "Adjustment must be in increments of 0.1",
      });
    }

    if (reason.trim().length < 20 || reason.trim().length > 500) {
      return res.status(400).json({
        success: false,
        error: "Reason must be between 20 and 500 characters",
      });
    }

    const targetUser = await User.findOne({ userId: targetUserId });
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: "Target user not found",
      });
    }

    const moderatorUserId = req.session.user.id;
    const moderator = await User.findOne({ userId: moderatorUserId });
    if (!moderator) {
      return res.status(404).json({
        success: false,
        error: "Moderator not found",
      });
    }

    const currentRating = targetUser.useModeratorRating
      ? targetUser.moderatorRating
      : targetUser.calculatedRating || targetUser.rating;

    let newRating = currentRating + adjustmentNum;
    newRating = Math.max(1.0, Math.min(5.0, newRating));
    newRating = Math.round(newRating * 10) / 10;

    const ipAddress =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      null;

    const auditLog = new RatingAudit({
      targetUserId: targetUser.userId,
      targetUserName: targetUser.name,
      targetUserRole: targetUser.role,
      previousRating: currentRating,
      newRating: newRating,
      adjustment: adjustmentNum,
      reason: reason.trim(),
      relatedComplaintId: complaintId || null,
      adjustedBy: moderator.userId,
      adjustedByName: moderator.name,
      adjustedByRole: moderator.role,
      ipAddress: ipAddress,
    });

    await auditLog.save();

    targetUser.moderatorRating = newRating;
    targetUser.useModeratorRating = true;
    targetUser.moderatorAdjustmentReason = reason.trim();
    targetUser.adjustedBy = moderator.userId;
    targetUser.adjustedAt = new Date();
    targetUser.rating = newRating;

    await targetUser.save();

    res.json({
      success: true,
      message: "Rating adjusted successfully",
      data: {
        userId: targetUser.userId,
        name: targetUser.name,
        previousRating: currentRating,
        newRating: newRating,
        adjustment: adjustmentNum,
        adjustedBy: moderator.name,
        adjustedAt: targetUser.adjustedAt,
        auditId: auditLog.auditId,
      },
    });
  } catch (error) {
    console.error("Error adjusting user rating:", error);
    res.status(500).json({
      success: false,
      error: "Failed to adjust rating",
    });
  }
};

exports.getRatingAuditHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    const auditLogs = await RatingAudit.find({ targetUserId: userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      history: auditLogs,
      total: auditLogs.length,
    });
  } catch (error) {
    console.error("Error fetching rating audit history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch audit history",
    });
  }
};

exports.revertToCalculatedRating = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 20) {
      return res.status(400).json({
        success: false,
        error: "Reason must be at least 20 characters",
      });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    if (!user.useModeratorRating) {
      return res.status(400).json({
        success: false,
        error: "User is already using calculated rating",
      });
    }

    const moderatorUserId = req.session.user.id;
    const moderator = await User.findOne({ userId: moderatorUserId });

    const previousRating = user.moderatorRating;
    const calculatedRating = user.calculatedRating || user.rating;

    const auditLog = new RatingAudit({
      targetUserId: user.userId,
      targetUserName: user.name,
      targetUserRole: user.role,
      previousRating: previousRating,
      newRating: calculatedRating,
      adjustment: calculatedRating - previousRating,
      reason: `[REVERT TO CALCULATED] ${reason.trim()}`,
      adjustedBy: moderator.userId,
      adjustedByName: moderator.name,
      adjustedByRole: moderator.role,
      ipAddress:
        req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress ||
        null,
    });

    await auditLog.save();

    user.useModeratorRating = false;
    user.rating = calculatedRating;
    user.moderatorRating = null;
    user.moderatorAdjustmentReason = "";
    user.adjustedBy = null;
    user.adjustedAt = null;

    await user.save();

    res.json({
      success: true,
      message: "Reverted to calculated rating",
      data: {
        userId: user.userId,
        name: user.name,
        previousRating: previousRating,
        newRating: calculatedRating,
      },
    });
  } catch (error) {
    console.error("Error reverting rating:", error);
    res.status(500).json({
      success: false,
      error: "Failed to revert rating",
    });
  }
};
