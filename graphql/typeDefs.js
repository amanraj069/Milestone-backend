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
    total: Int
    filterOptions: ApplicationsFilterOptions
    pagination: OffsetPagination
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

  type EmployerApplicationsResult {
    applications: [EmployerApplication]
    stats: ApplicationStats
    total: Int
    hasMore: Boolean
    filterOptions: EmployerApplicationsFilterOptions
    pagination: OffsetPagination
  }

  type ActiveJobsResult {
    jobs: [ActiveJob]
    total: Int
    pagination: OffsetPagination
  }

  type HistoryJobsFilterOptions {
    statuses: [String]
    employers: [String]
    jobTitles: [String]
  }

  type HistoryJobsResult {
    jobs: [HistoryJob]
    total: Int
    filterOptions: HistoryJobsFilterOptions
    pagination: OffsetPagination
  }

  type ChatConversation {
    conversationId: String!
    participant: ChatParticipant!
    lastMessage: LastMessage
    unreadCount: Int!
    updatedAt: String
  }

  type ChatParticipant {
    userId: String!
    name: String
    picture: String
    role: String
  }

  type LastMessage {
    messageId: String
    text: String
    sender: String
    timestamp: String
  }

  type ChatMessage {
    messageId: String!
    conversationId: String!
    from: String!
    to: String!
    messageData: String!
    isRead: Boolean!
    createdAt: String
    updatedAt: String
  }

  type MessageResult {
    conversationId: String
    messages: [ChatMessage!]!
    total: Int!
    hasMore: Boolean!
  }

  type ApplicationStats {
    total: Int
    pending: Int
    accepted: Int
    rejected: Int
  }

  type OffsetPagination {
    page: Int
    limit: Int
    total: Int
    totalPages: Int
    hasNextPage: Boolean
    hasPrevPage: Boolean
  }

  type ApplicationsFilterOptions {
    statuses: [String]
    jobTypes: [String]
  }

  type EmployerApplicationsFilterOptions {
    freelancers: [String]
    jobs: [String]
    statuses: [String]
    ratings: [Float]
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

  type AdminPlatformFeeEdge {
    node: AdminPlatformFeeJob
    cursor: String
  }

  type AdminPlatformFeePageInfo {
    hasNextPage: Boolean
    endCursor: String
  }

  type AdminPlatformFeeConnection {
    edges: [AdminPlatformFeeEdge]
    pageInfo: AdminPlatformFeePageInfo
    total: Int
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

  type AdminPaymentsSummary {
    totalTransactions: Int
    paidTotal: Float
    pendingTotal: Float
    inProgressTotal: Float
    paidCount: Int
    pendingCount: Int
    inProgressCount: Int
  }

  type AdminPaymentsFilterOptions {
    jobs: [String]
    milestones: [String]
    employers: [String]
    freelancers: [String]
    statuses: [String]
  }

  type AdminPaymentsMeta {
    summary: AdminPaymentsSummary
    filterOptions: AdminPaymentsFilterOptions
  }

  type AdminPaymentsEdge {
    node: AdminPayment
    cursor: String
  }

  type AdminPaymentsPageInfo {
    hasNextPage: Boolean
    endCursor: String
  }

  type AdminPaymentsConnection {
    edges: [AdminPaymentsEdge]
    pageInfo: AdminPaymentsPageInfo
    total: Int
    summary: AdminPaymentsSummary
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

  type AdminUsersEdge {
    node: AdminUser
    cursor: String
  }

  type AdminUsersPageInfo {
    hasNextPage: Boolean
    endCursor: String
  }

  type AdminUsersConnection {
    edges: [AdminUsersEdge]
    pageInfo: AdminUsersPageInfo
    total: Int
  }

  type AdminUsersSummary {
    total: Int
    freelancers: Int
    employers: Int
    moderators: Int
    admins: Int
  }

  type AdminUsersFilterOptions {
    roles: [String]
    subscriptions: [String]
    locations: [String]
    ratings: [Float]
  }

  type AdminUsersMeta {
    summary: AdminUsersSummary
    filterOptions: AdminUsersFilterOptions
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

  type AdminFreelancersEdge {
    node: AdminFreelancerSummary
    cursor: String
  }

  type AdminFreelancersPageInfo {
    hasNextPage: Boolean
    endCursor: String
  }

  type AdminFreelancersConnection {
    edges: [AdminFreelancersEdge]
    pageInfo: AdminFreelancersPageInfo
    total: Int
  }

  type AdminFreelancersSummary {
    total: Int
    working: Int
    premium: Int
  }

  type AdminFreelancersFilterOptions {
    locations: [String]
    ratings: [Float]
    subscriptions: [String]
    statuses: [String]
  }

  type AdminFreelancersMeta {
    summary: AdminFreelancersSummary
    filterOptions: AdminFreelancersFilterOptions
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

  type AdminEmployersEdge {
    node: AdminEmployerSummary
    cursor: String
  }

  type AdminEmployersPageInfo {
    hasNextPage: Boolean
    endCursor: String
  }

  type AdminEmployersConnection {
    edges: [AdminEmployersEdge]
    pageInfo: AdminEmployersPageInfo
    total: Int
  }

  type AdminEmployersSummary {
    total: Int
    premium: Int
    totalJobListings: Int
  }

  type AdminEmployersFilterOptions {
    companies: [String]
    locations: [String]
    ratings: [Float]
    subscriptions: [String]
  }

  type AdminEmployersMeta {
    summary: AdminEmployersSummary
    filterOptions: AdminEmployersFilterOptions
  }

  type AdminModeratorSummary {
    moderatorId: String
    userId: String
    name: String
    email: String
    picture: String
    location: String
    joinedDate: String
    complaintsResolved: Int
    totalComplaints: Int
    blogsCreated: Int
  }

  type AdminModeratorsEdge {
    node: AdminModeratorSummary
    cursor: String
  }

  type AdminModeratorsPageInfo {
    hasNextPage: Boolean
    endCursor: String
  }

  type AdminModeratorsConnection {
    edges: [AdminModeratorsEdge]
    pageInfo: AdminModeratorsPageInfo
    total: Int
  }

  type AdminModeratorsSummary {
    total: Int
    complaintsResolved: Int
    totalComplaints: Int
    blogsCreated: Int
  }

  type AdminModeratorsFilterOptions {
    locations: [String]
  }

  type AdminModeratorsMeta {
    summary: AdminModeratorsSummary
    filterOptions: AdminModeratorsFilterOptions
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

  # --- EMPLOYER JOB LISTINGS ---

  type EmployerJobListing {
    jobId: String
    title: String
    budget: Float
    location: String
    jobType: String
    experienceLevel: String
    imageUrl: String
    applicationDeadline: String
    postedDate: String
    remote: Boolean
    isBoosted: Boolean
    applicationCount: Int
    applicationCap: Int
    status: String
    description: JobDescription
  }

  type EmployerJobListingsResult {
    listings: [EmployerJobListing]
    pagination: OffsetPagination
  }

  # --- EMPLOYER CURRENT FREELANCERS ---

  type EmployerCurrentFreelancer {
    freelancerId: String
    userId: String
    name: String
    email: String
    phone: String
    picture: String
    rating: Float
    jobId: String
    jobTitle: String
    jobDescription: String
    startDate: String
    daysSinceStart: Int
    hasRated: Boolean
    employerRating: Float
  }

  type EmployerCurrentFreelancersStats {
    total: Int
    avgRating: Float
    avgDays: Int
    successRate: Int
  }

  type EmployerCurrentFreelancersFilterOptions {
    names: [String]
    jobRoles: [String]
  }

  type EmployerCurrentFreelancersResult {
    freelancers: [EmployerCurrentFreelancer]
    stats: EmployerCurrentFreelancersStats
    pagination: OffsetPagination
    filterOptions: EmployerCurrentFreelancersFilterOptions
  }

  # --- EMPLOYER WORK HISTORY ---

  type EmployerWorkHistoryFreelancer {
    userId: String
    freelancerId: String
    name: String
    email: String
    phone: String
    location: String
    picture: String
    rating: Float
    jobId: String
    jobTitle: String
    jobDescription: String
    startDate: String
    endDate: String
    completedDate: String
    status: String
  }

  type EmployerWorkHistoryStats {
    total: Int
    avgRating: Float
    avgDays: Int
    successRate: Int
  }

  type EmployerWorkHistoryFilterOptions {
    statuses: [String]
  }

  type EmployerWorkHistoryResult {
    freelancers: [EmployerWorkHistoryFreelancer]
    stats: EmployerWorkHistoryStats
    pagination: OffsetPagination
    filterOptions: EmployerWorkHistoryFilterOptions
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

  type EmployerTransactionsFilterOptions {
    freelancers: [String]
    jobs: [String]
    statuses: [String]
    milestones: [String]
    paymentBuckets: [String]
  }

  type EmployerTransactionsSummary {
    totalProjects: Int
    totalBudget: Float
    totalPaid: Float
    activeProjects: Int
    completedProjects: Int
  }

  type EmployerTransactionsResult {
    data: [EmployerTransactionRecord]
    total: Int
    pagination: OffsetPagination
    filterOptions: EmployerTransactionsFilterOptions
    summary: EmployerTransactionsSummary
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

  type PortfolioItem {
    title: String
    description: String
    image: String
    link: String
  }

  type FeedbackReview {
    feedbackId: String
    fromUserId: String
    fromUserName: String
    fromUserPicture: String
    rating: Int
    comment: String
    tags: [String]
    createdAt: String
  }

  type JobDescriptionDetail {
    text: String
    responsibilities: [String]
    requirements: [String]
    skills: [String]
  }

  type JobMatchSignals {
    matchScore: Int
    matchedSkills: [String]
    missingSkills: [String]
    hasPortfolio: Boolean
    hasResume: Boolean
    feedbackCount: Int
    averageFeedbackRating: Float
  }

  type EmployerApplicationDetail {
    applicationId: String
    jobId: String
    freelancerId: String
    freelancerUserId: String
    status: String
    appliedDate: String
    coverMessage: String
    resumeLink: String
    freelancerName: String
    freelancerPicture: String
    freelancerEmail: String
    freelancerPhone: String
    freelancerRating: Float
    skillRating: Float
    isPremium: Boolean
    freelancerAbout: String
    freelancerSkills: [String]
    freelancerPortfolio: [PortfolioItem]
    jobTitle: String
    jobDescription: JobDescriptionDetail
    feedbackReviews: [FeedbackReview]
    feedbackTotal: Int
    jobMatch: JobMatchSignals
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

  # ── Moderator GraphQL Types ─────────────────

  type ModeratorBlogsNode {
    blogId: String
    slug: String
    title: String
    tagline: String
    category: String
    imageUrl: String
    author: String
    readTime: Int
    status: String
    featured: Boolean
    createdAt: String
    formattedCreatedAt: String
    readTimeDisplay: String
  }

  type ModeratorBlogsEdge {
    node: ModeratorBlogsNode
    cursor: String
  }

  type ModeratorBlogsPageInfo {
    hasNextPage: Boolean
    endCursor: String
  }

  type ModeratorBlogsConnection {
    edges: [ModeratorBlogsEdge]
    pageInfo: ModeratorBlogsPageInfo
    total: Int
  }

  type ModeratorBlogsSummary {
    totalBlogs: Int
    publishedBlogs: Int
    featuredBlogs: Int
  }

  type ModeratorBlogsFilterOptions {
    categories: [String]
    featured: [String]
  }

  type ModeratorBlogsMeta {
    summary: ModeratorBlogsSummary
    filterOptions: ModeratorBlogsFilterOptions
  }

  type QuestionOption {
    text: String
    isCorrect: Boolean
  }

  type Question {
    _id: String
    text: String
    marks: Float
    options: [QuestionOption]
    hasCode: Boolean
    codeSnippet: String
    codeLanguage: String
  }

  type ModeratorQuizzesNode {
    _id: String
    title: String
    skillName: String
    passingScore: Int
    createdAt: String
    questionCount: Int
    questions: [Question]
  }

  type ModeratorQuizzesEdge {
    node: ModeratorQuizzesNode
    cursor: String
  }

  type ModeratorQuizzesPageInfo {
    hasNextPage: Boolean
    endCursor: String
  }

  type ModeratorQuizzesConnection {
    edges: [ModeratorQuizzesEdge]
    pageInfo: ModeratorQuizzesPageInfo
    total: Int
  }

  type ModeratorQuizzesSummary {
    totalQuizzes: Int
    totalQuestions: Int
    avgPassingScore: Int
  }

  type ModeratorQuizzesFilterOptions {
    skills: [String]
  }

  type ModeratorQuizzesMeta {
    summary: ModeratorQuizzesSummary
    filterOptions: ModeratorQuizzesFilterOptions
  }

  type ModeratorQuizAttemptNode {
    attemptId: String
    freelancerName: String
    email: String
    marksObtained: Float
    totalMarks: Float
    percentage: Float
    passed: Boolean
    badgeAwarded: Boolean
    attemptedAt: String
  }

  type ModeratorQuizAttemptsEdge {
    node: ModeratorQuizAttemptNode
    cursor: String
  }

  type ModeratorQuizAttemptsPageInfo {
    hasNextPage: Boolean
    endCursor: String
  }

  type ModeratorQuizAttemptsConnection {
    edges: [ModeratorQuizAttemptsEdge]
    pageInfo: ModeratorQuizAttemptsPageInfo
    total: Int
    quizTitle: String
    skillName: String
    passingScore: Int
    passedAttempts: Int
  }

  type ModeratorFreelancersNode {
    freelancerId: String
    userId: String
    name: String
    email: String
    phone: String
    picture: String
    location: String
    rating: Float
    skills: Int
    portfolioCount: Int
    joinedDate: String
    subscription: String
    isPremium: Boolean
    subscriptionDuration: Int
    subscriptionExpiryDate: String
    applicationsCount: Int
    isCurrentlyWorking: Boolean
  }

  type ModeratorFreelancersEdge {
    node: ModeratorFreelancersNode
    cursor: String
  }

  type ModeratorFreelancersPageInfo {
    hasNextPage: Boolean
    endCursor: String
  }

  type ModeratorFreelancersConnection {
    edges: [ModeratorFreelancersEdge]
    pageInfo: ModeratorFreelancersPageInfo
    total: Int
  }

  type ModeratorFreelancersFilterOptions {
    names: [String]
    emails: [String]
    phones: [String]
    ratings: [Float]
    subscribed: [String]
    durations: [Int]
  }

  type ModeratorFreelancersMeta {
    filterOptions: ModeratorFreelancersFilterOptions
  }

  type ModeratorEmployersNode {
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

  type ModeratorEmployersEdge {
    node: ModeratorEmployersNode
    cursor: String
  }

  type ModeratorEmployersPageInfo {
    hasNextPage: Boolean
    endCursor: String
  }

  type ModeratorEmployersConnection {
    edges: [ModeratorEmployersEdge]
    pageInfo: ModeratorEmployersPageInfo
    total: Int
  }

  type ModeratorEmployersFilterOptions {
    names: [String]
    companies: [String]
    emails: [String]
    phones: [String]
    ratings: [Float]
    subscribed: [String]
    durations: [Int]
  }

  type ModeratorEmployersMeta {
    filterOptions: ModeratorEmployersFilterOptions
  }

  type ModeratorJobListingsNode {
    jobId: String
    title: String
    companyName: String
    budget: Float
    location: String
    jobType: String
    experienceLevel: String
    status: String
    applicationDeadline: String
    descriptionText: String
    skillsRequired: [String]
    applicantsCount: Int
    createdAt: String
  }

  type ModeratorJobListingsEdge {
    node: ModeratorJobListingsNode
    cursor: String
  }

  type ModeratorJobListingsPageInfo {
    hasNextPage: Boolean
    endCursor: String
  }

  type ModeratorJobListingsConnection {
    edges: [ModeratorJobListingsEdge]
    pageInfo: ModeratorJobListingsPageInfo
    total: Int
  }

  type ModeratorJobListingsFilterOptions {
    titles: [String]
    companies: [String]
    types: [String]
    statuses: [String]
  }

  type ModeratorJobListingsMeta {
    filterOptions: ModeratorJobListingsFilterOptions
  }

  type ModeratorCompanyDetails {
    companyName: String
    companyPAN: String
    accountsPayableEmail: String
    officialBusinessEmail: String
    taxIdentificationNumber: String
    billingAddress: String
    proofOfAddressUrl: String
    companyLogoUrl: String
    isSubmitted: Boolean
    submittedAt: String
  }

  type ModeratorApprovalsNode {
    userId: String
    name: String
    email: String
    phone: String
    picture: String
    location: String
    companyName: String
    approvalStatus: String
    isApproved: Boolean
    isRejected: Boolean
    registeredAt: String
    companyDetails: ModeratorCompanyDetails
  }

  type ModeratorApprovalsEdge {
    node: ModeratorApprovalsNode
    cursor: String
  }

  type ModeratorApprovalsPageInfo {
    hasNextPage: Boolean
    endCursor: String
  }

  type ModeratorApprovalsConnection {
    edges: [ModeratorApprovalsEdge]
    pageInfo: ModeratorApprovalsPageInfo
    total: Int
  }

  type ModeratorApprovalsFilterOptions {
    names: [String]
    emails: [String]
    companies: [String]
    locations: [String]
    statuses: [String]
  }

  type ModeratorApprovalsMeta {
    filterOptions: ModeratorApprovalsFilterOptions
  }

  type ModeratorComplaintsNode {
    complaintId: String
    complainantType: String
    complainantId: String
    complainantName: String
    complainantUserId: String
    freelancerId: String
    freelancerName: String
    freelancerUserId: String
    freelancerRating: Float
    freelancerEmail: String
    employerId: String
    employerName: String
    employerUserId: String
    employerRating: Float
    employerEmail: String
    jobId: String
    jobTitle: String
    complaintType: String
    priority: String
    subject: String
    status: String
    createdAt: String
    updatedAt: String
    resolvedAt: String
  }

  type ModeratorComplaintsEdge {
    node: ModeratorComplaintsNode
    cursor: String
  }

  type ModeratorComplaintsPageInfo {
    hasNextPage: Boolean
    endCursor: String
  }

  type ModeratorComplaintsConnection {
    edges: [ModeratorComplaintsEdge]
    pageInfo: ModeratorComplaintsPageInfo
    total: Int
  }

  type ModeratorComplaintsSummary {
    total: Int
    pending: Int
    underReview: Int
    resolved: Int
    rejected: Int
  }

  type ModeratorComplaintsFilterOptions {
    complainantTypes: [String]
    against: [String]
    jobs: [String]
    statuses: [String]
    priorities: [String]
    types: [String]
  }

  type ModeratorComplaintsMeta {
    summary: ModeratorComplaintsSummary
    filterOptions: ModeratorComplaintsFilterOptions
  }

  type ModeratorActionResult {
    success: Boolean
    message: String
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

    # Chat queries
    chatConversations(limit: Int = 20, offset: Int = 0): [ChatConversation!]!
    messagesWithUser(userId: String!, limit: Int = 50, offset: Int = 0): MessageResult!

    # Freelancer queries (replaces per-job Employer lookups)
    freelancerActiveJobs(
      search: String
      sortBy: String
      page: Int = 1
      limit: Int = 25
    ): ActiveJobsResult
    freelancerJobHistory(
      search: String
      sortBy: String
      statusIn: [String]
      employerIn: [String]
      jobTitleIn: [String]
      page: Int = 1
      limit: Int = 25
    ): HistoryJobsResult
    freelancerApplications(
      search: String
      sortBy: String
      statusIn: [String]
      jobTypeIn: [String]
      page: Int = 1
      limit: Int = 25
    ): ApplicationsResult
    employerApplications(
      status: String
      sort: String
      limit: Int
      offset: Int
      page: Int
      search: String
      freelancerIn: [String]
      jobIn: [String]
      statusIn: [String]
      ratingIn: [Float]
    ): EmployerApplicationsResult

    # Employer job listings (replaces REST /api/employer/job-listings)
    employerJobListings(
      search: String
      searchFeature: String
      jobType: String
      sortBy: String
      page: Int = 1
      limit: Int = 25
    ): EmployerJobListingsResult

    # Employer current freelancers (replaces REST /api/employer/current-freelancers)
    employerCurrentFreelancers(
      search: String
      sortBy: String
      page: Int = 1
      limit: Int = 25
      nameIn: [String]
      jobRoleIn: [String]
    ): EmployerCurrentFreelancersResult

    # Employer work history (replaces REST /api/employer/work-history)
    employerWorkHistory(
      search: String
      searchFeature: String
      sortBy: String
      page: Int = 1
      limit: Int = 25
      statusIn: [String]
    ): EmployerWorkHistoryResult

    # Employer dashboard queries
    employerTransactions(
      search: String
      sortBy: String
      statusIn: [String]
      freelancerIn: [String]
      jobIn: [String]
      milestoneIn: [String]
      paymentBucketIn: [String]
      page: Int = 1
      limit: Int = 25
    ): EmployerTransactionsResult
    employerTransactionDetail(jobId: String!): EmployerTransactionDetail
    employerDashboardStats: EmployerDashboardStats
    employerApplicationDetail(applicationId: String!): EmployerApplicationDetail
    
    # Admin dashboard queries (replaces over-fetching REST endpoints)
    adminDashboardOverview: AdminDashboardOverview
    adminDashboardRevenue: AdminDashboardRevenue
    adminPlatformFeeCollections(first: Int = 10, after: String): AdminPlatformFeeConnection
    adminPayments(
      first: Int = 25
      after: String
      search: String
      jobTitleIn: [String]
      milestoneIn: [String]
      employerIn: [String]
      freelancerIn: [String]
      statusIn: [String]
      sortBy: String
      sortOrder: String
    ): AdminPaymentsConnection
    adminPaymentsMeta: AdminPaymentsMeta
    adminUsers(
      first: Int = 25
      after: String
      search: String
      roleIn: [String]
      subscriptionIn: [String]
      locationIn: [String]
      ratingIn: [Float]
      sortBy: String
      sortOrder: String
    ): AdminUsersConnection
    adminUsersMeta: AdminUsersMeta
    adminFreelancers(
      first: Int = 25
      after: String
      search: String
      locationIn: [String]
      ratingIn: [Float]
      subscriptionIn: [String]
      statusIn: [String]
      sortBy: String
      sortOrder: String
    ): AdminFreelancersConnection
    adminFreelancersMeta: AdminFreelancersMeta
    adminFreelancerDetail(freelancerId: String!): AdminFreelancerDetail
    adminEmployers(
      first: Int = 25
      after: String
      search: String
      companyIn: [String]
      locationIn: [String]
      ratingIn: [Float]
      subscriptionIn: [String]
      sortBy: String
      sortOrder: String
    ): AdminEmployersConnection
    adminEmployersMeta: AdminEmployersMeta
    adminModerators(
      first: Int = 25
      after: String
      search: String
      locationIn: [String]
      sortBy: String
      sortOrder: String
    ): AdminModeratorsConnection
    adminModeratorsMeta: AdminModeratorsMeta
    moderatorBlogs(
      first: Int = 25
      after: String
      page: Int
      search: String
      searchBy: String
      categoryIn: [String]
      featuredIn: [String]
      sortBy: String
      sortOrder: String
    ): ModeratorBlogsConnection
    moderatorBlogsMeta: ModeratorBlogsMeta
    moderatorQuizzes(
      first: Int = 25
      after: String
      page: Int
      search: String
      sortBy: String
    ): ModeratorQuizzesConnection
    moderatorQuizzesMeta: ModeratorQuizzesMeta
    moderatorQuizAttempts(
      quizId: String!
      first: Int = 20
      after: String
      page: Int
    ): ModeratorQuizAttemptsConnection
    moderatorFreelancers(
      first: Int = 25
      after: String
      page: Int
      search: String
      sortBy: String
      nameIn: [String]
      emailIn: [String]
      phoneIn: [String]
      ratingIn: [String]
      subscribedIn: [String]
      durationIn: [String]
    ): ModeratorFreelancersConnection
    moderatorFreelancersMeta: ModeratorFreelancersMeta
    moderatorEmployers(
      first: Int = 25
      after: String
      page: Int
      search: String
      sortBy: String
      nameIn: [String]
      companyIn: [String]
      emailIn: [String]
      phoneIn: [String]
      ratingIn: [String]
      subscribedIn: [String]
      durationIn: [String]
    ): ModeratorEmployersConnection
    moderatorEmployersMeta: ModeratorEmployersMeta
    moderatorJobListings(
      first: Int = 25
      after: String
      page: Int
      search: String
      sortBy: String
      titleIn: [String]
      companyIn: [String]
      typeIn: [String]
      statusIn: [String]
    ): ModeratorJobListingsConnection
    moderatorJobListingsMeta: ModeratorJobListingsMeta
    moderatorApprovals(
      first: Int = 25
      after: String
      page: Int
      status: String
      search: String
      sortBy: String
      sortOrder: String
      nameIn: [String]
      emailIn: [String]
      companyIn: [String]
      locationIn: [String]
      statusIn: [String]
    ): ModeratorApprovalsConnection
    moderatorApprovalsMeta: ModeratorApprovalsMeta
    moderatorComplaints(
      first: Int = 25
      after: String
      page: Int
      search: String
      sortBy: String
      sortOrder: String
      complainantTypeIn: [String]
      againstIn: [String]
      jobIn: [String]
      statusIn: [String]
      priorityIn: [String]
      typeIn: [String]
    ): ModeratorComplaintsConnection
    moderatorComplaintsMeta: ModeratorComplaintsMeta
    adminEmployerDetail(employerId: String!): AdminEmployerDetail
    adminStatistics: AdminStatistics
    adminActivities: [AdminActivity]
    # Public blog detail (replaces /api/blogs/:id + latest + featured)
    publicBlogDetail(blogId: String!): PublicBlogDetail
  }

  type Mutation {
    moderatorDeleteBlog(blogId: String!): ModeratorActionResult
  }
`;

module.exports = typeDefs;
