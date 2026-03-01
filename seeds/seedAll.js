/**
 * Master Seed Script
 * Seeds: Users, Admins, Moderators, Freelancers, Employers, Job Listings,
 *        Job Applications, Quizzes, Attempts, Badges, Feedback, Subscriptions,
 *        Complaints, RatingAudits
 *
 * Usage:  node seeds/seedAll.js          (seeds everything)
 *         node seeds/seedAll.js --clean   (drops collections first, then seeds)
 */

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv");

dotenv.config();

//   Models
const User = require("../models/user");
const Admin = require("../models/admin");
const Moderator = require("../models/moderator");
const Freelancer = require("../models/freelancer");
const Employer = require("../models/employer");
const JobListing = require("../models/job_listing");
const JobApplication = require("../models/job_application");
const Quiz = require("../models/Quiz");
const Badge = require("../models/Badge");
const Attempt = require("../models/Attempt");
const Feedback = require("../models/Feedback");
const Subscription = require("../models/subscription");
const Complaint = require("../models/complaint");
const RatingAudit = require("../models/RatingAudit");

//   Helpers
const SALT = 10;
const hash = (pw) => bcrypt.hashSync(pw, SALT);
const days = (n) => new Date(Date.now() + n * 86400000);
const pastDays = (n) => new Date(Date.now() - n * 86400000);

// deterministic UUIDs so relations stay consistent across runs
const ids = {
  // Admin
  adminUser: uuidv4(),
  admin: uuidv4(),

  // Moderator
  modUser: uuidv4(),
  mod: uuidv4(),

  // Freelancers (5)
  flUser1: uuidv4(), fl1: uuidv4(),
  flUser2: uuidv4(), fl2: uuidv4(),
  flUser3: uuidv4(), fl3: uuidv4(),
  flUser4: uuidv4(), fl4: uuidv4(),
  flUser5: uuidv4(), fl5: uuidv4(),

  // Employers (3)
  empUser1: uuidv4(), emp1: uuidv4(),
  empUser2: uuidv4(), emp2: uuidv4(),
  empUser3: uuidv4(), emp3: uuidv4(),

  // Jobs (10)
  job1: uuidv4(), job2: uuidv4(), job3: uuidv4(), job4: uuidv4(), job5: uuidv4(),
  job6: uuidv4(), job7: uuidv4(), job8: uuidv4(), job9: uuidv4(), job10: uuidv4(),

  // Complaints
  complaint1: uuidv4(),
  complaint2: uuidv4(),
  complaint3: uuidv4(),
  complaint4: uuidv4(),
  complaint5: uuidv4(),
  complaint6: uuidv4(),
};

//   USERS
const users = [
  // Admin
  {
    userId: ids.adminUser, name: "Vaibhav Admin", email: "admin@milestone.com",
    password: hash("Admin@123"), phone: "9876543210", isVerified: true,
    role: "Admin", roleId: ids.admin, rating: 5,
    picture: "https://randomuser.me/api/portraits/men/1.jpg",
    location: "New Delhi, India",
    aboutMe: "Platform administrator at Milestone. Managing the freelancing ecosystem.",
    subscription: "Premium",
  },
  // Moderator
  {
    userId: ids.modUser, name: "Vaibhav Moderator", email: "moderator@milestone.com",
    password: hash("Mod@123"), phone: "9876543230", isVerified: true,
    role: "Moderator", roleId: ids.mod, rating: 5,
    picture: "https://randomuser.me/api/portraits/men/2.jpg",
    location: "New Delhi, India",
    aboutMe: "Platform moderator at Milestone. Reviewing complaints and maintaining community standards.",
    subscription: "Premium",
  },
  // Freelancers
  {
    userId: ids.flUser1, name: "Arjun Sharma", email: "arjun@milestone.com",
    password: hash("Test@123"), phone: "9876543211", isVerified: true,
    role: "Freelancer", roleId: ids.fl1, rating: 4.8,
    calculatedRating: 4.8,
    picture: "https://randomuser.me/api/portraits/men/10.jpg",
    location: "Bangalore, India",
    aboutMe: "Full-stack developer with 4 years of experience in React and Node.js. Passionate about building scalable web applications.",
    socialMedia: { linkedin: "https://linkedin.com/in/arjunsharma", twitter: "https://twitter.com/arjundev", facebook: "", instagram: "" },
  },
  {
    userId: ids.flUser2, name: "Priya Patel", email: "priya@milestone.com",
    password: hash("Test@123"), phone: "9876543212", isVerified: true,
    role: "Freelancer", roleId: ids.fl2, rating: 4.5,
    calculatedRating: 4.5,
    picture: "https://randomuser.me/api/portraits/women/12.jpg",
    location: "Mumbai, India",
    aboutMe: "UI/UX designer specializing in mobile-first design systems. Previously worked at Flipkart and Swiggy.",
    socialMedia: { linkedin: "https://linkedin.com/in/priyapatel", twitter: "", facebook: "", instagram: "https://instagram.com/priyaDesigns" },
  },
  {
    userId: ids.flUser3, name: "Rahul Verma", email: "rahul@milestone.com",
    password: hash("Test@123"), phone: "9876543213", isVerified: true,
    role: "Freelancer", roleId: ids.fl3, rating: 4.2,
    calculatedRating: 4.2,
    picture: "https://randomuser.me/api/portraits/men/15.jpg",
    location: "Hyderabad, India",
    aboutMe: "Backend engineer focused on Python, Django, and cloud infrastructure. AWS certified.",
    socialMedia: { linkedin: "https://linkedin.com/in/rahulverma", twitter: "", facebook: "", instagram: "" },
  },
  {
    // Sneha: has MODERATOR OVERRIDE active (penalized from 4.9 to 3.5)
    userId: ids.flUser4, name: "Sneha Gupta", email: "sneha@milestone.com",
    password: hash("Test@123"), phone: "9876543214", isVerified: true,
    role: "Freelancer", roleId: ids.fl4,
    rating: 3.5,
    calculatedRating: 4.9,
    moderatorRating: 3.5,
    useModeratorRating: true,
    moderatorAdjustmentReason: "Repeated missed deadlines reported by multiple employers. Complaint #4 and #5 confirmed scope violations and lack of communication.",
    adjustedBy: ids.modUser,
    adjustedAt: pastDays(5),
    picture: "https://randomuser.me/api/portraits/women/20.jpg",
    location: "Pune, India",
    aboutMe: "Data scientist and ML engineer. Kaggle expert. Love turning data into actionable insights.",
    socialMedia: { linkedin: "https://linkedin.com/in/snehagupta", twitter: "https://twitter.com/snehaML", facebook: "", instagram: "" },
  },
  {
    // Karan: has MODERATOR OVERRIDE active (penalized from 3.9 to 2.9)
    userId: ids.flUser5, name: "Karan Singh", email: "karan@milestone.com",
    password: hash("Test@123"), phone: "9876543215", isVerified: true,
    role: "Freelancer", roleId: ids.fl5,
    rating: 2.9,
    calculatedRating: 3.9,
    moderatorRating: 2.9,
    useModeratorRating: true,
    moderatorAdjustmentReason: "Plagiarized code found in deliverable for mobile app project. Employer filed harassment complaint that was verified by moderator.",
    adjustedBy: ids.modUser,
    adjustedAt: pastDays(3),
    picture: "https://randomuser.me/api/portraits/men/25.jpg",
    location: "Chennai, India",
    aboutMe: "Mobile app developer (React Native, Flutter). Built 15+ apps on Play Store. Open source contributor.",
    socialMedia: { linkedin: "https://linkedin.com/in/karansingh", twitter: "", facebook: "", instagram: "" },
  },
  // Employers
  {
    userId: ids.empUser1, name: "TechCorp India", email: "techcorp@milestone.com",
    password: hash("Test@123"), phone: "9876543220", isVerified: true,
    role: "Employer", roleId: ids.emp1, rating: 4.7,
    calculatedRating: 4.7,
    picture: "https://logo.clearbit.com/infosys.com",
    location: "Bangalore, India",
    aboutMe: "Leading IT services company hiring top freelance talent for enterprise projects.",
  },
  {
    // DesignHub: has MODERATOR OVERRIDE (bonus from 4.3 to 4.5)
    userId: ids.empUser2, name: "DesignHub Studio", email: "designhub@milestone.com",
    password: hash("Test@123"), phone: "9876543221", isVerified: true,
    role: "Employer", roleId: ids.emp2,
    rating: 4.5,
    calculatedRating: 4.3,
    moderatorRating: 4.5,
    useModeratorRating: true,
    moderatorAdjustmentReason: "Employer consistently provides excellent working conditions and timely payments. Bonus applied after positive moderator review of multiple completed projects.",
    adjustedBy: ids.modUser,
    adjustedAt: pastDays(10),
    picture: "https://logo.clearbit.com/dribbble.com",
    location: "Mumbai, India",
    aboutMe: "Boutique design agency working with startups and Fortune 500 companies.",
  },
  {
    userId: ids.empUser3, name: "DataDriven Labs", email: "datadrivenlabs@milestone.com",
    password: hash("Test@123"), phone: "9876543222", isVerified: true,
    role: "Employer", roleId: ids.emp3, rating: 4.6,
    calculatedRating: 4.6,
    picture: "https://logo.clearbit.com/datadog.com",
    location: "Hyderabad, India",
    aboutMe: "AI/ML startup building next-gen analytics products. Always looking for skilled data professionals.",
  },
];

//   ADMIN
const admins = [
  { adminId: ids.admin, userId: ids.adminUser },
];

//   MODERATOR
const moderators = [
  { moderatorId: ids.mod, userId: ids.modUser },
];

//   FREELANCERS
const freelancers = [
  {
    freelancerId: ids.fl1, userId: ids.flUser1,
    skills: ["JavaScript", "React", "Node.js", "MongoDB", "TypeScript", "Express", "GraphQL"],
    experience: [
      { title: "Senior Frontend Developer", date: "2023 - Present", description: "Building enterprise React dashboards at a fintech startup." },
      { title: "Full Stack Developer", date: "2021 - 2023", description: "Developed microservices with Node.js and deployed to AWS." },
    ],
    education: [
      { degree: "B.Tech Computer Science", institution: "IIT Bangalore", date: "2017 - 2021" },
    ],
    portfolio: [
      { title: "E-Commerce Platform", description: "Built a full-stack e-commerce platform with React, Node.js and Stripe payments.", image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400", link: "https://github.com/arjun/ecommerce" },
      { title: "Real-Time Chat App", description: "Socket.io based chat application with video calling.", image: "https://images.unsplash.com/photo-1611746872915-64382b5c76da?w=400", link: "https://github.com/arjun/chatapp" },
    ],
  },
  {
    freelancerId: ids.fl2, userId: ids.flUser2,
    skills: ["UI/UX Design", "Figma", "Adobe XD", "CSS", "Tailwind CSS", "Framer"],
    experience: [
      { title: "Senior UI/UX Designer", date: "2022 - Present", description: "Leading design for a SaaS product with 50K+ users." },
      { title: "Product Designer at Flipkart", date: "2019 - 2022", description: "Redesigned checkout flow improving conversion by 23%." },
    ],
    education: [
      { degree: "B.Des Communication Design", institution: "NID Ahmedabad", date: "2015 - 2019" },
    ],
    portfolio: [
      { title: "FinTech Dashboard Redesign", description: "Redesigned a banking dashboard improving usability scores by 40%.", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400", link: "https://dribbble.com/priya/fintech" },
      { title: "Mobile Health App", description: "End-to-end design for a telemedicine app.", image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400", link: "https://dribbble.com/priya/healthapp" },
    ],
  },
  {
    freelancerId: ids.fl3, userId: ids.flUser3,
    skills: ["Python", "Django", "AWS", "Docker", "PostgreSQL", "Redis", "Celery"],
    experience: [
      { title: "Backend Engineer", date: "2022 - Present", description: "Building distributed systems at a logistics startup." },
      { title: "Software Developer at TCS", date: "2020 - 2022", description: "Developed REST APIs handling 1M+ requests/day." },
    ],
    education: [
      { degree: "B.Tech Information Technology", institution: "IIIT Hyderabad", date: "2016 - 2020" },
    ],
    portfolio: [
      { title: "Logistics API Gateway", description: "High-throughput API gateway handling delivery tracking for 10K+ drivers.", image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400", link: "https://github.com/rahul/logistics-api" },
    ],
  },
  {
    freelancerId: ids.fl4, userId: ids.flUser4,
    skills: ["Python", "Machine Learning", "TensorFlow", "PyTorch", "Data Analysis", "SQL", "Tableau"],
    experience: [
      { title: "Data Scientist", date: "2023 - Present", description: "Building recommendation engines for an e-commerce platform." },
      { title: "ML Engineer at Analytics Vidhya", date: "2021 - 2023", description: "Developed NLP models for text classification." },
    ],
    education: [
      { degree: "M.Tech Data Science", institution: "IISc Bangalore", date: "2019 - 2021" },
      { degree: "B.Tech Computer Science", institution: "BITS Pilani", date: "2015 - 2019" },
    ],
    portfolio: [
      { title: "Sentiment Analysis Tool", description: "Real-time Twitter sentiment analysis using BERT transformers.", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400", link: "https://github.com/sneha/sentiment" },
      { title: "Sales Forecasting Model", description: "Time-series forecasting model achieving 94% accuracy for retail chain.", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400", link: "https://github.com/sneha/forecasting" },
    ],
  },
  {
    freelancerId: ids.fl5, userId: ids.flUser5,
    skills: ["React Native", "Flutter", "Dart", "Firebase", "iOS", "Android", "TypeScript"],
    experience: [
      { title: "Mobile App Developer", date: "2022 - Present", description: "Freelancing full time, built 8 apps in the last year." },
      { title: "Junior Developer at Zoho", date: "2020 - 2022", description: "Worked on Zoho CRM mobile app." },
    ],
    education: [
      { degree: "B.E. Computer Science", institution: "Anna University", date: "2016 - 2020" },
    ],
    portfolio: [
      { title: "Fitness Tracker App", description: "Cross-platform fitness app with 10K+ downloads.", image: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=400", link: "https://play.google.com/store/apps/details?id=com.karan.fitness" },
    ],
  },
];

//   EMPLOYERS
const employers = [
  {
    employerId: ids.emp1, userId: ids.empUser1,
    companyName: "TechCorp India Pvt Ltd",
    websiteLink: "https://techcorp.example.com",
    jobsPosted: [ids.job1, ids.job2, ids.job3, ids.job4],
    currentFreelancers: [
      { freelancerId: ids.fl1, jobId: ids.job1, startDate: pastDays(30) },
    ],
    previouslyWorkedFreelancers: [ids.fl3],
  },
  {
    employerId: ids.emp2, userId: ids.empUser2,
    companyName: "DesignHub Studio LLP",
    websiteLink: "https://designhub.example.com",
    jobsPosted: [ids.job5, ids.job6, ids.job7],
    currentFreelancers: [
      { freelancerId: ids.fl2, jobId: ids.job5, startDate: pastDays(15) },
    ],
    previouslyWorkedFreelancers: [],
  },
  {
    employerId: ids.emp3, userId: ids.empUser3,
    companyName: "DataDriven Labs Inc",
    websiteLink: "https://datadrivenlabs.example.com",
    jobsPosted: [ids.job8, ids.job9, ids.job10],
    currentFreelancers: [
      { freelancerId: ids.fl4, jobId: ids.job8, startDate: pastDays(20) },
    ],
    previouslyWorkedFreelancers: [ids.fl3],
  },
];

//   JOB LISTINGS (10 diverse jobs)
function makeMilestones(payments, offsets) {
  return payments.map((p, i) => ({
    milestoneId: uuidv4(),
    description: `Milestone ${i + 1}`,
    deadline: days(offsets[i]).toISOString(),
    payment: String(p),
    status: i === 0 ? "paid" : "not-paid",
    requested: i === 0,
    subTasks: [
      { subTaskId: uuidv4(), description: `Task ${i + 1}.1`, status: i === 0 ? "completed" : "pending" },
      { subTaskId: uuidv4(), description: `Task ${i + 1}.2`, status: "pending" },
    ],
    completionPercentage: i === 0 ? 50 : 0,
  }));
}

const jobListings = [
  //  TechCorp Jobs (emp1)
  {
    jobId: ids.job1, employerId: ids.emp1,
    title: "React Dashboard Development",
    imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
    budget: 150000, location: "Bangalore, India", jobType: "freelance", experienceLevel: "Mid", remote: true,
    applicationDeadline: days(30),
    description: {
      text: "Build an interactive analytics dashboard with React.js, Chart.js, and Material UI for our enterprise SaaS product.",
      responsibilities: ["Develop reusable chart components", "Integrate REST APIs for live data", "Implement role-based access control", "Write unit & integration tests"],
      requirements: ["3+ years React experience", "Experience with charting libraries", "Knowledge of responsive design"],
      skills: ["React", "JavaScript", "Chart.js", "Material UI", "REST APIs"],
    },
    milestones: makeMilestones([30000, 60000, 60000], [7, 18, 30]),
    status: "in-progress",
    applicants: 8,
    assignedFreelancer: { freelancerId: ids.fl1, startDate: pastDays(30), endDate: null, status: "working" },
  },
  {
    jobId: ids.job2, employerId: ids.emp1,
    title: "Node.js Microservices Architecture",
    imageUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80",
    budget: 250000, location: "Bangalore, India", jobType: "contract", experienceLevel: "Senior", remote: true,
    applicationDeadline: days(20),
    description: {
      text: "Design and implement microservices architecture for our payment processing system using Node.js, RabbitMQ, and Docker.",
      responsibilities: ["Design service boundaries", "Implement event-driven communication", "Set up CI/CD pipelines", "Create API documentation"],
      requirements: ["5+ years backend development", "Experience with message queues", "Docker & Kubernetes knowledge"],
      skills: ["Node.js", "Docker", "RabbitMQ", "MongoDB", "Kubernetes"],
    },
    milestones: makeMilestones([50000, 100000, 100000], [10, 25, 40]),
    status: "open", applicants: 12,
    assignedFreelancer: { freelancerId: null, startDate: null, endDate: null, status: null },
  },
  {
    jobId: ids.job3, employerId: ids.emp1,
    title: "Python API Performance Optimization",
    imageUrl: "https://images.unsplash.com/photo-1515879218367-8466d910auj7?w=800&q=80",
    budget: 80000, location: "Remote", jobType: "freelance", experienceLevel: "Mid", remote: true,
    applicationDeadline: days(10),
    description: {
      text: "Optimize existing Django REST APIs to handle 5x more traffic. Current APIs have high latency and need caching strategy.",
      responsibilities: ["Profile existing APIs", "Implement Redis caching", "Database query optimization", "Load testing"],
      requirements: ["3+ years Django experience", "Knowledge of caching strategies", "Database optimization skills"],
      skills: ["Python", "Django", "Redis", "PostgreSQL", "Performance Tuning"],
    },
    milestones: makeMilestones([20000, 30000, 30000], [5, 12, 18]),
    status: "open", applicants: 5,
    assignedFreelancer: { freelancerId: null, startDate: null, endDate: null, status: null },
  },
  {
    jobId: ids.job4, employerId: ids.emp1,
    title: "DevOps Infrastructure Setup",
    imageUrl: "https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=800&q=80",
    budget: 120000, location: "Bangalore, India", jobType: "contract", experienceLevel: "Senior", remote: false,
    applicationDeadline: days(15),
    description: {
      text: "Set up complete CI/CD pipeline with monitoring, logging, and auto-scaling on AWS for our microservices platform.",
      responsibilities: ["Configure AWS infrastructure", "Set up Terraform IaC", "Implement monitoring with Grafana", "Configure auto-scaling policies"],
      requirements: ["AWS Solutions Architect certified", "5+ years DevOps experience", "Terraform expertise"],
      skills: ["AWS", "Docker", "Terraform", "Grafana", "CI/CD"],
    },
    milestones: makeMilestones([30000, 50000, 40000], [7, 20, 30]),
    status: "open", applicants: 3,
    assignedFreelancer: { freelancerId: null, startDate: null, endDate: null, status: null },
  },

  //  DesignHub Jobs (emp2)
  {
    jobId: ids.job5, employerId: ids.emp2,
    title: "Mobile App UI/UX Redesign",
    imageUrl: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&q=80",
    budget: 100000, location: "Mumbai, India", jobType: "freelance", experienceLevel: "Mid", remote: true,
    applicationDeadline: days(25),
    description: {
      text: "Redesign our food delivery mobile app with modern UI patterns, micro-interactions, and improved user flows.",
      responsibilities: ["User research and persona mapping", "Wireframing and prototyping in Figma", "Create design system", "Handoff to development team"],
      requirements: ["3+ years mobile UI/UX", "Strong Figma portfolio", "Understanding of iOS & Android guidelines"],
      skills: ["Figma", "UI/UX Design", "Prototyping", "Design Systems", "Mobile Design"],
    },
    milestones: makeMilestones([25000, 40000, 35000], [8, 18, 25]),
    status: "in-progress", applicants: 15,
    assignedFreelancer: { freelancerId: ids.fl2, startDate: pastDays(15), endDate: null, status: "working" },
  },
  {
    jobId: ids.job6, employerId: ids.emp2,
    title: "Brand Identity & Logo Design",
    imageUrl: "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=800&q=80",
    budget: 60000, location: "Mumbai, India", jobType: "freelance", experienceLevel: "Entry", remote: true,
    applicationDeadline: days(12),
    description: {
      text: "Create complete brand identity package for a new wellness startup including logo, color palette, typography, and brand guidelines.",
      responsibilities: ["Research competitor branding", "Create 3 logo concepts", "Define color palette & typography", "Prepare brand guidelines document"],
      requirements: ["Portfolio with brand identity projects", "Proficiency in Adobe Illustrator", "Understanding of color theory"],
      skills: ["Adobe Illustrator", "Brand Design", "Typography", "Logo Design"],
    },
    milestones: makeMilestones([15000, 25000, 20000], [5, 10, 15]),
    status: "open", applicants: 20,
    assignedFreelancer: { freelancerId: null, startDate: null, endDate: null, status: null },
  },
  {
    jobId: ids.job7, employerId: ids.emp2,
    title: "WordPress Website Development",
    imageUrl: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&q=80",
    budget: 45000, location: "Remote", jobType: "freelance", experienceLevel: "Entry", remote: true,
    applicationDeadline: days(8),
    description: {
      text: "Build a portfolio website on WordPress with custom theme, blog section, and contact forms for a photography studio.",
      responsibilities: ["Custom WordPress theme development", "SEO optimization", "Mobile responsiveness", "Integration with Instagram feed"],
      requirements: ["WordPress development experience", "PHP knowledge", "SEO fundamentals"],
      skills: ["WordPress", "PHP", "CSS", "SEO", "JavaScript"],
    },
    milestones: makeMilestones([10000, 20000, 15000], [4, 10, 15]),
    status: "open", applicants: 7,
    assignedFreelancer: { freelancerId: null, startDate: null, endDate: null, status: null },
  },

  //  DataDriven Labs Jobs (emp3)
  {
    jobId: ids.job8, employerId: ids.emp3,
    title: "ML Model for Customer Churn Prediction",
    imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
    budget: 200000, location: "Hyderabad, India", jobType: "contract", experienceLevel: "Senior", remote: true,
    applicationDeadline: days(30),
    description: {
      text: "Build and deploy a machine learning model to predict customer churn for our telecom client with 10M+ subscriber base.",
      responsibilities: ["Data exploration and cleaning", "Feature engineering", "Model training and evaluation", "Deploy model as REST API", "Create monitoring dashboard"],
      requirements: ["5+ years ML experience", "Experience with large datasets", "Model deployment experience"],
      skills: ["Python", "Scikit-learn", "TensorFlow", "Pandas", "Docker", "AWS SageMaker"],
    },
    milestones: makeMilestones([40000, 80000, 80000], [10, 25, 40]),
    status: "in-progress", applicants: 6,
    assignedFreelancer: { freelancerId: ids.fl4, startDate: pastDays(20), endDate: null, status: "working" },
  },
  {
    jobId: ids.job9, employerId: ids.emp3,
    title: "Data Pipeline with Apache Airflow",
    imageUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80",
    budget: 180000, location: "Hyderabad, India", jobType: "contract", experienceLevel: "Senior", remote: true,
    applicationDeadline: days(20),
    description: {
      text: "Build automated data pipelines using Apache Airflow to process 500GB+ daily data from multiple sources into our data warehouse.",
      responsibilities: ["Design DAGs for ETL workflows", "Implement data quality checks", "Optimize Spark jobs", "Set up alerting on failures"],
      requirements: ["Apache Airflow experience", "Spark/PySpark knowledge", "Data warehouse design"],
      skills: ["Python", "Apache Airflow", "Spark", "SQL", "AWS Redshift"],
    },
    milestones: makeMilestones([40000, 70000, 70000], [10, 25, 35]),
    status: "open", applicants: 4,
    assignedFreelancer: { freelancerId: null, startDate: null, endDate: null, status: null },
  },
  {
    jobId: ids.job10, employerId: ids.emp3,
    title: "React Native Mobile Analytics App",
    imageUrl: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&q=80",
    budget: 130000, location: "Remote", jobType: "freelance", experienceLevel: "Mid", remote: true,
    applicationDeadline: days(18),
    description: {
      text: "Build a React Native app to display analytics dashboards for our data products. Should support offline mode and push notifications.",
      responsibilities: ["Develop cross-platform mobile app", "Implement offline data sync", "Push notification integration", "Chart and graph components"],
      requirements: ["3+ years React Native", "Experience with offline-first architecture", "Published apps on stores"],
      skills: ["React Native", "TypeScript", "Firebase", "Chart Libraries", "Redux"],
    },
    milestones: makeMilestones([25000, 55000, 50000], [7, 20, 30]),
    status: "open", applicants: 9,
    assignedFreelancer: { freelancerId: null, startDate: null, endDate: null, status: null },
  },
];

//   JOB APPLICATIONS (various freelancers applying to jobs)
const jobApplications = [
  // Arjun's applications
  { applicationId: uuidv4(), freelancerId: ids.fl1, jobId: ids.job1, coverMessage: "I'm a strong React developer with 4 years experience building dashboards for fintech companies. I've worked extensively with Chart.js and D3.js.", status: "Accepted", appliedDate: pastDays(35), contactEmail: "arjun@milestone.com", skillRating: "Expert", availability: "immediate" },
  { applicationId: uuidv4(), freelancerId: ids.fl1, jobId: ids.job2, coverMessage: "I have built microservices at my previous company and am familiar with RabbitMQ and Docker.", status: "Pending", appliedDate: pastDays(5), contactEmail: "arjun@milestone.com", skillRating: "Advanced", availability: "notice" },
  { applicationId: uuidv4(), freelancerId: ids.fl1, jobId: ids.job10, coverMessage: "I have experience with React Native and have published 3 apps on Play Store.", status: "Pending", appliedDate: pastDays(3), contactEmail: "arjun@milestone.com", skillRating: "Advanced", availability: "immediate" },

  // Priya's applications
  { applicationId: uuidv4(), freelancerId: ids.fl2, jobId: ids.job5, coverMessage: "As a seasoned UI/UX designer with experience at Flipkart, I specialize in mobile app redesigns. My portfolio showcases 12+ successful redesign projects.", status: "Accepted", appliedDate: pastDays(20), contactEmail: "priya@milestone.com", skillRating: "Expert", availability: "immediate" },
  { applicationId: uuidv4(), freelancerId: ids.fl2, jobId: ids.job6, coverMessage: "Brand identity design is my passion. I have created identities for 8 startups.", status: "Pending", appliedDate: pastDays(4), contactEmail: "priya@milestone.com", skillRating: "Advanced", availability: "immediate" },

  // Rahul's applications
  { applicationId: uuidv4(), freelancerId: ids.fl3, jobId: ids.job3, coverMessage: "I've optimized Django APIs at TCS from 200ms to 20ms response times. Experienced with Redis caching and query optimization.", status: "Pending", appliedDate: pastDays(3), contactEmail: "rahul@milestone.com", skillRating: "Expert", availability: "immediate" },
  { applicationId: uuidv4(), freelancerId: ids.fl3, jobId: ids.job4, coverMessage: "AWS certified with 4 years of DevOps experience. Set up infrastructure for 3 startups.", status: "Pending", appliedDate: pastDays(7), contactEmail: "rahul@milestone.com", skillRating: "Advanced", availability: "serve-notice" },
  { applicationId: uuidv4(), freelancerId: ids.fl3, jobId: ids.job9, coverMessage: "Built ETL pipelines using Airflow at my current company processing 200GB daily.", status: "Pending", appliedDate: pastDays(2), contactEmail: "rahul@milestone.com", skillRating: "Advanced", availability: "notice" },

  // Sneha's applications
  { applicationId: uuidv4(), freelancerId: ids.fl4, jobId: ids.job8, coverMessage: "Kaggle expert with extensive experience in classification and churn prediction models. My last model achieved 96% AUC.", status: "Accepted", appliedDate: pastDays(25), contactEmail: "sneha@milestone.com", skillRating: "Expert", availability: "immediate" },
  { applicationId: uuidv4(), freelancerId: ids.fl4, jobId: ids.job9, coverMessage: "Experienced with Apache Airflow and Spark. Built data pipelines for retail analytics.", status: "Pending", appliedDate: pastDays(6), contactEmail: "sneha@milestone.com", skillRating: "Advanced", availability: "immediate" },

  // Karan's applications
  { applicationId: uuidv4(), freelancerId: ids.fl5, jobId: ids.job10, coverMessage: "I've built 15+ mobile apps with React Native. My fitness tracker app has 10K+ downloads and 4.5 rating.", status: "Pending", appliedDate: pastDays(4), contactEmail: "karan@milestone.com", skillRating: "Expert", availability: "immediate" },
  { applicationId: uuidv4(), freelancerId: ids.fl5, jobId: ids.job7, coverMessage: "While primarily a mobile developer, I've also built WordPress sites. Happy to take this on.", status: "Pending", appliedDate: pastDays(2), contactEmail: "karan@milestone.com", skillRating: "Intermediate", availability: "immediate" },
  { applicationId: uuidv4(), freelancerId: ids.fl5, jobId: ids.job1, coverMessage: "I know React well from my React Native experience and can build web dashboards too.", status: "Rejected", appliedDate: pastDays(36), contactEmail: "karan@milestone.com", skillRating: "Intermediate", availability: "notice" },
];

//   QUIZZES
const quizzes = [
  {
    title: "JavaScript Fundamentals",
    skillName: "JavaScript",
    description: "Test your JavaScript fundamentals — variables, scoping, closures, promises, and ES6+ features.",
    timeLimitMinutes: 20,
    passingScore: 60,
    questions: [
      { text: "What is the output of `typeof null`?", marks: 2, options: [{ text: "null", isCorrect: false }, { text: "object", isCorrect: true }, { text: "undefined", isCorrect: false }, { text: "string", isCorrect: false }] },
      { text: "Which keyword declares a block-scoped variable?", marks: 1, options: [{ text: "var", isCorrect: false }, { text: "let", isCorrect: true }, { text: "function", isCorrect: false }, { text: "declare", isCorrect: false }] },
      { text: "What does `===` check?", marks: 1, options: [{ text: "Value only", isCorrect: false }, { text: "Type only", isCorrect: false }, { text: "Value and type", isCorrect: true }, { text: "Reference", isCorrect: false }] },
      { text: "What is a closure in JavaScript?", marks: 2, options: [{ text: "A function with no parameters", isCorrect: false }, { text: "A function that has access to its outer scope variables", isCorrect: true }, { text: "A class method", isCorrect: false }, { text: "An immediately invoked function", isCorrect: false }] },
      { text: "Which method converts a JSON string to an object?", marks: 1, options: [{ text: "JSON.stringify()", isCorrect: false }, { text: "JSON.parse()", isCorrect: true }, { text: "JSON.toObject()", isCorrect: false }, { text: "JSON.convert()", isCorrect: false }] },
      { text: "What does `Promise.all()` do?", marks: 2, options: [{ text: "Runs promises sequentially", isCorrect: false }, { text: "Returns after first resolves", isCorrect: false }, { text: "Resolves when all promises resolve", isCorrect: true }, { text: "Catches all rejected promises", isCorrect: false }] },
      { text: "What is the output of `[...'hello']`?", marks: 2, options: [{ text: "['hello']", isCorrect: false }, { text: "['h','e','l','l','o']", isCorrect: true }, { text: "Error", isCorrect: false }, { text: "undefined", isCorrect: false }] },
      { text: "Which array method does NOT mutate the original array?", marks: 1, options: [{ text: "push()", isCorrect: false }, { text: "splice()", isCorrect: false }, { text: "map()", isCorrect: true }, { text: "sort()", isCorrect: false }] },
      { text: "What is the event loop responsible for?", marks: 2, options: [{ text: "Compiling JavaScript", isCorrect: false }, { text: "Managing asynchronous callbacks", isCorrect: true }, { text: "Memory allocation", isCorrect: false }, { text: "Type checking", isCorrect: false }] },
      { text: "What does `async/await` simplify?", marks: 1, options: [{ text: "DOM manipulation", isCorrect: false }, { text: "Promise handling", isCorrect: true }, { text: "Variable scoping", isCorrect: false }, { text: "Error logging", isCorrect: false }] },
    ],
  },
  {
    title: "React.js Proficiency",
    skillName: "React",
    description: "Assess your React.js knowledge — hooks, state management, component lifecycle, and performance.",
    timeLimitMinutes: 25,
    passingScore: 65,
    questions: [
      { text: "Which hook is used for side effects in functional components?", marks: 2, options: [{ text: "useState", isCorrect: false }, { text: "useEffect", isCorrect: true }, { text: "useReducer", isCorrect: false }, { text: "useMemo", isCorrect: false }] },
      { text: "What is the virtual DOM?", marks: 1, options: [{ text: "A copy of the real DOM in memory", isCorrect: true }, { text: "A browser API", isCorrect: false }, { text: "A database", isCorrect: false }, { text: "A CSS engine", isCorrect: false }] },
      { text: "When does `useEffect` with an empty dependency array run?", marks: 2, options: [{ text: "On every render", isCorrect: false }, { text: "Only on mount", isCorrect: true }, { text: "Only on unmount", isCorrect: false }, { text: "Never", isCorrect: false }] },
      { text: "What does `React.memo()` do?", marks: 2, options: [{ text: "Memoizes a function", isCorrect: false }, { text: "Prevents re-render if props haven't changed", isCorrect: true }, { text: "Creates a ref", isCorrect: false }, { text: "Manages state", isCorrect: false }] },
      { text: "Which hook returns a mutable ref object?", marks: 1, options: [{ text: "useRef", isCorrect: true }, { text: "useMemo", isCorrect: false }, { text: "useCallback", isCorrect: false }, { text: "useContext", isCorrect: false }] },
      { text: "What is prop drilling?", marks: 1, options: [{ text: "Passing props through many intermediate components", isCorrect: true }, { text: "Drilling into the DOM", isCorrect: false }, { text: "A performance technique", isCorrect: false }, { text: "Creating nested routes", isCorrect: false }] },
      { text: "Which pattern solves prop drilling?", marks: 2, options: [{ text: "Higher Order Components only", isCorrect: false }, { text: "Context API or state management libraries", isCorrect: true }, { text: "CSS Modules", isCorrect: false }, { text: "Server-side rendering", isCorrect: false }] },
      { text: "What is the purpose of keys in React lists?", marks: 1, options: [{ text: "Styling", isCorrect: false }, { text: "Help React identify which items changed", isCorrect: true }, { text: "Data binding", isCorrect: false }, { text: "Routing", isCorrect: false }] },
      { text: "What hook would you use for complex state logic?", marks: 1, options: [{ text: "useState", isCorrect: false }, { text: "useReducer", isCorrect: true }, { text: "useRef", isCorrect: false }, { text: "useCallback", isCorrect: false }] },
      { text: "Can you call hooks inside conditions or loops?", marks: 2, options: [{ text: "Yes, anywhere", isCorrect: false }, { text: "No, hooks must be called at the top level", isCorrect: true }, { text: "Only in loops", isCorrect: false }, { text: "Only in try-catch", isCorrect: false }] },
    ],
  },
  {
    title: "Python Core Concepts",
    skillName: "Python",
    description: "Test your Python skills — data structures, OOP, decorators, generators, and best practices.",
    timeLimitMinutes: 20,
    passingScore: 60,
    questions: [
      { text: "What is the output of `type([])`?", marks: 1, options: [{ text: "<class 'tuple'>", isCorrect: false }, { text: "<class 'list'>", isCorrect: true }, { text: "<class 'dict'>", isCorrect: false }, { text: "<class 'set'>", isCorrect: false }] },
      { text: "How do you create a virtual environment?", marks: 1, options: [{ text: "python -m venv myenv", isCorrect: true }, { text: "pip install venv", isCorrect: false }, { text: "python create venv", isCorrect: false }, { text: "virtualenv --init", isCorrect: false }] },
      { text: "What is a decorator in Python?", marks: 2, options: [{ text: "A class attribute", isCorrect: false }, { text: "A function that wraps another function", isCorrect: true }, { text: "A loop construct", isCorrect: false }, { text: "A data type", isCorrect: false }] },
      { text: "Which keyword is used for generator functions?", marks: 2, options: [{ text: "return", isCorrect: false }, { text: "yield", isCorrect: true }, { text: "generate", isCorrect: false }, { text: "async", isCorrect: false }] },
      { text: "What does `self` refer to in a class method?", marks: 1, options: [{ text: "The class itself", isCorrect: false }, { text: "The instance of the class", isCorrect: true }, { text: "A global variable", isCorrect: false }, { text: "The parent class", isCorrect: false }] },
      { text: "How do you handle exceptions in Python?", marks: 1, options: [{ text: "if-else", isCorrect: false }, { text: "try-except", isCorrect: true }, { text: "catch-throw", isCorrect: false }, { text: "handle-error", isCorrect: false }] },
      { text: "What is a list comprehension?", marks: 2, options: [{ text: "A way to document lists", isCorrect: false }, { text: "A concise way to create lists", isCorrect: true }, { text: "A sorting algorithm", isCorrect: false }, { text: "A type of loop", isCorrect: false }] },
      { text: "What does `__init__` method do?", marks: 1, options: [{ text: "Destroys the object", isCorrect: false }, { text: "Initializes the object", isCorrect: true }, { text: "Imports modules", isCorrect: false }, { text: "Creates a class", isCorrect: false }] },
      { text: "Which module is used for regular expressions?", marks: 1, options: [{ text: "regex", isCorrect: false }, { text: "re", isCorrect: true }, { text: "regexp", isCorrect: false }, { text: "match", isCorrect: false }] },
      { text: "What is the difference between `is` and `==`?", marks: 2, options: [{ text: "No difference", isCorrect: false }, { text: "`is` checks identity, `==` checks equality", isCorrect: true }, { text: "`==` checks identity, `is` checks equality", isCorrect: false }, { text: "`is` is faster", isCorrect: false }] },
    ],
  },
  {
    title: "UI/UX Design Principles",
    skillName: "UI/UX Design",
    description: "Test your design thinking — usability principles, accessibility, design systems, and user research.",
    timeLimitMinutes: 15,
    passingScore: 60,
    questions: [
      { text: "What does 'accessibility' mean in design?", marks: 2, options: [{ text: "Making designs pretty", isCorrect: false }, { text: "Making products usable by people with disabilities", isCorrect: true }, { text: "Fast loading times", isCorrect: false }, { text: "Mobile-only design", isCorrect: false }] },
      { text: "What is the minimum touch target size recommended by Apple?", marks: 1, options: [{ text: "24x24 pt", isCorrect: false }, { text: "44x44 pt", isCorrect: true }, { text: "60x60 pt", isCorrect: false }, { text: "32x32 pt", isCorrect: false }] },
      { text: "What is a wireframe?", marks: 1, options: [{ text: "A high-fidelity mockup", isCorrect: false }, { text: "A low-fidelity layout sketch", isCorrect: true }, { text: "A coded prototype", isCorrect: false }, { text: "A color palette", isCorrect: false }] },
      { text: "What does 'F-pattern' refer to in web design?", marks: 2, options: [{ text: "A font family", isCorrect: false }, { text: "How users scan content on a page", isCorrect: true }, { text: "A CSS framework", isCorrect: false }, { text: "A responsive breakpoint", isCorrect: false }] },
      { text: "What is a design system?", marks: 2, options: [{ text: "A single Figma file", isCorrect: false }, { text: "Reusable components and guidelines for consistent design", isCorrect: true }, { text: "A wireframing tool", isCorrect: false }, { text: "A user testing method", isCorrect: false }] },
      { text: "Which contrast ratio is minimum for WCAG AA compliance (normal text)?", marks: 2, options: [{ text: "2:1", isCorrect: false }, { text: "3:1", isCorrect: false }, { text: "4.5:1", isCorrect: true }, { text: "7:1", isCorrect: false }] },
      { text: "What is a user persona?", marks: 1, options: [{ text: "A real user's profile", isCorrect: false }, { text: "A fictional representation of target users", isCorrect: true }, { text: "A login avatar", isCorrect: false }, { text: "An admin account", isCorrect: false }] },
      { text: "What is the purpose of a usability test?", marks: 1, options: [{ text: "Test code quality", isCorrect: false }, { text: "Observe real users interacting with a product", isCorrect: true }, { text: "Check server load", isCorrect: false }, { text: "Validate business plan", isCorrect: false }] },
    ],
  },
  {
    title: "Data Science & ML Basics",
    skillName: "Machine Learning",
    description: "Evaluate your data science knowledge — statistics, ML algorithms, model evaluation, and data preprocessing.",
    timeLimitMinutes: 25,
    passingScore: 60,
    questions: [
      { text: "What type of ML problem is spam detection?", marks: 1, options: [{ text: "Regression", isCorrect: false }, { text: "Classification", isCorrect: true }, { text: "Clustering", isCorrect: false }, { text: "Reinforcement Learning", isCorrect: false }] },
      { text: "What is overfitting?", marks: 2, options: [{ text: "Model performs poorly on training data", isCorrect: false }, { text: "Model memorizes training data but fails on new data", isCorrect: true }, { text: "Model is too simple", isCorrect: false }, { text: "Model takes too long to train", isCorrect: false }] },
      { text: "Which metric is best for imbalanced classification?", marks: 2, options: [{ text: "Accuracy", isCorrect: false }, { text: "F1-Score", isCorrect: true }, { text: "MSE", isCorrect: false }, { text: "R-squared", isCorrect: false }] },
      { text: "What does cross-validation do?", marks: 2, options: [{ text: "Trains on the entire dataset", isCorrect: false }, { text: "Evaluates model on multiple train/test splits", isCorrect: true }, { text: "Reduces feature dimensions", isCorrect: false }, { text: "Normalizes data", isCorrect: false }] },
      { text: "What is the purpose of feature scaling?", marks: 1, options: [{ text: "Make features look better", isCorrect: false }, { text: "Ensure features are on comparable scales", isCorrect: true }, { text: "Remove outliers", isCorrect: false }, { text: "Add new features", isCorrect: false }] },
      { text: "Which algorithm is used for dimensionality reduction?", marks: 2, options: [{ text: "Random Forest", isCorrect: false }, { text: "PCA", isCorrect: true }, { text: "SVM", isCorrect: false }, { text: "KNN", isCorrect: false }] },
      { text: "What is a confusion matrix?", marks: 1, options: [{ text: "A loss function", isCorrect: false }, { text: "A table showing TP, FP, TN, FN", isCorrect: true }, { text: "A data structure", isCorrect: false }, { text: "A preprocessing step", isCorrect: false }] },
      { text: "What does gradient descent minimize?", marks: 2, options: [{ text: "Dataset size", isCorrect: false }, { text: "The loss/cost function", isCorrect: true }, { text: "Number of features", isCorrect: false }, { text: "Training time", isCorrect: false }] },
      { text: "What is the bias-variance tradeoff?", marks: 2, options: [{ text: "Choosing between CPU and GPU", isCorrect: false }, { text: "Balancing underfitting and overfitting", isCorrect: true }, { text: "Choosing learning rate", isCorrect: false }, { text: "Data vs model size", isCorrect: false }] },
      { text: "Which library is commonly used for data manipulation in Python?", marks: 1, options: [{ text: "NumPy only", isCorrect: false }, { text: "Pandas", isCorrect: true }, { text: "Matplotlib", isCorrect: false }, { text: "Flask", isCorrect: false }] },
    ],
  },
];

//   SUBSCRIPTIONS
const subscriptions = [
  { subscriptionId: uuidv4(), planName: "Basic", price: 0, features: ["5 job applications/month", "Basic profile", "Community access"], duration: "monthly" },
  { subscriptionId: uuidv4(), planName: "Premium", price: 999, features: ["Unlimited applications", "Featured profile", "Priority support", "Advanced analytics", "Badge showcase", "Direct messaging"], duration: "monthly" },
  { subscriptionId: uuidv4(), planName: "Premium Annual", price: 9999, features: ["All Premium features", "Annual savings of 17%", "Early access to new features", "Dedicated account manager"], duration: "yearly" },
];

//   FEEDBACK (for completed/in-progress jobs)
const feedbacks = [
  // Employer -> Freelancer feedback
  { feedbackId: uuidv4(), jobId: ids.job1, fromUserId: ids.empUser1, toUserId: ids.flUser1, toRole: "Freelancer", rating: 5, comment: "Arjun delivered exceptional work on the React dashboard. Very responsive and skilled.", tags: ["Excellent Communication", "Timely Delivery", "High Quality"] },
  { feedbackId: uuidv4(), jobId: ids.job5, fromUserId: ids.empUser2, toUserId: ids.flUser2, toRole: "Freelancer", rating: 4, comment: "Priya's designs are beautiful. The app redesign looks modern and user-friendly.", tags: ["Creative", "Attention to Detail", "Professional"] },
  { feedbackId: uuidv4(), jobId: ids.job8, fromUserId: ids.empUser3, toUserId: ids.flUser4, toRole: "Freelancer", rating: 5, comment: "Sneha's ML model exceeded our accuracy expectations. Highly recommend!", tags: ["Expert Knowledge", "Proactive", "Analytical"] },
  // Freelancer -> Employer feedback
  { feedbackId: uuidv4(), jobId: ids.job1, fromUserId: ids.flUser1, toUserId: ids.empUser1, toRole: "Employer", rating: 4, comment: "TechCorp provided clear requirements and timely payments. Great to work with.", tags: ["Clear Requirements", "Responsive", "Fair Pay"] },
  { feedbackId: uuidv4(), jobId: ids.job5, fromUserId: ids.flUser2, toUserId: ids.empUser2, toRole: "Employer", rating: 5, comment: "DesignHub is an amazing client. They value design and give creative freedom.", tags: ["Creative Freedom", "Respectful", "Prompt Payment"] },
];

//   COMPLAINTS (6 diverse complaints for testing rating adjustment)
const complaints = [
  // Complaint 1: Freelancer (Karan) complained by Employer (TechCorp) — Resolved with penalty
  {
    complaintId: ids.complaint1,
    complainantType: "Employer",
    complainantId: ids.emp1,
    complainantName: "TechCorp India",
    freelancerId: ids.fl5,
    freelancerName: "Karan Singh",
    jobId: ids.job1,
    jobTitle: "React Dashboard Development",
    employerId: ids.emp1,
    employerName: "TechCorp India",
    complaintType: "Contract Violation",
    priority: "High",
    subject: "Plagiarized code found in React dashboard deliverable",
    description: "We discovered that significant portions of the React dashboard code submitted by Karan were copied directly from open-source repositories without attribution. The code was presented as original work. We found at least 3 major components that were directly copied from GitHub repos. This violates our contract terms regarding original work and intellectual property.",
    status: "Resolved",
    moderatorNotes: "Confirmed plagiarism after code review. Rating penalty of -1.0 applied to freelancer. Warning issued.",
    createdAt: pastDays(15),
    updatedAt: pastDays(3),
    resolvedAt: pastDays(3),
  },
  // Complaint 2: Freelancer (Sneha) complained by Employer (DataDriven Labs) — Under Review
  {
    complaintId: ids.complaint2,
    complainantType: "Employer",
    complainantId: ids.emp3,
    complainantName: "DataDriven Labs",
    freelancerId: ids.fl4,
    freelancerName: "Sneha Gupta",
    jobId: ids.job8,
    jobTitle: "ML Model for Customer Churn Prediction",
    employerId: ids.emp3,
    employerName: "DataDriven Labs",
    complaintType: "Scope Creep",
    priority: "Medium",
    subject: "Freelancer repeatedly missing agreed milestones and deadlines",
    description: "Sneha has missed 3 consecutive milestone deadlines for the churn prediction model without adequate communication. The first milestone was due 10 days ago and only partial work has been delivered. When asked about the delays, responses are vague and non-committal. Project is now 2 weeks behind schedule and we are losing client confidence. We need immediate intervention.",
    status: "Under Review",
    moderatorNotes: "Investigating timeline and communication logs. Freelancer has been contacted for response.",
    createdAt: pastDays(10),
    updatedAt: pastDays(2),
  },
  // Complaint 3: Freelancer (Arjun) complains about Employer (TechCorp) — Pending
  {
    complaintId: ids.complaint3,
    complainantType: "Freelancer",
    complainantId: ids.fl1,
    complainantName: "Arjun Sharma",
    freelancerId: ids.fl1,
    freelancerName: "Arjun Sharma",
    jobId: ids.job1,
    jobTitle: "React Dashboard Development",
    employerId: ids.emp1,
    employerName: "TechCorp India",
    complaintType: "Payment Issue",
    priority: "High",
    subject: "Milestone 2 payment delayed by over 3 weeks despite completion",
    description: "I completed Milestone 2 of the React Dashboard project and it was approved by the employer on Feb 5th. However, the payment of Rs 60,000 has still not been released despite multiple follow-ups. The employer keeps saying it's a \"processing issue\" but it's been 3 weeks now. I have bills to pay and this delay is causing significant financial stress. I need the moderator to intervene and ensure the payment is released.",
    status: "Pending",
    moderatorNotes: "",
    createdAt: pastDays(7),
    updatedAt: pastDays(7),
  },
  // Complaint 4: Employer (DesignHub) complains about Freelancer (Sneha) — Resolved
  {
    complaintId: ids.complaint4,
    complainantType: "Employer",
    complainantId: ids.emp2,
    complainantName: "DesignHub Studio",
    freelancerId: ids.fl4,
    freelancerName: "Sneha Gupta",
    jobId: ids.job5,
    jobTitle: "Mobile App UI/UX Redesign",
    employerId: ids.emp2,
    employerName: "DesignHub Studio",
    complaintType: "Communication Issue",
    priority: "Medium",
    subject: "Freelancer unresponsive for extended periods during critical phase",
    description: "Sneha was hired for a data visualization side-project but became unresponsive for over a week during a critical project phase. Multiple emails and messages went unanswered. When she finally responded, the excuse given was personal issues, but no prior communication was made about availability changes. This caused us to miss our client presentation deadline.",
    status: "Resolved",
    moderatorNotes: "Spoke with both parties. Freelancer acknowledged the communication gap. Mediated resolution with adjusted timeline. Rating penalty applied due to pattern of unresponsiveness.",
    createdAt: pastDays(20),
    updatedAt: pastDays(5),
    resolvedAt: pastDays(5),
  },
  // Complaint 5: Freelancer (Priya) complains about Employer (DesignHub) — Rejected
  {
    complaintId: ids.complaint5,
    complainantType: "Freelancer",
    complainantId: ids.fl2,
    complainantName: "Priya Patel",
    freelancerId: ids.fl2,
    freelancerName: "Priya Patel",
    jobId: ids.job5,
    jobTitle: "Mobile App UI/UX Redesign",
    employerId: ids.emp2,
    employerName: "DesignHub Studio",
    complaintType: "Scope Creep",
    priority: "Low",
    subject: "Employer keeps requesting additional design revisions beyond agreed scope",
    description: "DesignHub has been asking for additional design iterations that were not part of the original scope. The original agreement was for 2 rounds of revisions per screen, but they have requested 5-6 rounds for some screens. While I have been accommodating, this is significantly increasing my workload without additional compensation. I request the moderator to review the original scope and mediate fair compensation for the extra work.",
    status: "Rejected",
    moderatorNotes: "Reviewed the contract and communication logs. The additional revisions were minor color/font tweaks that fall within standard revision scope. Complaint does not warrant intervention.",
    createdAt: pastDays(25),
    updatedAt: pastDays(18),
  },
  // Complaint 6: Employer (DataDriven Labs) complains about Freelancer (Karan) — Pending
  {
    complaintId: ids.complaint6,
    complainantType: "Employer",
    complainantId: ids.emp3,
    complainantName: "DataDriven Labs",
    freelancerId: ids.fl5,
    freelancerName: "Karan Singh",
    jobId: ids.job10,
    jobTitle: "React Native Mobile Analytics App",
    employerId: ids.emp3,
    employerName: "DataDriven Labs",
    complaintType: "Harassment",
    priority: "High",
    subject: "Freelancer made unprofessional and threatening comments after feedback",
    description: "After providing constructive code review feedback on the mobile analytics app, Karan responded with highly unprofessional messages including threatening language about leaving negative reviews and 'exposing' our company on social media. He also sent inappropriate messages to our team members directly. We have screenshots of all communications. This behavior is completely unacceptable and we request immediate action from the moderation team.",
    status: "Pending",
    moderatorNotes: "",
    createdAt: pastDays(4),
    updatedAt: pastDays(4),
  },
];

//   RATING AUDITS (historical rating adjustments for testing)
const ratingAudits = [
  // Sneha: First penalty -0.5 (from complaint 4 — communication issue)
  {
    targetUserId: ids.flUser4,
    targetUserName: "Sneha Gupta",
    targetUserRole: "Freelancer",
    previousRating: 4.9,
    newRating: 4.4,
    adjustment: -0.5,
    reason: "Unresponsive for over a week during critical project phase with DesignHub Studio. Pattern of poor communication confirmed across multiple complaints.",
    relatedComplaintId: ids.complaint4,
    adjustedBy: ids.modUser,
    adjustedByName: "Vaibhav Moderator",
    adjustedByRole: "Moderator",
    ipAddress: "192.168.1.100",
    createdAt: pastDays(12),
  },
  // Sneha: Second penalty -0.9 (from complaint 2 — missed deadlines)
  {
    targetUserId: ids.flUser4,
    targetUserName: "Sneha Gupta",
    targetUserRole: "Freelancer",
    previousRating: 4.4,
    newRating: 3.5,
    adjustment: -0.9,
    reason: "Repeated missed deadlines on ML churn prediction project with DataDriven Labs. Three consecutive milestones missed without adequate communication. This is a recurring pattern.",
    relatedComplaintId: ids.complaint2,
    adjustedBy: ids.modUser,
    adjustedByName: "Vaibhav Moderator",
    adjustedByRole: "Moderator",
    ipAddress: "192.168.1.100",
    createdAt: pastDays(5),
  },
  // Karan: Penalty -1.0 (from complaint 1 — plagiarism)
  {
    targetUserId: ids.flUser5,
    targetUserName: "Karan Singh",
    targetUserRole: "Freelancer",
    previousRating: 3.9,
    newRating: 2.9,
    adjustment: -1.0,
    reason: "Confirmed plagiarism in React dashboard deliverable. Multiple components copied from open-source repositories without attribution, presented as original work. Serious violation of contract terms.",
    relatedComplaintId: ids.complaint1,
    adjustedBy: ids.modUser,
    adjustedByName: "Vaibhav Moderator",
    adjustedByRole: "Moderator",
    ipAddress: "192.168.1.100",
    createdAt: pastDays(3),
  },
  // DesignHub: Bonus +0.2 (good employer behavior)
  {
    targetUserId: ids.empUser2,
    targetUserName: "DesignHub Studio",
    targetUserRole: "Employer",
    previousRating: 4.3,
    newRating: 4.5,
    adjustment: 0.2,
    reason: "Employer consistently provides excellent working conditions, timely payments, and constructive feedback. Bonus applied after positive review of 5 completed projects with no negative complaints from freelancers.",
    relatedComplaintId: null,
    adjustedBy: ids.modUser,
    adjustedByName: "Vaibhav Moderator",
    adjustedByRole: "Moderator",
    ipAddress: "192.168.1.100",
    createdAt: pastDays(10),
  },
];

//   SEED RUNNER
async function seed() {
  const cleanFlag = process.argv.includes("--clean");
  const connStr = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/Milestone";

  console.log("Connecting to MongoDB ...");
  await mongoose.connect(connStr, { serverSelectionTimeoutMS: 20000 });
  console.log("Connected to MongoDB");

  if (cleanFlag) {
    console.log("--clean flag detected, dropping existing data ...");
    const collections = [User, Admin, Moderator, Freelancer, Employer, JobListing, JobApplication, Quiz, Badge, Attempt, Feedback, Subscription, Complaint, RatingAudit];
    for (const Model of collections) {
      await Model.deleteMany({});
    }
    console.log("Collections cleaned");
  }

  // 1. Users
  console.log("Seeding Users ...");
  await User.insertMany(users);
  console.log(`   ${users.length} users created`);

  // 2. Admin
  console.log("Seeding Admins ...");
  await Admin.insertMany(admins);
  console.log(`   ${admins.length} admin(s) created`);

  // 3. Moderator
  console.log("Seeding Moderators ...");
  await Moderator.insertMany(moderators);
  console.log(`   ${moderators.length} moderator(s) created`);

  // 4. Freelancers
  console.log("Seeding Freelancers ...");
  await Freelancer.insertMany(freelancers);
  console.log(`   ${freelancers.length} freelancers created`);

  // 5. Employers
  console.log("Seeding Employers ...");
  await Employer.insertMany(employers);
  console.log(`   ${employers.length} employers created`);

  // 6. Job Listings
  console.log("Seeding Job Listings ...");
  await JobListing.insertMany(jobListings);
  console.log(`   ${jobListings.length} job listings created`);

  // 7. Job Applications
  console.log("Seeding Job Applications ...");
  await JobApplication.insertMany(jobApplications);
  console.log(`   ${jobApplications.length} job applications created`);

  // 8. Quizzes
  console.log("Seeding Quizzes ...");
  const createdQuizzes = await Quiz.insertMany(quizzes);
  console.log(`   ${createdQuizzes.length} quizzes created`);

  // 9. Badges (one per quiz)
  console.log("Seeding Badges ...");
  const badges = createdQuizzes.map((q) => ({
    title: `${q.skillName} Badge`,
    skillName: q.skillName,
    description: `Awarded for passing the ${q.title} quiz with >= ${q.passingScore}%`,
    icon: "trophy",
    criteria: { type: "pass_quiz", quizId: String(q._id), minPercentage: q.passingScore },
  }));
  await Badge.insertMany(badges);
  console.log(`   ${badges.length} badges created`);

  // 10. Quiz Attempts (for freelancers)
  console.log("Seeding Quiz Attempts ...");
  const attempts = [];
  const jsQuiz = createdQuizzes.find((q) => q.skillName === "JavaScript");
  const reactQuiz = createdQuizzes.find((q) => q.skillName === "React");
  const pyQuiz = createdQuizzes.find((q) => q.skillName === "Python");
  const mlQuiz = createdQuizzes.find((q) => q.skillName === "Machine Learning");
  const uiQuiz = createdQuizzes.find((q) => q.skillName === "UI/UX Design");

  function makeAnswers(quiz, correctIndices) {
    return quiz.questions.map((q, i) => {
      const correctIdx = q.options.findIndex((o) => o.isCorrect);
      const selected = correctIndices.includes(i) ? correctIdx : (correctIdx + 1) % q.options.length;
      return {
        questionId: q._id,
        selectedOptionIndex: selected,
        awardedMarks: correctIndices.includes(i) ? q.marks : 0,
      };
    });
  }

  function calcAttempt(quiz, correctIndices) {
    const totalMarks = quiz.questions.reduce((s, q) => s + q.marks, 0);
    const userMarks = correctIndices.reduce((s, i) => s + quiz.questions[i].marks, 0);
    const percentage = Math.round((userMarks / totalMarks) * 100);
    return { totalMarks, userMarks, percentage, passed: percentage >= quiz.passingScore };
  }

  // Arjun: JS (passed), React (passed)
  const arjunJs = calcAttempt(jsQuiz, [0, 1, 2, 3, 4, 5, 6, 7]);
  attempts.push({ userId: ids.flUser1, quizId: jsQuiz._id, answers: makeAnswers(jsQuiz, [0, 1, 2, 3, 4, 5, 6, 7]), ...arjunJs, attemptNumber: 1, createdAt: pastDays(60) });
  const arjunReact = calcAttempt(reactQuiz, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  attempts.push({ userId: ids.flUser1, quizId: reactQuiz._id, answers: makeAnswers(reactQuiz, [0, 1, 2, 3, 4, 5, 6, 7, 8]), ...arjunReact, attemptNumber: 1, createdAt: pastDays(55) });

  // Priya: UI/UX (passed), JS (failed then passed)
  const priyaUi = calcAttempt(uiQuiz, [0, 1, 2, 3, 4, 5, 6, 7]);
  attempts.push({ userId: ids.flUser2, quizId: uiQuiz._id, answers: makeAnswers(uiQuiz, [0, 1, 2, 3, 4, 5, 6, 7]), ...priyaUi, attemptNumber: 1, createdAt: pastDays(50) });
  const priyaJsFail = calcAttempt(jsQuiz, [0, 1, 4]);
  attempts.push({ userId: ids.flUser2, quizId: jsQuiz._id, answers: makeAnswers(jsQuiz, [0, 1, 4]), ...priyaJsFail, attemptNumber: 1, createdAt: pastDays(45) });
  const priyaJsPass = calcAttempt(jsQuiz, [0, 1, 2, 3, 4, 5, 6]);
  attempts.push({ userId: ids.flUser2, quizId: jsQuiz._id, answers: makeAnswers(jsQuiz, [0, 1, 2, 3, 4, 5, 6]), ...priyaJsPass, attemptNumber: 2, createdAt: pastDays(40) });

  // Rahul: Python (passed), JS (passed)
  const rahulPy = calcAttempt(pyQuiz, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  attempts.push({ userId: ids.flUser3, quizId: pyQuiz._id, answers: makeAnswers(pyQuiz, [0, 1, 2, 3, 4, 5, 6, 7, 8]), ...rahulPy, attemptNumber: 1, createdAt: pastDays(40) });
  const rahulJs = calcAttempt(jsQuiz, [0, 1, 2, 3, 4, 5]);
  attempts.push({ userId: ids.flUser3, quizId: jsQuiz._id, answers: makeAnswers(jsQuiz, [0, 1, 2, 3, 4, 5]), ...rahulJs, attemptNumber: 1, createdAt: pastDays(35) });

  // Sneha: ML (passed), Python (passed), React (failed)
  const snehaMl = calcAttempt(mlQuiz, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  attempts.push({ userId: ids.flUser4, quizId: mlQuiz._id, answers: makeAnswers(mlQuiz, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), ...snehaMl, attemptNumber: 1, createdAt: pastDays(50) });
  const snehaPy = calcAttempt(pyQuiz, [0, 1, 2, 3, 4, 5, 6, 7]);
  attempts.push({ userId: ids.flUser4, quizId: pyQuiz._id, answers: makeAnswers(pyQuiz, [0, 1, 2, 3, 4, 5, 6, 7]), ...snehaPy, attemptNumber: 1, createdAt: pastDays(45) });
  const snehaReact = calcAttempt(reactQuiz, [0, 1, 3]);
  attempts.push({ userId: ids.flUser4, quizId: reactQuiz._id, answers: makeAnswers(reactQuiz, [0, 1, 3]), ...snehaReact, attemptNumber: 1, createdAt: pastDays(30) });

  // Karan: React (passed), JS (passed)
  const karanReact = calcAttempt(reactQuiz, [0, 1, 2, 3, 4, 5, 6, 7]);
  attempts.push({ userId: ids.flUser5, quizId: reactQuiz._id, answers: makeAnswers(reactQuiz, [0, 1, 2, 3, 4, 5, 6, 7]), ...karanReact, attemptNumber: 1, createdAt: pastDays(30) });
  const karanJs = calcAttempt(jsQuiz, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  attempts.push({ userId: ids.flUser5, quizId: jsQuiz._id, answers: makeAnswers(jsQuiz, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), ...karanJs, attemptNumber: 1, createdAt: pastDays(25) });

  await Attempt.insertMany(attempts);
  console.log(`   ${attempts.length} quiz attempts created`);

  // 11. Subscriptions
  console.log("Seeding Subscriptions ...");
  await Subscription.insertMany(subscriptions);
  console.log(`   ${subscriptions.length} subscriptions created`);

  // 12. Feedback
  console.log("Seeding Feedback ...");
  await Feedback.insertMany(feedbacks);
  console.log(`   ${feedbacks.length} feedback entries created`);

  // 13. Complaints
  console.log("Seeding Complaints ...");
  await Complaint.insertMany(complaints);
  console.log(`   ${complaints.length} complaints created`);

  // 14. Rating Audits
  console.log("Seeding Rating Audits ...");
  await RatingAudit.insertMany(ratingAudits);
  console.log(`   ${ratingAudits.length} rating audit entries created`);

  // Summary
  console.log("\n==================================================");
  console.log("  ALL SEED DATA CREATED SUCCESSFULLY");
  console.log("==================================================");
  console.log("\nLogin Credentials:");
  console.log("  +------------------+-------------------------------+-----------+");
  console.log("  | Role             | Email                         | Password  |");
  console.log("  +------------------+-------------------------------+-----------+");
  console.log("  | Admin            | admin@milestone.com           | Admin@123 |");
  console.log("  | Moderator        | moderator@milestone.com       | Mod@123   |");
  console.log("  | Freelancer (x5)  | arjun@milestone.com           | Test@123  |");
  console.log("  |                  | priya@milestone.com           | Test@123  |");
  console.log("  |                  | rahul@milestone.com           | Test@123  |");
  console.log("  |                  | sneha@milestone.com           | Test@123  |");
  console.log("  |                  | karan@milestone.com           | Test@123  |");
  console.log("  | Employer (x3)    | techcorp@milestone.com        | Test@123  |");
  console.log("  |                  | designhub@milestone.com       | Test@123  |");
  console.log("  |                  | datadrivenlabs@milestone.com  | Test@123  |");
  console.log("  +------------------+-------------------------------+-----------+");
  console.log("\nSeeded Data Summary:");
  console.log(`   Users:            ${users.length}`);
  console.log(`   Admins:           ${admins.length}`);
  console.log(`   Moderators:       ${moderators.length}`);
  console.log(`   Freelancers:      ${freelancers.length}`);
  console.log(`   Employers:        ${employers.length}`);
  console.log(`   Job Listings:     ${jobListings.length}`);
  console.log(`   Job Applications: ${jobApplications.length}`);
  console.log(`   Quizzes:          ${createdQuizzes.length} (${createdQuizzes.reduce((s, q) => s + q.questions.length, 0)} questions total)`);
  console.log(`   Badges:           ${badges.length}`);
  console.log(`   Quiz Attempts:    ${attempts.length}`);
  console.log(`   Subscriptions:    ${subscriptions.length}`);
  console.log(`   Feedback:         ${feedbacks.length}`);
  console.log(`   Complaints:       ${complaints.length}`);
  console.log(`   Rating Audits:    ${ratingAudits.length}`);
  console.log("\nRating Adjustment Test Data:");
  console.log("   Sneha Gupta:    calculated=4.9, moderator=3.5 (OVERRIDE ACTIVE, 2 penalties)");
  console.log("   Karan Singh:    calculated=3.9, moderator=2.9 (OVERRIDE ACTIVE, 1 penalty)");
  console.log("   DesignHub:      calculated=4.3, moderator=4.5 (OVERRIDE ACTIVE, 1 bonus)");
  console.log("   Others:         using calculated ratings (no override)");
  console.log("\nComplaints for Testing:");
  console.log("   #1 Resolved  - TechCorp vs Karan (plagiarism) — penalty applied");
  console.log("   #2 Under Review - DataDriven vs Sneha (missed deadlines)");
  console.log("   #3 Pending   - Arjun vs TechCorp (payment delay)");
  console.log("   #4 Resolved  - DesignHub vs Sneha (communication) — penalty applied");
  console.log("   #5 Rejected  - Priya vs DesignHub (scope creep)");
  console.log("   #6 Pending   - DataDriven vs Karan (harassment)");
  console.log("");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
