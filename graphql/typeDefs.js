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

  # ── Admin Dashboard Types ────────────────────────

  type AdminUserCounts {
    total: Int
    freelancers: Int
    employers: Int
    moderators: Int
    admins: Int
    premium: Int
    basic: Int
  }

  type AdminJobCounts {
    total: Int
    active: Int
    completed: Int
    closed: Int
  }

  type AdminApplicationCounts {
    total: Int
    pending: Int
    accepted: Int
    rejected: Int
  }

  type AdminComplaintCounts {
    total: Int
    pending: Int
    resolved: Int
  }

  type AdminRevenueCounts {
    total: Float
    totalBudget: Float
    paidMilestones: Int
  }

  type AdminQuizCounts {
    total: Int
    attempts: Int
  }

  type AdminBlogCounts {
    total: Int
  }

  type AdminFeedbackCounts {
    total: Int
    avgRating: Float
  }

  type AdminDashboardOverview {
    users: AdminUserCounts
    jobs: AdminJobCounts
    applications: AdminApplicationCounts
    complaints: AdminComplaintCounts
    revenue: AdminRevenueCounts
    quizzes: AdminQuizCounts
    blogs: AdminBlogCounts
    feedback: AdminFeedbackCounts
  }

  # ── Admin Dashboard Revenue Types ──────────────

  type AdminMonthlyRevenue {
    label: String
    year: Int
    month: Int
    subscriptionRevenue: Float
    platformFeeRevenue: Float
    totalRevenue: Float
    jobsPosted: Int
  }

  type AdminRevenueTotals {
    totalRevenue: Float
    subscriptionRevenue: Float
    platformFees: Float
    thisMonthRevenue: Float
    revenueGrowth: Float
  }

  type AdminEngagement {
    jobCompletionRate: Int
    hireRate: Int
    activeUsers: Int
    totalUsers: Int
    premiumUsers: Int
    conversionRate: Float
    recentJobs: Int
    recentApplications: Int
    avgJobsPerMonth: Int
  }

  type AdminPlatformFeeJob {
    jobId: String
    title: String
    budget: Float
    durationDays: Int
    applicantCount: Int
    feeRate: Float
    feeAmount: Float
    postedDate: String
    status: String
    employerName: String
    companyName: String
  }

  type AdminFeeTier {
    range: String
    modifier: String
    label: String
  }

  type AdminFeeTiers {
    platform: [AdminFeeTier]
    applicationCap: [AdminFeeTier]
  }

  type AdminFeeStructure {
    baseRate: Int
    description: String
    range: String
    tiers: AdminFeeTiers
  }

  type AdminDashboardRevenue {
    monthlyRevenue: [AdminMonthlyRevenue]
    totals: AdminRevenueTotals
    engagement: AdminEngagement
    recentPlatformFees: [AdminPlatformFeeJob]
    feeStructure: AdminFeeStructure
  }

  # ── Admin Payments Types ───────────────────────

  type AdminPayment {
    jobId: String
    jobTitle: String
    milestoneId: String
    milestoneDescription: String
    amount: Float
    status: String
    employerName: String
    companyName: String
    freelancerName: String
    date: String
  }

  type AdminPaymentsResult {
    payments: [AdminPayment]
    total: Int
  }

  # ── Admin Users Types ──────────────────────────

  type AdminUser {
    userId: String
    name: String
    email: String
    role: String
    subscription: String
    picture: String
    location: String
    rating: Float
    createdAt: String
    subscriptionDuration: Int
    subscriptionExpiryDate: String
    roleId: String
    profilePath: String
  }

  type AdminUsersResult {
    users: [AdminUser]
    total: Int
  }

  # ── Admin Freelancers Types ────────────────────

  type AdminFreelancerSummary {
    freelancerId: String
    userId: String
    name: String
    email: String
    phone: String
    picture: String
    location: String
    rating: Float
    skills: Int
    subscription: String
    isPremium: Boolean
    subscriptionDuration: Int
    subscriptionExpiryDate: String
    applicationsCount: Int
    isCurrentlyWorking: Boolean
    joinedDate: String
  }

  type AdminFreelancersResult {
    freelancers: [AdminFreelancerSummary]
    total: Int
  }

  type AdminFreelancerApplication {
    applicationId: String
    jobTitle: String
    companyName: String
    employerName: String
    budget: Float
    status: String
    appliedDate: String
  }

  type AdminFreelancerDetail {
    freelancerId: String
    userId: String
    name: String
    email: String
    phone: String
    picture: String
    location: String
    aboutMe: String
    rating: Float
    subscription: String
    subscriptionDuration: Int
    subscriptionExpiryDate: String
    joinedDate: String
    skills: [String]
    experience: [String]
    education: [String]
    portfolio: [String]
    resume: String
    isCurrentlyWorking: Boolean
    currentJobTitle: String
    applicationsCount: Int
    acceptedCount: Int
    rejectedCount: Int
    pendingCount: Int
    recentApplications: [AdminFreelancerApplication]
  }

  # ── Admin Employers Types ──────────────────────

  type AdminEmployerSummary {
    employerId: String
    userId: String
    name: String
    email: String
    phone: String
    picture: String
    location: String
    companyName: String
    rating: Float
    subscription: String
    isPremium: Boolean
    subscriptionDuration: Int
    subscriptionExpiryDate: String
    jobListingsCount: Int
    hiredCount: Int
    currentHires: Int
    pastHires: Int
    joinedDate: String
  }

  type AdminEmployersResult {
    employers: [AdminEmployerSummary]
    total: Int
  }

  type AdminEmployerJob {
    jobId: String
    title: String
    budget: Float
    status: String
    jobType: String
    experienceLevel: String
    location: String
    postedDate: String
    applicationDeadline: String
    applicantsCount: Int
    hasAssignedFreelancer: Boolean
  }

  type AdminEmployerFreelancer {
    freelancerId: String
    name: String
    email: String
    picture: String
    rating: Float
    startDate: String
  }

  type AdminEmployerDetail {
    employerId: String
    userId: String
    name: String
    email: String
    phone: String
    picture: String
    location: String
    aboutMe: String
    companyName: String
    websiteLink: String
    rating: Float
    subscription: String
    subscriptionDuration: Int
    subscriptionExpiryDate: String
    joinedDate: String
    jobListingsCount: Int
    currentHiresCount: Int
    pastHiresCount: Int
    jobs: [AdminEmployerJob]
    currentFreelancers: [AdminEmployerFreelancer]
    pastFreelancers: [AdminEmployerFreelancer]
  }

  # ── Admin Statistics Types ─────────────────────

  type AggBucket {
    key: String
    count: Int
  }

  type AggBucketFloat {
    key: String
    avgBudget: Float
    maxBudget: Float
    minBudget: Float
  }

  type SubscriptionDistBucket {
    role: String
    subscription: String
    count: Int
  }

  type TopRatedUser {
    userId: String
    name: String
    email: String
    rating: Float
    picture: String
    subscription: String
  }

  type UserGrowthBucket {
    year: Int
    month: Int
    count: Int
  }

  type AdminStatistics {
    userGrowth: [UserGrowthBucket]
    jobsByStatus: [AggBucket]
    jobsByType: [AggBucket]
    jobsByExperience: [AggBucket]
    applicationsByStatus: [AggBucket]
    complaintsByStatus: [AggBucket]
    complaintsByType: [AggBucket]
    complaintsByPriority: [AggBucket]
    topFreelancers: [TopRatedUser]
    topEmployers: [TopRatedUser]
    avgBudgetByType: [AggBucketFloat]
    subscriptionDist: [SubscriptionDistBucket]
    recentSignups: Int
    newJobsThisMonth: Int
  }

  # ── Admin Activities Types ─────────────────────

  type AdminActivity {
    type: String
    title: String
    time: String
    icon: String
  }

  type BlogContentSection {
    heading: String
    description: String
  }

  # --- EMPLOYER DOMAIN TYPES ---

  type EmployerDashboardStats {
    activeJobs: Int
    currentFreelancers: Int
  }

  type EmployerMilestone {
    milestoneId: String
    sno: Int
    description: String
    payment: Float
    deadline: String
    status: String
    requested: Boolean
  }

  type EmployerTransactionRecord {
    jobId: String
    jobTitle: String
    freelancerId: String
    freelancerName: String
    freelancerPicture: String
    freelancerEmail: String
    status: String
    startDate: String
    endDate: String
    totalBudget: Float
    paidAmount: Float
    paymentPercentage: Int
    projectCompletion: Int
    milestonesCount: Int
    completedMilestones: Int
    pendingRequests: Int
  }

  type EmployerTransactionsResult {
    data: [EmployerTransactionRecord]
  }

  type EmployerTransactionDetail {
    jobId: String
    jobTitle: String
    freelancerId: String
    freelancerName: String
    freelancerPicture: String
    freelancerEmail: String
    status: String
    startDate: String
    endDate: String
    totalBudget: Float
    paidAmount: Float
    paymentPercentage: Int
    projectCompletion: Int
    milestones: [EmployerMilestone]
  }

  type EmployerApplication {
    applicationId: String
    jobId: String
    freelancerId: String
    status: String
    appliedDate: String
    coverMessage: String
    resumeLink: String
    freelancerUserId: String
    freelancerName: String
    freelancerPicture: String
    freelancerEmail: String
    freelancerPhone: String
    skillRating: Float
    jobTitle: String
    isPremium: Boolean
  }

  type EmployerApplicationsStats {
    total: Int
    pending: Int
    accepted: Int
    rejected: Int
  }

  type EmployerApplicationsResult {
    applications: [EmployerApplication]
    stats: EmployerApplicationsStats
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

    # Employer dashboard queries
    employerTransactions: EmployerTransactionsResult
    employerTransactionDetail(jobId: String!): EmployerTransactionDetail
    employerDashboardStats: EmployerDashboardStats
    employerApplications(status: String, sort: String, limit: Int, offset: Int): EmployerApplicationsResult
    
    # Admin dashboard queries (replaces over-fetching REST endpoints)
    adminDashboardOverview: AdminDashboardOverview
    adminDashboardRevenue: AdminDashboardRevenue
    adminPayments: AdminPaymentsResult
    adminUsers: AdminUsersResult
    adminFreelancers: AdminFreelancersResult
    adminFreelancerDetail(freelancerId: String!): AdminFreelancerDetail
    adminEmployers: AdminEmployersResult
    adminEmployerDetail(employerId: String!): AdminEmployerDetail
    adminStatistics: AdminStatistics
    adminActivities: [AdminActivity]
    # Public blog detail (replaces /api/blogs/:id + latest + featured)
    publicBlogDetail(blogId: String!): PublicBlogDetail
  }
`;

module.exports = typeDefs;
