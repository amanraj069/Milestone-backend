const JobListing = require("../models/job_listing");
const User = require("../models/user");
const JobApplication = require("../models/job_application");

const requireEmployer = (context) => {
  const user = context.session?.user;
  if (!user || user.role !== "Employer" || !user.roleId) {
    throw new Error("Unauthorized: Employer access required");
  }
  return user.roleId;
};

const employerResolvers = {
  // ──────────────────────────────────────────────
  //  EMPLOYER DASHBOARD STATS
  // ──────────────────────────────────────────────
  employerDashboardStats: async (_, __, context) => {
    const employerId = requireEmployer(context);

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

    return {
      activeJobs,
      currentFreelancers,
    };
  },

  // ──────────────────────────────────────────────
  //  EMPLOYER TRANSACTIONS
  // ──────────────────────────────────────────────
  employerTransactions: async (
    _,
    {
      search = "",
      sortBy = "name-a-z",
      statusIn = null,
      freelancerIn = null,
      jobIn = null,
      milestoneIn = null,
      paymentBucketIn = null,
      page = 1,
      limit = 25,
    },
    context,
  ) => {
    const employerId = requireEmployer(context);

    const safeLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
    const safePage = Math.max(1, Number(page) || 1);
    const safeSkip = (safePage - 1) * safeLimit;

    const cleanSearch = String(search || "").trim();
    const searchRegex = cleanSearch
      ? new RegExp(cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : null;

    const normalizeArray = (input) =>
      Array.isArray(input)
        ? input.map((value) => String(value || "").trim()).filter(Boolean)
        : [];

    const cleanStatusIn = normalizeArray(statusIn);
    const cleanFreelancerIn = normalizeArray(freelancerIn);
    const cleanJobIn = normalizeArray(jobIn);
    const cleanMilestoneIn = normalizeArray(milestoneIn);
    const cleanPaymentBucketIn = normalizeArray(paymentBucketIn);

    const sortMap = {
      "name-a-z": { freelancerName: 1, _id: 1 },
      "name-z-a": { freelancerName: -1, _id: -1 },
      "budget-high-low": { totalBudget: -1, _id: -1 },
      "budget-low-high": { totalBudget: 1, _id: 1 },
    };
    const dbSort = sortMap[sortBy] || sortMap["name-a-z"];

    const pipeline = [
      {
        $match: {
          employerId,
          "assignedFreelancer.freelancerId": { $ne: null },
          "assignedFreelancer.status": { $in: ["working", "finished"] },
        },
      },
      {
        $project: {
          _id: 1,
          jobId: 1,
          title: 1,
          budget: { $ifNull: ["$budget", 0] },
          milestones: { $ifNull: ["$milestones", []] },
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
                name: 1,
                email: 1,
                picture: 1,
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
          paidAmount: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$milestones",
                    as: "m",
                    cond: { $eq: ["$$m.status", "paid"] },
                  },
                },
                as: "pm",
                in: { $toDouble: { $ifNull: ["$$pm.payment", 0] } },
              },
            },
          },
          milestonesCount: { $size: "$milestones" },
          completedMilestones: {
            $size: {
              $filter: {
                input: "$milestones",
                as: "m",
                cond: { $eq: ["$$m.status", "paid"] },
              },
            },
          },
          pendingRequests: {
            $size: {
              $filter: {
                input: "$milestones",
                as: "m",
                cond: {
                  $and: [
                    { $eq: ["$$m.requested", true] },
                    { $ne: ["$$m.status", "paid"] },
                  ],
                },
              },
            },
          },
          freelancerName: { $ifNull: ["$freelancerUser.name", "Unknown"] },
          freelancerEmail: { $ifNull: ["$freelancerUser.email", ""] },
          freelancerPicture: { $ifNull: ["$freelancerUser.picture", ""] },
          totalBudget: { $toDouble: { $ifNull: ["$budget", 0] } },
          status: "$assignedFreelancer.status",
          startDate: "$assignedFreelancer.startDate",
          endDate: "$assignedFreelancer.endDate",
        },
      },
      {
        $addFields: {
          paymentPercentage: {
            $cond: [
              { $gt: ["$totalBudget", 0] },
              {
                $round: [
                  {
                    $multiply: [{ $divide: ["$paidAmount", "$totalBudget"] }, 100],
                  },
                  0,
                ],
              },
              0,
            ],
          },
          projectCompletion: {
            $cond: [
              { $gt: ["$milestonesCount", 0] },
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: ["$completedMilestones", "$milestonesCount"] },
                      100,
                    ],
                  },
                  0,
                ],
              },
              0,
            ],
          },
          milestoneLabel: {
            $concat: [
              { $toString: "$completedMilestones" },
              "/",
              { $toString: "$milestonesCount" },
            ],
          },
        },
      },
      {
        $addFields: {
          paymentBucket: {
            $switch: {
              branches: [
                { case: { $lt: ["$paymentPercentage", 25] }, then: "Less than 25%" },
                { case: { $lt: ["$paymentPercentage", 50] }, then: "25-50%" },
                { case: { $lt: ["$paymentPercentage", 75] }, then: "50-75%" },
              ],
              default: "75-100%",
            },
          },
        },
      },
    ];

    const matchStage = {};
    if (searchRegex) {
      matchStage.$or = [{ freelancerName: searchRegex }, { title: searchRegex }];
    }
    if (cleanStatusIn.length) matchStage.status = { $in: cleanStatusIn };
    if (cleanFreelancerIn.length) matchStage.freelancerName = { $in: cleanFreelancerIn };
    if (cleanJobIn.length) matchStage.title = { $in: cleanJobIn };
    if (cleanMilestoneIn.length) matchStage.milestoneLabel = { $in: cleanMilestoneIn };
    if (cleanPaymentBucketIn.length) matchStage.paymentBucket = { $in: cleanPaymentBucketIn };
    if (Object.keys(matchStage).length) pipeline.push({ $match: matchStage });

    const [result] = await JobListing.aggregate([
      ...pipeline,
      {
        $facet: {
          rows: [
            { $sort: dbSort },
            { $skip: safeSkip },
            { $limit: safeLimit },
            {
              $project: {
                _id: 0,
                jobId: 1,
                jobTitle: "$title",
                freelancerId: "$assignedFreelancer.freelancerId",
                freelancerName: 1,
                freelancerPicture: 1,
                freelancerEmail: 1,
                status: 1,
                startDate: 1,
                endDate: 1,
                totalBudget: 1,
                paidAmount: 1,
                paymentPercentage: 1,
                projectCompletion: 1,
                milestonesCount: 1,
                completedMilestones: 1,
                pendingRequests: 1,
              },
            },
          ],
          count: [{ $count: "total" }],
          filterFreelancers: [{ $group: { _id: "$freelancerName" } }],
          filterJobs: [{ $group: { _id: "$title" } }],
          filterStatuses: [{ $group: { _id: "$status" } }],
          filterMilestones: [{ $group: { _id: "$milestoneLabel" } }],
          filterBuckets: [{ $group: { _id: "$paymentBucket" } }],
          summary: [
            {
              $group: {
                _id: null,
                totalProjects: { $sum: 1 },
                totalBudget: { $sum: "$totalBudget" },
                totalPaid: { $sum: "$paidAmount" },
                activeProjects: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "working"] }, 1, 0],
                  },
                },
                completedProjects: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "finished"] }, 1, 0],
                  },
                },
              },
            },
          ],
        },
      },
    ]);

    const data = result?.rows || [];
    const total = result?.count?.[0]?.total || 0;
    const totalPages = Math.ceil(total / safeLimit) || 1;
    const toSorted = (items) =>
      (items || [])
        .map((entry) => entry?._id)
        .filter(Boolean)
        .sort((a, b) => String(a).localeCompare(String(b)));
    const summary = result?.summary?.[0] || {
      totalProjects: 0,
      totalBudget: 0,
      totalPaid: 0,
      activeProjects: 0,
      completedProjects: 0,
    };

    return {
      data,
      total,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPrevPage: safePage > 1,
      },
      filterOptions: {
        freelancers: toSorted(result?.filterFreelancers),
        jobs: toSorted(result?.filterJobs),
        statuses: toSorted(result?.filterStatuses),
        milestones: toSorted(result?.filterMilestones),
        paymentBuckets: toSorted(result?.filterBuckets),
      },
      summary,
    };
  },

  // ──────────────────────────────────────────────
  //  EMPLOYER TRANSACTION DETAIL
  // ──────────────────────────────────────────────
  employerTransactionDetail: async (_, { jobId }, context) => {
    const employerId = requireEmployer(context);

    // Find the job
    const job = await JobListing.findOne({
      jobId,
      employerId,
    }).lean();

    if (!job) {
      throw new Error("Job not found");
    }

    if (!job.assignedFreelancer || !job.assignedFreelancer.freelancerId) {
      throw new Error("No freelancer assigned to this job");
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
    const paymentPercentage = totalBudget > 0 ? Math.round((paidAmount / totalBudget) * 100) : 0;

    // Calculate project completion
    const completedMilestones = milestones.filter((m) => m.status === "paid").length;
    const projectCompletion = milestones.length > 0
        ? Math.round((completedMilestones / milestones.length) * 100)
        : 0;

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
      milestones: milestones.map((m, index) => ({
        milestoneId: m.milestoneId,
        sno: index + 1,
        description: m.description,
        payment: parseFloat(m.payment) || 0,
        deadline: m.deadline,
        status: m.status,
        requested: m.requested || false,
      })),
    };
  },

  // ──────────────────────────────────────────────
  //  EMPLOYER APPLICATIONS
  // ──────────────────────────────────────────────
  employerApplications: async (
    _,
    {
      status = "all",
      sort = "premium_oldest",
      limit = 25,
      offset = 0,
      page = null,
      search = "",
      freelancerIn = null,
      jobIn = null,
      statusIn = null,
      ratingIn = null,
    },
    context,
  ) => {
    const employerId = requireEmployer(context);

    const boundedLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
    const safePage = Number.isFinite(Number(page)) && Number(page) > 0
      ? Number(page)
      : Math.floor(Math.max(0, Number(offset) || 0) / boundedLimit) + 1;
    const safeOffset = (safePage - 1) * boundedLimit;
    const searchText = String(search || "").trim();
    const searchRegex = searchText
      ? new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : null;
    const cleanFreelancerIn = Array.isArray(freelancerIn)
      ? freelancerIn.map((value) => String(value)).filter(Boolean)
      : [];
    const cleanJobIn = Array.isArray(jobIn)
      ? jobIn.map((value) => String(value)).filter(Boolean)
      : [];
    const cleanStatusIn = Array.isArray(statusIn)
      ? statusIn.map((value) => String(value)).filter(Boolean)
      : [];
    const cleanRatingIn = Array.isArray(ratingIn)
      ? ratingIn.map((value) => Number(value)).filter((value) => Number.isFinite(value))
      : [];

    const jobs = await JobListing.find({ employerId })
      .select("jobId title")
      .lean();
    const jobIds = jobs.map((job) => job.jobId);

    if (!jobIds.length) {
      return {
        applications: [],
        stats: {
          total: 0,
          pending: 0,
          accepted: 0,
          rejected: 0,
        },
        total: 0,
        hasMore: false,
        filterOptions: {
          freelancers: [],
          jobs: [],
          statuses: [],
          ratings: [],
        },
        pagination: {
          page: safePage,
          limit: boundedLimit,
          total: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: safePage > 1,
        },
      };
    }

    const matchQuery = { jobId: { $in: jobIds } };
    if (status && status !== "all") {
      matchQuery.status = status;
    }
    if (cleanStatusIn.length) {
      matchQuery.status = { $in: cleanStatusIn };
    }

    const sortStage =
      sort === "newest"
        ? { appliedDate: -1, _id: -1 }
        : sort === "oldest"
        ? { appliedDate: 1, _id: 1 }
        : sort === "name_asc"
        ? { freelancerName: 1, _id: 1 }
        : sort === "name_desc"
        ? { freelancerName: -1, _id: -1 }
        : sort === "rating_desc"
        ? { skillRating: -1, _id: -1 }
        : sort === "rating_asc"
        ? { skillRating: 1, _id: 1 }
        : { isPremium: -1, appliedDate: 1, _id: 1 };

    const pipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: "users",
          localField: "freelancerId",
          foreignField: "roleId",
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
        $lookup: {
          from: "job_listings",
          localField: "jobId",
          foreignField: "jobId",
          as: "job",
        },
      },
      {
        $unwind: {
          path: "$job",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          freelancerName: "$freelancerUser.name",
          freelancerEmail: "$freelancerUser.email",
          freelancerPhone: "$freelancerUser.phone",
          freelancerPicture: "$freelancerUser.picture",
          freelancerUserId: "$freelancerUser.userId",
          skillRating: { $ifNull: ["$freelancerUser.rating", 0] },
          isPremium: { $eq: ["$freelancerUser.subscription", "Premium"] },
          jobTitle: "$job.title",
        },
      },
      ...(searchRegex
        ? [
            {
              $match: {
                $or: [
                  { freelancerName: searchRegex },
                  { freelancerEmail: searchRegex },
                  { jobTitle: searchRegex },
                ],
              },
            },
          ]
        : []),
      ...(cleanFreelancerIn.length
        ? [{ $match: { freelancerName: { $in: cleanFreelancerIn } } }]
        : []),
      ...(cleanJobIn.length
        ? [{ $match: { jobTitle: { $in: cleanJobIn } } }]
        : []),
      ...(cleanRatingIn.length
        ? [{ $match: { skillRating: { $in: cleanRatingIn } } }]
        : []),
    ];

    const [facet] = await JobApplication.aggregate([
      ...pipeline,
      {
        $facet: {
          rows: [
            { $sort: sortStage },
            { $skip: safeOffset },
            { $limit: boundedLimit },
            {
              $project: {
                _id: 0,
                applicationId: 1,
                jobId: 1,
                freelancerId: 1,
                status: 1,
                appliedDate: { $ifNull: ["$appliedDate", "$createdAt"] },
                coverMessage: 1,
                resumeLink: 1,
                freelancerUserId: 1,
                freelancerName: { $ifNull: ["$freelancerName", "Unknown Freelancer"] },
                freelancerPicture: "$freelancerPicture",
                freelancerEmail: "$freelancerEmail",
                freelancerPhone: "$freelancerPhone",
                skillRating: 1,
                jobTitle: { $ifNull: ["$jobTitle", "Unknown Job"] },
                isPremium: 1,
              },
            },
          ],
          total: [{ $count: "count" }],
          stats: [
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
              },
            },
          ],
          filterOptions: [
            {
              $group: {
                _id: null,
                freelancers: { $addToSet: "$freelancerName" },
                jobs: { $addToSet: "$jobTitle" },
                statuses: { $addToSet: "$status" },
                ratings: { $addToSet: "$skillRating" },
              },
            },
          ],
        },
      },
    ]);

    const rows = facet?.rows || [];
    const total = facet?.total?.[0]?.count || 0;
    const statsMap = Object.fromEntries((facet?.stats || []).map((row) => [row._id, row.count]));
    const totalPages = Math.ceil(total / boundedLimit) || 1;
    const optionBucket = facet?.filterOptions?.[0] || {};

    return {
      applications: rows,
      stats: {
        total,
        pending: statsMap.Pending || 0,
        accepted: statsMap.Accepted || 0,
        rejected: statsMap.Rejected || 0,
      },
      total,
      hasMore: safeOffset + rows.length < total,
      filterOptions: {
        freelancers: (optionBucket.freelancers || []).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b))),
        jobs: (optionBucket.jobs || []).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b))),
        statuses: (optionBucket.statuses || []).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b))),
        ratings: (optionBucket.ratings || []).map((value) => Number(value)).filter((value) => Number.isFinite(value)).sort((a, b) => a - b),
      },
      pagination: {
        page: safePage,
        limit: boundedLimit,
        total,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPrevPage: safePage > 1,
      },
    };
  },
  // ──────────────────────────────────────────────
  //  EMPLOYER JOB LISTINGS (replaces REST /api/employer/job-listings)
  // ──────────────────────────────────────────────
  employerJobListings: async (
    _,
    {
      search = "",
      searchFeature = "all",
      jobType = "All Jobs",
      sortBy = "newest-posted",
      page = 1,
      limit = 25,
    },
    context,
  ) => {
    const employerId = requireEmployer(context);

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
      baseQuery.jobType = {
        $regex: new RegExp(
          String(jobType).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "i",
        ),
      };
    }

    if (searchRegex) {
      const searchConditions = [];
      if (searchFeature === "jobRole") {
        searchConditions.push({ title: searchRegex });
      } else if (searchFeature === "skills") {
        searchConditions.push({
          "description.skills": { $elemMatch: { $regex: searchRegex } },
        });
      } else if (searchFeature === "location") {
        searchConditions.push({ location: searchRegex });
      } else {
        searchConditions.push({ title: searchRegex });
        searchConditions.push({ location: searchRegex });
        searchConditions.push({
          "description.skills": { $elemMatch: { $regex: searchRegex } },
        });
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

    const listings = jobListings.map((job) => ({
      jobId: job.jobId,
      title: job.title,
      budget: job.budget,
      location: job.location,
      jobType: job.jobType,
      experienceLevel: job.experienceLevel,
      imageUrl: job.imageUrl,
      applicationDeadline: job.applicationDeadline,
      postedDate: job.postedDate,
      remote: job.remote,
      isBoosted: job.isBoosted,
      applicationCount: applicationCountMap[job.jobId] || 0,
      applicationCap: job.applicationCap,
      status: job.status,
      description: job.description,
    }));

    const totalPages = Math.ceil(total / safeLimit) || 1;

    return {
      listings,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPrevPage: safePage > 1,
      },
    };
  },

  // ──────────────────────────────────────────────
  //  EMPLOYER CURRENT FREELANCERS (replaces REST /api/employer/current-freelancers)
  // ──────────────────────────────────────────────
  employerCurrentFreelancers: async (
    _,
    {
      search = "",
      sortBy = "rating-high-low",
      page = 1,
      limit = 25,
      nameIn = null,
      jobRoleIn = null,
    },
    context,
  ) => {
    const employerId = requireEmployer(context);

    const safeLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
    const safePage = Math.max(1, Number(page) || 1);
    const safeSkip = (safePage - 1) * safeLimit;
    const searchText = String(search || "").trim();
    const searchRegex = searchText
      ? new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : null;

    const cleanNameIn = Array.isArray(nameIn)
      ? nameIn.map((v) => String(v || "").trim()).filter(Boolean)
      : [];
    const cleanJobRoleIn = Array.isArray(jobRoleIn)
      ? jobRoleIn.map((v) => String(v || "").trim()).filter(Boolean)
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
          filterNames: [{ $group: { _id: "$freelancerUser.name" } }],
          filterRoles: [{ $group: { _id: "$title" } }],
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

    return {
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
    };
  },

  // ──────────────────────────────────────────────
  //  EMPLOYER WORK HISTORY (replaces REST /api/employer/work-history)
  // ──────────────────────────────────────────────
  employerWorkHistory: async (
    _,
    {
      search = "",
      searchFeature = "all",
      sortBy = "date-desc",
      page = 1,
      limit = 25,
      statusIn = null,
    },
    context,
  ) => {
    const employerId = requireEmployer(context);

    const safeLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
    const safePage = Math.max(1, Number(page) || 1);
    const safeSkip = (safePage - 1) * safeLimit;
    const searchText = String(search || "").trim();
    const searchRegex = searchText
      ? new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : null;

    const cleanStatuses = Array.isArray(statusIn)
      ? statusIn.map((v) => String(v || "").trim()).filter(Boolean)
      : [];

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

    return {
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
    };
  },
};

module.exports = employerResolvers;

