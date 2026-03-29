// Apollo Server v4 uses plain strings for typeDefs — no gql tag needed
const typeDefs = `#graphql
  type User {
    userId: String
    name: String
    email: String
    picture: String
    role: String
    rating: Float
    location: String
    aboutMe: String
    subscription: String
  }

  type Employer {
    employerId: String
    userId: String
    companyName: String
    websiteLink: String
    logo: String
  }

  type Milestone {
    milestoneId: String
    description: String
    deadline: String
    payment: String
    status: String
    requested: Boolean
    completionPercentage: Float
    subTasks: [SubTask]
  }

  type SubTask {
    subTaskId: String
    description: String
    status: String
    completedDate: String
    notes: String
  }

  type AssignedFreelancer {
    freelancerId: String
    startDate: String
    endDate: String
    status: String
    employerRating: Float
    employerReview: String
    rated: Boolean
  }

  type JobDescription {
    text: String
    responsibilities: [String]
    requirements: [String]
    skills: [String]
  }

  type JobListing {
    jobId: String
    employerId: String
    title: String
    budget: Float
    location: String
    jobType: String
    experienceLevel: String
    imageUrl: String
    applicationDeadline: String
    description: JobDescription
    milestones: [Milestone]
    status: String
    assignedFreelancer: AssignedFreelancer
    applicants: Int
    # Resolved via DataLoader
    employer: Employer
    employerUser: User
  }

  type FromUser {
    name: String
    picture: String
    role: String
  }

  type Feedback {
    _id: String
    feedbackId: String
    jobId: String
    fromUserId: String
    toUserId: String
    toRole: String
    rating: Int
    comment: String
    tags: [String]
    anonymous: Boolean
    createdAt: String
    # Resolved via DataLoader
    fromUser: FromUser
    jobTitle: String
  }

  type FeedbackConnection {
    feedbacks: [Feedback]
    total: Int
    page: Int
    limit: Int
  }

  type FeedbackStats {
    totalFeedbacks: Int
    averageRating: Float
    ratingDistribution: RatingDistribution
  }

  type RatingDistribution {
    one: Int
    two: Int
    three: Int
    four: Int
    five: Int
  }

  type Badge {
    _id: String
    title: String
    skillName: String
    description: String
    icon: String
    criteria: BadgeCriteria
    createdAt: String
  }

  type BadgeCriteria {
    type: String
    quizId: String
    minPercentage: Float
  }

  type UserBadge {
    badge: Badge
    awardedAt: String
  }

  # Freelancer active jobs - formatted like the REST response
  type ActiveJob {
    id: String
    title: String
    company: String
    logo: String
    deadline: String
    price: String
    totalBudget: Float
    paidAmount: Float
    progress: Int
    tech: [String]
    employerUserId: String
    description: String
    milestones: [Milestone]
    milestonesCount: Int
    completedMilestones: Int
    daysSinceStart: Int
    startDate: String
    startDateRaw: String
  }

  type HistoryJob {
    id: String
    _id: String
    title: String
    company: String
    logo: String
    status: String
    tech: [String]
    employerUserId: String
    date: String
    price: String
    paidAmount: Float
    totalBudget: Float
    rating: Float
    startDate: String
    startDateRaw: String
    endDateRaw: String
    daysSinceStart: Int
    description: String
    milestones: [Milestone]
    milestonesCount: Int
    completedMilestones: Int
    progress: Int
    cancelReason: String
  }

  type Application {
    applicationId: String
    jobId: String
    jobTitle: String
    company: String
    logo: String
    appliedDate: String
    status: String
    coverMessage: String
    resumeLink: String
    budget: Float
    location: String
    jobType: String
    skillsRequired: [String]
    experienceLevel: String
  }

  type ApplicationsResult {
    applications: [Application]
    stats: ApplicationStats
  }

  type ApplicationStats {
    total: Int
    pending: Int
    accepted: Int
    rejected: Int
  }

  type PublicJobBudget {
    amount: Float
    period: String
  }

  type PublicJobDescription {
    skills: [String]
  }

  type PublicJob {
    jobId: String
    employerId: String
    title: String
    imageUrl: String
    budget: PublicJobBudget
    location: String
    jobType: String
    experienceLevel: String
    remote: Boolean
    postedDate: String
    description: PublicJobDescription
    applicationCount: Int
    applicationCap: Int
    isSponsored: Boolean
    isBoosted: Boolean
    tier: Int
  }

  type BlogContentSection {
    heading: String
    description: String
  }

  type PublicBlog {
    blogId: String
    slug: String
    title: String
    tagline: String
    category: String
    imageUrl: String
    author: String
    content: [BlogContentSection]
    readTime: Int
    featured: Boolean
    status: String
    views: Int
    likes: Int
    createdAt: String
  }

  type PublicBlogDetail {
    blog: PublicBlog
    recentBlogs: [PublicBlog]
    featuredBlog: PublicBlog
  }

  type Query {
    # Feedback queries (replaces N+1 REST endpoints)
    feedbacksForJob(jobId: String!): [Feedback]
    feedbacksForUser(userId: String!, page: Int, limit: Int): FeedbackConnection
    publicFeedbacksForUser(userId: String!, page: Int, limit: Int): FeedbackConnection
    feedbackStats(userId: String!): FeedbackStats
    publicFeedbackStats(userId: String!): FeedbackStats

    # Quiz badges (replaces .populate() endpoint)
    userBadges(userId: String!): [UserBadge]

    # Freelancer queries (replaces per-job Employer lookups)
    freelancerActiveJobs: [ActiveJob]
    freelancerJobHistory: [HistoryJob]
    freelancerApplications: ApplicationsResult

    # Public jobs (replaces /api/jobs/api)
    publicJobs: [PublicJob]

    # Public blog detail (replaces /api/blogs/:id + latest + featured)
    publicBlogDetail(blogId: String!): PublicBlogDetail
  }
`;

module.exports = typeDefs;
