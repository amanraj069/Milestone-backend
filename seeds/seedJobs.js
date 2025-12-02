const mongoose = require("mongoose");
const JobListing = require("../models/job_listing");

const jobs = [
  {
    employerId: "8f4e0b08-687f-4989-b9a9-36c795872dcf",
    title: "Software Engineer",
    budget: 1200000,
    location: "Bangalore, India",
    jobType: "full-time",
    experienceLevel: "Mid",
    remote: true,
    applicationDeadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    description: {
      text: "Join a leading tech company in Bangalore as a Software Engineer. Work on scalable web applications.",
      responsibilities: [
        "Develop and maintain web applications",
        "Collaborate with cross-functional teams",
      ],
      requirements: [
        "B.Tech in Computer Science",
        "2+ years experience in software development",
      ],
      skills: ["JavaScript", "React", "Node.js", "MongoDB"],
    },
    milestones: [
      {
        description: "Initial project setup and environment configuration",
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "₹200,000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Setup development environment",
            status: "pending",
            completedDate: null,
            notes: "Install required tools and dependencies.",
          },
        ],
        completionPercentage: 0,
      },
      {
        description: "Feature development phase",
        deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "₹600,000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Implement core features",
            status: "pending",
            completedDate: null,
            notes: "Focus on main modules.",
          },
        ],
        completionPercentage: 0,
      },
    ],
  },
  {
    employerId: "8f4e0b08-687f-4989-b9a9-36c795872dcf",
    title: "Digital Marketing Specialist",
    budget: 600000,
    location: "Mumbai, India",
    jobType: "full-time",
    experienceLevel: "Entry",
    remote: false,
    applicationDeadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    description: {
      text: "Work with a top e-commerce brand to drive digital campaigns and social media engagement.",
      responsibilities: [
        "Plan and execute digital marketing campaigns",
        "Analyze campaign performance",
      ],
      requirements: ["Bachelor's degree", "Strong communication skills"],
      skills: ["SEO", "Google Ads", "Social Media Marketing"],
    },
    milestones: [
      {
        description: "Campaign planning and strategy",
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "₹100,000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Research target audience",
            status: "pending",
            completedDate: null,
            notes: "Gather demographic data.",
          },
        ],
        completionPercentage: 0,
      },
      {
        description: "Campaign execution and analysis",
        deadline: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "₹200,000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Launch and monitor campaigns",
            status: "pending",
            completedDate: null,
            notes: "Track KPIs and ROI.",
          },
        ],
        completionPercentage: 0,
      },
    ],
  },
  {
    employerId: "8f4e0b08-687f-4989-b9a9-36c795872dcf",
    title: "Civil Engineer",
    budget: 900000,
    location: "Delhi, India",
    jobType: "contract",
    experienceLevel: "Senior",
    remote: false,
    applicationDeadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    description: {
      text: "Supervise infrastructure projects for a government contractor in Delhi.",
      responsibilities: ["Project supervision", "Quality assurance"],
      requirements: ["B.E. in Civil Engineering", "5+ years experience"],
      skills: ["AutoCAD", "Project Management", "Site Supervision"],
    },
    milestones: [
      {
        description: "Site survey and planning",
        deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "₹150,000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Conduct initial site survey",
            status: "pending",
            completedDate: null,
            notes: "Document site conditions.",
          },
        ],
        completionPercentage: 0,
      },
      {
        description: "Project execution and supervision",
        deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "₹300,000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Supervise construction activities",
            status: "pending",
            completedDate: null,
            notes: "Ensure quality standards.",
          },
        ],
        completionPercentage: 0,
      },
    ],
  },
];

async function seedJobs() {
  await mongoose.connect("mongodb://localhost:27017/milestone");
  await JobListing.insertMany(jobs);
  console.log("Indian jobs seeded successfully.");
  await mongoose.disconnect();
}

seedJobs();
