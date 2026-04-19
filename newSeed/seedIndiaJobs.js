/**
 * ============================================================
 *  INDIAN JOB LISTINGS SEED SCRIPT (WITH MILESTONES)
 *  Adds 15 BRAND NEW Indian-specific jobs with milestones.
 *  Run:  node newSeed/seedIndiaJobs.js
 * ============================================================
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

// Load Environment Variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Models
const User = require("../models/user");
const Employer = require("../models/employer");
const JobListing = require("../models/job_listing");

// Helpers
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

async function main() {
  const connectionString =
    process.env.MONGO_URL || "mongodb://127.0.0.1:27017/milestone";
  
  console.log(`[SEED] Connecting to ${connectionString}...`);
  
  try {
    await mongoose.connect(connectionString, {
      serverSelectionTimeoutMS: 20000,
    });
    console.log("[OK] Connected to MongoDB");

    // 1. Find an existing Employer
    const employerUser = await User.findOne({ role: "Employer" });
    if (!employerUser) {
      console.error("[ERROR] No user with role 'Employer' found in the database.");
      process.exit(1);
    }

    const employer = await Employer.findOne({ userId: employerUser.userId });
    if (!employer) {
      console.error(`[ERROR] Employer record not found for user ${employerUser.userId}`);
      process.exit(1);
    }

    const empId = employer.employerId;
    console.log(`[INFO] Adding jobs to Employer: ${employerUser.name} (${empId})`);

    // 1.5 Find an existing Freelancer to assign these jobs to
    const freelancerUser = await User.findOne({ role: "Freelancer" });
    if (!freelancerUser) {
      console.warn("[WARN] No user with role 'Freelancer' found. Jobs will be unassigned.");
    }
    const freelancer = freelancerUser ? await mongoose.model("Freelancer").findOne({ userId: freelancerUser.userId }) : null;
    const flId = freelancer?.freelancerId || null;
    if (flId) {
      console.log(`[INFO] Assigning jobs to Freelancer: ${freelancerUser.name} (${flId})`);
    }

    // 2. Define 15 BRAND NEW Indian Job Listings with Milestones
    const jobs = [
      {
        jobId: uuidv4(),
        employerId: empId,
        title: "Full-Stack Developer (MERN Stack)",
        budget: 200000,
        location: "Bangalore, Karnataka",
        jobType: "full-time",
        experienceLevel: "Senior",
        remote: true,
        postedDate: daysAgo(2),
        applicationDeadline: daysFromNow(20),
        description: {
          text: "Senior developer needed for a high-growth fintech startup in Bangalore. You will be responsible for scaling our core platform.",
          responsibilities: ["Lead the development of new features", "Mentor junior developers", "Optimize system performance"],
          requirements: ["5+ years experience in MERN stack", "Deep understanding of microservices", "Experience with AWS/GCP"],
          skills: ["MongoDB", "Express", "React", "Node.js", "AWS"]
        },
        milestones: [
          { milestoneId: uuidv4(), description: "System Architecture & Backend Setup", deadline: "3 weeks", payment: "70000", status: "not-paid" },
          { milestoneId: uuidv4(), description: "Frontend Development & API Integration", deadline: "4 weeks", payment: "80000", status: "not-paid" },
          { milestoneId: uuidv4(), description: "Testing & Final Deployment", deadline: "2 weeks", payment: "50000", status: "not-paid" }
        ],
        status: "open",
        applicants: 0,
        assignedFreelancer: flId ? {
          freelancerId: flId,
          startDate: daysAgo(5),
          status: "working"
        } : null
      },
      {
        jobId: uuidv4(),
        employerId: empId,
        title: "Shopify Store Expert",
        budget: 50000,
        location: "Jaipur, Rajasthan",
        jobType: "freelance",
        experienceLevel: "Mid",
        remote: true,
        postedDate: daysAgo(5),
        applicationDeadline: daysFromNow(15),
        description: {
          text: "Set up and customize a premium Shopify store for a luxury ethnic wear brand based in Jaipur.",
          responsibilities: ["Store setup & theme customization", "App integration", "Product listing"],
          requirements: ["Proven experience with Shopify", "Portfolio of successful store launches"],
          skills: ["Shopify", "Liquid", "E-commerce"]
        },
        milestones: [
          { milestoneId: uuidv4(), description: "Initial Store Setup & Theme Selection", deadline: "1 week", payment: "20000", status: "not-paid" },
          { milestoneId: uuidv4(), description: "Custom UI Design & App Integrations", deadline: "10 days", payment: "30000", status: "not-paid" }
        ],
        status: "open",
        applicants: 0,
        assignedFreelancer: flId ? {
          freelancerId: flId,
          startDate: daysAgo(5),
          status: "working"
        } : null
      },
      {
        jobId: uuidv4(),
        employerId: empId,
        title: "Data Scientist (ML)",
        budget: 150000,
        location: "Mumbai, Maharashtra",
        jobType: "full-time",
        experienceLevel: "Senior",
        remote: true,
        postedDate: daysAgo(1),
        applicationDeadline: daysFromNow(30),
        description: {
          text: "Expert in Machine Learning and Data Science to help us improve our recommendation algorithms.",
          responsibilities: ["Develop ML models", "Analyze large datasets", "A/B testing"],
          requirements: ["3+ years experience in Data Science", "Proficient in Python/R", "Strong statistics background"],
          skills: ["Python", "TensorFlow", "Pandas", "Machine Learning"]
        },
        milestones: [
          { milestoneId: uuidv4(), description: "Exploratory Data Analysis & Feature Engineering", deadline: "2 weeks", payment: "50000", status: "not-paid" },
          { milestoneId: uuidv4(), description: "Model Training & Validation", deadline: "4 weeks", payment: "100000", status: "not-paid" }
        ],
        status: "open",
        applicants: 0,
        assignedFreelancer: flId ? {
          freelancerId: flId,
          startDate: daysAgo(5),
          status: "working"
        } : null
      },
      {
        jobId: uuidv4(),
        employerId: empId,
        title: "Tech Content Writer",
        budget: 30000,
        location: "Pune, Maharashtra",
        jobType: "part-time",
        experienceLevel: "Mid",
        remote: true,
        postedDate: daysAgo(3),
        applicationDeadline: daysFromNow(10),
        description: {
          text: "Write 10 high-quality technical blogs per month for our engineering blog.",
          responsibilities: ["Research technical topics", "Write clear, concise blogs", "Coordinate with dev team"],
          requirements: ["Experience in tech writing", "Understand software dev concepts"],
          skills: ["Technical Writing", "SEO", "Engineering Knowledge"]
        },
        milestones: [
          { milestoneId: uuidv4(), description: "10 Technical Blog Posts (Batch 1)", deadline: "4 weeks", payment: "30000", status: "not-paid" }
        ],
        status: "open",
        applicants: 0,
        assignedFreelancer: flId ? {
          freelancerId: flId,
          startDate: daysAgo(5),
          status: "working"
        } : null
      },
      {
        jobId: uuidv4(),
        employerId: empId,
        title: "Product Designer (UI/UX)",
        budget: 80000,
        location: "Hyderabad, Telangana",
        jobType: "contract",
        experienceLevel: "Mid",
        remote: false,
        postedDate: daysAgo(4),
        applicationDeadline: daysFromNow(25),
        description: {
          text: "Design the user interface and experience for our new mobile app.",
          responsibilities: ["Create wireframes", "High-fidelity UI design", "User testing"],
          requirements: ["Expertise in Figma", "Strong UX portfolio", "3+ years experience"],
          skills: ["Figma", "UI Design", "UX Research"]
        },
        milestones: [
          { milestoneId: uuidv4(), description: "User Research & Wireframing", deadline: "2 weeks", payment: "30000", status: "not-paid" },
          { milestoneId: uuidv4(), description: "High-Fidelity UI Design (Figma)", deadline: "3 weeks", payment: "50000", status: "not-paid" }
        ],
        status: "open",
        applicants: 0,
        assignedFreelancer: flId ? {
          freelancerId: flId,
          startDate: daysAgo(5),
          status: "working"
        } : null
      },
      {
        jobId: uuidv4(),
        employerId: empId,
        title: "Mobile App Developer (Flutter)",
        budget: 120000,
        location: "Ahmedabad, Gujarat",
        jobType: "full-time",
        experienceLevel: "Mid",
        remote: true,
        postedDate: daysAgo(1),
        applicationDeadline: daysFromNow(20),
        description: {
          text: "Develop a cross-platform mobile application using Flutter.",
          responsibilities: ["Build mobile app UI", "Integrate APIs", "Ensure app performance"],
          requirements: ["Strong Dart/Flutter skills", "Experience with state management"],
          skills: ["Flutter", "Dart", "Firebase"]
        },
        milestones: [
          { milestoneId: uuidv4(), description: "Base Application Framework & UI", deadline: "4 weeks", payment: "60000", status: "not-paid" },
          { milestoneId: uuidv4(), description: "API Integration & Final Build", deadline: "4 weeks", payment: "60000", status: "not-paid" }
        ],
        status: "open",
        applicants: 0,
        assignedFreelancer: flId ? {
          freelancerId: flId,
          startDate: daysAgo(5),
          status: "working"
        } : null
      },
      {
        jobId: uuidv4(),
        employerId: empId,
        title: "SEO Specialist",
        budget: 40000,
        location: "New Delhi",
        jobType: "contract",
        experienceLevel: "Mid",
        remote: true,
        postedDate: daysAgo(6),
        applicationDeadline: daysFromNow(22),
        description: {
          text: "Optimize our website for search engines and improve organic traffic.",
          responsibilities: ["Keyword research", "On-page & off-page SEO", "Backlink building"],
          requirements: ["Proven SEO success", "Experience with Google Analytics"],
          skills: ["SEO", "Google Search Console", "Content Strategy"]
        },
        milestones: [
          { milestoneId: uuidv4(), description: "Keyword Research & Site Audit", deadline: "2 weeks", payment: "15000", status: "not-paid" },
          { milestoneId: uuidv4(), description: "On-Page Optimization & Initial Backlinks", deadline: "6 weeks", payment: "25000", status: "not-paid" }
        ],
        status: "open",
        applicants: 0,
        assignedFreelancer: flId ? {
          freelancerId: flId,
          startDate: daysAgo(5),
          status: "working"
        } : null
      },
      {
        jobId: uuidv4(),
        employerId: empId,
        title: "Cloud DevOps Engineer",
        budget: 180000,
        location: "Chennai, Tamil Nadu",
        jobType: "full-time",
        experienceLevel: "Expert",
        remote: true,
        postedDate: daysAgo(2),
        applicationDeadline: daysFromNow(18),
        description: {
          text: "Lead our cloud infrastructure management and automation efforts.",
          responsibilities: ["Manage AWS infrastructure", "Set up CI/CD pipelines", "Automation scripting"],
          requirements: ["5+ years in DevOps", "Expert in AWS/Terraform", "Kubernetes experience"],
          skills: ["AWS", "Terraform", "Kubernetes", "Docker"]
        },
        milestones: [
          { milestoneId: uuidv4(), description: "Infrastructure as Code Setup (Terraform)", deadline: "4 weeks", payment: "90000", status: "not-paid" },
          { milestoneId: uuidv4(), description: "CI/CD Pipeline & Monitoring Setup", deadline: "4 weeks", payment: "90000", status: "not-paid" }
        ],
        status: "open",
        applicants: 0,
        assignedFreelancer: flId ? {
          freelancerId: flId,
          startDate: daysAgo(5),
          status: "working"
        } : null
      },
      {
        jobId: uuidv4(),
        employerId: empId,
        title: "Graphic Designer (Social Media)",
        budget: 25000,
        location: "Indore, Madhya Pradesh",
        jobType: "freelance",
        experienceLevel: "Entry",
        remote: true,
        postedDate: daysAgo(5),
        applicationDeadline: daysFromNow(14),
        description: {
          text: "Create high-quality social media creative and ads for our various brands.",
          responsibilities: ["Design social media posts", "Create ad banners", "Photo editing"],
          requirements: ["Creative eye", "Proficient in Adobe Suite", "Quick turnaround"],
          skills: ["Photoshop", "Illustrator", "Canva"]
        },
        milestones: [
          { milestoneId: uuidv4(), description: "20 High-Quality Social Media Creative Items", deadline: "4 weeks", payment: "25000", status: "not-paid" }
        ],
        status: "open",
        applicants: 0,
        assignedFreelancer: flId ? {
          freelancerId: flId,
          startDate: daysAgo(5),
          status: "working"
        } : null
      },
      {
        jobId: uuidv4(),
        employerId: empId,
        title: "QA Automation Engineer",
        budget: 90000,
        location: "Noida, Uttar Pradesh",
        jobType: "full-time",
        experienceLevel: "Mid",
        remote: false,
        postedDate: daysAgo(10),
        applicationDeadline: daysFromNow(12),
        description: {
          text: "Build and maintain automated test suites for our core products.",
          responsibilities: ["Write test cases", "Automate UI/API tests", "Report bugs"],
          requirements: ["3+ years in QA automation", "Proficient in Selenium/Playwright"],
          skills: ["Selenium", "JavaScript", "Manual Testing"]
        },
        milestones: [
          { milestoneId: uuidv4(), description: "Automation Framework Setup", deadline: "3 weeks", payment: "40000", status: "not-paid" },
          { milestoneId: uuidv4(), description: "Core Product Test Suite Coverage", deadline: "5 weeks", payment: "50000", status: "not-paid" }
        ],
        status: "open",
        applicants: 0,
        assignedFreelancer: flId ? {
          freelancerId: flId,
          startDate: daysAgo(5),
          status: "working"
        } : null
      },
      {
        jobId: uuidv4(),
        employerId: empId,
        title: "Web3/Blockchain Developer",
        budget: 250000,
        location: "Bangalore",
        jobType: "full-time",
        experienceLevel: "Expert",
        remote: true,
        postedDate: daysAgo(4),
        applicationDeadline: daysFromNow(25),
        description: {
          text: "Develop decentralized applications and smart contracts for our Web3 platform.",
          responsibilities: ["Write smart contracts", "Build DApp integration", "Analyze blockchain data"],
          requirements: ["Experience with Solidity", "Understanding of Web3.js / Ethers.js", "Knowledge of Ethereum/Polygon"],
          skills: ["Solidity", "Web3.js", "Ethereum", "Smart Contracts"]
        },
        milestones: [
          { milestoneId: uuidv4(), description: "Smart Contract Development & Auditing", deadline: "5 weeks", payment: "120000", status: "not-paid" },
          { milestoneId: uuidv4(), description: "DApp UI & Contract Integration", deadline: "5 weeks", payment: "130000", status: "not-paid" }
        ],
        status: "open",
        applicants: 0,
        assignedFreelancer: flId ? {
          freelancerId: flId,
          startDate: daysAgo(5),
          status: "working"
        } : null
      },
      {
        jobId: uuidv4(),
        employerId: empId,
        title: "Video Editor (YouTube)",
        budget: 45000,
        location: "Mumbai",
        jobType: "part-time",
        experienceLevel: "Mid",
        remote: true,
        postedDate: daysAgo(7),
        applicationDeadline: daysFromNow(15),
        description: {
          text: "Edit high-quality video content for our tech-focused YouTube channel.",
          responsibilities: ["Edit raw footage", "Add motion graphics", "Color grading"],
          requirements: ["Expertise in Premiere Pro / FCP", "Creative storytelling ability"],
          skills: ["Video Editing", "After Effects", "Motion Graphics"]
        },
        milestones: [
          { milestoneId: uuidv4(), description: "5 Polished YouTube Video Edits", deadline: "4 weeks", payment: "45000", status: "not-paid" }
        ],
        status: "open",
        applicants: 0,
        assignedFreelancer: flId ? {
          freelancerId: flId,
          startDate: daysAgo(5),
          status: "working"
        } : null
      },
      {
        jobId: uuidv4(),
        employerId: empId,
        title: "Digital Marketing Strategist",
        budget: 75000,
        location: "Gurugram",
        jobType: "contract",
        experienceLevel: "Mid",
        remote: true,
        postedDate: daysAgo(3),
        applicationDeadline: daysFromNow(20),
        description: {
          text: "Develop and execute digital marketing strategies to improve brand reach.",
          responsibilities: ["Develop marketing strategy", "Manage campaign budgets", "Analyze campaign performance"],
          requirements: ["3+ years digital marketing experience", "Data-driven mindset", "Strong analytical skills"],
          skills: ["Google Ads", "Social Media Marketing", "Data Analytics"]
        },
        milestones: [
          { milestoneId: uuidv4(), description: "Comprehensive Strategy Development", deadline: "2 weeks", payment: "25000", status: "not-paid" },
          { milestoneId: uuidv4(), description: "Campaign Execution & Optimization (Phase 1)", deadline: "6 weeks", payment: "50000", status: "not-paid" }
        ],
        status: "open",
        applicants: 0,
        assignedFreelancer: flId ? {
          freelancerId: flId,
          startDate: daysAgo(5),
          status: "working"
        } : null
      },
      {
        jobId: uuidv4(),
        employerId: empId,
        title: "Python Automation Specialist",
        budget: 60000,
        location: "Kolkata",
        jobType: "contract",
        experienceLevel: "Mid",
        remote: true,
        postedDate: daysAgo(9),
        applicationDeadline: daysFromNow(15),
        description: {
          text: "Write custom Python scripts to automate internal business processes.",
          responsibilities: ["Write automation scripts", "Integrate with various APIs", "Documentation"],
          requirements: ["Proficient in Python", "Experience with web scraping & APIs"],
          skills: ["Python", "Scraping", "Automation", "REST APIs"]
        },
        milestones: [
          { milestoneId: uuidv4(), description: "3 Custom Automation Scripts", deadline: "4 weeks", payment: "60000", status: "not-paid" }
        ],
        status: "open",
        applicants: 0,
        assignedFreelancer: flId ? {
          freelancerId: flId,
          startDate: daysAgo(5),
          status: "working"
        } : null
      },
      {
        jobId: uuidv4(),
        employerId: empId,
        title: "Business Analyst",
        budget: 55000,
        location: "Lucknow",
        jobType: "full-time",
        experienceLevel: "Entry",
        remote: false,
        postedDate: daysAgo(11),
        applicationDeadline: daysFromNow(10),
        description: {
          text: "Work with stakeholders to gather requirements and define business processes.",
          responsibilities: ["Requirement gathering", "Process documentation", "Liaison between dev & biz teams"],
          requirements: ["Excellent communication", "Strong analytical skills", "BBA/MBA background preferred"],
          skills: ["Business Analysis", "Documentation", "Process Improvement"]
        },
        milestones: [
          { milestoneId: uuidv4(), description: "Business Requirements Documentation", deadline: "2 weeks", payment: "25000", status: "not-paid" },
          { milestoneId: uuidv4(), description: "Business Process Maps & Workflows", deadline: "3 weeks", payment: "30000", status: "not-paid" }
        ],
        status: "open",
        applicants: 0
      }
    ];

    // 3. Insert Jobs
    console.log(`[SEED] Inserting ${jobs.length} BRAND NEW job listings...`);
    const result = await JobListing.insertMany(jobs);
    console.log(`[OK] Successfully added ${result.length} jobs with milestones!`);

  } catch (error) {
    console.error("[ERROR] Seeding failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("[SEED] Disconnected from MongoDB.");
    process.exit(0);
  }
}

main();
