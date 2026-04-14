const Complaint = require("../models/complaint");
const User = require("../models/user");
const Moderator = require("../models/moderator");
const JobListing = require("../models/job_listing");
const JobApplication = require("../models/job_application");
const Freelancer = require("../models/freelancer");
const Employer = require("../models/employer");
const RatingAudit = require("../models/RatingAudit");
const Blog = require("../models/blog");
const Notification = require("../models/Notification");
const { v4: uuidv4 } = require("uuid");
const { uploadToCloudinary } = require("../middleware/imageUpload");

function getPaginationParams(query, defaultLimit = 25, maxLimit = 100) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(query.limit, 10) || defaultLimit),
  );
  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

function getPaginationMeta(total, page, limit) {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

function parseArrayQueryParam(value) {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => String(entry).split(","))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

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
    const { search = "", sortBy = "date", sortOrder = "desc" } = req.query;
    const { page, limit, skip } = getPaginationParams(req.query, 25);
    const cleanComplainantTypeIn = parseArrayQueryParam(req.query.complainantTypeIn);
    const cleanAgainstIn = parseArrayQueryParam(req.query.againstIn);
    const cleanJobIn = parseArrayQueryParam(req.query.jobIn);
    const cleanStatusIn = parseArrayQueryParam(req.query.statusIn);
    const cleanPriorityIn = parseArrayQueryParam(req.query.priorityIn);
    const cleanTypeIn = parseArrayQueryParam(req.query.typeIn);
    const searchText = String(search || "").trim();
    const regex = searchText
      ? new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : null;

    const andConditions = [];

    if (cleanComplainantTypeIn.length) {
      andConditions.push({ complainantType: { $in: cleanComplainantTypeIn } });
    }
    if (cleanAgainstIn.length) {
      andConditions.push({
        $or: [
          { complainantType: "Freelancer", employerName: { $in: cleanAgainstIn } },
          { complainantType: "Employer", freelancerName: { $in: cleanAgainstIn } },
        ],
      });
    }
    if (cleanJobIn.length) {
      andConditions.push({ jobTitle: { $in: cleanJobIn } });
    }
    if (cleanStatusIn.length) {
      andConditions.push({ status: { $in: cleanStatusIn } });
    }
    if (cleanPriorityIn.length) {
      andConditions.push({ priority: { $in: cleanPriorityIn } });
    }
    if (cleanTypeIn.length) {
      andConditions.push({ complaintType: { $in: cleanTypeIn } });
    }

    if (regex) {
      andConditions.push({
        $or: [
          { subject: regex },
          { complainantName: regex },
          { complaintType: regex },
          { jobTitle: regex },
          { employerName: regex },
          { freelancerName: regex },
        ],
      });
    }

    const query = andConditions.length ? { $and: andConditions } : {};
    const sortFieldMap = {
      date: "createdAt",
      priority: "priority",
      status: "status",
      complainant: "complainantName",
    };
    const normalizedSortField = sortFieldMap[sortBy] || "createdAt";
    const normalizedSortOrder = String(sortOrder).toLowerCase() === "asc" ? 1 : -1;
    const querySort = { [normalizedSortField]: normalizedSortOrder, _id: normalizedSortOrder };

    const [
      complaints,
      totalComplaints,
      pendingComplaints,
      underReviewComplaints,
      resolvedComplaints,
      rejectedComplaints,
    ] = await Promise.all([
      Complaint.find(query)
        .sort(querySort)
        .skip(skip)
        .limit(limit)
        .select(
          "complaintId complainantType complainantId complainantName freelancerId freelancerName jobId jobTitle employerId employerName complaintType priority subject status createdAt updatedAt resolvedAt",
        )
        .lean(),
      Complaint.countDocuments(query),
      Complaint.countDocuments({ status: "Pending" }),
      Complaint.countDocuments({ status: "Under Review" }),
      Complaint.countDocuments({ status: "Resolved" }),
      Complaint.countDocuments({ status: "Rejected" }),
    ]);

    const stats = {
      total: totalComplaints,
      pending: pendingComplaints,
      underReview: underReviewComplaints,
      resolved: resolvedComplaints,
      rejected: rejectedComplaints,
    };

    if (!complaints.length) {
      return res.json({
        success: true,
        complaints: [],
        total: totalComplaints,
        stats,
        pagination: getPaginationMeta(totalComplaints, page, limit),
      });
    }

    // Get complainant userIds for chat functionality
    const complainantIds = [...new Set(complaints.map((c) => c.complainantId))];
    
    // Get all unique freelancer and employer IDs to fetch their ratings
    const freelancerIds = [...new Set(complaints.map((c) => c.freelancerId))];
    const employerIds = [...new Set(complaints.map((c) => c.employerId))];

    // Fetch users based on roleId or userId (for backward compatibility in old complaints data)
    const complainantUsers = await User.find({
      $or: [
        { roleId: { $in: complainantIds } },
        { userId: { $in: complainantIds } },
      ],
    })
      .select("userId roleId")
      .lean();
    
    // Fetch freelancers with their ratings
    const freelancers = await User.find({
      $or: [
        { roleId: { $in: freelancerIds } },
        { userId: { $in: freelancerIds } },
      ],
    })
      .select("userId roleId rating email")
      .lean();
    
    // Fetch employers with their ratings
    const employers = await User.find({
      $or: [
        { roleId: { $in: employerIds } },
        { userId: { $in: employerIds } },
      ],
    })
      .select("userId roleId rating email")
      .lean();

    // Add complainant userId and user ratings to each complaint
    const complainantByRoleId = new Map(
      complainantUsers.filter((u) => u.roleId).map((u) => [u.roleId, u]),
    );
    const complainantByUserId = new Map(
      complainantUsers.filter((u) => u.userId).map((u) => [u.userId, u]),
    );
    const freelancerByRoleId = new Map(
      freelancers.filter((u) => u.roleId).map((u) => [u.roleId, u]),
    );
    const freelancerByUserId = new Map(
      freelancers.filter((u) => u.userId).map((u) => [u.userId, u]),
    );
    const employerByRoleId = new Map(
      employers.filter((u) => u.roleId).map((u) => [u.roleId, u]),
    );
    const employerByUserId = new Map(
      employers.filter((u) => u.userId).map((u) => [u.userId, u]),
    );

    const complaintsWithUserId = complaints.map((complaint) => {
      const complainantUser =
        complainantByRoleId.get(complaint.complainantId) ||
        complainantByUserId.get(complaint.complainantId);

      const freelancer =
        freelancerByRoleId.get(complaint.freelancerId) ||
        freelancerByUserId.get(complaint.freelancerId);

      const employer =
        employerByRoleId.get(complaint.employerId) ||
        employerByUserId.get(complaint.employerId);
      
      const result = {
        ...complaint,
        complainantUserId:
          complainantUser?.userId ||
          (complaint.complainantType === "Freelancer"
            ? freelancer?.userId || null
            : employer?.userId || null),
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
      total: totalComplaints,
      stats,
      pagination: getPaginationMeta(totalComplaints, page, limit),
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
      $or: [
        { roleId: complaint.complainantId },
        { userId: complaint.complainantId },
      ],
    })
      .select("userId")
      .lean();
    
    // Fetch freelancer and employer ratings
    const freelancer = await User.findOne({
      $or: [
        { roleId: complaint.freelancerId },
        { userId: complaint.freelancerId },
      ],
    })
      .select("userId roleId rating email")
      .lean();
    
    const employer = await User.findOne({
      $or: [
        { roleId: complaint.employerId },
        { userId: complaint.employerId },
      ],
    })
      .select("userId roleId rating email")
      .lean();

    const complaintWithUserId = {
      ...complaint,
      complainantUserId:
        complainantUser?.userId ||
        (complaint.complainantType === "Freelancer"
          ? freelancer?.userId || null
          : employer?.userId || null),
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
    // JobApplication.status enum is ["Pending", "Accepted", "Rejected"],
    // so use "Accepted" as the completed applications metric.
    const completedTasks = await JobApplication.countDocuments({
      status: "Accepted",
    });

    // Calculate total read time via aggregation to avoid loading all blog docs
    const readTimeAgg = await Blog.aggregate([
      {
        $group: {
          _id: null,
          totalReadTime: { $sum: { $ifNull: ["$readTime", 0] } },
        },
      },
    ]);
    const totalReadTime = readTimeAgg[0]?.totalReadTime || 0;

    // Calculate uptime percentage (mock calculation)
    const uptime = 98;

    // Calculate average user rating (across users that have a rating)
    // Calculate average rating separately for freelancers and employers, then combine
    const freelancerRatingAgg = await User.aggregate([
      { $match: { role: 'Freelancer', rating: { $exists: true, $ne: null } } },
      { $group: { _id: null, avgRating: { $avg: '$rating' } } },
    ]);
    const employerRatingAgg = await User.aggregate([
      { $match: { role: 'Employer', rating: { $exists: true, $ne: null } } },
      { $group: { _id: null, avgRating: { $avg: '$rating' } } },
    ]);

    const avgFreelancerRating = freelancerRatingAgg && freelancerRatingAgg[0] && freelancerRatingAgg[0].avgRating
      ? Number(freelancerRatingAgg[0].avgRating)
      : null;
    const avgEmployerRating = employerRatingAgg && employerRatingAgg[0] && employerRatingAgg[0].avgRating
      ? Number(employerRatingAgg[0].avgRating)
      : null;

    // Combine the two averages: if both present average them, else use whichever exists, else 0
    let avgRating = 0;
    if (Number.isFinite(avgFreelancerRating) && Number.isFinite(avgEmployerRating)) {
      avgRating = Number(((avgFreelancerRating + avgEmployerRating) / 2).toFixed(1));
    } else if (Number.isFinite(avgFreelancerRating)) {
      avgRating = Number(avgFreelancerRating.toFixed(1));
    } else if (Number.isFinite(avgEmployerRating)) {
      avgRating = Number(avgEmployerRating.toFixed(1));
    } else {
      avgRating = 0;
    }

    // Calculate success rate aligned with moderator freelancers view:
    // successRate = (currently working freelancers / total freelancers) * 100
    const totalFreelancers = await Freelancer.countDocuments({});
    let currentlyWorkingCount = 0;
    if (totalFreelancers > 0) {
      const workingFreelancerIds = await JobListing.distinct(
        'assignedFreelancer.freelancerId',
        {
          'assignedFreelancer.freelancerId': { $exists: true, $ne: null },
          'assignedFreelancer.status': 'working',
        },
      );
      currentlyWorkingCount = workingFreelancerIds.length;
    }
    const successRate = totalFreelancers > 0 ? Math.round((currentlyWorkingCount / totalFreelancers) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalUsers,
        activeJobs,
        completedTasks,
        uptime,
        totalReadTime,
        avgRating,
        successRate,
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
    const { search = "", sortBy = "recent" } = req.query;
    const { page, limit, skip } = getPaginationParams(req.query, 25);
    const cleanNameIn = parseArrayQueryParam(req.query.nameIn);
    const cleanEmailIn = parseArrayQueryParam(req.query.emailIn);
    const cleanPhoneIn = parseArrayQueryParam(req.query.phoneIn);
    const cleanRatingIn = parseArrayQueryParam(req.query.ratingIn)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    const cleanSubscribedIn = parseArrayQueryParam(req.query.subscribedIn)
      .map((value) => String(value).toLowerCase());
    const cleanDurationIn = parseArrayQueryParam(req.query.durationIn)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    const searchText = String(search || "").trim();
    const regex = searchText
      ? new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : null;

    const andConditions = [{ role: "Freelancer" }];

    if (cleanNameIn.length) {
      andConditions.push({ name: { $in: cleanNameIn } });
    }
    if (cleanEmailIn.length) {
      andConditions.push({ email: { $in: cleanEmailIn } });
    }
    if (cleanPhoneIn.length) {
      andConditions.push({ phone: { $in: cleanPhoneIn } });
    }
    if (cleanRatingIn.length) {
      andConditions.push({ rating: { $in: cleanRatingIn } });
    }
    if (cleanSubscribedIn.length) {
      const wantsPremium = cleanSubscribedIn.includes("yes");
      const wantsBasic = cleanSubscribedIn.includes("no");

      if (wantsPremium && !wantsBasic) {
        andConditions.push({ subscription: "Premium" });
      } else if (!wantsPremium && wantsBasic) {
        andConditions.push({ subscription: { $ne: "Premium" } });
      }
    }
    if (cleanDurationIn.length) {
      const includesZero = cleanDurationIn.includes(0);
      const positiveDurations = cleanDurationIn.filter((value) => value > 0);

      if (includesZero && positiveDurations.length) {
        andConditions.push({
          $or: [
            { subscriptionDuration: { $in: positiveDurations } },
            { subscriptionDuration: { $exists: false } },
            { subscriptionDuration: null },
            { subscriptionDuration: 0 },
          ],
        });
      } else if (includesZero) {
        andConditions.push({
          $or: [
            { subscriptionDuration: { $exists: false } },
            { subscriptionDuration: null },
            { subscriptionDuration: 0 },
          ],
        });
      } else if (positiveDurations.length) {
        andConditions.push({ subscriptionDuration: { $in: positiveDurations } });
      }
    }

    if (regex) {
      andConditions.push({
        $or: [
          { name: regex },
          { email: regex },
          { location: regex },
          { phone: regex },
        ],
      });
    }

    const query = andConditions.length === 1 ? andConditions[0] : { $and: andConditions };
    const sortMap = {
      recent: { createdAt: -1, _id: -1 },
      oldest: { createdAt: 1, _id: 1 },
      "name-az": { name: 1, _id: 1 },
      "name-za": { name: -1, _id: -1 },
      "rating-high-low": { rating: -1, _id: -1 },
      "rating-low-high": { rating: 1, _id: 1 },
    };
    const userSort = sortMap[sortBy] || sortMap.recent;

    const [users, totalFreelancers] = await Promise.all([
      User.find(query)
        .select(
          "userId name email phone picture location rating createdAt subscription subscriptionDuration subscriptionExpiryDate",
        )
        .sort(userSort)
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    const freelancers = await Freelancer.find({ userId: { $in: users.map((u) => u.userId) } })
      .select("freelancerId userId skills portfolio createdAt")
      .lean();

    if (!freelancers.length) {
      return res.json({
        success: true,
        freelancers: [],
        total: totalFreelancers,
        pagination: getPaginationMeta(totalFreelancers, page, limit),
      });
    }

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

    const userMap = new Map(users.map((u) => [u.userId, u]));
    const freelancerByUserId = new Map(
      freelancers.map((freelancer) => [freelancer.userId, freelancer]),
    );

    const freelancersWithDetails = users
      .map((user) => {
      const freelancer = freelancerByUserId.get(user.userId);
      if (!freelancer) {
        return null;
      }
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
    })
      .filter(Boolean);

    res.json({
      success: true,
      freelancers: freelancersWithDetails,
      total: totalFreelancers,
      pagination: getPaginationMeta(totalFreelancers, page, limit),
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
    const { search = "", sortBy = "recent" } = req.query;
    const { page, limit, skip } = getPaginationParams(req.query, 25);
    const cleanNameIn = parseArrayQueryParam(req.query.nameIn);
    const cleanCompanyIn = parseArrayQueryParam(req.query.companyIn);
    const cleanEmailIn = parseArrayQueryParam(req.query.emailIn);
    const cleanPhoneIn = parseArrayQueryParam(req.query.phoneIn);
    const cleanRatingIn = parseArrayQueryParam(req.query.ratingIn)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    const cleanSubscribedIn = parseArrayQueryParam(req.query.subscribedIn)
      .map((value) => String(value).toLowerCase());
    const cleanDurationIn = parseArrayQueryParam(req.query.durationIn)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    const searchText = String(search || "").trim();
    const regex = searchText
      ? new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : null;

    const andConditions = [{ "user.role": "Employer" }];

    if (cleanNameIn.length) {
      andConditions.push({ "user.name": { $in: cleanNameIn } });
    }
    if (cleanCompanyIn.length) {
      andConditions.push({ companyName: { $in: cleanCompanyIn } });
    }
    if (cleanEmailIn.length) {
      andConditions.push({ "user.email": { $in: cleanEmailIn } });
    }
    if (cleanPhoneIn.length) {
      andConditions.push({ "user.phone": { $in: cleanPhoneIn } });
    }
    if (cleanRatingIn.length) {
      andConditions.push({ "user.rating": { $in: cleanRatingIn } });
    }
    if (cleanSubscribedIn.length) {
      const wantsPremium = cleanSubscribedIn.includes("yes");
      const wantsBasic = cleanSubscribedIn.includes("no");

      if (wantsPremium && !wantsBasic) {
        andConditions.push({ "user.subscription": "Premium" });
      } else if (!wantsPremium && wantsBasic) {
        andConditions.push({ "user.subscription": { $ne: "Premium" } });
      }
    }
    if (cleanDurationIn.length) {
      const includesZero = cleanDurationIn.includes(0);
      const positiveDurations = cleanDurationIn.filter((value) => value > 0);

      if (includesZero && positiveDurations.length) {
        andConditions.push({
          $or: [
            { "user.subscriptionDuration": { $in: positiveDurations } },
            { "user.subscriptionDuration": { $exists: false } },
            { "user.subscriptionDuration": null },
            { "user.subscriptionDuration": 0 },
          ],
        });
      } else if (includesZero) {
        andConditions.push({
          $or: [
            { "user.subscriptionDuration": { $exists: false } },
            { "user.subscriptionDuration": null },
            { "user.subscriptionDuration": 0 },
          ],
        });
      } else if (positiveDurations.length) {
        andConditions.push({ "user.subscriptionDuration": { $in: positiveDurations } });
      }
    }

    if (regex) {
      andConditions.push({
        $or: [
          { "user.name": regex },
          { "user.email": regex },
          { "user.phone": regex },
          { "user.location": regex },
          { companyName: regex },
        ],
      });
    }

    const matchStage = andConditions.length === 1 ? andConditions[0] : { $and: andConditions };
    const sortMap = {
      recent: { "user.createdAt": -1, _id: -1 },
      oldest: { "user.createdAt": 1, _id: 1 },
      "name-az": { "user.name": 1, _id: 1 },
      "name-za": { "user.name": -1, _id: -1 },
      "rating-high-low": { "user.rating": -1, _id: -1 },
      "rating-low-high": { "user.rating": 1, _id: 1 },
      "jobListings-high-low": { jobListingsCount: -1, _id: -1 },
      "jobListings-low-high": { jobListingsCount: 1, _id: 1 },
    };
    const sortStage = sortMap[sortBy] || sortMap.recent;

    const aggregateResult = await Employer.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "userId",
          as: "user",
        },
      },
      { $unwind: "$user" },
      { $match: matchStage },
      {
        $lookup: {
          from: "job_listings",
          let: { employerId: "$employerId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$employerId", "$$employerId"] } } },
            { $count: "count" },
          ],
          as: "jobListingMeta",
        },
      },
      {
        $addFields: {
          jobListingsCount: {
            $ifNull: [{ $arrayElemAt: ["$jobListingMeta.count", 0] }, 0],
          },
        },
      },
      {
        $facet: {
          rows: [
            { $sort: sortStage },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                employerId: 1,
                userId: 1,
                companyName: 1,
                currentFreelancers: 1,
                previouslyWorkedFreelancers: 1,
                createdAt: 1,
                jobListingsCount: 1,
                "user.name": 1,
                "user.email": 1,
                "user.phone": 1,
                "user.picture": 1,
                "user.location": 1,
                "user.rating": 1,
                "user.createdAt": 1,
                "user.subscription": 1,
                "user.subscriptionDuration": 1,
                "user.subscriptionExpiryDate": 1,
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ]);

    const employers = aggregateResult?.[0]?.rows || [];
    const totalEmployers = aggregateResult?.[0]?.total?.[0]?.count || 0;

    if (!employers.length) {
      return res.json({
        success: true,
        employers: [],
        total: totalEmployers,
        pagination: getPaginationMeta(totalEmployers, page, limit),
      });
    }

    const empIds = employers.map((e) => e.employerId);

    // Get hired freelancers from job listings as source of truth
    // (covers cases where Employer.currentFreelancers arrays are stale)
    const hiredAgg = await JobListing.aggregate([
      { $match: { employerId: { $in: empIds }, "assignedFreelancer.freelancerId": { $exists: true, $ne: null } } },
      {
        $group: {
          _id: "$employerId",
          hiredFreelancers: { $addToSet: "$assignedFreelancer.freelancerId" },
          activeFreelancers: {
            $addToSet: {
              $cond: [
                { $eq: ["$assignedFreelancer.status", "working"] },
                "$assignedFreelancer.freelancerId",
                null,
              ],
            },
          },
        },
      },
    ]);

    const hiredMap = {};
    hiredAgg.forEach((item) => {
      const hiredSet = (item.hiredFreelancers || []).filter(Boolean);
      const activeSet = (item.activeFreelancers || []).filter(Boolean);
      hiredMap[item._id] = {
        hiredCount: hiredSet.length,
        currentHires: activeSet.length,
      };
    });

    const employersWithDetails = employers.map((employer) => {
      const user = employer.user || {};
      const isPremium = user?.subscription === "Premium";
      const fallbackCurrentHires = employer.currentFreelancers?.length || 0;
      const fallbackPastHires = employer.previouslyWorkedFreelancers?.length || 0;

      const hiredFromJobs = hiredMap[employer.employerId];
      const currentHires = hiredFromJobs ? hiredFromJobs.currentHires : fallbackCurrentHires;
      const hiredCount = hiredFromJobs
        ? hiredFromJobs.hiredCount
        : fallbackCurrentHires + fallbackPastHires;
      const pastHires = Math.max(0, hiredCount - currentHires);

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
        jobListingsCount: employer.jobListingsCount || 0,
        hiredCount,
        currentHires,
        pastHires,
        joinedDate: user?.createdAt || employer.createdAt,
      };
    });

    res.json({
      success: true,
      employers: employersWithDetails,
      total: totalEmployers,
      pagination: getPaginationMeta(totalEmployers, page, limit),
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

    // Get all job listings for this employer
    const jobs = await JobListing.find({ employerId })
      .select("jobId title budget status jobType postedDate applicants assignedFreelancer")
      .lean();

    const jobsWithDetails = jobs.map((job) => ({
      jobId: job.jobId,
      title: job.title,
      budget: job.budget,
      status: job.status,
      jobType: job.jobType,
      postedDate: job.postedDate,
      hasAssignedFreelancer: !!job.assignedFreelancer?.freelancerId,
    }));

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
    const { search = "", sortBy = "recent" } = req.query;
    const { page, limit, skip } = getPaginationParams(req.query, 25);
    const cleanTitleIn = parseArrayQueryParam(req.query.titleIn);
    const cleanCompanyIn = parseArrayQueryParam(req.query.companyIn);
    const cleanTypeIn = parseArrayQueryParam(req.query.typeIn);
    const cleanStatusIn = parseArrayQueryParam(req.query.statusIn);
    const searchText = String(search || "").trim();
    const regex = searchText
      ? new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : null;

    const andConditions = [];
    if (cleanTitleIn.length) {
      andConditions.push({ title: { $in: cleanTitleIn } });
    }
    if (cleanCompanyIn.length) {
      andConditions.push({ companyName: { $in: cleanCompanyIn } });
    }
    if (cleanTypeIn.length) {
      andConditions.push({ jobType: { $in: cleanTypeIn } });
    }
    if (cleanStatusIn.length) {
      andConditions.push({ status: { $in: cleanStatusIn } });
    }
    if (regex) {
      andConditions.push({
        $or: [
          { title: regex },
          { companyName: regex },
          { location: regex },
          { jobType: regex },
        ],
      });
    }

    const matchStage = andConditions.length ? { $and: andConditions } : {};
    const sortMap = {
      recent: { postedDate: -1, _id: -1 },
      oldest: { postedDate: 1, _id: 1 },
      "budget-high-low": { budget: -1, _id: -1 },
      "budget-low-high": { budget: 1, _id: 1 },
      "applicants-high-low": { applicantsCount: -1, _id: -1 },
      "applicants-low-high": { applicantsCount: 1, _id: 1 },
    };
    const sortStage = sortMap[sortBy] || sortMap.recent;

    const aggregateResult = await JobListing.aggregate([
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
        $lookup: {
          from: "job_applications",
          let: { jobId: "$jobId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$jobId", "$$jobId"] } } },
            { $count: "count" },
          ],
          as: "applicantMeta",
        },
      },
      {
        $addFields: {
          companyName: { $ifNull: ["$employer.companyName", "Unknown Company"] },
          employerName: { $ifNull: ["$employerUser.name", "Unknown"] },
          applicantsCount: {
            $ifNull: [{ $arrayElemAt: ["$applicantMeta.count", 0] }, 0],
          },
        },
      },
      { $match: matchStage },
      {
        $facet: {
          rows: [
            { $sort: sortStage },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                jobId: 1,
                title: 1,
                employerId: 1,
                budget: 1,
                jobType: 1,
                experienceLevel: 1,
                status: 1,
                location: 1,
                postedDate: 1,
                applicationDeadline: 1,
                description: 1,
                assignedFreelancer: 1,
                companyName: 1,
                employerName: 1,
                applicantsCount: 1,
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ]);

    const jobs = aggregateResult?.[0]?.rows || [];
    const totalJobs = aggregateResult?.[0]?.total?.[0]?.count || 0;

    if (!jobs.length) {
      return res.json({
        success: true,
        jobs: [],
        total: totalJobs,
        pagination: getPaginationMeta(totalJobs, page, limit),
      });
    }

    const jobsWithDetails = jobs.map((job) => {
      return {
        jobId: job.jobId,
        title: job.title,
        employerName: job.employerName || "Unknown",
        companyName: job.companyName || "Unknown Company",
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
        applicantsCount: job.applicantsCount || 0,
      };
    });

    res.json({
      success: true,
      jobs: jobsWithDetails,
      total: totalJobs,
      pagination: getPaginationMeta(totalJobs, page, limit),
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

// ============================================
// EMPLOYER APPROVAL SYSTEM (Moderator)
// ============================================

// Get pending employer approvals (or all employers if status=all)
exports.getPendingApprovals = async (req, res) => {
  try {
    const { status, search = "", sortBy = "createdAt", sortOrder = "desc" } = req.query; // 'pending', 'approved', or 'all'
    const { page, limit, skip } = getPaginationParams(req.query, 25);
    const cleanNameIn = parseArrayQueryParam(req.query.nameIn);
    const cleanEmailIn = parseArrayQueryParam(req.query.emailIn);
    const cleanCompanyIn = parseArrayQueryParam(req.query.companyIn);
    const cleanLocationIn = parseArrayQueryParam(req.query.locationIn);
    const cleanStatusIn = parseArrayQueryParam(req.query.statusIn)
      .map((entry) => entry.toLowerCase())
      .filter((entry) => ["pending", "approved", "rejected"].includes(entry));
    const searchText = String(search || "").trim();
    const regex = searchText
      ? new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : null;

    const allowedSortBy = new Set(["createdAt", "name"]);
    const normalizedSortBy = allowedSortBy.has(sortBy) ? sortBy : "createdAt";
    const normalizedSortOrder = String(sortOrder).toLowerCase() === "asc" ? 1 : -1;
    
    const andConditions = [{ role: "Employer" }];
    
    // Filter by approval status if specified
    if (status === 'pending') {
      andConditions.push({ isApproved: false, isRejected: { $ne: true } });
    } else if (status === 'approved') {
      andConditions.push({ isApproved: true, isRejected: { $ne: true } });
    } else if (status === 'rejected') {
      andConditions.push({ isRejected: true });
    }

    if (cleanNameIn.length) {
      andConditions.push({ name: { $in: cleanNameIn } });
    }
    if (cleanEmailIn.length) {
      andConditions.push({ email: { $in: cleanEmailIn } });
    }
    if (cleanLocationIn.length) {
      andConditions.push({ location: { $in: cleanLocationIn } });
    }

    if (cleanStatusIn.length) {
      const statusOr = [];
      if (cleanStatusIn.includes("pending")) {
        statusOr.push({ isApproved: false, isRejected: { $ne: true } });
      }
      if (cleanStatusIn.includes("approved")) {
        statusOr.push({ isApproved: true, isRejected: { $ne: true } });
      }
      if (cleanStatusIn.includes("rejected")) {
        statusOr.push({ isRejected: true });
      }
      if (statusOr.length) {
        andConditions.push({ $or: statusOr });
      }
    }

    let companyMatchedUserIds = [];
    if (cleanCompanyIn.length || regex) {
      const employerAnd = [];

      if (cleanCompanyIn.length) {
        employerAnd.push({ companyName: { $in: cleanCompanyIn } });
      }

      if (regex) {
        employerAnd.push({ companyName: regex });
      }

      const employerQuery = employerAnd.length > 1 ? { $and: employerAnd } : employerAnd[0] || {};
      const matchedEmployers = await Employer.find(employerQuery).select("userId").lean();
      companyMatchedUserIds = matchedEmployers.map((employer) => employer.userId);

      if (cleanCompanyIn.length && !companyMatchedUserIds.length) {
        return res.json({
          success: true,
          pendingApprovals: [],
          count: 0,
          pagination: getPaginationMeta(0, page, limit),
        });
      }
    }

    if (searchText) {
      const searchOr = [
        { name: regex },
        { email: regex },
        { location: regex },
      ];

      if (companyMatchedUserIds.length) {
        searchOr.push({ userId: { $in: companyMatchedUserIds } });
      }

      andConditions.push({ $or: searchOr });
    } else if (cleanCompanyIn.length) {
      andConditions.push({ userId: { $in: companyMatchedUserIds } });
    }

    const query = andConditions.length === 1 ? andConditions[0] : { $and: andConditions };
    const querySort = { [normalizedSortBy]: normalizedSortOrder, _id: normalizedSortOrder };
    
    const [users, totalApprovals] = await Promise.all([
      User.find(query)
        .select(
          "userId name email phone picture location createdAt isApproved isRejected",
        )
        .sort(querySort)
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    const employerDocs = await Employer.find({
      userId: { $in: users.map((u) => u.userId) },
    })
      .select("userId employerId companyName websiteLink companyDetails")
      .lean();
    const employerMap = new Map(employerDocs.map((e) => [e.userId, e]));

    const approvals = users.map((user) => {
      const employer = employerMap.get(user.userId);

      return {
        userId: user.userId,
        employerId: employer?.employerId || null,
        name: user.name,
        email: user.email,
        phone: user.phone,
        picture: user.picture,
        location: user.location,
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
        registeredAt: user.createdAt,
        isApproved: user.isApproved,
        isRejected: user.isRejected || false,
        approvalStatus: user.isRejected
          ? "Rejected"
          : user.isApproved
            ? "Approved"
            : "Pending",
      };
    });

    res.json({
      success: true,
      pendingApprovals: approvals, // keeping the same key for backward compatibility
      count: totalApprovals,
      pagination: getPaginationMeta(totalApprovals, page, limit),
    });
  } catch (error) {
    console.error("Error fetching approvals:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch approvals",
    });
  }
};

// Approve an employer
exports.approveEmployer = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    if (user.role !== "Employer") {
      return res.status(400).json({
        success: false,
        error: "User is not an employer",
      });
    }

    const employer = await Employer.findOne({ userId }).lean();
    if (!employer?.companyDetails?.isSubmitted) {
      return res.status(400).json({
        success: false,
        error: "Company verification details are not submitted yet",
      });
    }

    user.isApproved = true;
    await user.save();

    res.json({
      success: true,
      message: "Employer approved successfully",
    });
  } catch (error) {
    console.error("Error approving employer:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to approve employer",
    });
  }
};

// Reject an employer (delete their account)
exports.rejectEmployer = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findOne({ userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    if (user.role !== "Employer") {
      return res.status(400).json({
        success: false,
        error: "User is not an employer",
      });
    }

    // Mark user as rejected rather than deleting (so stats/history remains)
    user.isRejected = true;
    user.isApproved = false;
    await user.save();

    // Optionally, you may want to remove sensitive role data from employer profile
    // but keep employer document for record. We won't delete employer here.

    res.json({
      success: true,
      message: "Employer rejected successfully",
    });
  } catch (error) {
    console.error("Error rejecting employer:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to reject employer",
    });
  }
};

// ============================================
// RATING ADJUSTMENT SYSTEM (Moderator)
// ============================================

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

    //Send notification to the affected user
    try {
      const direction = adjustmentNum < 0 ? 'decreased' : 'increased';
      const notification = new Notification({
        notificationId: uuidv4(),
        userId: targetUser.userId,
        type: 'rating_adjusted',
        title: `Your rating has been ${direction}`,
        message: `Your rating has been ${direction} from ${currentRating} to ${newRating}. Reason: ${reason.trim()}`,
        jobId: null,
        questionId: null,
        fromUserId: moderator.userId,
        fromUserName: moderator.name,
        read: false,
      });

      await notification.save();

      const io = req.app.get('io');
      if (io) {
        io.to(`user:${targetUser.userId}`).emit('notification:new', notification);
      }
    } catch (notifErr) {
      console.error('Error sending rating adjustment notification:', notifErr);
    }

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

    //Send notification to the affected user
    try {
      const notification = new Notification({
        notificationId: uuidv4(),
        userId: user.userId,
        type: 'rating_adjusted',
        title: 'Your rating has been reverted',
        message: `Your rating has been reverted from ${previousRating} to the calculated value (${calculatedRating}). Reason: ${reason.trim()}`,
        jobId: null,
        questionId: null,
        fromUserId: moderator.userId,
        fromUserName: moderator.name,
        read: false,
      });

      await notification.save();

      const io = req.app.get('io');
      if (io) {
        io.to(`user:${user.userId}`).emit('notification:new', notification);
      }
    } catch (notifErr) {
      console.error('Error sending rating revert notification:', notifErr);
    }

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
