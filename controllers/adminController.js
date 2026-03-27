const User = require("../models/user");
const Admin = require("../models/admin");
const Moderator = require("../models/moderator");
const Employer = require("../models/employer");
const Freelancer = require("../models/freelancer");
const JobListing = require("../models/job_listing");
const JobApplication = require("../models/job_application");
const Complaint = require("../models/complaint");
const Feedback = require("../models/Feedback");
const Quiz = require("../models/Quiz");
const Attempt = require("../models/Attempt");
const Blog = require("../models/blog");
const Subscription = require("../models/subscription");
const RatingAudit = require("../models/RatingAudit");
const { uploadToCloudinary } = require("../middleware/imageUpload");

// ============ PROFILE ============

exports.getAdminProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const user = await User.findOne({ userId }).lean();

    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: "Profile not found" });
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
    res.status(500).json({ success: false, error: "Failed to fetch profile" });
  }
};

exports.updateAdminProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { name, email, phone, location, profileImageUrl, about } = req.body;

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
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (name) req.session.user.name = name;
    if (email) req.session.user.email = email;
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
    console.error("Error updating admin profile:", error.message);
    res.status(500).json({ success: false, error: "Failed to update profile" });
  }
};

exports.uploadProfilePicture = async (req, res) => {
  try {
    const userId = req.session.user.id;
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No image file provided" });
    }

    const result = await uploadToCloudinary(req.file.buffer);
    const updatedUser = await User.findOneAndUpdate(
      { userId },
      { picture: result.secure_url },
      { new: true },
    ).lean();

    if (!updatedUser) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    req.session.user.picture = result.secure_url;

    res.json({
      success: true,
      message: "Profile picture uploaded successfully",
      data: { picture: updatedUser.picture },
    });
  } catch (error) {
    console.error("Error uploading profile picture:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to upload profile picture" });
  }
};

// ============ DASHBOARD OVERVIEW ============

exports.getDashboardOverview = async (req, res) => {
  try {
    // Total counts
    const totalUsers = await User.countDocuments({ role: { $ne: "" } });
    const totalFreelancers = await User.countDocuments({ role: "Freelancer" });
    const totalEmployers = await User.countDocuments({ role: "Employer" });
    const totalModerators = await User.countDocuments({ role: "Moderator" });
    const totalAdmins = await User.countDocuments({ role: "Admin" });

    // Job stats
    const totalJobs = await JobListing.countDocuments();
    const activeJobs = await JobListing.countDocuments({
      status: { $in: ["open", "active", "in-progress"] },
    });
    const completedJobs = await JobListing.countDocuments({
      status: "completed",
    });
    const closedJobs = await JobListing.countDocuments({ status: "closed" });

    // Application stats
    const totalApplications = await JobApplication.countDocuments();
    const pendingApplications = await JobApplication.countDocuments({
      status: "Pending",
    });
    const acceptedApplications = await JobApplication.countDocuments({
      status: "Accepted",
    });
    const rejectedApplications = await JobApplication.countDocuments({
      status: "Rejected",
    });

    // Complaint stats
    const totalComplaints = await Complaint.countDocuments();
    const pendingComplaints = await Complaint.countDocuments({
      status: "Pending",
    });
    const resolvedComplaints = await Complaint.countDocuments({
      status: "Resolved",
    });

    // Subscription stats
    const premiumUsers = await User.countDocuments({ subscription: "Premium" });
    const basicUsers = await User.countDocuments({
      subscription: "Basic",
      role: { $ne: "" },
    });

    // Revenue calculation from paid milestones
    const revenueData = await JobListing.aggregate([
      { $unwind: "$milestones" },
      { $match: { "milestones.status": "paid" } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $toDouble: "$milestones.payment" } },
          totalPaidMilestones: { $sum: 1 },
        },
      },
    ]);

    const totalRevenue =
      revenueData.length > 0 ? revenueData[0].totalRevenue : 0;
    const totalPaidMilestones =
      revenueData.length > 0 ? revenueData[0].totalPaidMilestones : 0;

    // Total budget across all jobs
    const budgetData = await JobListing.aggregate([
      { $group: { _id: null, totalBudget: { $sum: "$budget" } } },
    ]);
    const totalBudget = budgetData.length > 0 ? budgetData[0].totalBudget : 0;

    // Quiz stats
    const totalQuizzes = await Quiz.countDocuments();
    const totalAttempts = await Attempt.countDocuments();

    // Blog stats
    const totalBlogs = await Blog.countDocuments();

    // Feedback stats
    const totalFeedbacks = await Feedback.countDocuments();
    const avgRatingData = await Feedback.aggregate([
      { $group: { _id: null, avgRating: { $avg: "$rating" } } },
    ]);
    const avgRating =
      avgRatingData.length > 0
        ? Math.round(avgRatingData[0].avgRating * 10) / 10
        : 0;

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          freelancers: totalFreelancers,
          employers: totalEmployers,
          moderators: totalModerators,
          admins: totalAdmins,
          premium: premiumUsers,
          basic: basicUsers,
        },
        jobs: {
          total: totalJobs,
          active: activeJobs,
          completed: completedJobs,
          closed: closedJobs,
        },
        applications: {
          total: totalApplications,
          pending: pendingApplications,
          accepted: acceptedApplications,
          rejected: rejectedApplications,
        },
        complaints: {
          total: totalComplaints,
          pending: pendingComplaints,
          resolved: resolvedComplaints,
        },
        revenue: {
          total: totalRevenue,
          totalBudget: totalBudget,
          paidMilestones: totalPaidMilestones,
        },
        quizzes: {
          total: totalQuizzes,
          attempts: totalAttempts,
        },
        blogs: {
          total: totalBlogs,
        },
        feedback: {
          total: totalFeedbacks,
          avgRating: avgRating,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching admin dashboard overview:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch dashboard overview" });
  }
};

// ============ REVENUE & PAYMENTS ============

exports.getRevenueStats = async (req, res) => {
  try {
    const PREMIUM_MONTHLY_PRICE = 868;

    // Build all 12 months (including zeros)
    const now = new Date();
    const allMonths = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      allMonths.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    const monthLabels = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    // Monthly milestone revenue
    const monthlyMilestoneAgg = await JobListing.aggregate([
      { $unwind: "$milestones" },
      { $match: { "milestones.status": "paid" } },
      {
        $group: {
          _id: {
            year: { $year: "$updatedAt" },
            month: { $month: "$updatedAt" },
          },
          revenue: { $sum: { $toDouble: "$milestones.payment" } },
          count: { $sum: 1 },
        },
      },
    ]);

    // Monthly subscription revenue (from users whose subscription started that month)
    const monthlySubAgg = await User.aggregate([
      {
        $match: {
          subscription: "Premium",
          subscriptionExpiryDate: { $exists: true, $ne: null },
        },
      },
      {
        $addFields: {
          subStartDate: {
            $dateSubtract: {
              startDate: "$subscriptionExpiryDate",
              unit: "month",
              amount: { $ifNull: ["$subscriptionDuration", 1] },
            },
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$subStartDate" },
            month: { $month: "$subStartDate" },
          },
          subRevenue: {
            $sum: {
              $multiply: [
                { $ifNull: ["$subscriptionDuration", 1] },
                PREMIUM_MONTHLY_PRICE,
              ],
            },
          },
          userCount: { $sum: 1 },
        },
      },
    ]);

    // Monthly platform fee revenue (from jobs posted that month)
    const allJobs = await JobListing.find(
      {},
      {
        budget: 1,
        postedDate: 1,
        applicationDeadline: 1,
        applicants: 1,
        title: 1,
        status: 1,
      },
    ).lean();

    const monthlyPlatformFeeMap = {};
    allJobs.forEach((job) => {
      if (!job.budget || !job.postedDate) return;
      const posted = new Date(job.postedDate);
      const key = `${posted.getFullYear()}-${posted.getMonth() + 1}`;
      const deadline = job.applicationDeadline
        ? new Date(job.applicationDeadline)
        : new Date(posted.getTime() + 30 * 86400000);
      const durationDays = Math.max(
        1,
        Math.ceil((deadline - posted) / 86400000),
      );
      const applicantCount = job.applicants || 0;
      const feeRate = calculatePlatformFee(durationDays, applicantCount);
      const feeAmount = (job.budget * feeRate) / 100;
      if (!monthlyPlatformFeeMap[key]) monthlyPlatformFeeMap[key] = 0;
      monthlyPlatformFeeMap[key] += feeAmount;
    });

    // Merge into 12-month array
    const milestoneMap = {};
    monthlyMilestoneAgg.forEach((m) => {
      milestoneMap[`${m._id.year}-${m._id.month}`] = m;
    });
    const subMap = {};
    monthlySubAgg.forEach((m) => {
      subMap[`${m._id.year}-${m._id.month}`] = m;
    });

    const monthlyRevenue = allMonths.map(({ year, month }) => {
      const key = `${year}-${month}`;
      const milestone = milestoneMap[key] || { revenue: 0, count: 0 };
      const sub = subMap[key] || { subRevenue: 0, userCount: 0 };
      const platformFee = monthlyPlatformFeeMap[key] || 0;
      return {
        label: `${monthLabels[month - 1]} ${String(year).slice(2)}`,
        year,
        month,
        milestoneRevenue: Math.round(milestone.revenue * 100) / 100,
        milestoneCount: milestone.count,
        subscriptionRevenue: Math.round(sub.subRevenue * 100) / 100,
        platformFeeRevenue: Math.round(platformFee * 100) / 100,
        totalRevenue:
          Math.round((milestone.revenue + sub.subRevenue + platformFee) * 100) /
          100,
      };
    });

    // Revenue by job type
    const revenueByJobType = await JobListing.aggregate([
      { $unwind: "$milestones" },
      { $match: { "milestones.status": "paid" } },
      {
        $group: {
          _id: "$jobType",
          revenue: { $sum: { $toDouble: "$milestones.payment" } },
          count: { $sum: 1 },
        },
      },
    ]);

    // Top paying jobs
    const topPayingJobs = await JobListing.find()
      .sort({ budget: -1 })
      .limit(10)
      .select(
        "jobId title budget status jobType employerId postedDate applicationDeadline applicants",
      )
      .lean();

    const employerIds = [...new Set(topPayingJobs.map((j) => j.employerId))];
    const employers = await Employer.find({ employerId: { $in: employerIds } })
      .select("employerId companyName userId")
      .lean();
    const employerUserIds = employers.map((e) => e.userId);
    const employerUsers = await User.find({ userId: { $in: employerUserIds } })
      .select("userId name")
      .lean();

    const topPayingJobsWithDetails = topPayingJobs.map((job) => {
      const employer = employers.find((e) => e.employerId === job.employerId);
      const user = employerUsers.find((u) => u.userId === employer?.userId);
      const posted = new Date(job.postedDate);
      const deadline = job.applicationDeadline
        ? new Date(job.applicationDeadline)
        : new Date(posted.getTime() + 30 * 86400000);
      const durationDays = Math.max(
        1,
        Math.ceil((deadline - posted) / 86400000),
      );
      const feeRate = calculatePlatformFee(durationDays, job.applicants || 0);
      return {
        ...job,
        employerName: user?.name || "Unknown",
        companyName: employer?.companyName || "Unknown",
        feeRate,
        feeAmount: Math.round(((job.budget * feeRate) / 100) * 100) / 100,
      };
    });

    // Overall totals
    const premiumUserCount = await User.countDocuments({
      subscription: "Premium",
    });
    const premiumUsersData = await User.find(
      { subscription: "Premium" },
      { subscriptionDuration: 1 },
    ).lean();
    const actualSubscriptionRevenue = premiumUsersData.reduce(
      (sum, u) => sum + (u.subscriptionDuration || 1) * PREMIUM_MONTHLY_PRICE,
      0,
    );

    const totalMilestoneRevenue = monthlyRevenue.reduce(
      (s, m) => s + m.milestoneRevenue,
      0,
    );
    const totalPlatformFees = monthlyRevenue.reduce(
      (s, m) => s + m.platformFeeRevenue,
      0,
    );

    // Pending payments
    const pendingPayments = await JobListing.aggregate([
      { $unwind: "$milestones" },
      { $match: { "milestones.status": { $in: ["not-paid", "in-progress"] } } },
      {
        $group: {
          _id: null,
          totalPending: { $sum: { $toDouble: "$milestones.payment" } },
          count: { $sum: 1 },
        },
      },
    ]);
    const totalPendingPayments =
      pendingPayments.length > 0 ? pendingPayments[0].totalPending : 0;
    const pendingPaymentCount =
      pendingPayments.length > 0 ? pendingPayments[0].count : 0;

    // Revenue by experience level
    const revenueByExperience = await JobListing.aggregate([
      { $unwind: "$milestones" },
      { $match: { "milestones.status": "paid" } },
      {
        $group: {
          _id: "$experienceLevel",
          revenue: { $sum: { $toDouble: "$milestones.payment" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    // Job & budget summary stats
    const jobSummary = await JobListing.aggregate([
      {
        $group: {
          _id: null,
          totalJobs: { $sum: 1 },
          totalBudget: { $sum: "$budget" },
          avgBudget: { $avg: "$budget" },
          maxBudget: { $max: "$budget" },
          minBudget: { $min: "$budget" },
        },
      },
    ]);

    // Month-over-month growth
    const currentMonth =
      monthlyRevenue[monthlyRevenue.length - 1]?.totalRevenue || 0;
    const previousMonth =
      monthlyRevenue.length >= 2
        ? monthlyRevenue[monthlyRevenue.length - 2]?.totalRevenue || 0
        : 0;
    const revenueGrowth =
      previousMonth > 0
        ? Math.round(((currentMonth - previousMonth) / previousMonth) * 100)
        : currentMonth > 0
          ? 100
          : 0;

    res.json({
      success: true,
      data: {
        monthlyRevenue,
        revenueByJobType,
        revenueByExperience,
        topPayingJobs: topPayingJobsWithDetails,
        subscriptionRevenue: actualSubscriptionRevenue,
        premiumUsers: premiumUserCount,
        totalMilestoneRevenue: Math.round(totalMilestoneRevenue * 100) / 100,
        totalPlatformFees: Math.round(totalPlatformFees * 100) / 100,
        combinedRevenue:
          Math.round(
            (totalMilestoneRevenue +
              actualSubscriptionRevenue +
              totalPlatformFees) *
              100,
          ) / 100,
        pendingPayments: {
          total: totalPendingPayments,
          count: pendingPaymentCount,
        },
        revenueGrowth,
        jobSummary: jobSummary[0] || {
          totalJobs: 0,
          totalBudget: 0,
          avgBudget: 0,
          maxBudget: 0,
          minBudget: 0,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching revenue stats:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch revenue data" });
  }
};

exports.getAllPayments = async (req, res) => {
  try {
    // Get all jobs with paid milestones
    const jobsWithPayments = await JobListing.find({
      "milestones.status": "paid",
    })
      .select(
        "jobId title budget employerId milestones assignedFreelancer status updatedAt",
      )
      .lean();

    // Get employer and freelancer details
    const employerIds = [...new Set(jobsWithPayments.map((j) => j.employerId))];
    const freelancerIds = [
      ...new Set(
        jobsWithPayments
          .filter((j) => j.assignedFreelancer?.freelancerId)
          .map((j) => j.assignedFreelancer.freelancerId),
      ),
    ];

    const employers = await Employer.find({ employerId: { $in: employerIds } })
      .select("employerId companyName userId")
      .lean();
    const freelancers = await Freelancer.find({
      freelancerId: { $in: freelancerIds },
    })
      .select("freelancerId userId")
      .lean();

    const allUserIds = [
      ...employers.map((e) => e.userId),
      ...freelancers.map((f) => f.userId),
    ];
    const users = await User.find({ userId: { $in: allUserIds } })
      .select("userId name email")
      .lean();

    const payments = [];
    jobsWithPayments.forEach((job) => {
      const employer = employers.find((e) => e.employerId === job.employerId);
      const employerUser = users.find((u) => u.userId === employer?.userId);
      const freelancer = freelancers.find(
        (f) => f.freelancerId === job.assignedFreelancer?.freelancerId,
      );
      const freelancerUser = users.find((u) => u.userId === freelancer?.userId);

      job.milestones
        .filter((m) => m.status === "paid")
        .forEach((milestone) => {
          payments.push({
            jobId: job.jobId,
            jobTitle: job.title,
            milestoneId: milestone.milestoneId,
            milestoneDescription: milestone.description,
            amount: parseFloat(milestone.payment) || 0,
            status: "Paid",
            employerName: employerUser?.name || "Unknown",
            companyName: employer?.companyName || "Unknown",
            freelancerName: freelancerUser?.name || "Unknown",
            date: job.updatedAt,
          });
        });
    });

    // Also get pending payments
    const jobsWithPendingPayments = await JobListing.find({
      "milestones.status": { $in: ["not-paid", "in-progress"] },
    })
      .select(
        "jobId title budget employerId milestones assignedFreelancer status updatedAt",
      )
      .lean();

    const pendingEmployerIds = [
      ...new Set(jobsWithPendingPayments.map((j) => j.employerId)),
    ];
    const pendingFreelancerIds = [
      ...new Set(
        jobsWithPendingPayments
          .filter((j) => j.assignedFreelancer?.freelancerId)
          .map((j) => j.assignedFreelancer.freelancerId),
      ),
    ];

    const pendingEmployers = await Employer.find({
      employerId: { $in: pendingEmployerIds },
    })
      .select("employerId companyName userId")
      .lean();
    const pendingFreelancersList = await Freelancer.find({
      freelancerId: { $in: pendingFreelancerIds },
    })
      .select("freelancerId userId")
      .lean();

    const pendingUserIds = [
      ...pendingEmployers.map((e) => e.userId),
      ...pendingFreelancersList.map((f) => f.userId),
    ];
    const pendingUsers = await User.find({ userId: { $in: pendingUserIds } })
      .select("userId name")
      .lean();

    jobsWithPendingPayments.forEach((job) => {
      const employer = pendingEmployers.find(
        (e) => e.employerId === job.employerId,
      );
      const employerUser = pendingUsers.find(
        (u) => u.userId === employer?.userId,
      );
      const freelancer = pendingFreelancersList.find(
        (f) => f.freelancerId === job.assignedFreelancer?.freelancerId,
      );
      const freelancerUser = pendingUsers.find(
        (u) => u.userId === freelancer?.userId,
      );

      job.milestones
        .filter((m) => m.status === "not-paid" || m.status === "in-progress")
        .forEach((milestone) => {
          payments.push({
            jobId: job.jobId,
            jobTitle: job.title,
            milestoneId: milestone.milestoneId,
            milestoneDescription: milestone.description,
            amount: parseFloat(milestone.payment) || 0,
            status:
              milestone.status === "in-progress" ? "In Progress" : "Pending",
            employerName: employerUser?.name || "Unknown",
            companyName: employer?.companyName || "Unknown",
            freelancerName: freelancerUser?.name || "Unknown",
            date: job.updatedAt,
          });
        });
    });

    // Sort by date desc
    payments.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      success: true,
      payments,
      total: payments.length,
    });
  } catch (error) {
    console.error("Error fetching payments:", error.message);
    res.status(500).json({ success: false, error: "Failed to fetch payments" });
  }
};

// ============ MODERATOR MANAGEMENT ============

exports.getAllModerators = async (req, res) => {
  try {
    // Find all existing Moderator documents
    let moderators = await Moderator.find({}).lean();
    const existingModeratorUserIds = new Set(moderators.map((m) => m.userId));

    // Also find users with role "Moderator" who may not have a Moderator document
    const moderatorUsers = await User.find({ role: "Moderator" })
      .select(
        "userId name email phone picture location rating createdAt subscription aboutMe roleId",
      )
      .lean();

    // Auto-create missing Moderator documents for users with role "Moderator"
    for (const user of moderatorUsers) {
      if (!existingModeratorUserIds.has(user.userId)) {
        const newMod = await Moderator.create({
          moderatorId: user.roleId || require("uuid").v4(),
          userId: user.userId,
        });
        moderators.push(newMod.toObject ? newMod.toObject() : newMod);
      }
    }

    const moderatorUserIds = moderators.map((m) => m.userId);
    const users = await User.find({ userId: { $in: moderatorUserIds } })
      .select(
        "userId name email phone picture location rating createdAt subscription aboutMe",
      )
      .lean();

    // Get complaint resolution stats per moderator
    const resolvedComplaints = await Complaint.find({
      status: "Resolved",
      resolvedAt: { $exists: true },
    }).lean();

    // Get all complaints for stats
    const allComplaints = await Complaint.countDocuments();

    // Get blog creation stats
    const blogs = await Blog.find({}).select("createdAt").lean();

    // Get quiz creation stats
    const quizzes = await Quiz.find({}).select("createdAt").lean();

    const moderatorsWithDetails = moderators.map((mod) => {
      const user = users.find((u) => u.userId === mod.userId);

      return {
        moderatorId: mod.moderatorId,
        userId: mod.userId,
        name: user?.name || "N/A",
        email: user?.email || "N/A",
        phone: user?.phone || "N/A",
        picture: user?.picture || "",
        location: user?.location || "N/A",
        rating: user?.rating || 0,
        aboutMe: user?.aboutMe || "",
        joinedDate: user?.createdAt || mod.createdAt,
        subscription: user?.subscription || "Basic",
        complaintsResolved: resolvedComplaints.length,
        totalComplaints: allComplaints,
        blogsCreated: blogs.length,
        quizzesCreated: quizzes.length,
      };
    });

    res.json({
      success: true,
      moderators: moderatorsWithDetails,
      total: moderatorsWithDetails.length,
    });
  } catch (error) {
    console.error("Error fetching moderators:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch moderators" });
  }
};

exports.getModeratorActivity = async (req, res) => {
  try {
    const { moderatorId } = req.params;

    const moderator = await Moderator.findOne({ moderatorId }).lean();
    if (!moderator) {
      return res
        .status(404)
        .json({ success: false, error: "Moderator not found" });
    }

    const user = await User.findOne({ userId: moderator.userId })
      .select("name email picture createdAt")
      .lean();

    // Get complaint activity
    const complaints = await Complaint.find({}).sort({ updatedAt: -1 }).lean();
    const resolvedByModerator = complaints.filter(
      (c) => c.status === "Resolved",
    );
    const pendingComplaints = complaints.filter((c) => c.status === "Pending");
    const underReview = complaints.filter((c) => c.status === "Under Review");

    // Get blog stats
    const totalBlogs = await Blog.countDocuments();

    // Get quiz stats
    const totalQuizzes = await Quiz.countDocuments();

    res.json({
      success: true,
      data: {
        moderator: {
          moderatorId: moderator.moderatorId,
          name: user?.name || "N/A",
          email: user?.email || "N/A",
          picture: user?.picture || "",
          joinedDate: user?.createdAt,
        },
        activity: {
          complaintsResolved: resolvedByModerator.length,
          complaintsPending: pendingComplaints.length,
          complaintsUnderReview: underReview.length,
          totalBlogs,
          totalQuizzes,
        },
        recentComplaints: complaints.slice(0, 10).map((c) => ({
          complaintId: c.complaintId,
          subject: c.subject,
          status: c.status,
          priority: c.priority,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          complainantName: c.complainantName,
          complainantType: c.complainantType,
          freelancerName: c.freelancerName,
          employerName: c.employerName,
          jobTitle: c.jobTitle,
          complaintType: c.complaintType,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching moderator activity:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch moderator activity" });
  }
};

exports.deleteModerator = async (req, res) => {
  try {
    const { moderatorId } = req.params;

    const moderator = await Moderator.findOne({ moderatorId }).lean();
    if (!moderator) {
      return res
        .status(404)
        .json({ success: false, error: "Moderator not found" });
    }

    await Moderator.deleteOne({ moderatorId });
    await User.deleteOne({ userId: moderator.userId });

    res.json({ success: true, message: "Moderator deleted successfully" });
  } catch (error) {
    console.error("Error deleting moderator:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete moderator" });
  }
};

// ============ ALL USERS MANAGEMENT ============

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: "" } })
      .select(
        "userId name email role subscription picture location rating createdAt subscriptionDuration subscriptionExpiryDate",
      )
      .sort({ createdAt: -1 })
      .lean();

    const userIds = users.map((u) => u.userId);
    const [freelancers, employers, moderators] = await Promise.all([
      Freelancer.find({ userId: { $in: userIds } })
        .select("userId freelancerId")
        .lean(),
      Employer.find({ userId: { $in: userIds } })
        .select("userId employerId")
        .lean(),
      Moderator.find({ userId: { $in: userIds } })
        .select("userId moderatorId")
        .lean(),
    ]);
    const flMap = Object.fromEntries(
      freelancers.map((f) => [f.userId, f.freelancerId]),
    );
    const empMap = Object.fromEntries(
      employers.map((e) => [e.userId, e.employerId]),
    );
    const modMap = Object.fromEntries(
      moderators.map((m) => [m.userId, m.moderatorId]),
    );

    const usersWithRoleId = users.map((u) => {
      let roleId = null;
      let profilePath = null;
      if (u.role === "Freelancer" && flMap[u.userId]) {
        roleId = flMap[u.userId];
        profilePath = `/admin/freelancers/${roleId}`;
      } else if (u.role === "Employer" && empMap[u.userId]) {
        roleId = empMap[u.userId];
        profilePath = `/admin/employers/${roleId}`;
      } else if (u.role === "Moderator" && modMap[u.userId]) {
        roleId = modMap[u.userId];
        profilePath = `/admin/moderators/${roleId}`;
      }
      return { ...u, roleId, profilePath };
    });

    res.json({
      success: true,
      users: usersWithRoleId,
      total: usersWithRoleId.length,
    });
  } catch (error) {
    console.error("Error fetching all users:", error.message);
    res.status(500).json({ success: false, error: "Failed to fetch users" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findOne({ userId }).lean();
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Prevent deleting yourself
    if (userId === req.session.user.id) {
      return res
        .status(400)
        .json({ success: false, error: "Cannot delete your own account" });
    }

    // Delete role entity
    switch (user.role) {
      case "Employer":
        await Employer.deleteOne({ userId });
        break;
      case "Freelancer":
        await Freelancer.deleteOne({ userId });
        break;
      case "Moderator":
        await Moderator.deleteOne({ userId });
        break;
      case "Admin":
        await Admin.deleteOne({ userId });
        break;
    }

    await User.deleteOne({ userId });

    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error.message);
    res.status(500).json({ success: false, error: "Failed to delete user" });
  }
};

// ============ PLATFORM STATISTICS ============

exports.getPlatformStats = async (req, res) => {
  try {
    // User growth by month
    const userGrowth = await User.aggregate([
      { $match: { role: { $ne: "" } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      { $limit: 12 },
    ]);

    // Jobs by status
    const jobsByStatus = await JobListing.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Jobs by type
    const jobsByType = await JobListing.aggregate([
      { $group: { _id: "$jobType", count: { $sum: 1 } } },
    ]);

    // Jobs by experience level
    const jobsByExperience = await JobListing.aggregate([
      { $group: { _id: "$experienceLevel", count: { $sum: 1 } } },
    ]);

    // Applications by status
    const applicationsByStatus = await JobApplication.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Complaints by status
    const complaintsByStatus = await Complaint.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Complaints by type
    const complaintsByType = await Complaint.aggregate([
      { $group: { _id: "$complaintType", count: { $sum: 1 } } },
    ]);

    // Complaints by priority
    const complaintsByPriority = await Complaint.aggregate([
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]);

    // Top rated freelancers
    const topFreelancers = await User.find({ role: "Freelancer" })
      .sort({ rating: -1 })
      .limit(10)
      .select("userId name email rating picture subscription")
      .lean();

    // Top rated employers
    const topEmployers = await User.find({ role: "Employer" })
      .sort({ rating: -1 })
      .limit(10)
      .select("userId name email rating picture subscription")
      .lean();

    // Average budget by job type
    const avgBudgetByType = await JobListing.aggregate([
      {
        $group: {
          _id: "$jobType",
          avgBudget: { $avg: "$budget" },
          maxBudget: { $max: "$budget" },
          minBudget: { $min: "$budget" },
        },
      },
    ]);

    // Subscription distribution
    const subscriptionDist = await User.aggregate([
      { $match: { role: { $ne: "" } } },
      {
        $group: {
          _id: { role: "$role", subscription: "$subscription" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Recent signups (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSignups = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
      role: { $ne: "" },
    });

    // New jobs this month
    const newJobsThisMonth = await JobListing.countDocuments({
      postedDate: { $gte: thirtyDaysAgo },
    });

    res.json({
      success: true,
      data: {
        userGrowth,
        jobsByStatus,
        jobsByType,
        jobsByExperience,
        applicationsByStatus,
        complaintsByStatus,
        complaintsByType,
        complaintsByPriority,
        topFreelancers,
        topEmployers,
        avgBudgetByType,
        subscriptionDist,
        recentSignups,
        newJobsThisMonth,
      },
    });
  } catch (error) {
    console.error("Error fetching platform stats:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch platform statistics" });
  }
};

// ============ COMPLAINTS OVERVIEW ============

exports.getAllComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({}).sort({ createdAt: -1 }).lean();

    const complainantIds = [...new Set(complaints.map((c) => c.complainantId))];
    const complainantUsers = await User.find({
      roleId: { $in: complainantIds },
    })
      .select("userId roleId name")
      .lean();

    const complaintsWithUserId = complaints.map((complaint) => {
      const complainantUser = complainantUsers.find(
        (user) => user.roleId === complaint.complainantId,
      );
      return {
        ...complaint,
        complainantUserId: complainantUser?.userId || null,
      };
    });

    res.json({
      success: true,
      complaints: complaintsWithUserId,
      total: complaintsWithUserId.length,
    });
  } catch (error) {
    console.error("Error fetching complaints:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch complaints" });
  }
};

// ============ FREELANCERS & EMPLOYERS ============

exports.getAllFreelancers = async (req, res) => {
  try {
    const freelancers = await Freelancer.find({}).lean();
    const freelancerUserIds = freelancers.map((f) => f.userId);
    const users = await User.find({ userId: { $in: freelancerUserIds } })
      .select(
        "userId name email phone picture location rating createdAt subscription subscriptionDuration subscriptionExpiryDate",
      )
      .lean();

    const roleIds = freelancers.map((f) => f.freelancerId);
    const applicationCounts = await JobApplication.aggregate([
      { $match: { freelancerId: { $in: roleIds } } },
      { $group: { _id: "$freelancerId", count: { $sum: 1 } } },
    ]);
    const applicationMap = {};
    applicationCounts.forEach((item) => {
      applicationMap[item._id] = item.count;
    });

    const activeJobs = await JobListing.find({
      "assignedFreelancer.freelancerId": { $in: roleIds },
      "assignedFreelancer.status": "working",
    })
      .select("assignedFreelancer.freelancerId")
      .lean();

    const workingFreelancerIds = new Set(
      activeJobs.map((job) => job.assignedFreelancer.freelancerId),
    );

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
        subscription: user?.subscription || "Basic",
        isPremium: user?.subscription === "Premium",
        subscriptionDuration: user?.subscriptionDuration || null,
        subscriptionExpiryDate: user?.subscriptionExpiryDate || null,
        applicationsCount: applicationMap[freelancer.freelancerId] || 0,
        isCurrentlyWorking: workingFreelancerIds.has(freelancer.freelancerId),
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
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch freelancers" });
  }
};

exports.getAllEmployers = async (req, res) => {
  try {
    const employers = await Employer.find({}).lean();
    const employerUserIds = employers.map((e) => e.userId);
    const users = await User.find({ userId: { $in: employerUserIds } })
      .select(
        "userId name email phone picture location rating createdAt subscription subscriptionDuration subscriptionExpiryDate",
      )
      .lean();

    const empIds = employers.map((e) => e.employerId);
    const jobCounts = await JobListing.aggregate([
      { $match: { employerId: { $in: empIds } } },
      { $group: { _id: "$employerId", count: { $sum: 1 } } },
    ]);
    const jobCountMap = {};
    jobCounts.forEach((item) => {
      jobCountMap[item._id] = item.count;
    });

    const employersWithDetails = employers.map((employer) => {
      const user = users.find((u) => u.userId === employer.userId);
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
        isPremium: user?.subscription === "Premium",
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
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch employers" });
  }
};

// ============ FREELANCER / EMPLOYER DETAIL ============

exports.getFreelancerDetail = async (req, res) => {
  try {
    const { freelancerId } = req.params;
    const freelancer = await Freelancer.findOne({ freelancerId }).lean();
    if (!freelancer)
      return res
        .status(404)
        .json({ success: false, error: "Freelancer not found" });

    const user = await User.findOne({ userId: freelancer.userId })
      .select(
        "userId name email phone picture location rating createdAt subscription subscriptionDuration subscriptionExpiryDate aboutMe",
      )
      .lean();

    const applications = await JobApplication.find({ freelancerId }).lean();
    const jobIds = applications.map((a) => a.jobId);
    const jobs = await JobListing.find({ jobId: { $in: jobIds } })
      .select("jobId title budget status employerId postedDate")
      .lean();
    const empIds = jobs.map((j) => j.employerId);
    const empDocs = await Employer.find({ employerId: { $in: empIds } })
      .select("employerId companyName userId")
      .lean();
    const empUserIds = empDocs.map((e) => e.userId);
    const empUsers = await User.find({ userId: { $in: empUserIds } })
      .select("userId name")
      .lean();

    const activeJob = await JobListing.findOne({
      "assignedFreelancer.freelancerId": freelancerId,
      "assignedFreelancer.status": "working",
    })
      .select("jobId title employerId")
      .lean();

    const applicationsWithDetails = applications.map((app) => {
      const job = jobs.find((j) => j.jobId === app.jobId);
      const emp = empDocs.find((e) => e.employerId === job?.employerId);
      const empUser = empUsers.find((u) => u.userId === emp?.userId);
      return {
        applicationId: app.applicationId,
        jobTitle: job?.title || "N/A",
        companyName: emp?.companyName || "N/A",
        employerName: empUser?.name || "N/A",
        budget: job?.budget || 0,
        status: app.status,
        appliedDate: app.appliedDate,
      };
    });

    const acceptedCount = applications.filter(
      (a) => a.status === "Accepted",
    ).length;
    const rejectedCount = applications.filter(
      (a) => a.status === "Rejected",
    ).length;
    const pendingCount = applications.filter(
      (a) => a.status === "Pending",
    ).length;

    res.json({
      success: true,
      freelancer: {
        freelancerId: freelancer.freelancerId,
        userId: freelancer.userId,
        name: user?.name || "N/A",
        email: user?.email || "N/A",
        phone: user?.phone || "N/A",
        picture: user?.picture || "",
        location: user?.location || "N/A",
        aboutMe: user?.aboutMe || "",
        rating: user?.rating || 0,
        subscription: user?.subscription || "Basic",
        subscriptionDuration: user?.subscriptionDuration || null,
        subscriptionExpiryDate: user?.subscriptionExpiryDate || null,
        joinedDate: user?.createdAt || freelancer.createdAt,
        skills: freelancer.skills || [],
        experience: freelancer.experience || [],
        education: freelancer.education || [],
        portfolio: freelancer.portfolio || [],
        resume: freelancer.resume || "",
        isCurrentlyWorking: !!activeJob,
        currentJobTitle: activeJob?.title || null,
        applicationsCount: applications.length,
        acceptedCount,
        rejectedCount,
        pendingCount,
        recentApplications: applicationsWithDetails.slice(0, 10),
      },
    });
  } catch (error) {
    console.error("Error fetching freelancer detail:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch freelancer detail" });
  }
};

exports.getEmployerDetail = async (req, res) => {
  try {
    const { employerId } = req.params;
    const employer = await Employer.findOne({ employerId }).lean();
    if (!employer)
      return res
        .status(404)
        .json({ success: false, error: "Employer not found" });

    const user = await User.findOne({ userId: employer.userId })
      .select(
        "userId name email phone picture location rating createdAt subscription subscriptionDuration subscriptionExpiryDate aboutMe",
      )
      .lean();

    const jobs = await JobListing.find({ employerId })
      .select(
        "jobId title budget status jobType experienceLevel postedDate applicationDeadline location assignedFreelancer",
      )
      .lean();

    const jobIds = jobs.map((j) => j.jobId);
    const appCounts = await JobApplication.aggregate([
      { $match: { jobId: { $in: jobIds } } },
      { $group: { _id: "$jobId", count: { $sum: 1 } } },
    ]);
    const appCountMap = {};
    appCounts.forEach((item) => {
      appCountMap[item._id] = item.count;
    });

    const currentFLIds = (employer.currentFreelancers || []).map(
      (f) => f.freelancerId,
    );
    const pastFLIds = employer.previouslyWorkedFreelancers || [];
    const allFLIds = [...new Set([...currentFLIds, ...pastFLIds])];

    const flDocs = await Freelancer.find({ freelancerId: { $in: allFLIds } })
      .select("freelancerId userId")
      .lean();
    const flUserIds = flDocs.map((f) => f.userId);
    const flUsers = await User.find({ userId: { $in: flUserIds } })
      .select("userId name email picture rating")
      .lean();

    const buildFL = (id) => {
      const fl = flDocs.find((f) => f.freelancerId === id);
      const u = flUsers.find((u) => u.userId === fl?.userId);
      const currentEntry = (employer.currentFreelancers || []).find(
        (f) => f.freelancerId === id,
      );
      return {
        freelancerId: id,
        name: u?.name || "N/A",
        email: u?.email || "",
        picture: u?.picture || "",
        rating: u?.rating || 0,
        startDate: currentEntry?.startDate || null,
      };
    };

    res.json({
      success: true,
      employer: {
        employerId: employer.employerId,
        userId: employer.userId,
        name: user?.name || "N/A",
        email: user?.email || "N/A",
        phone: user?.phone || "N/A",
        picture: user?.picture || "",
        location: user?.location || "N/A",
        aboutMe: user?.aboutMe || "",
        companyName: employer.companyName || "N/A",
        websiteLink: employer.websiteLink || "",
        rating: user?.rating || 0,
        subscription: user?.subscription || "Basic",
        subscriptionDuration: user?.subscriptionDuration || null,
        subscriptionExpiryDate: user?.subscriptionExpiryDate || null,
        joinedDate: user?.createdAt || employer.createdAt,
        jobListingsCount: jobs.length,
        currentHiresCount: currentFLIds.length,
        pastHiresCount: pastFLIds.length,
        jobs: jobs.map((j) => ({
          jobId: j.jobId,
          title: j.title,
          budget: j.budget,
          status: j.status,
          jobType: j.jobType,
          experienceLevel: j.experienceLevel,
          location: j.location,
          postedDate: j.postedDate,
          applicationDeadline: j.applicationDeadline,
          applicantsCount: appCountMap[j.jobId] || 0,
          hasAssignedFreelancer: !!j.assignedFreelancer?.freelancerId,
        })),
        currentFreelancers: currentFLIds.map(buildFL),
        pastFreelancers: pastFLIds.map(buildFL),
      },
    });
  } catch (error) {
    console.error("Error fetching employer detail:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch employer detail" });
  }
};

// ============ JOB LISTINGS ============

exports.getAllJobListings = async (req, res) => {
  try {
    const jobs = await JobListing.find({}).lean();
    const employerIds = jobs.map((job) => job.employerId);
    const employers = await Employer.find({ employerId: { $in: employerIds } })
      .select("employerId companyName userId")
      .lean();
    const userIds = employers.map((e) => e.userId);
    const users = await User.find({ userId: { $in: userIds } })
      .select("userId name")
      .lean();

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

      // Calculate paid amount from milestones
      let paidAmount = 0;
      let totalMilestones = 0;
      let paidMilestones = 0;
      if (job.milestones) {
        totalMilestones = job.milestones.length;
        job.milestones.forEach((m) => {
          if (m.status === "paid") {
            paidAmount += parseFloat(m.payment) || 0;
            paidMilestones++;
          }
        });
      }

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
        applicantsCount: applicantMap[job.jobId] || 0,
        paidAmount,
        totalMilestones,
        paidMilestones,
        hasAssignedFreelancer: !!job.assignedFreelancer?.freelancerId,
      };
    });

    res.json({
      success: true,
      jobs: jobsWithDetails,
      total: jobsWithDetails.length,
    });
  } catch (error) {
    console.error("Error fetching job listings:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch job listings" });
  }
};

// ============ RECENT ACTIVITY ============

exports.getRecentActivities = async (req, res) => {
  try {
    const activities = [];

    // Recent user signups
    const recentUsers = await User.find({ role: { $ne: "" } })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name role createdAt")
      .lean();

    recentUsers.forEach((u) => {
      activities.push({
        type: "user",
        title: `New ${u.role} registered: ${u.name}`,
        time: getTimeAgo(u.createdAt),
        timestamp: u.createdAt,
        icon: "user",
      });
    });

    // Recent resolved complaints
    const resolvedComplaints = await Complaint.find({
      status: "Resolved",
      resolvedAt: { $exists: true, $ne: null },
    })
      .sort({ resolvedAt: -1 })
      .limit(5)
      .lean();

    resolvedComplaints.forEach((c) => {
      activities.push({
        type: "complaint",
        title: `Complaint resolved: ${c.subject}`,
        time: getTimeAgo(c.resolvedAt),
        timestamp: c.resolvedAt,
        icon: "complaint",
      });
    });

    // Recent job postings
    const recentJobs = await JobListing.find({})
      .sort({ postedDate: -1 })
      .limit(5)
      .select("title postedDate status")
      .lean();

    recentJobs.forEach((j) => {
      activities.push({
        type: "job",
        title: `Job posted: ${j.title}`,
        time: getTimeAgo(j.postedDate),
        timestamp: j.postedDate,
        icon: "job",
      });
    });

    // Recent applications
    const recentApplications = await JobApplication.find({})
      .sort({ appliedDate: -1 })
      .limit(5)
      .lean();

    const appJobIds = recentApplications.map((a) => a.jobId);
    const appJobs = await JobListing.find({ jobId: { $in: appJobIds } })
      .select("jobId title")
      .lean();

    recentApplications.forEach((a) => {
      const job = appJobs.find((j) => j.jobId === a.jobId);
      activities.push({
        type: "application",
        title: `New application for: ${job?.title || "Unknown Job"}`,
        time: getTimeAgo(a.appliedDate),
        timestamp: a.appliedDate,
        icon: "application",
      });
    });

    // Sort and return top 10
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      data: activities.slice(0, 10).map((a) => ({
        type: a.type,
        title: a.title,
        time: a.time,
        icon: a.icon,
      })),
    });
  } catch (error) {
    console.error("Error fetching recent activities:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch recent activities" });
  }
};

function getTimeAgo(date) {
  const now = new Date();
  const diffInMs = now - new Date(date);
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInHours < 1) return "Just now";
  if (diffInHours < 24) return `${diffInHours} hours ago`;
  if (diffInDays === 1) return "Yesterday";
  if (diffInDays < 7) return `${diffInDays} days ago`;
  return new Date(date).toLocaleDateString();
}

// ============ PLATFORM FEE SYSTEM ============

/**
 * Calculates the platform fee percentage for a job listing.
 * Base rate: 5%
 *
 * Duration modifiers (days between posting and application deadline):
 *   ≤7 days   → +2%  (rush listing premium)
 *   8–15 days → +1%  (short-term premium)
 *   16–30 days→  0%  (standard)
 *   31–60 days→ -0.5% (extended discount)
 *   >60 days  → -1%  (long-term discount)
 *
 * Applicant modifiers (number of applications received):
 *   ≤5        → -0.5% (limited reach)
 *   6–15      →  0%  (standard)
 *   16–30     → +0.5% (moderate demand)
 *   >30       → +1%  (high demand)
 *
 * Final rate clamped between 2% and 8%.
 */
function calculatePlatformFee(durationDays, applicantCount) {
  let rate = 5;

  // Duration modifier
  if (durationDays <= 7) rate += 2;
  else if (durationDays <= 15) rate += 1;
  else if (durationDays <= 30) rate += 0;
  else if (durationDays <= 60) rate -= 0.5;
  else rate -= 1;

  // Applicant modifier
  if (applicantCount <= 5) rate -= 0.5;
  else if (applicantCount <= 15) rate += 0;
  else if (applicantCount <= 30) rate += 0.5;
  else rate += 1;

  return Math.max(2, Math.min(8, Math.round(rate * 10) / 10));
}

// ============ DASHBOARD REVENUE (new) ============

exports.getDashboardRevenue = async (req, res) => {
  try {
    const PREMIUM_MONTHLY_PRICE = 868; // ₹868/month

    // Generate last 12 months
    const now = new Date();
    const monthsRange = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endOfMonth = new Date(
        d.getFullYear(),
        d.getMonth() + 1,
        0,
        23,
        59,
        59,
      );
      const shortMonth = d.toLocaleString("en-IN", { month: "short" });
      monthsRange.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: shortMonth + " '" + String(d.getFullYear()).slice(-2),
        startDate: d,
        endDate: endOfMonth,
      });
    }

    // --- Subscription Revenue ---
    const premiumUsers = await User.find(
      { subscription: "Premium" },
      { subscriptionDuration: 1, subscriptionExpiryDate: 1, createdAt: 1 },
    ).lean();

    // --- All Jobs for Platform Fee ---
    const allJobs = await JobListing.find({})
      .select(
        "jobId budget postedDate applicationDeadline applicants status title employerId",
      )
      .lean();

    // Application counts per job
    const jobIds = allJobs.map((j) => j.jobId);
    const appCounts = await JobApplication.aggregate([
      { $match: { jobId: { $in: jobIds } } },
      { $group: { _id: "$jobId", count: { $sum: 1 } } },
    ]);
    const appCountMap = {};
    appCounts.forEach((a) => {
      appCountMap[a._id] = a.count;
    });

    // Employer info for fee table
    const employerIds = [...new Set(allJobs.map((j) => j.employerId))];
    const employers = await Employer.find({ employerId: { $in: employerIds } })
      .select("employerId companyName userId")
      .lean();
    const employerUserIds = employers.map((e) => e.userId);
    const employerUsers = await User.find({ userId: { $in: employerUserIds } })
      .select("userId name")
      .lean();

    // Calculate fee for each job
    const jobFees = allJobs.map((job) => {
      const postedDate = new Date(job.postedDate);
      const deadline = new Date(job.applicationDeadline);
      const durationDays = Math.max(
        1,
        Math.ceil((deadline - postedDate) / (1000 * 60 * 60 * 24)),
      );
      const applicantCount = appCountMap[job.jobId] || job.applicants || 0;
      const feeRate = calculatePlatformFee(durationDays, applicantCount);
      const feeAmount = (job.budget || 0) * (feeRate / 100);

      const employer = employers.find((e) => e.employerId === job.employerId);
      const empUser = employerUsers.find((u) => u.userId === employer?.userId);

      return {
        jobId: job.jobId,
        title: job.title,
        budget: job.budget,
        durationDays,
        applicantCount,
        feeRate,
        feeAmount: Math.round(feeAmount * 100) / 100,
        postedDate: job.postedDate,
        status: job.status,
        employerName: empUser?.name || "Unknown",
        companyName: employer?.companyName || "Unknown",
      };
    });

    // --- Build monthly data ---
    const monthlyData = monthsRange.map((m) => {
      // Subscription revenue: count active premium users during this month
      let subRevenue = 0;
      premiumUsers.forEach((u) => {
        if (u.subscriptionExpiryDate && u.subscriptionDuration) {
          const expiry = new Date(u.subscriptionExpiryDate);
          const startDate = new Date(expiry);
          startDate.setMonth(
            startDate.getMonth() - (u.subscriptionDuration || 1),
          );
          if (startDate <= m.endDate && expiry >= m.startDate) {
            subRevenue += PREMIUM_MONTHLY_PRICE;
          }
        } else {
          // Fallback: premium user active since creation
          const created = new Date(u.createdAt);
          if (created <= m.endDate) {
            subRevenue += PREMIUM_MONTHLY_PRICE;
          }
        }
      });

      // Platform fee revenue: sum of fees for jobs posted in this month
      let platformFeeRevenue = 0;
      const monthJobs = jobFees.filter((j) => {
        const pd = new Date(j.postedDate);
        return pd >= m.startDate && pd <= m.endDate;
      });
      monthJobs.forEach((j) => {
        platformFeeRevenue += j.feeAmount;
      });

      return {
        label: m.label,
        year: m.year,
        month: m.month,
        subscriptionRevenue: Math.round(subRevenue * 100) / 100,
        platformFeeRevenue: Math.round(platformFeeRevenue * 100) / 100,
        totalRevenue: Math.round((subRevenue + platformFeeRevenue) * 100) / 100,
        jobsPosted: monthJobs.length,
      };
    });

    // Totals
    const totalSubscriptionRevenue = monthlyData.reduce(
      (s, m) => s + m.subscriptionRevenue,
      0,
    );
    const totalPlatformFees = monthlyData.reduce(
      (s, m) => s + m.platformFeeRevenue,
      0,
    );
    const totalRevenue = totalSubscriptionRevenue + totalPlatformFees;

    // This month vs last month growth
    const thisMonth = monthlyData[monthlyData.length - 1];
    const lastMonth =
      monthlyData.length >= 2 ? monthlyData[monthlyData.length - 2] : null;
    const revenueGrowth =
      lastMonth && lastMonth.totalRevenue > 0
        ? ((thisMonth.totalRevenue - lastMonth.totalRevenue) /
            lastMonth.totalRevenue) *
          100
        : 0;

    // --- Engagement metrics ---
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const totalJobCount = await JobListing.countDocuments();
    const completedJobs = await JobListing.countDocuments({
      status: "completed",
    });
    const totalApplications = await JobApplication.countDocuments();
    const acceptedApplications = await JobApplication.countDocuments({
      status: "Accepted",
    });
    const recentJobCount = await JobListing.countDocuments({
      postedDate: { $gte: thirtyDaysAgo },
    });
    const recentAppCount = await JobApplication.countDocuments({
      appliedDate: { $gte: thirtyDaysAgo },
    });
    const activeUsers = await User.countDocuments({
      role: { $ne: "" },
      updatedAt: { $gte: thirtyDaysAgo },
    });
    const totalUsers = await User.countDocuments({ role: { $ne: "" } });
    const premiumCount = await User.countDocuments({
      subscription: "Premium",
    });

    // Recent platform-fee transactions (top 10)
    const recentFeeJobs = jobFees
      .filter((j) => j.feeAmount > 0)
      .sort((a, b) => new Date(b.postedDate) - new Date(a.postedDate))
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        monthlyRevenue: monthlyData,
        totals: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          subscriptionRevenue: Math.round(totalSubscriptionRevenue * 100) / 100,
          platformFees: Math.round(totalPlatformFees * 100) / 100,
          thisMonthRevenue: thisMonth.totalRevenue,
          revenueGrowth: Math.round(revenueGrowth * 10) / 10,
        },
        engagement: {
          jobCompletionRate:
            totalJobCount > 0
              ? Math.round((completedJobs / totalJobCount) * 100)
              : 0,
          hireRate:
            totalApplications > 0
              ? Math.round((acceptedApplications / totalApplications) * 100)
              : 0,
          activeUsers,
          totalUsers,
          premiumUsers: premiumCount,
          conversionRate:
            totalUsers > 0
              ? Math.round((premiumCount / totalUsers) * 100 * 10) / 10
              : 0,
          recentJobs: recentJobCount,
          recentApplications: recentAppCount,
          avgJobsPerMonth:
            totalJobCount > 0 ? Math.round(totalJobCount / 12) : 0,
        },
        recentPlatformFees: recentFeeJobs,
        feeStructure: {
          baseRate: 2,
          description:
            "Platform fee is 2% for standard jobs and 4% for boosted jobs, plus an application cap fee of 0%–2%",
          range: "2.5% – 6%",
          tiers: {
            platform: [
              { range: "Standard job", modifier: "2%", label: "Standard" },
              { range: "Boosted job", modifier: "4%", label: "Boosted" },
            ],
            applicationCap: [
              { range: "≤ 10 applicants", modifier: "0%", label: "Strict" },
              { range: "≤ 25 applicants", modifier: "+0.5%", label: "Limited" },
              { range: "≤ 50 applicants", modifier: "+1%", label: "Moderate" },
              { range: "Unlimited", modifier: "+2%", label: "Open" },
            ],
          },
        },
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard revenue:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch dashboard revenue" });
  }
};

// ============ FEEDBACK OVERVIEW ============

exports.getAllFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find({}).sort({ createdAt: -1 }).lean();

    const userIds = [
      ...new Set([
        ...feedbacks.map((f) => f.fromUserId),
        ...feedbacks.map((f) => f.toUserId),
      ]),
    ];

    const users = await User.find({ userId: { $in: userIds } })
      .select("userId name email role picture")
      .lean();

    const feedbacksWithDetails = feedbacks.map((fb) => {
      const fromUser = users.find((u) => u.userId === fb.fromUserId);
      const toUser = users.find((u) => u.userId === fb.toUserId);
      return {
        ...fb,
        fromUserName: fromUser?.name || "Unknown",
        fromUserRole: fromUser?.role || "Unknown",
        toUserName: toUser?.name || "Unknown",
        toUserRole: toUser?.role || "Unknown",
      };
    });

    res.json({
      success: true,
      feedbacks: feedbacksWithDetails,
      total: feedbacksWithDetails.length,
    });
  } catch (error) {
    console.error("Error fetching feedbacks:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch feedbacks" });
  }
};

// ============ RATING ADJUSTMENT ============

exports.adjustUserRating = async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const { adjustment, reason, complaintId } = req.body;

    // Validate required fields
    if (!targetUserId || adjustment === undefined || !reason) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: targetUserId, adjustment, reason",
      });
    }

    // Validate adjustment (must be multiple of 0.1, between -4.0 and +0.5)
    const adjustmentNum = parseFloat(adjustment);
    if (isNaN(adjustmentNum) || adjustmentNum < -4.0 || adjustmentNum > 0.5) {
      return res.status(400).json({
        success: false,
        error: "Adjustment must be between -4.0 and +0.5",
      });
    }

    // Check if adjustment is multiple of 0.1
    if (Math.abs((adjustmentNum * 10) % 1) > 0.001) {
      return res.status(400).json({
        success: false,
        error: "Adjustment must be in increments of 0.1",
      });
    }

    // Validate reason length
    if (reason.trim().length < 20 || reason.trim().length > 500) {
      return res.status(400).json({
        success: false,
        error: "Reason must be between 20 and 500 characters",
      });
    }

    // Get target user
    const targetUser = await User.findOne({ userId: targetUserId });
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: "Target user not found",
      });
    }

    // Get moderator info
    const moderatorUserId = req.session.user.id;
    const moderator = await User.findOne({ userId: moderatorUserId });
    if (!moderator) {
      return res.status(404).json({
        success: false,
        error: "Moderator not found",
      });
    }

    // Calculate new rating
    const currentRating = targetUser.useModeratorRating
      ? targetUser.moderatorRating
      : targetUser.calculatedRating || targetUser.rating;

    let newRating = currentRating + adjustmentNum;

    // Apply floor and ceiling
    newRating = Math.max(1.0, Math.min(5.0, newRating));
    newRating = Math.round(newRating * 10) / 10; // Round to 1 decimal

    // Get IP address
    const ipAddress =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      null;

    // Create audit log
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

    // Update user rating
    targetUser.moderatorRating = newRating;
    targetUser.useModeratorRating = true;
    targetUser.moderatorAdjustmentReason = reason.trim();
    targetUser.adjustedBy = moderator.userId;
    targetUser.adjustedAt = new Date();
    targetUser.rating = newRating; // Update display rating

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

    // Create audit log for reversion
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
        req.headers["x-forwarded-for"] || req.connection.remoteAddress || null,
    });

    await auditLog.save();

    // Revert to calculated rating
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
