const JobListing = require("../models/job_listing");
const User = require("../models/user");
const Employer = require("../models/employer");
const Freelancer = require("../models/freelancer");
const Skill = require("../models/skill");
const Complaint = require("../models/complaint");
const { uploadToCloudinary } = require("../middleware/imageUpload");
const { uploadToCloudinary } = require("../middleware/pdfUpload");

exports.getFreelancerActiveJobs = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).send("Unauthorized: Please log in");
    }

    // Fetch user data for proper user object construction
    const user = await User.findOne({ userId: req.session.user.id }).lean();

    // Just render the page template with user data
    // Jobs will be loaded dynamically via JavaScript fetch API
    res.render("Vanya/active_job", {
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        picture: user.picture,
        location: user.location,
        socialMedia: user.socialMedia,
        aboutMe: user.aboutMe,
        subscription: user.subscription,
        role: user.role,
      },
      activePage: "active_job",
    });
  } catch (error) {
    console.error("Error loading active jobs page:", error.message);
    res.status(500).send("Server Error: Unable to load active jobs page");
  }
};

exports.leaveActiveJob = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: "Unauthorized: Please log in" });
    }

    const freelancerId = req.session.user.roleId;
    const jobId = req.params.jobId;

    const result = await JobListing.updateOne(
      {
        jobId: jobId,
        "assignedFreelancer.freelancerId": freelancerId,
        "assignedFreelancer.status": "working",
      },
      { $set: { "assignedFreelancer.status": "left" } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: "Job not found or not authorized" });
    }

    res.status(200).json({ message: "Job left successfully" });
  } catch (error) {
    console.error("Error leaving active job:", error.message);
    res.status(500).json({ error: "Failed to leave job" });
  }
};

exports.getFreelancerJobHistory = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).send("Unauthorized: Please log in");
    }

    // Fetch user data for proper user object construction
    const user = await User.findOne({ userId: req.session.user.id }).lean();

    // Just render the page template with user data
    // Jobs will be loaded dynamically via JavaScript fetch API
    res.render("Vanya/job_history", {
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        picture: user.picture,
        location: user.location,
        socialMedia: user.socialMedia,
        aboutMe: user.aboutMe,
        subscription: user.subscription,
        role: user.role,
      },
      activePage: "job_history",
    });
  } catch (error) {
    console.error("Error loading job history page:", error.message);
    res.status(500).send("Server Error: Unable to load job history page");
  }
};

exports.getFreelancerSubscription = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).send("Unauthorized: Please log in");
    }

    // Fetch user data for proper user object construction
    const user = await User.findOne({ userId: req.session.user.id }).lean();

    if (!user) {
      console.error("User not found in database for ID:", req.session.user.id);
      return res.status(404).send("User not found");
    }

    res.render("Vanya/subscription", {
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        picture: user.picture,
        location: user.location,
        socialMedia: user.socialMedia,
        aboutMe: user.aboutMe,
        subscription: user.subscription,
        role: user.role,
      },
      activePage: "subscription",
    });
  } catch (error) {
    console.error("Error rendering subscription:", error.message);
    res.status(500).send("Server Error: Unable to render subscription page");
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

    res.render("Vanya/subscription", {
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        picture: user.picture,
        location: user.location,
        socialMedia: user.socialMedia,
        aboutMe: user.aboutMe,
        subscription: user.subscription || "Basic",
        role: user.role,
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
      return res.status(401).json({ success: false, message: "Not logged in" });
    }
    // Update the user's subscription to "Premium"
    await User.updateOne({ userId }, { $set: { subscription: "Premium" } });
    req.session.user.subscription = "Premium";
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// API endpoint for active jobs (JSON response)
exports.getFreelancerActiveJobsAPI = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: "Unauthorized: Please log in" });
    }

    const freelancerId = req.session.user.roleId;

    const activeJobs = await JobListing.find({
      "assignedFreelancer.freelancerId": freelancerId,
      "assignedFreelancer.status": "working",
    }).lean();

    const employerIds = activeJobs
      .map((job) => job.employerId)
      .filter((id) => id);
    const users = await User.find({ roleId: { $in: employerIds } })
      .select("roleId userId")
      .lean();

    const formattedJobs = await Promise.all(
      activeJobs.map(async (job) => {
        const paidAmount = job.milestones
          .filter((milestone) => milestone.status === "paid")
          .reduce(
            (sum, milestone) => sum + parseFloat(milestone.payment) || 0,
            0
          );

        const totalBudget = parseFloat(job.budget.amount) || 0;
        const progress =
          totalBudget > 0 ? Math.min((paidAmount / totalBudget) * 100, 100) : 0;

        const employer = await Employer.findOne({
          employerId: job.employerId,
        }).lean();
        const companyName = employer ? employer.companyName : "Unknown Company";

        const user = users.find((u) => u.roleId === job.employerId);

        return {
          id: job.jobId,
          title: job.title,
          company: companyName,
          logo: job.imageUrl || "/assets/company_logo.jpg",
          deadline: job.applicationDeadline
            ? job.applicationDeadline.toLocaleDateString()
            : "No deadline",
          price: job.budget.amount
            ? `Rs.${parseFloat(job.budget.amount).toFixed(2)}`
            : "Not specified",
          progress: Math.round(progress),
          tech: job.description.skills || [],
          employerUserId: user?.userId || "",
        };
      })
    );

    res.json({
      success: true,
      activeJobs: formattedJobs,
      total: formattedJobs.length,
    });
  } catch (error) {
    console.error("Error fetching active jobs API:", error.message);
    res.status(500).json({
      success: false,
      error: "Server Error: Unable to load active jobs",
    });
  }
};

// API endpoint for job history (JSON response)
exports.getFreelancerJobHistoryAPI = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: "Unauthorized: Please log in" });
    }

    const freelancerId = req.session.user.roleId;

    const historyJobs = await JobListing.find({
      "assignedFreelancer.freelancerId": freelancerId,
      "assignedFreelancer.status": { $in: ["finished", "left"] },
    }).lean();

    const formattedJobs = await Promise.all(
      historyJobs.map(async (job) => {
        const paidAmount = job.milestones
          .filter((milestone) => milestone.status === "paid")
          .reduce(
            (sum, milestone) => sum + parseFloat(milestone.payment) || 0,
            0
          );

        const employer = await Employer.findOne({
          employerId: job.employerId,
        }).lean();
        const companyName = employer ? employer.companyName : "Unknown Company";

        return {
          id: job.jobId,
          title: job.title,
          company: companyName,
          logo: job.imageUrl || "/assets/company_logo.jpg",
          status: job.assignedFreelancer.status,
          tech: job.description.skills || [],
          date: `${
            job.assignedFreelancer.startDate
              ? job.assignedFreelancer.startDate.toLocaleDateString()
              : "Unknown"
          } - ${
            job.updatedAt ? job.updatedAt.toLocaleDateString() : "Unknown"
          }`,
          price: paidAmount ? `Rs.${paidAmount.toFixed(2)}` : "Not paid",
          rating: job.rating || 0,
        };
      })
    );

    res.json({
      success: true,
      historyJobs: formattedJobs,
      total: formattedJobs.length,
    });
  } catch (error) {
    console.error("Error fetching job history API:", error.message);
    res.status(500).json({
      success: false,
      error: "Server Error: Unable to load job history",
    });
  }
};