const Complaint = require("../models/complaint");
const Freelancer = require("../models/freelancer");
const Employer = require("../models/employer");
const User = require("../models/user");

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

// Get all freelancers (Admin only)
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

// Delete freelancer (Admin only)
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

// Get all employers (Admin only)
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

// Delete employer (Admin only)
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
