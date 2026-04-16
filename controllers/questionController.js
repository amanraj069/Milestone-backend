const Question = require("../models/Question");
const Notification = require("../models/Notification");
const JobListing = require("../models/job_listing");
const JobApplication = require("../models/job_application");
const User = require("../models/user");
const Freelancer = require("../models/freelancer");
const { v4: uuidv4 } = require("uuid");

function mapBy(items, key) {
  return new Map((items || []).map((item) => [item[key], item]));
}

// Get all questions for a job
const getJobQuestions = async (req, res) => {
  try {
    const { jobId } = req.params;

    const questions = await Question.find({ jobId }).sort({ createdAt: -1 }).lean();

    // Batch resolve missing pictures by roleId.
    const missingRoleIds = new Set();
    questions.forEach((question) => {
      if (!question.askerPicture) {
        missingRoleIds.add(question.askerId);
      }
      (question.answers || []).forEach((answer) => {
        if (!answer.answererPicture) {
          missingRoleIds.add(answer.answererId);
        }
      });
    });

    const roleIds = [...missingRoleIds].filter(Boolean);
    const users = roleIds.length
      ? await User.find({ roleId: { $in: roleIds } }).select("roleId picture").lean()
      : [];
    const userByRoleId = mapBy(users, "roleId");

    const enrichedQuestions = questions.map((question) => {
      const questionObj = {
        ...question,
        answers: [...(question.answers || [])],
      };

      if (!questionObj.askerPicture) {
        const askerUser = userByRoleId.get(questionObj.askerId);
        if (askerUser?.picture) {
          questionObj.askerPicture = askerUser.picture;
        }
      }

      questionObj.answers = questionObj.answers.map((answer) => {
        if (!answer.answererPicture) {
          const answererUser = userByRoleId.get(answer.answererId);
          if (answererUser?.picture) {
            return { ...answer, answererPicture: answererUser.picture };
          }
        }
        return answer;
      });

      return questionObj;
    });

    res.json({
      success: true,
      questions: enrichedQuestions,
    });
  } catch (error) {
    console.error("Error fetching questions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch questions",
    });
  }
};

// Post a new question (any freelancer can ask)
const postQuestion = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { text } = req.body;
    const user = req.session.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Please login to post a question",
      });
    }

    if (user.role !== "Freelancer") {
      return res.status(403).json({
        success: false,
        error: "Only freelancers can post questions",
      });
    }

    // Get job to find employer
    const job = await JobListing.findOne({ jobId });
    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    // Get employer's user account
    const employerUser = await User.findOne({ roleId: job.employerId });

    // Create the question
    const question = new Question({
      questionId: uuidv4(),
      jobId,
      askerId: user.roleId,
      askerType: "Freelancer",
      askerName: user.name || "Anonymous",
      askerPicture: user.picture || "",
      text,
      answers: [],
    });

    await question.save();

    // Get socket io instance
    const io = req.app.get("io");

    // Track notified users to avoid duplicates
    const notifiedUserIds = new Set();

    // Create notification for employer
    if (employerUser) {
      const notification = new Notification({
        notificationId: uuidv4(),
        userId: employerUser.userId,
        type: "question_posted",
        title: "New Question on Your Job",
        message: `A freelancer asked a question about "${job.title}"`,
        jobId,
        questionId: question.questionId,
        fromUserId: user.id,
        fromUserName: user.name || "A Freelancer",
        read: false,
      });

      await notification.save();
      notifiedUserIds.add(employerUser.userId);

      // Emit socket event if io is available
      if (io) {
        io.to(`user:${employerUser.userId}`).emit(
          "notification:new",
          notification
        );
      }
    }

    // Also notify freelancers who have worked/are working for this employer (on any job)
    // They might be able to help answer questions about the employer
    const employerJobs = await JobListing.find({
      employerId: job.employerId,
      "assignedFreelancer.freelancerId": { $exists: true, $ne: null },
      "assignedFreelancer.status": { $in: ["working", "finished"] },
    });

    const candidateFreelancerIds = new Set();

    if (
      job.assignedFreelancer &&
      job.assignedFreelancer.freelancerId &&
      job.assignedFreelancer.freelancerId !== user.roleId &&
      (job.assignedFreelancer.status === "working" ||
        job.assignedFreelancer.status === "finished")
    ) {
      candidateFreelancerIds.add(job.assignedFreelancer.freelancerId);
    }

    employerJobs.forEach((empJob) => {
      if (empJob.assignedFreelancer?.freelancerId) {
        candidateFreelancerIds.add(empJob.assignedFreelancer.freelancerId);
      }
    });

    candidateFreelancerIds.delete(user.roleId);

    const freelancerIds = [...candidateFreelancerIds];
    const freelancerDocs = freelancerIds.length
      ? await Freelancer.find({ freelancerId: { $in: freelancerIds } })
          .select("freelancerId userId")
          .lean()
      : [];

    const freelancerByFreelancerId = mapBy(freelancerDocs, "freelancerId");

    const candidateUserIds = freelancerDocs
      .map((freelancerDoc) => freelancerDoc.userId)
      .filter(Boolean);
    const candidateUsers = candidateUserIds.length
      ? await User.find({ userId: { $in: candidateUserIds } })
          .select("userId")
          .lean()
      : [];
    const userByUserId = mapBy(candidateUsers, "userId");

    const assignedFreelancerId = job.assignedFreelancer?.freelancerId;
    const assignedFreelancerDoc = assignedFreelancerId
      ? freelancerByFreelancerId.get(assignedFreelancerId)
      : null;
    const assignedFreelancerUser = assignedFreelancerDoc
      ? userByUserId.get(assignedFreelancerDoc.userId)
      : null;

    if (
      assignedFreelancerUser &&
      !notifiedUserIds.has(assignedFreelancerUser.userId)
    ) {
      const freelancerNotification = new Notification({
        notificationId: uuidv4(),
        userId: assignedFreelancerUser.userId,
        type: "question_posted",
        title: "New Question on a Job You Worked",
        message: `Someone asked a question about "${job.title}" - you can help answer it!`,
        jobId,
        questionId: question.questionId,
        fromUserId: user.id,
        fromUserName: user.name || "A Freelancer",
        read: false,
      });

      await freelancerNotification.save();
      notifiedUserIds.add(assignedFreelancerUser.userId);

      if (io) {
        io.to(`user:${assignedFreelancerUser.userId}`).emit(
          "notification:new",
          freelancerNotification
        );
      }
    }

    for (const empJob of employerJobs) {
      // Skip if it's the same freelancer who asked the question
      if (empJob.assignedFreelancer.freelancerId === user.roleId) {
        continue;
      }

      const freelancerDoc = freelancerByFreelancerId.get(
        empJob.assignedFreelancer.freelancerId
      );

      if (!freelancerDoc) {
        continue;
      }

      const freelancerUser = userByUserId.get(freelancerDoc.userId);

      // Skip if already notified or user not found
      if (!freelancerUser || notifiedUserIds.has(freelancerUser.userId)) {
        continue;
      }

      const empFreelancerNotification = new Notification({
        notificationId: uuidv4(),
        userId: freelancerUser.userId,
        type: "question_posted",
        title: "New Question About an Employer You Worked With",
        message: `Someone asked a question about "${job.title}" from an employer you've worked with - you can help answer it!`,
        jobId,
        questionId: question.questionId,
        fromUserId: user.id,
        fromUserName: user.name || "A Freelancer",
        read: false,
      });

      await empFreelancerNotification.save();
      notifiedUserIds.add(freelancerUser.userId);

      // Emit socket event if io is available
      if (io) {
        io.to(`user:${freelancerUser.userId}`).emit(
          "notification:new",
          empFreelancerNotification
        );
      }
    }

    res.json({
      success: true,
      question,
      message: "Question posted successfully",
    });
  } catch (error) {
    console.error("Error posting question:", error);
    res.status(500).json({
      success: false,
      error: "Failed to post question",
    });
  }
};

// Post an answer to a question (only employer or freelancers working/finished on the job or with the employer)
const postAnswer = async (req, res) => {
  try {
    const { questionId } = req.params;
    const { text } = req.body;
    const user = req.session.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Please login to answer",
      });
    }

    // Find the question
    const question = await Question.findOne({ questionId });
    if (!question) {
      return res.status(404).json({
        success: false,
        error: "Question not found",
      });
    }

    // Check if user is trying to answer their own question
    if (question.askerId === user.roleId) {
      return res.status(403).json({
        success: false,
        error: "You cannot answer your own question",
      });
    }

    // Get the job
    const job = await JobListing.findOne({ jobId: question.jobId });
    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    let canAnswer = false;
    let answererType = user.role;

    if (user.role === "Employer" && job.employerId === user.roleId) {
      // Employer who owns the job can answer
      canAnswer = true;
    } else if (user.role === "Freelancer") {
      // Get the freelancer's freelancerId from Freelancer model using userId
      const freelancerDoc = await Freelancer.findOne({ userId: user.id });
      const freelancerId = freelancerDoc ? freelancerDoc.freelancerId : null;

      console.log("Checking answer permissions for freelancer:", {
        sessionUserId: user.id,
        freelancerDoc: freelancerDoc ? freelancerDoc.freelancerId : null,
        jobEmployerId: job.employerId,
        assignedFreelancer: job.assignedFreelancer,
      });

      // Check if freelancer is currently working or has finished this specific job
      if (
        freelancerId &&
        job.assignedFreelancer &&
        job.assignedFreelancer.freelancerId === freelancerId &&
        (job.assignedFreelancer.status === "working" ||
          job.assignedFreelancer.status === "finished")
      ) {
        canAnswer = true;
      }

      // Also check if freelancer has worked/is working for the same employer on any job
      if (!canAnswer && freelancerId) {
        const employerJob = await JobListing.findOne({
          employerId: job.employerId,
          "assignedFreelancer.freelancerId": freelancerId,
          "assignedFreelancer.status": { $in: ["working", "finished"] },
        });

        console.log(
          "Checking employer jobs:",
          employerJob ? employerJob.jobId : null
        );

        if (employerJob) {
          canAnswer = true;
        }
      }
    }

    if (!canAnswer) {
      return res.status(403).json({
        success: false,
        error:
          "Only the employer or freelancers who worked/are working for this employer can answer questions",
      });
    }

    // Add the answer
    const answer = {
      answerId: uuidv4(),
      answererId: user.roleId,
      answererType,
      answererName: user.name || "Anonymous",
      answererPicture: user.picture || "",
      text,
      createdAt: new Date(),
    };

    question.answers.push(answer);
    await question.save();

    // Create notification for the question asker
    const askerUser = await User.findOne({ roleId: question.askerId });

    if (askerUser && askerUser.userId !== user.id) {
      const notification = new Notification({
        notificationId: uuidv4(),
        userId: askerUser.userId,
        type: "question_answered",
        title: "Your Question Was Answered",
        message: `${user.name || "Someone"} answered your question about "${
          job.title
        }"`,
        jobId: question.jobId,
        questionId: question.questionId,
        fromUserId: user.id,
        fromUserName: user.name || "Someone",
        read: false,
      });

      await notification.save();

      // Emit socket event if io is available
      const io = req.app.get("io");
      if (io) {
        io.to(`user:${askerUser.userId}`).emit(
          "notification:new",
          notification
        );
      }
    }

    res.json({
      success: true,
      answer,
      message: "Answer posted successfully",
    });
  } catch (error) {
    console.error("Error posting answer:", error);
    res.status(500).json({
      success: false,
      error: "Failed to post answer",
    });
  }
};

// Check if user can answer questions for a job
const canAnswerQuestions = async (req, res) => {
  try {
    const { jobId } = req.params;
    const user = req.session.user;

    if (!user) {
      return res.json({
        success: true,
        canAnswer: false,
      });
    }

    const job = await JobListing.findOne({ jobId });
    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    let canAnswer = false;

    if (user.role === "Employer" && job.employerId === user.roleId) {
      // Employer who owns the job can answer
      canAnswer = true;
    } else if (user.role === "Freelancer") {
      // Get the freelancer's freelancerId from Freelancer model using userId
      const freelancerDoc = await Freelancer.findOne({ userId: user.id });
      const freelancerId = freelancerDoc ? freelancerDoc.freelancerId : null;

      // Check if freelancer is currently working or has finished this specific job
      if (
        freelancerId &&
        job.assignedFreelancer &&
        job.assignedFreelancer.freelancerId === freelancerId &&
        (job.assignedFreelancer.status === "working" ||
          job.assignedFreelancer.status === "finished")
      ) {
        canAnswer = true;
      }

      // Also check if freelancer has worked/is working for the same employer on any job
      if (!canAnswer && freelancerId) {
        const employerJob = await JobListing.findOne({
          employerId: job.employerId,
          "assignedFreelancer.freelancerId": freelancerId,
          "assignedFreelancer.status": { $in: ["working", "finished"] },
        });

        if (employerJob) {
          canAnswer = true;
        }
      }
    }

    res.json({
      success: true,
      canAnswer,
    });
  } catch (error) {
    console.error("Error checking answer permissions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check permissions",
    });
  }
};

module.exports = {
  getJobQuestions,
  postQuestion,
  postAnswer,
  canAnswerQuestions,
};
