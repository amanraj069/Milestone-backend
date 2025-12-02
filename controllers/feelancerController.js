const JobListing = require("../models/job_listing");
const JobApplication = require("../models/job_application");
const User = require("../models/user");
const Employer = require("../models/employer");
const Freelancer = require("../models/freelancer");
const Complaint = require("../models/complaint");
const { uploadToCloudinary } = require("../middleware/imageUpload");
const {
  uploadToCloudinary: uploadPdfToCloudinary,
} = require("../middleware/pdfUpload");

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
          subscriptionExpiryDate: expiryDate
        } 
      }
    );
    
    req.session.user.subscription = "Premium";
    req.session.user.subscriptionDuration = duration || null;
    req.session.user.subscriptionExpiryDate = expiryDate;
    
    res.json({ 
      success: true, 
      message: "Successfully upgraded to Premium",
      duration: duration,
      expiryDate: expiryDate
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
        $unset: { subscriptionDuration: "", subscriptionExpiryDate: "" }
      }
    );
    
    req.session.user.subscription = "Basic";
    delete req.session.user.subscriptionDuration;
    delete req.session.user.subscriptionExpiryDate;
    
    res.json({ success: true, message: "Successfully downgraded to Basic" });
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
            (sum, milestone) => sum + (parseFloat(milestone.payment) || 0),
            0
          );

        const totalBudget = parseFloat(job.budget) || 0;
        const progress =
          totalBudget > 0 ? Math.min((paidAmount / totalBudget) * 100, 100) : 0;

        const employer = await Employer.findOne({
          employerId: job.employerId,
        }).lean();
        const companyName =
          employer && employer.companyName && employer.companyName.trim()
            ? employer.companyName
            : "Unknown Company";

        const user = users.find((u) => u.roleId === job.employerId);

        // Calculate days since start
        const startDate = job.assignedFreelancer?.startDate;
        const daysSinceStart = startDate
          ? Math.floor(
              (Date.now() - new Date(startDate).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : 0;

        return {
          id: job.jobId,
          title: job.title,
          company: companyName,
          logo: job.imageUrl || "/assets/company_logo.jpg",
          deadline: job.applicationDeadline
            ? job.applicationDeadline.toLocaleDateString()
            : "No deadline",
          price: job.budget
            ? `Rs.${parseFloat(job.budget).toFixed(2)}`
            : "Not specified",
          progress: Math.round(progress),
          tech: job.description.skills || [],
          employerUserId: user?.userId || "",
          description: job.description?.text || job.description || "",
          milestones: job.milestones || [],
          daysSinceStart: daysSinceStart,
          startDate: startDate
            ? new Date(startDate).toLocaleDateString()
            : "Not set",
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
    console.log("getFreelancerJobHistoryAPI called");
    console.log("Session user:", req.session.user);

    if (!req.session.user) {
      console.log("No session user - unauthorized");
      return res
        .status(401)
        .json({ success: false, error: "Unauthorized: Please log in" });
    }

    const freelancerId = req.session.user.roleId;
    console.log("Fetching job history for freelancer:", freelancerId);

    const historyJobs = await JobListing.find({
      "assignedFreelancer.freelancerId": freelancerId,
      "assignedFreelancer.status": { $in: ["finished", "left"] },
    }).lean();

    console.log("Found history jobs:", historyJobs.length);

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
          rating: job.assignedFreelancer.employerRating || null,
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

// Get freelancer profile data
exports.getFreelancerProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const freelancerId = req.session.user.roleId;

    const user = await User.findOne({ userId }).lean();
    const freelancer = await Freelancer.findOne({ freelancerId }).lean();

    if (!user || !freelancer) {
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
        resume: freelancer.resume,
        skills: freelancer.skills || [],
        experience: freelancer.experience || [],
        education: freelancer.education || [],
        portfolio: freelancer.portfolio || [],
        rating: user.rating || 0,
        subscription: user.subscription || "Basic",
      },
    });
  } catch (error) {
    console.error("Error fetching freelancer profile:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch profile",
    });
  }
};

// Update freelancer profile (email, phone)
exports.updateFreelancerProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const freelancerId = req.session.user.roleId;
    const {
      name,
      email,
      phone,
      location,
      profileImageUrl,
      about,
      resumeLink,
      skills,
      experience,
      education,
      portfolio,
    } = req.body;

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

    // Update Freelancer fields
    const freelancerUpdate = {};
    if (resumeLink) freelancerUpdate.resume = resumeLink;
    if (skills) freelancerUpdate.skills = skills;
    if (experience) freelancerUpdate.experience = experience;
    if (education) freelancerUpdate.education = education;
    if (portfolio) freelancerUpdate.portfolio = portfolio;

    const updatedFreelancer = await Freelancer.findOneAndUpdate(
      { freelancerId },
      freelancerUpdate,
      { new: true, runValidators: true }
    ).lean();

    if (!updatedFreelancer) {
      return res.status(404).json({
        success: false,
        error: "Freelancer profile not found",
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
        resume: updatedFreelancer.resume,
        skills: updatedFreelancer.skills,
        experience: updatedFreelancer.experience,
        education: updatedFreelancer.education,
        portfolio: updatedFreelancer.portfolio,
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

// Upload portfolio image
exports.uploadPortfolioImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No image file provided",
      });
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer);

    res.json({
      success: true,
      message: "Portfolio image uploaded successfully",
      data: {
        imageUrl: result.secure_url,
      },
    });
  } catch (error) {
    console.error("Error uploading portfolio image:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to upload portfolio image",
    });
  }
};

// Upload resume
exports.uploadResume = async (req, res) => {
  try {
    const freelancerId = req.session.user.roleId;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No resume file provided",
      });
    }

    // File is already saved to local storage by multer
    // Get the file URL
    const result = await uploadPdfToCloudinary(req.file);

    // Update freelancer resume link
    const updatedFreelancer = await Freelancer.findOneAndUpdate(
      { freelancerId },
      { resume: result.secure_url },
      { new: true }
    ).lean();

    if (!updatedFreelancer) {
      return res.status(404).json({
        success: false,
        error: "Freelancer not found",
      });
    }

    res.json({
      success: true,
      data: {
        resume: updatedFreelancer.resume,
      },
    });
  } catch (error) {
    console.error("Error uploading resume:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to upload resume",
    });
  }
};

// Apply for a job
exports.applyForJob = async (req, res) => {
  try {
    const freelancerId = req.session.user.roleId;
    const { jobId } = req.params;
    const { coverMessage, skillRating, availability } = req.body;

    // Validate input
    if (!coverMessage || coverMessage.length < 50) {
      return res.status(400).json({
        success: false,
        error: "Cover message must be at least 50 characters",
      });
    }

    // Check if job exists
    const job = await JobListing.findOne({ jobId }).lean();
    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    // Check if already applied
    const existingApplication = await JobApplication.findOne({
      freelancerId,
      jobId,
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        error: "You have already applied for this job",
      });
    }

    // Get freelancer's resume
    const freelancer = await Freelancer.findOne({ freelancerId }).lean();
    if (!freelancer) {
      return res.status(404).json({
        success: false,
        error: "Freelancer profile not found",
      });
    }

    // Create new application
    const newApplication = new JobApplication({
      freelancerId,
      jobId,
      coverMessage,
      resumeLink: freelancer.resume,
      appliedDate: new Date(),
      status: "Pending",
    });

    await newApplication.save();

    // Update user's last cover message for future use
    await User.findOneAndUpdate(
      { roleId: freelancerId },
      { lastCoverMessage: coverMessage }
    );

    res.json({
      success: true,
      message: "Application submitted successfully",
      data: {
        applicationId: newApplication.applicationId,
      },
    });
  } catch (error) {
    console.error("Error applying for job:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to submit application",
    });
  }
};

// Get last used cover message
exports.getLastCoverMessage = async (req, res) => {
  try {
    const freelancerId = req.session.user.roleId;

    const user = await User.findOne({ roleId: freelancerId }).lean();

    res.json({
      success: true,
      data: {
        lastCoverMessage: user?.lastCoverMessage || "",
      },
    });
  } catch (error) {
    console.error("Error fetching last cover message:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch last cover message",
    });
  }
};

// Create a new complaint
exports.createComplaint = async (req, res) => {
  try {
    const freelancerId = req.session.user.roleId;
    const userId = req.session.user.id;
    const { jobId, complaintType, priority, subject, description } = req.body;

    // Validate input
    if (!jobId || !complaintType || !subject || !description) {
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

    // Get freelancer details
    const user = await User.findOne({ userId }).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Get employer details
    const employer = await Employer.findOne({
      employerId: job.employerId,
    }).lean();
    const employerUser = await User.findOne({ roleId: job.employerId }).lean();

    const employerName =
      employer?.companyName || employerUser?.name || "Unknown Employer";

    // Create new complaint
    const newComplaint = new Complaint({
      complainantType: "Freelancer",
      complainantId: freelancerId,
      complainantName: user.name,
      freelancerId,
      freelancerName: user.name,
      jobId,
      jobTitle: job.title,
      employerId: job.employerId,
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
    console.error("Error creating complaint:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to submit complaint",
    });
  }
};

// Get freelancer's complaints
exports.getFreelancerComplaints = async (req, res) => {
  try {
    const freelancerId = req.session.user.roleId;

    const complaints = await Complaint.find({ freelancerId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      complaints,
      total: complaints.length,
    });
  } catch (error) {
    console.error("Error fetching complaints:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch complaints",
    });
  }
};

// Get all payments (jobs with freelancer assigned - working or finished)
exports.getFreelancerPayments = async (req, res) => {
  try {
    const freelancerId = req.session.user?.roleId;

    if (!freelancerId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // Find all jobs where this freelancer is assigned (working or finished)
    const jobs = await JobListing.find({
      "assignedFreelancer.freelancerId": freelancerId,
      "assignedFreelancer.status": { $in: ["working", "finished"] },
    }).lean();

    if (jobs.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    // Get employer details
    const employerIds = jobs.map((job) => job.employerId);
    const users = await User.find({ roleId: { $in: employerIds } })
      .select("roleId name email picture")
      .lean();
    const employers = await Employer.find({ employerId: { $in: employerIds } })
      .select("employerId companyName")
      .lean();

    // Build payment data
    const payments = jobs.map((job) => {
      const user = users.find((u) => u.roleId === job.employerId);
      const employer = employers.find((e) => e.employerId === job.employerId);

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
        (m) => m.status === "paid"
      ).length;
      const projectCompletion =
        milestones.length > 0
          ? Math.round((completedMilestones / milestones.length) * 100)
          : 0;

      return {
        jobId: job.jobId,
        jobTitle: job.title,
        employerId: job.employerId,
        employerName: user?.name || "Unknown",
        employerPicture: user?.picture || "",
        employerEmail: user?.email || "",
        companyName: employer?.companyName || "",
        status: job.assignedFreelancer.status,
        startDate: job.assignedFreelancer.startDate,
        endDate: job.assignedFreelancer.endDate,
        totalBudget,
        paidAmount,
        paymentPercentage,
        projectCompletion,
        milestonesCount: milestones.length,
        completedMilestones,
      };
    });

    return res.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    console.error("Get freelancer payments error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch payments",
    });
  }
};

// Get payment details for a specific job
exports.getFreelancerPaymentDetails = async (req, res) => {
  try {
    const freelancerId = req.session.user?.roleId;
    const { jobId } = req.params;

    if (!freelancerId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // Find the job
    const job = await JobListing.findOne({
      jobId,
      "assignedFreelancer.freelancerId": freelancerId,
    }).lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    // Get employer details
    const user = await User.findOne({ roleId: job.employerId })
      .select("roleId name email picture")
      .lean();
    const employer = await Employer.findOne({ employerId: job.employerId })
      .select("employerId companyName")
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
      (m) => m.status === "paid"
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
        employerId: job.employerId,
        employerName: user?.name || "Unknown",
        employerPicture: user?.picture || "",
        employerEmail: user?.email || "",
        companyName: employer?.companyName || "",
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
    console.error("Get freelancer payment details error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch payment details",
    });
  }
};

// Request payment for a milestone
exports.requestMilestonePayment = async (req, res) => {
  try {
    const freelancerId = req.session.user?.roleId;
    const { jobId, milestoneId } = req.params;

    if (!freelancerId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // Find the job
    const job = await JobListing.findOne({
      jobId,
      "assignedFreelancer.freelancerId": freelancerId,
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    // Find the milestone
    const milestoneIndex = job.milestones.findIndex(
      (m) => m.milestoneId === milestoneId
    );
    if (milestoneIndex === -1) {
      return res.status(404).json({
        success: false,
        error: "Milestone not found",
      });
    }

    // Check if already paid
    if (job.milestones[milestoneIndex].status === "paid") {
      return res.status(400).json({
        success: false,
        error: "Milestone already paid",
      });
    }

    // Check if already requested
    if (job.milestones[milestoneIndex].requested) {
      return res.status(400).json({
        success: false,
        error: "Payment already requested",
      });
    }

    // Update milestone requested status
    job.milestones[milestoneIndex].requested = true;
    await job.save();

    return res.json({
      success: true,
      message: "Payment requested successfully",
    });
  } catch (error) {
    console.error("Request milestone payment error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to request payment",
    });
  }
};
