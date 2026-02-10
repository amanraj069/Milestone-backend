const mongoose = require("mongoose");
const JobListing = require("../models/job_listing");
const dotenv = require("dotenv");

dotenv.config();

const jobs = [
  {
    employerId: "2032fc33-3428-4106-8009-e9d576d4bff9",
    title: "Software Engineer",
    imageUrl:
      "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80",
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
        payment: "200000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Setup development environment",
            status: "pending",
            completedDate: null,
            notes: "Install required tools and dependencies.",
          },
          {
            description: "Configure version control",
            status: "pending",
            completedDate: null,
            notes: "Set up Git repository and branches.",
          },
        ],
        completionPercentage: 0,
      },
      {
        description: "Feature development phase",
        deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "600000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Implement core features",
            status: "pending",
            completedDate: null,
            notes: "Focus on main modules.",
          },
          {
            description: "Write unit tests",
            status: "pending",
            completedDate: null,
            notes: "Ensure code coverage above 80%.",
          },
          {
            description: "Integrate APIs",
            status: "pending",
            completedDate: null,
            notes: "Connect to backend services.",
          },
        ],
        completionPercentage: 0,
      },
      {
        description: "Testing and deployment",
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "400000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Conduct integration testing",
            status: "pending",
            completedDate: null,
            notes: "Test end-to-end workflows.",
          },
        ],
        completionPercentage: 0,
      },
    ],
  },
  {
    employerId: "2032fc33-3428-4106-8009-e9d576d4bff9",
    title: "Digital Marketing Specialist",
    imageUrl:
      "https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?w=800&q=80",
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
        payment: "100000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Research target audience",
            status: "pending",
            completedDate: null,
            notes: "Gather demographic data.",
          },
          {
            description: "Develop content calendar",
            status: "pending",
            completedDate: null,
            notes: "Plan posts for 30 days.",
          },
        ],
        completionPercentage: 0,
      },
      {
        description: "Campaign execution and analysis",
        deadline: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "200000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Launch and monitor campaigns",
            status: "pending",
            completedDate: null,
            notes: "Track KPIs and ROI.",
          },
          {
            description: "Optimize ad spend",
            status: "pending",
            completedDate: null,
            notes: "Adjust bids based on performance.",
          },
        ],
        completionPercentage: 0,
      },
      {
        description: "Reporting and recommendations",
        deadline: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "300000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Generate performance report",
            status: "pending",
            completedDate: null,
            notes: "Include metrics and insights.",
          },
        ],
        completionPercentage: 0,
      },
    ],
  },
  {
    employerId: "2032fc33-3428-4106-8009-e9d576d4bff9",
    title: "Civil Engineer",
    imageUrl:
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80",
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
        payment: "150000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Conduct initial site survey",
            status: "pending",
            completedDate: null,
            notes: "Document site conditions.",
          },
          {
            description: "Prepare blueprints",
            status: "pending",
            completedDate: null,
            notes: "Update designs in AutoCAD.",
          },
        ],
        completionPercentage: 0,
      },
      {
        description: "Project execution and supervision",
        deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "300000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Supervise construction activities",
            status: "pending",
            completedDate: null,
            notes: "Ensure quality standards.",
          },
          {
            description: "Manage material procurement",
            status: "pending",
            completedDate: null,
            notes: "Order supplies on time.",
          },
          {
            description: "Conduct safety audits",
            status: "pending",
            completedDate: null,
            notes: "Check compliance with regulations.",
          },
        ],
        completionPercentage: 0,
      },
      {
        description: "Final inspection and handover",
        deadline: new Date(Date.now() + 19 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "450000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Perform quality checks",
            status: "pending",
            completedDate: null,
            notes: "Verify all work against specs.",
          },
        ],
        completionPercentage: 0,
      },
    ],
  },
  {
    employerId: "2032fc33-3428-4106-8009-e9d576d4bff9",
    title: "Data Scientist",
    imageUrl:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
    budget: 1500000,
    location: "Hyderabad, India",
    jobType: "full-time",
    experienceLevel: "Senior",
    remote: true,
    applicationDeadline: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000),
    description: {
      text: "Analyze large datasets to derive insights for a fintech startup in Hyderabad.",
      responsibilities: [
        "Build machine learning models",
        "Data visualization and reporting",
      ],
      requirements: [
        "M.Tech in Data Science or related",
        "4+ years in data analysis",
      ],
      skills: ["Python", "SQL", "TensorFlow", "Tableau"],
    },
    milestones: [
      {
        description: "Data collection and preprocessing",
        deadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "250000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Gather datasets from sources",
            status: "pending",
            completedDate: null,
            notes: "Clean and normalize data.",
          },
          {
            description: "Handle missing values",
            status: "pending",
            completedDate: null,
            notes: "Impute or remove anomalies.",
          },
        ],
        completionPercentage: 0,
      },
      {
        description: "Model development and training",
        deadline: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "700000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Select algorithms",
            status: "pending",
            completedDate: null,
            notes: "Compare regression vs. classification.",
          },
          {
            description: "Train and validate models",
            status: "pending",
            completedDate: null,
            notes: "Use cross-validation techniques.",
          },
        ],
        completionPercentage: 0,
      },
      {
        description: "Insights generation and deployment",
        deadline: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "550000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Create dashboards",
            status: "pending",
            completedDate: null,
            notes: "Use Tableau for visualizations.",
          },
          {
            description: "Deploy model to production",
            status: "pending",
            completedDate: null,
            notes: "Integrate with API endpoints.",
          },
        ],
        completionPercentage: 0,
      },
    ],
  },
  {
    employerId: "2032fc33-3428-4106-8009-e9d576d4bff9",
    title: "UI/UX Designer",
    imageUrl:
      "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=80",
    budget: 800000,
    location: "Chennai, India",
    jobType: "freelance",
    experienceLevel: "Mid",
    remote: true,
    applicationDeadline: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
    description: {
      text: "Design intuitive user interfaces for a mobile app in Chennai.",
      responsibilities: [
        "Create wireframes and prototypes",
        "User research and testing",
      ],
      requirements: ["Bachelor's in Design", "3+ years in UI/UX"],
      skills: ["Figma", "Adobe XD", "User Research", "Prototyping"],
    },
    milestones: [
      {
        description: "Research and wireframing",
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "150000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Conduct user interviews",
            status: "pending",
            completedDate: null,
            notes: "Identify pain points.",
          },
          {
            description: "Sketch initial wireframes",
            status: "pending",
            completedDate: null,
            notes: "Low-fidelity designs.",
          },
        ],
        completionPercentage: 0,
      },
      {
        description: "High-fidelity prototyping",
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "300000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Design in Figma",
            status: "pending",
            completedDate: null,
            notes: "Add colors and interactions.",
          },
          {
            description: "Create interactive prototype",
            status: "pending",
            completedDate: null,
            notes: "Test click-through flows.",
          },
        ],
        completionPercentage: 0,
      },
      {
        description: "User testing and iterations",
        deadline: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "350000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Run usability tests",
            status: "pending",
            completedDate: null,
            notes: "Gather feedback from 10 users.",
          },
          {
            description: "Refine designs based on feedback",
            status: "pending",
            completedDate: null,
            notes: "Update prototypes accordingly.",
          },
        ],
        completionPercentage: 0,
      },
    ],
  },
  {
    employerId: "2032fc33-3428-4106-8009-e9d576d4bff9",
    title: "Content Writer",
    imageUrl:
      "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&q=80",
    budget: 450000,
    location: "Pune, India",
    jobType: "part-time",
    experienceLevel: "Entry",
    remote: true,
    applicationDeadline: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
    description: {
      text: "Craft engaging content for a lifestyle blog based in Pune.",
      responsibilities: ["Write blog posts and articles", "SEO optimization"],
      requirements: [
        "Bachelor's in English or Journalism",
        "1+ year writing experience",
      ],
      skills: ["Content Writing", "SEO", "WordPress", "Copyediting"],
    },
    milestones: [
      {
        description: "Topic research and outlining",
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "75000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Brainstorm article ideas",
            status: "pending",
            completedDate: null,
            notes: "Align with editorial calendar.",
          },
          {
            description: "Create outlines",
            status: "pending",
            completedDate: null,
            notes: "Structure for readability.",
          },
        ],
        completionPercentage: 0,
      },
      {
        description: "Drafting and editing",
        deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "150000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Write first drafts",
            status: "pending",
            completedDate: null,
            notes: "Aim for 1000 words per post.",
          },
          {
            description: "Self-edit and proofread",
            status: "pending",
            completedDate: null,
            notes: "Check grammar and flow.",
          },
          {
            description: "Incorporate SEO keywords",
            status: "pending",
            completedDate: null,
            notes: "Optimize for search engines.",
          },
        ],
        completionPercentage: 0,
      },
      {
        description: "Publishing and promotion",
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "225000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Upload to WordPress",
            status: "pending",
            completedDate: null,
            notes: "Add images and meta tags.",
          },
        ],
        completionPercentage: 0,
      },
    ],
  },
  {
    employerId: "2032fc33-3428-4106-8009-e9d576d4bff9",
    title: "Project Manager",
    imageUrl:
      "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80",
    budget: 1100000,
    location: "Bangalore, India",
    jobType: "contract",
    experienceLevel: "Expert",
    remote: false,
    applicationDeadline: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
    description: {
      text: "Lead cross-functional teams on software projects in Bangalore.",
      responsibilities: [
        "Resource allocation and timeline management",
        "Stakeholder communication",
      ],
      requirements: ["PMP certification", "7+ years in project management"],
      skills: ["Agile", "Jira", "Risk Management", "Budgeting"],
    },
    milestones: [
      {
        description: "Project initiation and planning",
        deadline: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "200000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Define project scope",
            status: "pending",
            completedDate: null,
            notes: "Document objectives and deliverables.",
          },
          {
            description: "Assemble team",
            status: "pending",
            completedDate: null,
            notes: "Assign roles and responsibilities.",
          },
          {
            description: "Set up Jira board",
            status: "pending",
            completedDate: null,
            notes: "Configure sprints and epics.",
          },
        ],
        completionPercentage: 0,
      },
      {
        description: "Execution and monitoring",
        deadline: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "500000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Conduct daily standups",
            status: "pending",
            completedDate: null,
            notes: "Track progress and blockers.",
          },
          {
            description: "Manage risks and changes",
            status: "pending",
            completedDate: null,
            notes: "Update risk register.",
          },
        ],
        completionPercentage: 0,
      },
      {
        description: "Closure and review",
        deadline: new Date(Date.now() + 24 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "400000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Finalize deliverables",
            status: "pending",
            completedDate: null,
            notes: "Handover to client.",
          },
          {
            description: "Conduct retrospective",
            status: "pending",
            completedDate: null,
            notes: "Gather lessons learned.",
          },
        ],
        completionPercentage: 0,
      },
    ],
  },
  {
    employerId: "2032fc33-3428-4106-8009-e9d576d4bff9",
    title: "Graphic Designer",
    imageUrl:
      "https://images.unsplash.com/photo-1626785774625-0b1c2c4eab67?w=800&q=80",
    budget: 700000,
    location: "Mumbai, India",
    jobType: "freelance",
    experienceLevel: "Mid",
    remote: true,
    applicationDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    description: {
      text: "Create visual assets for branding campaigns in Mumbai.",
      responsibilities: [
        "Design logos and banners",
        "Brand guideline development",
      ],
      requirements: ["Bachelor's in Graphic Design", "2+ years experience"],
      skills: ["Adobe Photoshop", "Illustrator", "Branding", "Typography"],
    },
    milestones: [
      {
        description: "Concept development",
        deadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "140000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Mood board creation",
            status: "pending",
            completedDate: null,
            notes: "Collect inspiration images.",
          },
          {
            description: "Initial sketches",
            status: "pending",
            completedDate: null,
            notes: "Hand-drawn concepts.",
          },
        ],
        completionPercentage: 0,
      },
      {
        description: "Digital design and revisions",
        deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "280000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Vectorize designs in Illustrator",
            status: "pending",
            completedDate: null,
            notes: "Ensure scalability.",
          },
          {
            description: "Incorporate feedback",
            status: "pending",
            completedDate: null,
            notes: "Make up to 3 revision rounds.",
          },
          {
            description: "Rasterize for web use",
            status: "pending",
            completedDate: null,
            notes: "Optimize in Photoshop.",
          },
        ],
        completionPercentage: 0,
      },
      {
        description: "Final delivery and guidelines",
        deadline: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000).toISOString(),
        payment: "280000",
        status: "not-paid",
        requested: false,
        subTasks: [
          {
            description: "Package files",
            status: "pending",
            completedDate: null,
            notes: "Include source files.",
          },
          {
            description: "Create brand book",
            status: "pending",
            completedDate: null,
            notes: "Outline usage rules.",
          },
        ],
        completionPercentage: 0,
      },
    ],
  },
];

async function seedJobs() {
  await mongoose.connect(
    process.env.MONGO_URL ||
      "mongodb+srv://amanraj3567:Passw0rd@react-m-cluster.gz7cugu.mongodb.net/milestone_db?retryWrites=true&w=majority",
  );
  await JobListing.insertMany(jobs);
  console.log("Indian jobs seeded successfully.");
  await mongoose.disconnect();
}

seedJobs();
