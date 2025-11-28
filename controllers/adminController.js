const Complaint = require("../models/complaint");
const User = require("../models/user");
const Admin = require("../models/admin");
const JobListing = require("../models/job_listing");
const JobApplication = require("../models/job_application");
const Freelancer = require("../models/freelancer");
const Employer = require("../models/employer");
const { uploadToCloudinary } = require("../middleware/imageUpload");

// Get admin profile data
exports.getAdminProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const adminId = req.session.user.roleId;

    const user = await User.findOne({ userId }).lean();
    const admin = await Admin.findOne({ adminId }).lean();

    if (!user || !admin) {
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
    console.error("Error fetching admin profile:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch profile",
    });
  }
};

// Update admin profile
exports.updateAdminProfile = async (req, res) => {
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

    const updatedUser = await User.findOneAndUpdate(
      { userId },
      userUpdate,
      { new: true, runValidators: true }
    ).lean();

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
      { new: true }
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

// Get all complaints (Admin only)
exports.getAllComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({})
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      complaints,
      total: complaints.length,
    });
  } catch (error) {
    console.error("Error fetching all complaints:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch complaints",
    });
  }
};

// Update complaint status (Admin only)
exports.updateComplaintStatus = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { status, adminNotes } = req.body;

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

    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes;
    }

    if (status === "Resolved") {
      updateData.resolvedAt = new Date();
    }

    const complaint = await Complaint.findOneAndUpdate(
      { complaintId },
      updateData,
      { new: true }
    ).lean();

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: "Complaint not found",
      });
    }

    res.json({
      success: true,
      complaint,
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

// Get complaint by ID (Admin only)
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

// Get admin profile data
exports.getAdminProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const user = await User.findOne({ userId }).lean();

    if (!user) {
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
        subscription: user.subscription || 'Premium Admin',
        socialMedia: user.socialMedia || {
          linkedin: '',
          twitter: '',
          facebook: '',
          instagram: ''
        },
      },
    });
  } catch (error) {
    console.error("Error fetching admin profile:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch profile",
    });
  }
};

// Update admin profile
exports.updateAdminProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const {
      name,
      phone,
      location,
      profileImageUrl,
      about,
      socialMedia
    } = req.body;

    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (location !== undefined) updateData.location = location;
    if (profileImageUrl !== undefined) updateData.picture = profileImageUrl;
    if (about !== undefined) updateData.aboutMe = about;
    if (socialMedia !== undefined) updateData.socialMedia = socialMedia;

    const updatedUser = await User.findOneAndUpdate(
      { userId },
      updateData,
      { new: true }
    ).lean();

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Update session
    if (name) req.session.user.name = name;
    if (phone) req.session.user.phone = phone;
    if (location) req.session.user.location = location;
    if (profileImageUrl) req.session.user.picture = profileImageUrl;
    if (about) req.session.user.aboutMe = about;
    if (socialMedia) req.session.user.socialMedia = socialMedia;

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
        socialMedia: updatedUser.socialMedia,
      },
    });
  } catch (error) {
    console.error("Error updating admin profile:", error.message);
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
      { new: true }
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


// Get admin dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    // Get total users count (excluding admins)
    const totalUsers = await User.countDocuments({ role: { $ne: 'Admin' } });

    // Get active jobs count (status: open)
    const activeJobs = await JobListing.countDocuments({ status: 'open' });

    // Get completed tasks/applications count
    const completedTasks = await JobApplication.countDocuments({ status: 'completed' });

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
    console.error('Error fetching dashboard stats:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics',
    });
  }
};

// Get recent activities
exports.getRecentActivities = async (req, res) => {
  try {
    const activities = [];

    // Get recently resolved complaints (using resolvedAt timestamp)
    const resolvedComplaints = await Complaint.find({
      status: 'Resolved',
      resolvedAt: { $exists: true, $ne: null }
    })
      .sort({ resolvedAt: -1 })
      .limit(5)
      .lean();

    resolvedComplaints.forEach(complaint => {
      activities.push({
        type: 'complaint',
        title: `Resolved complaint: ${complaint.subject}`,
        time: getTimeAgo(complaint.resolvedAt),
        timestamp: complaint.resolvedAt,
        icon: 'complaint',
      });
    });

    // Get recently approved job listings
    // Track jobs that have status "open", "active", or "in-progress" (approved jobs)
    // Also track jobs where a freelancer was assigned (job approved and freelancer accepted)
    const recentJobs = await JobListing.find({
      $or: [
        { status: { $in: ['open', 'active', 'in-progress'] } },
        { 'assignedFreelancer.freelancerId': { $exists: true, $ne: null } }
      ]
    })
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();

    recentJobs.forEach(job => {
      // Use assignedFreelancer.startDate if available (when freelancer was accepted)
      // Otherwise use updatedAt (when job was approved/updated)
      const timestamp = job.assignedFreelancer?.startDate || job.updatedAt;
      const activityTitle = job.assignedFreelancer?.freelancerId ? `Job approved & freelancer assigned: ${job.title}` : `Job approved: ${job.title}`;
      
      activities.push({
        type: 'job',
        title: activityTitle,
        time: getTimeAgo(timestamp),
        timestamp: timestamp,
        icon: 'job',
      });
    });

    // Sort all activities by timestamp (most recent first)
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Return only the 4 most recent activities
    const sortedActivities = activities.slice(0, 4).map(activity => ({
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
    console.error('Error fetching recent activities:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent activities',
    });
  }
};

function getTimeAgo(date) {
  const now = new Date();
  const diffInMs = now - new Date(date);
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInHours < 1) {
    return 'Just now';
  } else if (diffInHours < 24) {
    return `${diffInHours} hours ago`;
  } else if (diffInDays === 1) {
    return 'Yesterday';
  } else if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  } else {
    return new Date(date).toLocaleDateString();
  }
}
