/**
 * ============================================================
 *  COMPREHENSIVE DEMO SEED SCRIPT
 *  Seeds the entire database for a full client demonstration.
 *  Run:  node newSeed/seedAll.js
 * ============================================================
 *
 *  Prerequisites:
 *    - 4 users already exist: 1 Employer, 1 Freelancer, 1 Moderator, 1 Admin
 *    - MongoDB is running and accessible
 *
 *  What this seeds:
 *    1.  Employer profile enrichment (company name, about, social)
 *    2.  Freelancer profile enrichment (skills, experience, education, portfolio)
 *    3.  Job Listings in various states (open, closed, in-progress, completed)
 *    4.  Job Applications (pending, accepted, rejected)
 *    5.  Milestones with mixed payment states (paid, not-paid, requested)
 *    6.  Complaints from both employer & freelancer (Pending, Under Review, Resolved)
 *    7.  Blogs (multiple categories, featured, published)
 *    8.  Quizzes with questions + Badges
 *    9.  Quiz Attempts (passed + failed) + UserBadges
 *   10.  Feedback (employer to freelancer, freelancer to employer)
 *   11.  Questions & Answers on job listings
 *   12.  Conversations & Chat messages
 *   13.  Notifications
 *   14.  Premium subscription for employer
 *   15.  Rating audit trail
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { v4: uuidv4 } = require("uuid");

dotenv.config({ path: require("path").resolve(__dirname, "../.env") });

// Models
const User = require("../models/user");
const Employer = require("../models/employer");
const Freelancer = require("../models/freelancer");
const Moderator = require("../models/moderator");
const Admin = require("../models/admin");
const JobListing = require("../models/job_listing");
const JobApplication = require("../models/job_application");
const Complaint = require("../models/complaint");
const Blog = require("../models/blog");
const Quiz = require("../models/Quiz");
const Attempt = require("../models/Attempt");
const Badge = require("../models/Badge");
const UserBadge = require("../models/UserBadge");
const Feedback = require("../models/Feedback");
const Question = require("../models/Question");
const Notification = require("../models/Notification");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const RatingAudit = require("../models/RatingAudit");

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

// ----------------------------------------------------------
// MAIN
// ----------------------------------------------------------
async function main() {
  const connectionString =
    process.env.MONGO_URL || "mongodb://127.0.0.1:27017/milestone";
  await mongoose.connect(connectionString, {
    serverSelectionTimeoutMS: 20000,
  });
  console.log("[OK] Connected to MongoDB");

  // -- 0. Discover existing users --------------------------
  const employerUser = await User.findOne({ role: "Employer" });
  const freelancerUser = await User.findOne({ role: "Freelancer" });
  const moderatorUser = await User.findOne({ role: "Moderator" });
  const adminUser = await User.findOne({ role: "Admin" });

  if (!employerUser || !freelancerUser || !moderatorUser || !adminUser) {
    console.error(
      "[ERROR] Could not find all 4 users (Employer, Freelancer, Moderator, Admin)."
    );
    console.error("   Please create them first, then rerun this script.");
    process.exit(1);
  }

  const employer = await Employer.findOne({ userId: employerUser.userId });
  const freelancer = await Freelancer.findOne({
    userId: freelancerUser.userId,
  });
  const moderator = await Moderator.findOne({ userId: moderatorUser.userId });

  if (!employer || !freelancer) {
    console.error("[ERROR] Employer or Freelancer role record not found.");
    process.exit(1);
  }

  console.log(`  Employer  : ${employerUser.name} (${employerUser.userId})`);
  console.log(
    `  Freelancer: ${freelancerUser.name} (${freelancerUser.userId})`
  );
  console.log(
    `  Moderator : ${moderatorUser.name} (${moderatorUser.userId})`
  );
  console.log(`  Admin     : ${adminUser.name} (${adminUser.userId})`);

  const empId = employer.employerId;
  const flId = freelancer.freelancerId;
  const empUserId = employerUser.userId;
  const flUserId = freelancerUser.userId;
  const modUserId = moderatorUser.userId;
  const adminUserId = adminUser.userId;

  // -- 1. Enrich user profiles -----------------------------
  console.log("\n[1/13] Enriching user profiles...");

  await User.findOneAndUpdate(
    { userId: empUserId },
    {
      $set: {
        aboutMe:
          "We are a leading technology company based in Bengaluru, specialising in innovative digital solutions for the Indian market. Our team works with cutting-edge technologies to deliver exceptional products and services to clients across India and abroad.",
        location: "Bengaluru, Karnataka",
        phone: "+91-9876543210",
        socialMedia: {
          linkedin: "https://linkedin.com/company/techvision-india",
          twitter: "https://twitter.com/techvision_in",
          facebook: "",
          instagram: "",
        },
        rating: 4.5,
      },
    }
  );

  await Employer.findOneAndUpdate(
    { employerId: empId },
    {
      $set: {
        companyName: "TechVision Solutions Pvt. Ltd.",
        websiteLink: "https://techvision.co.in",
      },
    }
  );

  await User.findOneAndUpdate(
    { userId: flUserId },
    {
      $set: {
        aboutMe:
          "Full-stack developer with 4+ years of experience in React, Node.js, and Python. Based in Mumbai, passionate about building scalable web applications with clean, maintainable code. Open to exciting freelance opportunities across India.",
        location: "Mumbai, Maharashtra",
        phone: "+91-9123456789",
        socialMedia: {
          linkedin: "https://linkedin.com/in/devfreelancer",
          twitter: "https://twitter.com/devfreelancer_in",
          facebook: "",
          instagram: "https://instagram.com/devfreelancer",
        },
        rating: 4.7,
      },
    }
  );

  await Freelancer.findOneAndUpdate(
    { freelancerId: flId },
    {
      $set: {
        skills: [
          "JavaScript",
          "React",
          "Node.js",
          "Python",
          "MongoDB",
          "TypeScript",
          "Express.js",
          "HTML/CSS",
          "Git",
          "Docker",
        ],
        experience: [
          {
            title: "Senior Frontend Developer",
            date: "2022 - Present",
            description:
              "Leading frontend development for multiple SaaS products using React, TypeScript, and Next.js at a Pune-based startup.",
          },
          {
            title: "Full Stack Developer",
            date: "2020 - 2022",
            description:
              "Built and maintained e-commerce platforms using MERN stack for clients in Mumbai and Bengaluru. Increased site performance by 40%.",
          },
          {
            title: "Junior Web Developer",
            date: "2019 - 2020",
            description:
              "Developed responsive web applications using HTML, CSS, JavaScript, and PHP at a Noida-based IT services firm.",
          },
        ],
        education: [
          {
            degree: "B.Tech in Computer Science",
            institution: "IIT Bombay",
            date: "2015 - 2019",
          },
          {
            degree: "Full-Stack Web Development Certification",
            institution: "NPTEL / IIT Madras",
            date: "2019",
          },
        ],
        portfolio: [
          {
            title: "Dukaan Online - E-Commerce Platform",
            description:
              "A full-featured online store with Razorpay payment integration, inventory management and analytics dashboard built for an Indian retail chain.",
            image:
              "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400",
            link: "https://github.com/example/dukaan-online",
          },
          {
            title: "KaamTracker - Project Management Tool",
            description:
              "Kanban-style project tracker with real-time collaboration, built with React and Socket.io for distributed teams across India.",
            image:
              "https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400",
            link: "https://github.com/example/kaamtracker",
          },
          {
            title: "SahayakAI - Chatbot Dashboard",
            description:
              "Admin dashboard for managing AI chatbot conversations in Hindi and English, with analytics and training data management.",
            image:
              "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400",
            link: "https://github.com/example/sahayak-ai",
          },
        ],
      },
    }
  );

  await User.findOneAndUpdate(
    { userId: modUserId },
    {
      $set: {
        aboutMe:
          "Platform moderator ensuring quality standards, resolving disputes, and maintaining a safe community for all users on the platform.",
        location: "New Delhi, Delhi",
        phone: "+91-9988776655",
      },
    }
  );

  await User.findOneAndUpdate(
    { userId: adminUserId },
    {
      $set: {
        aboutMe:
          "Platform administrator overseeing all operations, analytics, and strategic growth initiatives for the Indian freelancing ecosystem.",
        location: "Hyderabad, Telangana",
        phone: "+91-9090909090",
      },
    }
  );

  console.log("   [OK] Profiles enriched");

  // -- 2. Job Listings -------------------------------------
  console.log("\n[2/13] Creating job listings...");

  // Clear existing jobs (and related data) for clean demo
  await JobListing.deleteMany({});
  await JobApplication.deleteMany({});
  await Complaint.deleteMany({});
  await Question.deleteMany({});
  await Notification.deleteMany({});
  await Feedback.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});
  await RatingAudit.deleteMany({});

  // Job IDs for reference
  const jobIds = {
    openJob1: uuidv4(),
    openJob2: uuidv4(),
    openJob3: uuidv4(),
    closedJob: uuidv4(), // accepted application, freelancer working
    inProgressJob: uuidv4(), // freelancer working with milestones
    completedJob: uuidv4(), // all milestones paid, freelancer finished
    leftJob: uuidv4(), // freelancer left this job
    boostedJob: uuidv4(), // boosted open job
  };

  const milestoneIds = {
    ip1: uuidv4(),
    ip2: uuidv4(),
    ip3: uuidv4(),
    ip4: uuidv4(),
    comp1: uuidv4(),
    comp2: uuidv4(),
    comp3: uuidv4(),
    left1: uuidv4(),
    left2: uuidv4(),
  };

  const jobs = [
    // -- Open jobs (available for application) --
    {
      jobId: jobIds.openJob1,
      employerId: empId,
      title: "React Native Mobile App Development",
      budget: 75000,
      location: "Bengaluru, Karnataka",
      jobType: "freelance",
      experienceLevel: "Mid",
      remote: true,
      postedDate: daysAgo(3),
      applicationDeadline: daysFromNow(25),
      description: {
        text: "We are looking for an experienced React Native developer to build a cross-platform mobile application for our e-commerce platform. The app should support iOS and Android with a seamless user experience, including UPI and Razorpay payment integration.",
        responsibilities: [
          "Design and develop mobile application screens using React Native",
          "Integrate REST APIs for product catalog, cart, and checkout",
          "Implement push notifications and in-app messaging",
          "Integrate UPI and Razorpay payment gateways",
          "Write unit tests and participate in code reviews",
        ],
        requirements: [
          "3+ years experience with React Native",
          "Familiarity with Redux or Context API for state management",
          "Experience publishing apps to App Store and Play Store",
          "Strong understanding of mobile UX best practices",
        ],
        skills: ["React Native", "JavaScript", "Redux", "REST APIs", "Mobile Development"],
      },
      milestones: [],
      status: "open",
      applicants: 0,
      platformFeeRate: 2,
      applicationCap: 25,
      applicationCapFeeRate: 1,
      platformFeeAmount: 2250,
      isBoosted: false,
    },
    {
      jobId: jobIds.openJob2,
      employerId: empId,
      title: "Full-Stack E-Commerce Website Redesign",
      budget: 120000,
      location: "Remote",
      jobType: "contract",
      experienceLevel: "Senior",
      remote: true,
      postedDate: daysAgo(5),
      applicationDeadline: daysFromNow(20),
      description: {
        text: "Complete redesign and development of our existing e-commerce platform. Looking for a senior full-stack developer who can modernize the tech stack and improve the overall user experience for the Indian market.",
        responsibilities: [
          "Redesign the frontend using React and modern CSS frameworks",
          "Migrate backend to Node.js with Express",
          "Implement Razorpay and UPI payment gateway integration",
          "Set up CI/CD pipeline and deployment automation",
          "Migrate existing data with zero downtime",
        ],
        requirements: [
          "5+ years of full-stack development experience",
          "Expertise in React, Node.js, and MongoDB",
          "Experience with payment gateways like Razorpay, Paytm, or PhonePe",
          "Knowledge of DevOps and cloud deployment (AWS Mumbai / GCP)",
        ],
        skills: ["React", "Node.js", "MongoDB", "Express.js", "AWS", "Razorpay"],
      },
      milestones: [],
      status: "open",
      applicants: 0,
      platformFeeRate: 2,
      applicationCap: null,
      applicationCapFeeRate: 2,
      platformFeeAmount: 4800,
    },
    {
      jobId: jobIds.openJob3,
      employerId: empId,
      title: "Python Data Analytics Dashboard",
      budget: 45000,
      location: "Hyderabad, Telangana",
      jobType: "part-time",
      experienceLevel: "Entry",
      remote: false,
      postedDate: daysAgo(1),
      applicationDeadline: daysFromNow(30),
      description: {
        text: "Build an interactive data analytics dashboard using Python and modern visualization libraries. The dashboard will display key business metrics for our operations across major Indian cities and allow data exploration.",
        responsibilities: [
          "Develop interactive dashboards using Python (Streamlit or Dash)",
          "Create data pipelines to process raw CSV/Excel data",
          "Implement charts and visualizations for business KPIs",
          "Add filtering and drill-down capabilities by region and city",
        ],
        requirements: [
          "Proficiency in Python and data analysis libraries (Pandas, NumPy)",
          "Experience with data visualization (Matplotlib, Plotly)",
          "Familiarity with SQL databases",
        ],
        skills: ["Python", "Data Analytics", "Pandas", "Plotly", "SQL"],
      },
      milestones: [],
      status: "open",
      applicants: 0,
      platformFeeRate: 2,
      applicationCap: 10,
      applicationCapFeeRate: 0.5,
      platformFeeAmount: 1125,
    },

    // -- Boosted open job --
    {
      jobId: jobIds.boostedJob,
      employerId: empId,
      title: "AI-Powered Customer Support Chatbot",
      budget: 200000,
      location: "Remote",
      jobType: "contract",
      experienceLevel: "Expert",
      remote: true,
      postedDate: daysAgo(2),
      applicationDeadline: daysFromNow(28),
      description: {
        text: "Develop an AI-powered customer support chatbot with Hindi and English language support using NLP and machine learning. The chatbot should understand customer queries, provide accurate responses, and seamlessly hand off to human agents when needed.",
        responsibilities: [
          "Design conversational AI flows and intents for Hindi and English",
          "Train NLP models for intent recognition and entity extraction",
          "Integrate with existing CRM and ticketing systems",
          "Implement analytics dashboard for chatbot performance",
          "Deploy and maintain chatbot infrastructure on AWS Mumbai region",
        ],
        requirements: [
          "Expert-level experience with NLP/ML frameworks",
          "Proficiency in Python, TensorFlow/PyTorch",
          "Experience with chatbot platforms (Dialogflow, Rasa, etc.)",
          "Strong API integration skills",
        ],
        skills: ["Python", "Machine Learning", "NLP", "TensorFlow", "Chatbot", "API Integration"],
      },
      milestones: [],
      status: "open",
      applicants: 0,
      platformFeeRate: 4,
      applicationCap: null,
      applicationCapFeeRate: 2,
      platformFeeAmount: 12000,
      isBoosted: true,
      boostExpiresAt: null,
    },

    // -- Closed job (freelancer accepted & working) --
    {
      jobId: jobIds.closedJob,
      employerId: empId,
      title: "Company Website Development",
      budget: 50000,
      location: "Bengaluru, Karnataka",
      jobType: "freelance",
      experienceLevel: "Mid",
      remote: true,
      postedDate: daysAgo(30),
      applicationDeadline: daysAgo(10),
      description: {
        text: "Develop a modern corporate website with about page, services, portfolio, blog, and contact form. Must be responsive and SEO optimized for Indian search traffic.",
        responsibilities: [
          "Design and implement responsive web pages",
          "Set up CMS for blog management",
          "Optimize for SEO and performance",
          "Implement contact form with email integration",
        ],
        requirements: [
          "3+ years web development experience",
          "Strong HTML, CSS, and JavaScript skills",
          "Experience with React or Next.js",
        ],
        skills: ["React", "Next.js", "HTML/CSS", "SEO", "Responsive Design"],
      },
      milestones: [
        {
          milestoneId: milestoneIds.ip1,
          description: "Homepage & About page design and development",
          deadline: "2 weeks",
          payment: "15000",
          status: "paid",
          requested: false,
          completionPercentage: 100,
          subTasks: [],
        },
        {
          milestoneId: milestoneIds.ip2,
          description: "Services, Portfolio & Blog pages",
          deadline: "2 weeks",
          payment: "20000",
          status: "in-progress",
          requested: true,
          completionPercentage: 60,
          subTasks: [],
        },
        {
          milestoneId: milestoneIds.ip3,
          description: "Contact form, SEO & Final polish",
          deadline: "1 week",
          payment: "15000",
          status: "not-paid",
          requested: false,
          completionPercentage: 0,
          subTasks: [],
        },
      ],
      status: "closed",
      applicants: 3,
      assignedFreelancer: {
        freelancerId: flId,
        startDate: daysAgo(20),
        endDate: null,
        status: "working",
        employerRating: null,
        employerReview: "",
        rated: false,
      },
    },

    // -- In-progress job (with milestones at various stages) --
    {
      jobId: jobIds.inProgressJob,
      employerId: empId,
      title: "CRM System Backend API Development",
      budget: 90000,
      location: "Remote",
      jobType: "contract",
      experienceLevel: "Senior",
      remote: true,
      postedDate: daysAgo(45),
      applicationDeadline: daysAgo(25),
      description: {
        text: "Build a comprehensive CRM backend system with RESTful APIs for customer management, lead tracking, sales pipeline, and reporting modules tailored for the Indian B2B market.",
        responsibilities: [
          "Design database schema for CRM entities",
          "Develop RESTful APIs using Node.js and Express",
          "Implement authentication and role-based access control",
          "Create automated reporting and analytics endpoints",
          "Write comprehensive API documentation",
        ],
        requirements: [
          "5+ years of backend development experience",
          "Expertise in Node.js, Express, and MongoDB",
          "Experience with API design and documentation",
          "Knowledge of authentication systems (JWT, OAuth)",
        ],
        skills: ["Node.js", "Express.js", "MongoDB", "REST APIs", "JWT", "Docker"],
      },
      milestones: [
        {
          milestoneId: milestoneIds.ip4,
          description: "Database design & Auth system",
          deadline: "2 weeks",
          payment: "25000",
          status: "paid",
          requested: false,
          completionPercentage: 100,
          subTasks: [],
        },
        {
          milestoneId: uuidv4(),
          description: "Customer & Lead management APIs",
          deadline: "3 weeks",
          payment: "30000",
          status: "paid",
          requested: false,
          completionPercentage: 100,
          subTasks: [],
        },
        {
          milestoneId: uuidv4(),
          description: "Sales pipeline & Reporting module",
          deadline: "2 weeks",
          payment: "20000",
          status: "not-paid",
          requested: true,
          completionPercentage: 75,
          subTasks: [],
        },
        {
          milestoneId: uuidv4(),
          description: "API documentation & Final testing",
          deadline: "1 week",
          payment: "15000",
          status: "not-paid",
          requested: false,
          completionPercentage: 0,
          subTasks: [],
        },
      ],
      status: "closed",
      applicants: 5,
      assignedFreelancer: {
        freelancerId: flId,
        startDate: daysAgo(35),
        endDate: null,
        status: "working",
        employerRating: null,
        employerReview: "",
        rated: false,
      },
    },

    // -- Completed job (all milestones paid, rated) --
    {
      jobId: jobIds.completedJob,
      employerId: empId,
      title: "Landing Page Design & Development",
      budget: 25000,
      location: "Pune, Maharashtra",
      jobType: "freelance",
      experienceLevel: "Entry",
      remote: true,
      postedDate: daysAgo(60),
      applicationDeadline: daysAgo(45),
      description: {
        text: "Design and develop a high-converting landing page for our new SaaS product launch targeting the Indian startup ecosystem. The page should be visually appealing, fast, and optimized for conversions.",
        responsibilities: [
          "Design a modern, professional landing page",
          "Implement responsive layout for all devices",
          "Add animations and interactive elements",
          "Optimize for page speed and Core Web Vitals",
        ],
        requirements: [
          "Experience with landing page design",
          "Strong HTML/CSS skills",
          "Knowledge of conversion optimization techniques",
        ],
        skills: ["HTML/CSS", "JavaScript", "UI/UX Design", "Landing Pages"],
      },
      milestones: [
        {
          milestoneId: milestoneIds.comp1,
          description: "Wireframe & UI Design",
          deadline: "1 week",
          payment: "8000",
          status: "paid",
          requested: false,
          completionPercentage: 100,
          subTasks: [],
        },
        {
          milestoneId: milestoneIds.comp2,
          description: "Development & Responsiveness",
          deadline: "1 week",
          payment: "10000",
          status: "paid",
          requested: false,
          completionPercentage: 100,
          subTasks: [],
        },
        {
          milestoneId: milestoneIds.comp3,
          description: "Animations, Speed optimization & Delivery",
          deadline: "3 days",
          payment: "7000",
          status: "paid",
          requested: false,
          completionPercentage: 100,
          subTasks: [],
        },
      ],
      status: "completed",
      applicants: 4,
      assignedFreelancer: {
        freelancerId: flId,
        startDate: daysAgo(50),
        endDate: daysAgo(30),
        status: "finished",
        employerRating: 5,
        employerReview:
          "Outstanding work! Delivered ahead of schedule with incredible attention to detail. The landing page looks amazing and converts well. Highly recommend!",
        rated: true,
      },
    },

    // -- Left job (freelancer left mid-project) --
    {
      jobId: jobIds.leftJob,
      employerId: empId,
      title: "Legacy PHP System Migration",
      budget: 60000,
      location: "Chennai, Tamil Nadu",
      jobType: "contract",
      experienceLevel: "Mid",
      remote: false,
      postedDate: daysAgo(75),
      applicationDeadline: daysAgo(60),
      description: {
        text: "Migrate a legacy PHP monolith application to a modern microservices architecture using Node.js. The existing system handles inventory and order management for our warehouses across South India.",
        responsibilities: [
          "Analyze existing PHP codebase and database schema",
          "Design microservices architecture",
          "Implement key services in Node.js",
          "Ensure data migration integrity",
        ],
        requirements: [
          "Experience with PHP and Node.js",
          "Knowledge of microservices architecture",
          "Database migration experience",
        ],
        skills: ["PHP", "Node.js", "Microservices", "MySQL", "Docker"],
      },
      milestones: [
        {
          milestoneId: milestoneIds.left1,
          description: "Code audit & Architecture design",
          deadline: "2 weeks",
          payment: "20000",
          status: "paid",
          requested: false,
          completionPercentage: 100,
          subTasks: [],
        },
        {
          milestoneId: milestoneIds.left2,
          description: "Core services migration",
          deadline: "4 weeks",
          payment: "40000",
          status: "not-paid",
          requested: false,
          completionPercentage: 30,
          subTasks: [],
        },
      ],
      status: "open",
      applicants: 2,
      assignedFreelancer: {
        freelancerId: flId,
        startDate: daysAgo(65),
        endDate: daysAgo(40),
        status: "left",
        employerRating: 2,
        employerReview:
          "Left the project halfway through. Communication was decent initially but dropped off before leaving.",
        rated: true,
      },
    },
  ];

  await JobListing.insertMany(jobs);
  console.log(`   [OK] ${jobs.length} job listings created`);

  // -- 3. Job Applications ---------------------------------
  console.log("\n[3/13] Creating job applications...");

  const applications = [
    // Pending apps for open jobs
    {
      applicationId: uuidv4(),
      freelancerId: flId,
      jobId: jobIds.openJob1,
      coverMessage:
        "I am a highly experienced React Native developer with 4 years of building cross-platform mobile applications. I have published 8 apps on both App Store and Play Store with combined 5 lakh+ downloads. I have also integrated Razorpay and UPI in multiple apps. I would love to bring my expertise to your e-commerce mobile app project and deliver a polished, performant application.",
      resumeLink: "",
      appliedDate: daysAgo(2),
      status: "Pending",
      contactEmail: freelancerUser.email,
      skillRating: "4.7",
      availability: "immediate",
    },
    {
      applicationId: uuidv4(),
      freelancerId: flId,
      jobId: jobIds.openJob2,
      coverMessage:
        "With 5+ years of full-stack experience and expertise in React, Node.js, and MongoDB, I am the perfect fit for your e-commerce platform redesign. I have previously migrated three large-scale platforms with zero downtime and improved performance metrics by 60%. I have hands-on experience with Razorpay and Paytm integrations. I am excited about modernizing your tech stack and delivering a superior user experience.",
      resumeLink: "",
      appliedDate: daysAgo(4),
      status: "Pending",
      contactEmail: freelancerUser.email,
      skillRating: "4.7",
      availability: "notice",
    },
    // Accepted application (for the closed job)
    {
      applicationId: uuidv4(),
      freelancerId: flId,
      jobId: jobIds.closedJob,
      coverMessage:
        "I specialize in building modern corporate websites with React and Next.js. My portfolio includes 15+ responsive websites, all scoring 95+ on Google Lighthouse. I would be thrilled to create a stunning, SEO-optimized website for your company that truly represents your brand in the Indian market.",
      resumeLink: "",
      appliedDate: daysAgo(28),
      status: "Accepted",
      contactEmail: freelancerUser.email,
      skillRating: "4.7",
      availability: "immediate",
    },
    // Accepted for in-progress job
    {
      applicationId: uuidv4(),
      freelancerId: flId,
      jobId: jobIds.inProgressJob,
      coverMessage:
        "I have extensive experience building CRM systems and backend APIs. At my previous role at a Bengaluru-based SaaS company, I designed and implemented a CRM that serves 10,000+ daily active users. I am confident I can deliver a robust, scalable backend for your CRM project within the specified timeline.",
      resumeLink: "",
      appliedDate: daysAgo(42),
      status: "Accepted",
      contactEmail: freelancerUser.email,
      skillRating: "4.7",
      availability: "immediate",
    },
    // Accepted for completed job
    {
      applicationId: uuidv4(),
      freelancerId: flId,
      jobId: jobIds.completedJob,
      coverMessage:
        "Landing pages are my specialty! I have designed and developed over 30 high-converting landing pages for Indian SaaS companies and startups. My designs consistently achieve above-average conversion rates through strategic use of visual hierarchy, compelling copy placement, and optimized CTAs. Let me help make your product launch a success!",
      resumeLink: "",
      appliedDate: daysAgo(55),
      status: "Accepted",
      contactEmail: freelancerUser.email,
      skillRating: "4.7",
      availability: "immediate",
    },
    // Accepted for left job
    {
      applicationId: uuidv4(),
      freelancerId: flId,
      jobId: jobIds.leftJob,
      coverMessage:
        "I have worked on several PHP-to-Node.js migration projects and understand the complexities of modernizing legacy systems. I would love to help transform your monolith into a clean microservices architecture while ensuring data integrity throughout the process.",
      resumeLink: "",
      appliedDate: daysAgo(70),
      status: "Accepted",
      contactEmail: freelancerUser.email,
      skillRating: "4.7",
      availability: "immediate",
    },
  ];

  await JobApplication.insertMany(applications);

  // Update applicant counts for open jobs
  await JobListing.updateOne(
    { jobId: jobIds.openJob1 },
    { $set: { applicants: 1 } }
  );
  await JobListing.updateOne(
    { jobId: jobIds.openJob2 },
    { $set: { applicants: 1 } }
  );

  console.log(`   [OK] ${applications.length} job applications created`);

  // -- 4. Complaints ---------------------------------------
  console.log("\n[4/13] Creating complaints...");

  const complaints = [
    // Freelancer complaint - Pending
    {
      complainantType: "Freelancer",
      complainantId: flId,
      complainantName: freelancerUser.name,
      freelancerId: flId,
      freelancerName: freelancerUser.name,
      jobId: jobIds.closedJob,
      jobTitle: "Company Website Development",
      employerId: empId,
      employerName: "TechVision Solutions Pvt. Ltd.",
      complaintType: "Payment Issue",
      priority: "High",
      subject: "Milestone payment delayed beyond agreed timeline",
      description:
        "I completed the second milestone (Services, Portfolio & Blog pages) over a week ago and submitted all deliverables for review. The employer acknowledged the completion but has not released the payment yet. The agreement was to process payments within 3 business days of milestone completion. I have sent multiple follow-up messages but have not received a concrete timeline for payment.",
      status: "Pending",
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    },
    // Employer complaint - Under Review
    {
      complainantType: "Employer",
      complainantId: empId,
      complainantName: "TechVision Solutions Pvt. Ltd.",
      freelancerId: flId,
      freelancerName: freelancerUser.name,
      jobId: jobIds.leftJob,
      jobTitle: "Legacy PHP System Migration",
      employerId: empId,
      employerName: "TechVision Solutions Pvt. Ltd.",
      complaintType: "Contract Violation",
      priority: "High",
      subject: "Freelancer abandoned project without proper notice",
      description:
        "The freelancer working on our PHP migration project suddenly stopped responding to messages and officially left the project without completing the second milestone. This has caused significant delays to our roadmap. We paid for the first milestone in good faith but the freelancer left after barely starting the second phase. We need this resolved as it has caused both financial and scheduling damage to our project.",
      status: "Under Review",
      moderatorNotes:
        "Reviewing communication history between both parties. Will contact freelancer for their side of the story.",
      createdAt: daysAgo(35),
      updatedAt: daysAgo(10),
    },
    // Freelancer complaint - Resolved
    {
      complainantType: "Freelancer",
      complainantId: flId,
      complainantName: freelancerUser.name,
      freelancerId: flId,
      freelancerName: freelancerUser.name,
      jobId: jobIds.completedJob,
      jobTitle: "Landing Page Design & Development",
      employerId: empId,
      employerName: "TechVision Solutions Pvt. Ltd.",
      complaintType: "Scope Creep",
      priority: "Medium",
      subject: "Additional features requested beyond original scope",
      description:
        "During the landing page project, the employer requested several additional features that were not part of the original agreement, including a multi-language toggle, animated testimonials carousel, and an interactive pricing calculator. While I completed these to maintain good relations, I believe the extra work should be compensated fairly. The original budget did not account for these additions which took an extra 15+ hours of work.",
      status: "Resolved",
      moderatorNotes:
        "After reviewing the project scope and communication, both parties agreed to a fair resolution. Employer has provided a bonus payment of Rs. 5,000 for the additional work. Case closed.",
      createdAt: daysAgo(28),
      updatedAt: daysAgo(15),
      resolvedAt: daysAgo(15),
    },
    // Employer complaint - Pending (Communication)
    {
      complainantType: "Employer",
      complainantId: empId,
      complainantName: "TechVision Solutions Pvt. Ltd.",
      freelancerId: flId,
      freelancerName: freelancerUser.name,
      jobId: jobIds.inProgressJob,
      jobTitle: "CRM System Backend API Development",
      employerId: empId,
      employerName: "TechVision Solutions Pvt. Ltd.",
      complaintType: "Communication Issue",
      priority: "Low",
      subject: "Inconsistent communication and update frequency",
      description:
        "While the quality of work on the CRM project has been satisfactory, the freelancer has been inconsistent with daily standups and weekly progress reports that were agreed upon at the start of the project. There were multiple instances where I had to follow up for status updates. I would like the moderator to remind the freelancer about the agreed communication schedule and help establish a more reliable reporting cadence.",
      status: "Pending",
      createdAt: daysAgo(8),
      updatedAt: daysAgo(8),
    },
  ];

  await Complaint.insertMany(complaints);
  console.log(`   [OK] ${complaints.length} complaints created`);

  // -- 5. Blogs --------------------------------------------
  console.log("\n[5/13] Creating blog posts...");

  // Clear existing blogs
  await Blog.deleteMany({});

  const blogs = [
    {
      title: "10 Essential Tips for Freelance Success in India (2026)",
      tagline:
        "Master the freelance game with these proven strategies that top Indian freelancers swear by.",
      category: "Freelancing Tips",
      imageUrl:
        "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800",
      author: "FreelancerHub Team",
      content: [
        {
          heading: "Build a Strong Personal Brand",
          description:
            "Your personal brand is your most valuable asset as a freelancer. Create a professional portfolio website, maintain an active presence on LinkedIn and GitHub, and consistently showcase your best work. Indian clients are more likely to hire freelancers with a clear, professional brand identity.",
        },
        {
          heading: "Set Clear Expectations from Day One",
          description:
            "Before starting any project, ensure both you and your client are on the same page regarding scope, timeline, deliverables, and payment terms. A clear contract or project brief prevents misunderstandings and protects both parties. This is especially important when working with clients across different Indian states and time zones.",
        },
        {
          heading: "Never Stop Learning",
          description:
            "The tech landscape evolves rapidly. Dedicate at least 5-10 hours per week to learning new technologies, frameworks, or methodologies. Take courses on NPTEL, Coursera, or Udemy, attend webinars, and participate in developer communities like GDG India and HashnodeIndia to stay ahead of the curve.",
        },
        {
          heading: "Master Time Management",
          description:
            "Use tools like Toggl, Notion, or Trello to track your time and manage projects effectively. The Pomodoro technique works well for maintaining focus during coding sessions. Remember, as a freelancer, time is literally money.",
        },
      ],
      readTime: 8,
      featured: true,
      status: "published",
      views: 1247,
      likes: 89,
    },
    {
      title: "How to Negotiate Better Rates as an Indian Freelancer",
      tagline:
        "Stop undercharging and learn the art of negotiation to earn what you truly deserve.",
      category: "Career Advice",
      imageUrl:
        "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800",
      author: "FreelancerHub Team",
      content: [
        {
          heading: "Know Your Worth",
          description:
            "Research market rates for your skillset and experience level. Websites like Glassdoor India, AmbitionBox, and freelancer communities can help you benchmark your rates. Factor in your experience, specialization, and the value you bring to the table. Do not undersell yourself just because you are based in a Tier-2 or Tier-3 city.",
        },
        {
          heading: "Present Value, Not Hours",
          description:
            "Instead of charging by the hour, consider value-based pricing. Show clients the ROI they can expect from your work. A landing page that increases conversions by 30% is worth more than the hours it took to build. Indian startups especially appreciate this approach.",
        },
        {
          heading: "When to Walk Away",
          description:
            "Not every client is worth taking on. If a client consistently low-balls your rates or does not value your expertise, it is better to walk away and spend that time finding clients who appreciate quality work. Your skills have value - do not compromise.",
        },
      ],
      readTime: 6,
      featured: false,
      status: "published",
      views: 856,
      likes: 67,
    },
    {
      title: "The Remote Work Revolution: Tools Every Indian Freelancer Needs",
      tagline:
        "Boost your productivity with these essential tools and apps for remote freelancers working from India.",
      category: "Tools & Resources",
      imageUrl:
        "https://images.unsplash.com/photo-1600267185393-e158a98703de?w=800",
      author: "FreelancerHub Team",
      content: [
        {
          heading: "Communication Tools",
          description:
            "Slack for async communication, Google Meet or Zoom for video calls, and Loom for async video updates. These tools bridge the gap between you and your clients regardless of whether they are in Bengaluru, Mumbai, or overseas.",
        },
        {
          heading: "Project Management",
          description:
            "Notion for documentation, Trello or Jira for task tracking, and GitHub Projects for development workflows. A well-organized project board helps you and your clients stay aligned across different time zones.",
        },
        {
          heading: "Design & Development",
          description:
            "VS Code remains the gold standard for code editors. Figma for design collaboration, Postman for API testing, and Docker for consistent development environments. These tools are industry standards used by top IT companies in India.",
        },
      ],
      readTime: 5,
      featured: false,
      status: "published",
      views: 623,
      likes: 45,
    },
    {
      title: "From Side Hustle to Full-Time: An Indian Freelancer's Journey",
      tagline:
        "A real story of how one developer from Jaipur transitioned from a 9-to-5 job to a thriving freelance career.",
      category: "Success Stories",
      imageUrl:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",
      author: "FreelancerHub Team",
      content: [
        {
          heading: "The Spark",
          description:
            "It all started with a weekend project for a friend's sweet shop website in Jaipur. What seemed like a simple favour turned into a revelation - I could earn money doing what I loved, on my own terms. Within months, word of mouth brought me three more clients from Rajasthan itself.",
        },
        {
          heading: "The Leap of Faith",
          description:
            "After 8 months of freelancing on the side, I had built up a steady pipeline of clients and saved 6 months of living expenses. That was my signal to take the plunge and go full-time. The first month was terrifying, but by month three, I was earning 40% more than my TCS salary.",
        },
        {
          heading: "Lessons Learned",
          description:
            "Always have a financial buffer, never put all eggs in one client's basket, and invest in relationships. My biggest clients today came through referrals from past happy clients. The freelance life is not always glamorous, but the freedom and growth potential are unmatched - especially in India's booming digital economy.",
        },
      ],
      readTime: 7,
      featured: false,
      status: "published",
      views: 1089,
      likes: 112,
    },
    {
      title: "AI and the Future of Freelancing in India: What to Expect",
      tagline:
        "How artificial intelligence is reshaping the Indian freelance landscape and what it means for your career.",
      category: "Industry News",
      imageUrl:
        "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800",
      author: "FreelancerHub Team",
      content: [
        {
          heading: "AI as a Collaborator, Not a Competitor",
          description:
            "Rather than replacing freelancers, AI tools like GitHub Copilot, ChatGPT, and Midjourney are becoming powerful collaborators. Indian freelancers who learn to leverage these tools can deliver faster, higher-quality work and command premium rates in both domestic and international markets.",
        },
        {
          heading: "New Skill Demands",
          description:
            "The Indian market is increasingly demanding AI-adjacent skills: prompt engineering, ML model fine-tuning, AI integration, and data pipeline development. Freelancers who upskill in these areas through platforms like NPTEL, Coursera, or Andrew Ng's courses will have a significant competitive advantage.",
        },
        {
          heading: "The Human Touch Premium",
          description:
            "As AI-generated content becomes commonplace, the value of human creativity, strategic thinking, and personalised solutions will only increase. Clients across India and abroad will pay premium rates for freelancers who bring genuine expertise and nuanced understanding to their projects.",
        },
      ],
      readTime: 6,
      featured: false,
      status: "published",
      views: 934,
      likes: 78,
    },
    {
      title: "Mastering the Art of Productive Deep Work",
      tagline:
        "Unlock your peak performance by eliminating distractions and embracing deep work sessions.",
      category: "Productivity",
      imageUrl:
        "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800",
      author: "FreelancerHub Team",
      content: [
        {
          heading: "The 90-Minute Rule",
          description:
            "Research shows that our brains can sustain intense focus for about 90 minutes before needing a break. Structure your work in 90-minute deep work blocks followed by 15-20 minute chai breaks. During these blocks, eliminate all notifications and close unnecessary tabs.",
        },
        {
          heading: "Design Your Environment",
          description:
            "Create a dedicated workspace that signals 'work mode' to your brain. Whether you work from home in a 1BHK or a co-working space, use noise-cancelling headphones, keep your desk minimal, and invest in good lighting. Your environment has a direct impact on your ability to focus.",
        },
        {
          heading: "Batch Similar Tasks",
          description:
            "Group similar tasks together - respond to all emails at set times, schedule all client calls on specific days, and dedicate uninterrupted blocks for coding. Context switching is the biggest productivity killer for freelancers working on multiple projects.",
        },
      ],
      readTime: 5,
      featured: false,
      status: "published",
      views: 567,
      likes: 41,
    },
  ];

  await Blog.insertMany(blogs);
  console.log(`   [OK] ${blogs.length} blog posts created`);

  // -- 6. Quizzes & Badges ---------------------------------
  console.log("\n[6/13] Creating quizzes and badges...");

  await Quiz.deleteMany({});
  await Badge.deleteMany({});
  await UserBadge.deleteMany({});
  await Attempt.deleteMany({});

  const quiz1 = new Quiz({
    title: "JavaScript Mastery Quiz",
    skillName: "JavaScript",
    description:
      "Test your JavaScript knowledge covering ES6+, async programming, closures, prototypes, and modern patterns.",
    timeLimitMinutes: 15,
    passingScore: 60,
    maxViolations: 5,
    violationPenaltyPercent: 5,
    questions: [
      {
        text: "What is the output of: typeof null?",
        marks: 2,
        options: [
          { text: '"null"', isCorrect: false },
          { text: '"undefined"', isCorrect: false },
          { text: '"object"', isCorrect: true },
          { text: '"boolean"', isCorrect: false },
        ],
      },
      {
        text: "Which method creates a new array with all elements that pass the test implemented by the provided function?",
        marks: 2,
        options: [
          { text: "map()", isCorrect: false },
          { text: "filter()", isCorrect: true },
          { text: "reduce()", isCorrect: false },
          { text: "forEach()", isCorrect: false },
        ],
      },
      {
        text: "What does the 'use strict' directive do?",
        marks: 2,
        options: [
          { text: "Makes code run faster", isCorrect: false },
          {
            text: "Enforces stricter parsing and error handling",
            isCorrect: true,
          },
          { text: "Enables new ES6 features", isCorrect: false },
          { text: "Prevents code from running", isCorrect: false },
        ],
      },
      {
        text: "What is a closure in JavaScript?",
        marks: 3,
        options: [
          { text: "A way to close browser windows", isCorrect: false },
          {
            text: "A function that has access to variables in its outer scope",
            isCorrect: true,
          },
          { text: "A method to end a loop", isCorrect: false },
          { text: "A type of error handler", isCorrect: false },
        ],
      },
      {
        text: "Which of the following is NOT a valid way to declare a variable in modern JavaScript?",
        marks: 2,
        options: [
          { text: "let x = 5", isCorrect: false },
          { text: "const x = 5", isCorrect: false },
          { text: "var x = 5", isCorrect: false },
          { text: "int x = 5", isCorrect: true },
        ],
      },
      {
        text: "What will `Promise.all([promise1, promise2])` do if one promise rejects?",
        marks: 3,
        options: [
          { text: "Wait for all promises to settle", isCorrect: false },
          { text: "Immediately reject with the first rejection", isCorrect: true },
          { text: "Return an array of errors", isCorrect: false },
          { text: "Ignore the rejected promise", isCorrect: false },
        ],
      },
      {
        text: "What is the output of: `[1,2,3].map(num => num * 2)`?",
        marks: 2,
        hasCode: true,
        codeSnippet: "const result = [1, 2, 3].map(num => num * 2);\nconsole.log(result);",
        codeLanguage: "javascript",
        options: [
          { text: "[1, 2, 3]", isCorrect: false },
          { text: "[2, 4, 6]", isCorrect: true },
          { text: "[3, 6, 9]", isCorrect: false },
          { text: "6", isCorrect: false },
        ],
      },
    ],
  });
  await quiz1.save();

  const quiz2 = new Quiz({
    title: "React Fundamentals Assessment",
    skillName: "React",
    description:
      "Assess your React knowledge including hooks, state management, component lifecycle, and best practices.",
    timeLimitMinutes: 20,
    passingScore: 50,
    maxViolations: 5,
    violationPenaltyPercent: 5,
    questions: [
      {
        text: "What hook is used to perform side effects in a React functional component?",
        marks: 2,
        options: [
          { text: "useState", isCorrect: false },
          { text: "useEffect", isCorrect: true },
          { text: "useContext", isCorrect: false },
          { text: "useReducer", isCorrect: false },
        ],
      },
      {
        text: "What is the virtual DOM in React?",
        marks: 3,
        options: [
          {
            text: "A lightweight copy of the actual DOM kept in memory",
            isCorrect: true,
          },
          { text: "A browser API for fast rendering", isCorrect: false },
          { text: "The actual DOM after React renders", isCorrect: false },
          { text: "A CSS rendering engine", isCorrect: false },
        ],
      },
      {
        text: "Which of the following is the correct way to update state in a functional component?",
        marks: 2,
        options: [
          { text: "this.setState({ count: 1 })", isCorrect: false },
          { text: "state.count = 1", isCorrect: false },
          { text: "setCount(1)", isCorrect: true },
          { text: "updateState(count, 1)", isCorrect: false },
        ],
      },
      {
        text: "What is the purpose of React.memo()?",
        marks: 3,
        options: [
          { text: "To store data in memory", isCorrect: false },
          {
            text: "To memoize a component and prevent unnecessary re-renders",
            isCorrect: true,
          },
          { text: "To create a new component", isCorrect: false },
          { text: "To handle errors in components", isCorrect: false },
        ],
      },
      {
        text: "What is JSX?",
        marks: 2,
        options: [
          { text: "A new programming language", isCorrect: false },
          { text: "JavaScript XML - a syntax extension for JavaScript", isCorrect: true },
          { text: "A CSS preprocessor", isCorrect: false },
          { text: "A testing framework", isCorrect: false },
        ],
      },
    ],
  });
  await quiz2.save();

  // Create badges for quizzes
  const badge1 = new Badge({
    title: "JavaScript Expert",
    skillName: "JavaScript",
    description:
      "Earned by passing the JavaScript Mastery Quiz with 60% or higher",
    criteria: {
      type: "pass_quiz",
      quizId: String(quiz1._id),
      minPercentage: 60,
    },
  });
  await badge1.save();

  const badge2 = new Badge({
    title: "React Expert",
    skillName: "React",
    description:
      "Earned by passing the React Fundamentals Assessment with 50% or higher",
    criteria: {
      type: "pass_quiz",
      quizId: String(quiz2._id),
      minPercentage: 50,
    },
  });
  await badge2.save();

  console.log("   [OK] 2 quizzes and 2 badges created");

  // -- 7. Quiz Attempts & User Badges ----------------------
  console.log("\n[7/13] Creating quiz attempts and awarding badges...");

  // Passed attempt for JS quiz
  const jsAttempt = new Attempt({
    userId: flUserId,
    quizId: quiz1._id,
    answers: quiz1.questions.map((q, i) => ({
      questionId: q._id,
      selectedOptionIndex: q.options.findIndex((o) => o.isCorrect),
      awardedMarks: q.marks,
    })),
    totalMarks: quiz1.questions.reduce((s, q) => s + q.marks, 0),
    userMarks: quiz1.questions.reduce((s, q) => s + q.marks, 0),
    percentage: 100,
    passed: true,
    attemptNumber: 1,
    status: "submitted",
    startedAt: daysAgo(10),
    submittedAt: daysAgo(10),
    createdAt: daysAgo(10),
  });
  await jsAttempt.save();

  // Partially correct attempt for React quiz (pass)
  const reactAttempt = new Attempt({
    userId: flUserId,
    quizId: quiz2._id,
    answers: quiz2.questions.map((q, i) => ({
      questionId: q._id,
      selectedOptionIndex: i < 3 ? q.options.findIndex((o) => o.isCorrect) : 0,
      awardedMarks: i < 3 ? q.marks : 0,
    })),
    totalMarks: quiz2.questions.reduce((s, q) => s + q.marks, 0),
    userMarks: quiz2.questions
      .slice(0, 3)
      .reduce((s, q) => s + q.marks, 0),
    percentage: Math.round(
      (quiz2.questions.slice(0, 3).reduce((s, q) => s + q.marks, 0) /
        quiz2.questions.reduce((s, q) => s + q.marks, 0)) *
        100
    ),
    passed: true,
    attemptNumber: 1,
    status: "submitted",
    startedAt: daysAgo(8),
    submittedAt: daysAgo(8),
    createdAt: daysAgo(8),
  });
  await reactAttempt.save();

  // Award badges
  await UserBadge.create([
    { userId: flUserId, badgeId: badge1._id, awardedAt: daysAgo(10) },
    { userId: flUserId, badgeId: badge2._id, awardedAt: daysAgo(8) },
  ]);

  console.log("   [OK] 2 quiz attempts created, 2 badges awarded");

  // -- 8. Feedback -----------------------------------------
  console.log("\n[8/13] Creating feedback...");

  const feedbacks = [
    // Employer to Freelancer (on completed job)
    {
      jobId: jobIds.completedJob,
      fromUserId: empUserId,
      toUserId: flUserId,
      toRole: "Freelancer",
      rating: 5,
      comment:
        "Absolutely fantastic work on the landing page! Delivered ahead of schedule, communicated proactively, and the quality was top-notch. The page design is modern and the conversion rate has already improved by 25% since launch. Would definitely hire again for future projects!",
      tags: [
        "On Time",
        "Great Communication",
        "High Quality",
        "Creative",
        "Exceeds Expectations",
      ],
      anonymous: false,
    },
    // Freelancer to Employer (on completed job)
    {
      jobId: jobIds.completedJob,
      fromUserId: flUserId,
      toUserId: empUserId,
      toRole: "Employer",
      rating: 4,
      comment:
        "Good experience overall. The project requirements were clear, payments were processed on time, and the team was easy to communicate with. Only reason I am not giving 5 stars is because there was some scope creep mid-project, but it was handled fairly after discussion.",
      tags: ["Clear Requirements", "Timely Payments", "Professional"],
      anonymous: false,
    },
    // Employer to Freelancer (on left job)
    {
      jobId: jobIds.leftJob,
      fromUserId: empUserId,
      toUserId: flUserId,
      toRole: "Freelancer",
      rating: 2,
      comment:
        "Unfortunately, the freelancer left the project midway without adequate notice. The initial work on the code audit was decent, but the sudden departure caused significant project delays. I would recommend better communication if circumstances change.",
      tags: ["Incomplete", "Poor Communication"],
      anonymous: false,
    },
  ];

  await Feedback.insertMany(feedbacks);
  console.log(`   [OK] ${feedbacks.length} feedback entries created`);

  // -- 9. Questions & Answers ------------------------------
  console.log("\n[9/13] Creating Q&A on job listings...");

  const questionId1 = uuidv4();
  const questionId2 = uuidv4();
  const questionId3 = uuidv4();

  const questions = [
    {
      questionId: questionId1,
      jobId: jobIds.openJob1,
      askerId: flId,
      askerType: "Freelancer",
      askerName: freelancerUser.name,
      askerPicture: freelancerUser.picture || "",
      text: "What is the expected timeline for the complete mobile app development? Also, will the API documentation be provided upfront or will I need to work with the backend team to define endpoints?",
      answers: [
        {
          answerId: uuidv4(),
          answererId: empId,
          answererType: "Employer",
          answererName: employerUser.name,
          answererPicture: employerUser.picture || "",
          text: "We are targeting a 3-month timeline for the complete app. API documentation will be provided - our backend is already built and documented using Swagger. You will have full access to our staging environment from day one.",
          createdAt: daysAgo(1),
        },
      ],
      createdAt: daysAgo(2),
    },
    {
      questionId: questionId2,
      jobId: jobIds.openJob2,
      askerId: flId,
      askerType: "Freelancer",
      askerName: freelancerUser.name,
      askerPicture: freelancerUser.picture || "",
      text: "Is there a specific design system or UI framework preference for the frontend? Also, how many products does the current e-commerce platform handle approximately?",
      answers: [],
      createdAt: daysAgo(3),
    },
    {
      questionId: questionId3,
      jobId: jobIds.closedJob,
      askerId: flId,
      askerType: "Freelancer",
      askerName: freelancerUser.name,
      askerPicture: freelancerUser.picture || "",
      text: "Can you share the brand guidelines or any existing design assets I should follow for the website? Also, do you have preferences for the CMS (WordPress, Strapi, etc.)?",
      answers: [
        {
          answerId: uuidv4(),
          answererId: empId,
          answererType: "Employer",
          answererName: employerUser.name,
          answererPicture: employerUser.picture || "",
          text: "Yes! I will share our brand kit with you which includes logo variations, colour palette, and typography guidelines. For CMS, we prefer a headless solution - Strapi or Sanity would work perfectly. Let me know which you are more comfortable with.",
          createdAt: daysAgo(18),
        },
      ],
      createdAt: daysAgo(19),
    },
  ];

  await Question.insertMany(questions);
  console.log(`   [OK] ${questions.length} questions with answers created`);

  // -- 10. Conversations & Messages ------------------------
  console.log("\n[10/13] Creating chat conversations and messages...");

  const convId1 = uuidv4();
  const convId2 = uuidv4();

  // Employer <-> Freelancer conversation
  const messages1 = [
    {
      messageId: uuidv4(),
      conversationId: convId1,
      from: empUserId,
      to: flUserId,
      messageData:
        "Hi! I saw your application for the React Native project. Your experience looks impressive! Do you have time for a quick chat about the project requirements?",
      isRead: true,
      readAt: daysAgo(2),
      createdAt: daysAgo(3),
    },
    {
      messageId: uuidv4(),
      conversationId: convId1,
      from: flUserId,
      to: empUserId,
      messageData:
        "Namaste! Thank you for reaching out. Yes, I am very interested in the project. I have extensive experience with React Native and have built similar e-commerce apps before. I am available for a call anytime this week.",
      isRead: true,
      readAt: daysAgo(2),
      createdAt: daysAgo(3),
    },
    {
      messageId: uuidv4(),
      conversationId: convId1,
      from: empUserId,
      to: flUserId,
      messageData:
        "Great! Let us schedule a call for tomorrow at 3 PM IST. Also, regarding the Company Website project you are working on - the first milestone delivery looked fantastic! The homepage design is exactly what we envisioned.",
      isRead: true,
      readAt: daysAgo(1),
      createdAt: daysAgo(2),
    },
    {
      messageId: uuidv4(),
      conversationId: convId1,
      from: flUserId,
      to: empUserId,
      messageData:
        "Thank you! I am glad you liked it. Tomorrow at 3 PM IST works perfectly for me. I will also have an update on the Services page ready by then. Looking forward to the call!",
      isRead: true,
      readAt: daysAgo(1),
      createdAt: daysAgo(2),
    },
    {
      messageId: uuidv4(),
      conversationId: convId1,
      from: empUserId,
      to: flUserId,
      messageData:
        "Sounds perfect. By the way, I have also submitted the milestone 2 payment request review. You should see it processed within the next 2 business days. Keep up the great work!",
      isRead: false,
      createdAt: daysAgo(1),
    },
  ];

  // Moderator <-> Freelancer conversation
  const messages2 = [
    {
      messageId: uuidv4(),
      conversationId: convId2,
      from: modUserId,
      to: flUserId,
      messageData:
        "Hi there! I am following up on the complaint regarding the PHP Migration project. Could you share your side of the story about why you left the project?",
      isRead: true,
      readAt: daysAgo(7),
      createdAt: daysAgo(9),
    },
    {
      messageId: uuidv4(),
      conversationId: convId2,
      from: flUserId,
      to: modUserId,
      messageData:
        "Hi, thank you for reaching out. I had to leave due to a family emergency back home in my native place that required my full attention. I did try to communicate this to the employer, but I understand my departure was abrupt. I have since recovered and I am willing to discuss a fair resolution.",
      isRead: true,
      readAt: daysAgo(7),
      createdAt: daysAgo(8),
    },
    {
      messageId: uuidv4(),
      conversationId: convId2,
      from: modUserId,
      to: flUserId,
      messageData:
        "I understand, thank you for being transparent. I will work with both you and the employer to find a fair resolution. In the future, if you face any emergencies, please use our built-in leave notification system to formally inform your employer. This helps protect both parties.",
      isRead: true,
      readAt: daysAgo(6),
      createdAt: daysAgo(7),
    },
  ];

  // Create conversations
  const conv1 = new Conversation({
    conversationId: convId1,
    participants: [empUserId, flUserId],
    lastMessage: {
      messageId: messages1[messages1.length - 1].messageId,
      text: messages1[messages1.length - 1].messageData,
      sender: empUserId,
      timestamp: messages1[messages1.length - 1].createdAt,
    },
    unreadCount: new Map([
      [empUserId, 0],
      [flUserId, 1],
    ]),
  });
  await conv1.save();

  const conv2 = new Conversation({
    conversationId: convId2,
    participants: [modUserId, flUserId],
    lastMessage: {
      messageId: messages2[messages2.length - 1].messageId,
      text: messages2[messages2.length - 1].messageData,
      sender: modUserId,
      timestamp: messages2[messages2.length - 1].createdAt,
    },
    unreadCount: new Map([
      [modUserId, 0],
      [flUserId, 0],
    ]),
  });
  await conv2.save();

  await Message.insertMany([...messages1, ...messages2]);
  console.log(
    `   [OK] 2 conversations with ${messages1.length + messages2.length} messages created`
  );

  // -- 11. Notifications -----------------------------------
  console.log("\n[11/13] Creating notifications...");

  const notifications = [
    {
      notificationId: uuidv4(),
      userId: empUserId,
      type: "question_posted",
      title: "New Question on Your Job",
      message: `A freelancer asked a question about "React Native Mobile App Development"`,
      jobId: jobIds.openJob1,
      questionId: questionId1,
      fromUserId: flUserId,
      fromUserName: freelancerUser.name,
      read: false,
      createdAt: daysAgo(2),
    },
    {
      notificationId: uuidv4(),
      userId: empUserId,
      type: "question_posted",
      title: "New Question on Your Job",
      message: `A freelancer asked a question about "Full-Stack E-Commerce Website Redesign"`,
      jobId: jobIds.openJob2,
      questionId: questionId2,
      fromUserId: flUserId,
      fromUserName: freelancerUser.name,
      read: true,
      createdAt: daysAgo(3),
    },
    {
      notificationId: uuidv4(),
      userId: flUserId,
      type: "question_answered",
      title: "Your Question Was Answered",
      message: `${employerUser.name} answered your question about "React Native Mobile App Development"`,
      jobId: jobIds.openJob1,
      questionId: questionId1,
      fromUserId: empUserId,
      fromUserName: employerUser.name,
      read: false,
      createdAt: daysAgo(1),
    },
  ];

  await Notification.insertMany(notifications);
  console.log(`   [OK] ${notifications.length} notifications created`);

  // -- 12. Premium subscription ----------------------------
  console.log("\n[12/13] Setting up Premium subscription for employer...");

  const expiryDate = daysFromNow(90);
  await User.findOneAndUpdate(
    { userId: empUserId },
    {
      $set: {
        subscription: "Premium",
        subscriptionDuration: 3,
        subscriptionExpiryDate: expiryDate,
      },
    }
  );
  console.log(`   [OK] Employer upgraded to Premium (expires ${expiryDate.toLocaleDateString()})`);

  // -- 13. Rating audit trail ------------------------------
  console.log("\n[13/13] Creating rating audit trail...");

  const audits = [
    {
      targetUserId: flUserId,
      targetUserName: freelancerUser.name,
      targetUserRole: "Freelancer",
      previousRating: 4.5,
      newRating: 4.2,
      adjustment: -0.3,
      reason:
        "Rating adjustment following review of abandoned project (PHP Migration). The freelancer left the project without proper notice, impacting the employer's timeline.",
      relatedComplaintId: null,
      adjustedBy: modUserId,
      adjustedByName: moderatorUser.name,
      adjustedByRole: "Moderator",
      createdAt: daysAgo(12),
    },
    {
      targetUserId: flUserId,
      targetUserName: freelancerUser.name,
      targetUserRole: "Freelancer",
      previousRating: 4.2,
      newRating: 4.7,
      adjustment: 0.5,
      reason:
        "Rating restored after freelancer provided evidence of emergency circumstances and agreed to compensate the employer. Excellent track record on other projects.",
      relatedComplaintId: null,
      adjustedBy: modUserId,
      adjustedByName: moderatorUser.name,
      adjustedByRole: "Moderator",
      createdAt: daysAgo(6),
    },
  ];

  await RatingAudit.insertMany(audits);
  console.log(`   [OK] ${audits.length} rating audit entries created`);

  // -- Update employer's jobsPosted array ------------------
  await Employer.findOneAndUpdate(
    { employerId: empId },
    {
      $set: {
        jobsPosted: Object.values(jobIds),
      },
    }
  );

  // ------------------------------------------------------
  // DONE
  // ------------------------------------------------------
  console.log("\n" + "=".repeat(60));
  console.log("DEMO SEED COMPLETE!");
  console.log("=".repeat(60));
  console.log("\nSummary:");
  console.log(`   4 user profiles enriched`);
  console.log(`   ${jobs.length} job listings (open/closed/in-progress/completed/left/boosted)`);
  console.log(`   ${applications.length} job applications (pending/accepted)`);
  console.log(`   ${complaints.length} complaints (pending/under review/resolved)`);
  console.log(`   ${blogs.length} blog posts`);
  console.log(`   2 quizzes with badges`);
  console.log(`   2 quiz attempts + 2 badges awarded`);
  console.log(`   ${feedbacks.length} feedback entries`);
  console.log(`   ${questions.length} Q&A threads`);
  console.log(`   2 conversations, ${messages1.length + messages2.length} messages`);
  console.log(`   ${notifications.length} notifications`);
  console.log(`   1 premium subscription (Employer)`);
  console.log(`   ${audits.length} rating audit entries`);
  console.log("\nYou are ready to demo!\n");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[ERROR] Seed failed:", err);
  process.exit(1);
});
