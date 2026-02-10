const mongoose = require("mongoose");
const Blog = require("../models/blog");
require("dotenv").config();

const blogs = [
  {
    title: "How to Build a Winning Freelance Portfolio from Scratch",
    tagline:
      "Essential steps to create a portfolio that attracts high-paying clients.",
    category: "Freelancing Tips",
    imageUrl:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
    author: "FreelancerHub Team",
    readTime: 6,
    featured: true,
    status: "published",
    content: [
      {
        heading: "Why Your Portfolio Matters",
        description:
          "Your portfolio is your most powerful marketing tool. It showcases your skills, experience, and the value you bring to clients. A well-crafted portfolio can be the difference between landing a dream project and being overlooked.",
      },
      {
        heading: "Choosing Your Best Work",
        description:
          "Select 5-10 projects that demonstrate your range and expertise. Quality trumps quantity every time. Include case studies that show your problem-solving process, the challenges you faced, and the results you delivered for clients.",
      },
      {
        heading: "Presenting Your Projects Effectively",
        description:
          "Each project should tell a story. Include before-and-after comparisons, client testimonials, and metrics that prove your impact. Use high-quality images and clear descriptions that non-technical clients can understand.",
      },
      {
        heading: "Keeping Your Portfolio Updated",
        description:
          "Regularly refresh your portfolio with recent work. Remove outdated projects and add new ones that reflect your current skills and the type of work you want to attract. An updated portfolio signals that you're active and in-demand.",
      },
    ],
  },
  {
    title: "Top 10 Tools Every Freelancer Should Use in 2025",
    tagline:
      "Boost productivity and manage your business with these essential tools.",
    category: "Tools & Resources",
    imageUrl:
      "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&q=80",
    author: "FreelancerHub Team",
    readTime: 7,
    featured: false,
    status: "published",
    content: [
      {
        heading: "Project Management: Trello & Asana",
        description:
          "Stay organized with visual boards and task lists. These tools help you track multiple projects, set deadlines, and collaborate with clients. Trello is perfect for visual thinkers, while Asana offers more robust project tracking features.",
      },
      {
        heading: "Time Tracking: Toggl & Harvest",
        description:
          "Accurate time tracking ensures you get paid fairly for your work. These tools automatically track time spent on tasks and generate detailed reports. Harvest also includes invoicing features, making it a complete billing solution.",
      },
      {
        heading: "Communication: Slack & Zoom",
        description:
          "Professional communication builds trust with clients. Slack keeps conversations organized by project, while Zoom provides reliable video conferencing for client meetings. Both tools are essential for remote collaboration.",
      },
      {
        heading: "Design & Collaboration: Figma & Canva",
        description:
          "Create stunning visuals without being a professional designer. Figma is perfect for collaborative design work, while Canva offers templates for social media, presentations, and marketing materials. Both tools streamline the creative process.",
      },
    ],
  },
  {
    title: "From $0 to $10K/Month: A Freelancer's Success Story",
    tagline:
      "How one freelancer scaled from side hustle to full-time income in 12 months.",
    category: "Success Stories",
    imageUrl:
      "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=800&q=80",
    author: "FreelancerHub Team",
    readTime: 8,
    featured: true,
    status: "published",
    content: [
      {
        heading: "The Beginning: First Steps",
        description:
          "Sarah started freelancing as a side hustle while working full-time as a graphic designer. She invested in a professional portfolio website and spent evenings building her online presence. Her first client paid just $200, but it was the validation she needed.",
      },
      {
        heading: "Building Momentum: Months 1-6",
        description:
          "By consistently delivering quality work and asking for referrals, Sarah landed 2-3 new clients monthly. She raised her rates from $50/hour to $75/hour as demand grew. The key was focusing on a specific niche: branding for eco-friendly businesses.",
      },
      {
        heading: "The Breakthrough: Months 7-9",
        description:
          "A satisfied client referred Sarah to a large eco-brand, resulting in a $15,000 contract. This single project gave her the confidence to transition to full-time freelancing. She streamlined her processes and started outsourcing smaller tasks.",
      },
      {
        heading: "Scaling Up: Months 10-12",
        description:
          "With consistent $10K+ months, Sarah hired a virtual assistant and a junior designer. She now focuses on strategy and client relationships while her team handles execution. Her advice: specialize, deliver excellence, and invest in relationships.",
      },
    ],
  },
  {
    title: "Time Management Hacks for Maximum Productivity",
    tagline: "Proven strategies to get more done in less time without burnout.",
    category: "Productivity",
    imageUrl:
      "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800&q=80",
    author: "FreelancerHub Team",
    readTime: 5,
    featured: false,
    status: "published",
    content: [
      {
        heading: "The Pomodoro Technique",
        description:
          "Work in focused 25-minute intervals followed by 5-minute breaks. After four pomodoros, take a longer 15-30 minute break. This method prevents burnout and maintains high concentration throughout the day. Many freelancers report 30% productivity increases.",
      },
      {
        heading: "Time Blocking Your Calendar",
        description:
          "Allocate specific time blocks for different types of work: deep work, client calls, admin tasks, and breaks. Treat these blocks as non-negotiable appointments. This prevents context-switching and ensures important tasks get dedicated attention.",
      },
      {
        heading: "The Two-Minute Rule",
        description:
          "If a task takes less than two minutes, do it immediately. This prevents small tasks from piling up and cluttering your to-do list. Responding to quick emails, filing documents, or scheduling meetings become automatic habits.",
      },
      {
        heading: "Batching Similar Tasks",
        description:
          "Group similar tasks together and complete them in one session. Schedule all client calls on specific days, batch content creation, or handle all administrative work at once. This reduces mental fatigue and increases efficiency.",
      },
    ],
  },
  {
    title: "Negotiating Higher Rates: A Complete Guide",
    tagline:
      "Master the art of getting paid what you're worth without losing clients.",
    category: "Career Advice",
    imageUrl:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80",
    author: "FreelancerHub Team",
    readTime: 7,
    featured: false,
    status: "published",
    content: [
      {
        heading: "Know Your Market Value",
        description:
          "Research industry rates for your skill level and location. Check freelance platforms, industry surveys, and ask fellow freelancers. Understanding the market prevents undercharging and gives you confidence during negotiations.",
      },
      {
        heading: "Communicate Value, Not Hours",
        description:
          "Frame your rates around the value you deliver, not time spent. Instead of '$100/hour,' say 'complete website redesign that increases conversions by 30% - $5,000.' Clients pay for results, not time.",
      },
      {
        heading: "When to Raise Your Rates",
        description:
          "Increase rates when you're consistently booked, have a waitlist, or have gained significant expertise. Notify existing clients 30-60 days in advance. New clients get the new rate immediately. Aim to raise rates 10-20% annually.",
      },
      {
        heading: "Handling Rate Objections",
        description:
          "When clients push back, don't immediately discount. Instead, ask what their budget is and adjust scope accordingly. Offer payment plans or explain the ROI they'll receive. Be willing to walk away from low-ball offers.",
      },
    ],
  },
  {
    title: "AI Tools Transforming Freelance Work in 2025",
    tagline:
      "How artificial intelligence is creating new opportunities for freelancers.",
    category: "Industry News",
    imageUrl:
      "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80",
    author: "FreelancerHub Team",
    readTime: 6,
    featured: false,
    status: "published",
    content: [
      {
        heading: "AI Writing Assistants",
        description:
          "Tools like ChatGPT and Jasper help freelancers create content faster. Writers use them for research, outlines, and first drafts. Rather than replacing writers, AI tools increase productivity and allow freelancers to take on more clients.",
      },
      {
        heading: "Design Automation",
        description:
          "AI-powered design tools can generate logos, mockups, and variations in seconds. Smart freelancers use these to speed up iteration and focus on strategy and creative direction. Tools like Midjourney and DALL-E are game-changers for visual creators.",
      },
      {
        heading: "Code Generation & Debugging",
        description:
          "GitHub Copilot and similar tools help developers write code faster and with fewer bugs. They autocomplete functions, suggest improvements, and explain complex code. Freelance developers who embrace these tools are more competitive and efficient.",
      },
      {
        heading: "Client Communication & Proposals",
        description:
          "AI tools can draft proposals, summarize client meetings, and even predict project timelines. This frees freelancers to focus on relationship-building and strategy. Smart automation of routine tasks is the future of freelancing.",
      },
    ],
  },
  {
    title: "Setting Boundaries: How to Avoid Freelance Burnout",
    tagline:
      "Protect your time and energy while building a sustainable freelance business.",
    category: "Freelancing Tips",
    imageUrl:
      "https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=800&q=80",
    author: "FreelancerHub Team",
    readTime: 6,
    featured: false,
    status: "published",
    content: [
      {
        heading: "Define Your Working Hours",
        description:
          "Set clear start and end times for your workday. Communicate these boundaries to clients upfront. Use email autoresponders outside business hours. Remember: just because you work from home doesn't mean you're always available.",
      },
      {
        heading: "Learn to Say No",
        description:
          "Not every opportunity is worth taking. Declining projects that don't fit your expertise, pay well, or align with your values protects your energy. Saying no to bad-fit clients makes room for ideal ones.",
      },
      {
        heading: "Create a Dedicated Workspace",
        description:
          "Separate work from personal life with a designated office area. This physical boundary helps you mentally switch between work and relaxation. At the end of the day, close your laptop and leave your workspace.",
      },
      {
        heading: "Schedule Regular Breaks",
        description:
          "Take weekends off, plan vacations, and build buffer time between projects. Burnout kills creativity and productivity. Sustainable freelancing requires rest and recovery. Your best work comes from a well-rested mind.",
      },
    ],
  },
  {
    title: "Essential Contracts and Legal Protection for Freelancers",
    tagline:
      "Protect your business with proper contracts and legal frameworks.",
    category: "Tools & Resources",
    imageUrl:
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80",
    author: "FreelancerHub Team",
    readTime: 7,
    featured: false,
    status: "published",
    content: [
      {
        heading: "Why Contracts Matter",
        description:
          "A solid contract protects both you and your client. It outlines scope, payment terms, deadlines, and what happens if things go wrong. Never start work without a signed agreement, no matter how trustworthy the client seems.",
      },
      {
        heading: "Essential Contract Clauses",
        description:
          "Include: project scope and deliverables, payment schedule and late fees, revision limits, intellectual property rights, termination conditions, and liability limitations. These protect you from scope creep and non-payment.",
      },
      {
        heading: "Using Contract Templates",
        description:
          "Services like Bonsai, HelloBonsai, and legal template sites offer customizable freelance contracts. Have a lawyer review your template once, then use it for all projects. This saves time and ensures legal protection.",
      },
      {
        heading: "Handling Contract Disputes",
        description:
          "Despite best efforts, disputes happen. Document everything in writing, stay professional, and try mediation first. Most issues resolve through clear communication. For serious breaches, consult a lawyer who specializes in contract law.",
      },
    ],
  },
  {
    title: "How I Built a 6-Figure Freelance Business",
    tagline:
      "Real strategies and lessons from scaling freelance income to $100K+.",
    category: "Success Stories",
    imageUrl:
      "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&q=80",
    author: "FreelancerHub Team",
    readTime: 9,
    featured: false,
    status: "published",
    content: [
      {
        heading: "Finding My Niche",
        description:
          "I started as a general web developer taking any project. After 6 months of inconsistent income, I specialized in e-commerce solutions for fashion brands. This focus attracted better clients and allowed me to charge premium rates.",
      },
      {
        heading: "Building Systems and Processes",
        description:
          "I documented every aspect of my workflow: onboarding, development, testing, and delivery. These systems let me work faster and deliver consistent quality. Eventually, I could delegate parts to contractors while maintaining standards.",
      },
      {
        heading: "Raising Rates Strategically",
        description:
          "I increased rates every 6 months as my expertise grew. Started at $50/hour, reached $150/hour within two years. Each rate increase came with improved service, faster delivery, or expanded offerings. Clients paid for the value I delivered.",
      },
      {
        heading: "Diversifying Income Streams",
        description:
          "Beyond client work, I created passive income through online courses, templates, and affiliate marketing. This diversification stabilized my income and reduced dependence on any single client. Multiple income streams equal financial security.",
      },
    ],
  },
  {
    title: "Deep Work: How to Enter Flow State as a Freelancer",
    tagline:
      "Unlock peak productivity with focused, distraction-free work sessions.",
    category: "Productivity",
    imageUrl:
      "https://images.unsplash.com/photo-1483058712412-4245e9b90334?w=800&q=80",
    author: "FreelancerHub Team",
    readTime: 6,
    featured: true,
    status: "published",
    content: [
      {
        heading: "What is Deep Work?",
        description:
          "Deep work is focused, uninterrupted concentration on cognitively demanding tasks. It's when you produce your best work, solve complex problems, and enter flow state. Most freelancers struggle to achieve deep work due to constant distractions.",
      },
      {
        heading: "Creating the Right Environment",
        description:
          "Eliminate distractions before starting. Turn off notifications, use website blockers, and inform others you're unavailable. Use noise-canceling headphones with focus music or white noise. The ideal environment is quiet, comfortable, and dedicated to work.",
      },
      {
        heading: "The Deep Work Routine",
        description:
          "Schedule deep work sessions during your peak energy hours. Most people focus best in the morning. Start with 90-minute blocks and gradually increase. Begin each session with a clear goal and end by noting your progress and next steps.",
      },
      {
        heading: "Measuring and Improving",
        description:
          "Track your deep work hours weekly. Aim to increase them gradually. Notice which times of day, environments, and preparation rituals work best. Deep work is a skill that improves with practice. Even 2-3 hours daily can transform your output.",
      },
    ],
  },
  {
    title: "Transitioning from Employee to Freelancer",
    tagline:
      "A step-by-step guide to making the leap to full-time freelancing.",
    category: "Career Advice",
    imageUrl:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80",
    author: "FreelancerHub Team",
    readTime: 8,
    featured: false,
    status: "published",
    content: [
      {
        heading: "Financial Preparation",
        description:
          "Save 6-12 months of expenses before quitting your job. Calculate exactly what you need monthly: rent, food, insurance, taxes, and business expenses. Having a financial cushion reduces stress and lets you focus on building your business.",
      },
      {
        heading: "Building Your Client Base",
        description:
          "Start freelancing part-time while employed. Evenings and weekends are enough to land your first 3-5 clients. Once your side income consistently covers 50-75% of expenses, the transition becomes less risky. Test your business model before committing.",
      },
      {
        heading: "Setting Up Your Business",
        description:
          "Register your business, get insurance, set up accounting systems, and create contracts before going full-time. These administrative tasks are easier to handle while you have stable income. Proper setup prevents legal and financial headaches later.",
      },
      {
        heading: "Making the Transition",
        description:
          "Give proper notice and leave on good terms. Your employer could become a client or referral source. Have 3-6 months of projects lined up before your last day. Plan your first month as a full-time freelancer with specific goals and milestones.",
      },
    ],
  },
  {
    title: "The Future of Remote Work and Freelancing",
    tagline: "Trends shaping the freelance economy and what they mean for you.",
    category: "Industry News",
    imageUrl:
      "https://images.unsplash.com/photo-1521898284481-a5ec348cb555?w=800&q=80",
    author: "FreelancerHub Team",
    readTime: 6,
    featured: false,
    status: "published",
    content: [
      {
        heading: "Global Talent Marketplace",
        description:
          "Companies increasingly hire freelancers regardless of location. This creates unprecedented opportunities for talented professionals worldwide. Geographic barriers are disappearing, but competition is global. Success requires differentiation and specialized expertise.",
      },
      {
        heading: "Rise of Fractional Executives",
        description:
          "High-level professionals are offering part-time C-suite services. Fractional CMOs, CFOs, and CTOs help startups access expertise they couldn't afford full-time. This trend is spreading to other senior roles, creating lucrative opportunities for experienced freelancers.",
      },
      {
        heading: "Platform Consolidation",
        description:
          "Major freelance platforms are merging features: payments, contracts, communication, and project management. This makes it easier to manage entire client relationships in one place. The downside: platform dependency and fees eating into income.",
      },
      {
        heading: "Hybrid Work Models",
        description:
          "Many professionals mix full-time employment with freelancing. Companies are increasingly accepting this arrangement. Hybrid models offer stability plus entrepreneurial freedom. Expect this trend to grow as work-life integration becomes the norm.",
      },
    ],
  },
  {
    title: "Mastering Client Communication for Freelancers",
    tagline:
      "Build stronger relationships and avoid misunderstandings with better communication.",
    category: "Freelancing Tips",
    imageUrl:
      "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&q=80",
    author: "FreelancerHub Team",
    readTime: 6,
    featured: false,
    status: "published",
    content: [
      {
        heading: "Setting Expectations Early",
        description:
          "Start every project with a kickoff call. Clarify goals, deliverables, timelines, and communication preferences. Document everything in writing. Clear expectations prevent 90% of client conflicts. Never assume you understand what the client wants—ask questions.",
      },
      {
        heading: "Regular Progress Updates",
        description:
          "Send weekly progress reports, even when things are going smoothly. Clients worry when they don't hear from you. Brief updates build trust and demonstrate you're actively working. Include what you've completed, what's next, and any blockers.",
      },
      {
        heading: "Handling Difficult Conversations",
        description:
          "When problems arise, address them immediately. Take responsibility for your part, explain the situation clearly, and propose solutions. Never blame or make excuses. Professional problem-solving turns potential disasters into trust-building opportunities.",
      },
      {
        heading: "Overcommunication is Undercommunication",
        description:
          "What feels like too much communication to you is probably just right for clients. Confirm receipt of materials, acknowledge questions quickly, and be transparent about delays. Responsive communication is a competitive advantage in freelancing.",
      },
    ],
  },
  {
    title: "Financial Planning for Freelancers: A Practical Guide",
    tagline: "Master taxes, savings, and money management for variable income.",
    category: "Tools & Resources",
    imageUrl:
      "https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=800&q=80",
    author: "FreelancerHub Team",
    readTime: 7,
    featured: false,
    status: "published",
    content: [
      {
        heading: "Understanding Freelance Taxes",
        description:
          "Set aside 25-30% of every payment for taxes. As a freelancer, you're responsible for income tax and self-employment tax. Make quarterly estimated payments to avoid penalties. Hire an accountant or use software like QuickBooks or FreshBooks to stay organized.",
      },
      {
        heading: "Building an Emergency Fund",
        description:
          "Save 6-12 months of expenses in a high-yield savings account. Freelance income fluctuates—some months are great, others slow. An emergency fund prevents panic during dry spells. It also lets you turn down bad-fit clients without financial stress.",
      },
      {
        heading: "Retirement Planning",
        description:
          "Open a Solo 401(k) or SEP IRA to save for retirement. These accounts offer tax advantages and higher contribution limits than traditional IRAs. Start contributing at least 10-15% of net income. Your future self will thank you for starting early.",
      },
      {
        heading: "Managing Variable Income",
        description:
          "Pay yourself a consistent salary from your business account. In good months, the surplus builds up. In slow months, you still get paid. This system creates financial stability and makes budgeting easier. Separate business and personal finances completely.",
      },
    ],
  },
  {
    title: "From Freelancer to Agency: One Woman's Growth Story",
    tagline:
      "How scaling from solo freelancer to team of 12 changed everything.",
    category: "Success Stories",
    imageUrl:
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80",
    author: "FreelancerHub Team",
    readTime: 9,
    featured: false,
    status: "published",
    content: [
      {
        heading: "The Solo Years: Building Foundation",
        description:
          "Lisa spent three years as a solo freelance marketer, maxing out at $120K annually. She was turning away work but couldn't scale further alone. The realization hit: growing meant building a team or staying at this ceiling forever.",
      },
      {
        heading: "First Hires: Growing Pains",
        description:
          "Hiring her first contractor felt terrifying. What if she couldn't maintain quality? What if she couldn't afford to pay them? Starting with project-based contractors reduced risk. She learned delegation, quality control, and client management while testing the agency model.",
      },
      {
        heading: "Systems and Processes",
        description:
          "Scaling required documenting everything. Lisa created SOPs for client onboarding, project management, delivery, and quality control. These systems allowed new team members to maintain standards. Process documentation was boring but essential for growth.",
      },
      {
        heading: "Current Success: Leading a Team",
        description:
          "Today, Lisa runs a 12-person agency generating $1.2M annually. She works fewer hours than as a solo freelancer, focusing on strategy and growth. Her advice: scale when you're consistently turning away work, not because you think you should.",
      },
    ],
  },
];

const seedBlogs = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGO_URL ||
        "mongodb+srv://amanraj3567:Passw0rd@react-m-cluster.gz7cugu.mongodb.net/milestone_db?retryWrites=true&w=majority",
    );
    console.log("Connected to MongoDB");

    // Clear existing blogs
    await Blog.deleteMany({});
    console.log("Cleared existing blogs");

    // Insert new blogs
    const insertedBlogs = await Blog.insertMany(blogs);
    console.log(`Successfully seeded ${insertedBlogs.length} blogs`);

    // Display seeded blogs
    insertedBlogs.forEach((blog, index) => {
      console.log(`\n${index + 1}. ${blog.title}`);
      console.log(`   Category: ${blog.category}`);
      console.log(`   Featured: ${blog.featured}`);
      console.log(`   Blog ID: ${blog.blogId}`);
    });

    mongoose.connection.close();
    console.log("\nDatabase connection closed");
  } catch (error) {
    console.error("Error seeding blogs:", error);
    process.exit(1);
  }
};

// Run the seed function
seedBlogs();
