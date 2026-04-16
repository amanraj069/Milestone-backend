const Blog = require("../models/blog");
const { cloudinary } = require("../middleware/imageUpload");
const { Readable } = require("stream");

// Helper function to generate slug from title
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
};

// Helper function to upload buffer to Cloudinary for blog images
const uploadBlogImageToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "blog-images",
        transformation: [
          { width: 1200, height: 675, crop: "fill" },
          { quality: "auto" },
        ],
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);
    readableStream.pipe(uploadStream);
  });
};

// Get all published blogs
exports.getAllBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find({ status: "published" })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      blogs: blogs.map((blog) => ({
        ...blog,
        formattedCreatedAt: new Date(blog.createdAt).toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric",
            year: "numeric",
          }
        ),
        readTimeDisplay: `${blog.readTime} min read`,
      })),
    });
  } catch (error) {
    console.error("Error fetching blogs:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch blogs",
      error: error.message,
    });
  }
};

// Get latest 3 blogs for home page
exports.getLatestBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find({ status: "published" })
      .sort({ createdAt: -1 })
      .limit(6) // Get 6 for pagination
      .lean();

    return res.json({
      success: true,
      blogs: blogs.map((blog) => ({
        ...blog,
        formattedCreatedAt: new Date(blog.createdAt).toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric",
            year: "numeric",
          }
        ),
        readTimeDisplay: `${blog.readTime} min read`,
      })),
    });
  } catch (error) {
    console.error("Error fetching latest blogs:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch latest blogs",
      error: error.message,
    });
  }
};

// Get featured blog
exports.getFeaturedBlog = async (req, res) => {
  try {
    const blog = await Blog.findOne({ status: "published", featured: true })
      .sort({ createdAt: -1 })
      .lean();

    // If no featured blog, get the most recent one
    const featuredBlog =
      blog ||
      (await Blog.findOne({ status: "published" })
        .sort({ createdAt: -1 })
        .lean());

    if (!featuredBlog) {
      return res.json({
        success: true,
        blog: null,
      });
    }

    return res.json({
      success: true,
      blog: {
        ...featuredBlog,
        formattedCreatedAt: new Date(featuredBlog.createdAt).toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric",
            year: "numeric",
          }
        ),
        readTimeDisplay: `${featuredBlog.readTime} min read`,
      },
    });
  } catch (error) {
    console.error("Error fetching featured blog:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch featured blog",
      error: error.message,
    });
  }
};

// Get single blog by ID
exports.getBlogById = async (req, res) => {
  try {
    const { blogId } = req.params;
    const blog = await Blog.findOne({ blogId, status: "published" }).lean();

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Increment views
    await Blog.updateOne({ blogId }, { $inc: { views: 1 } });

    // Get recent blogs for "Latest Posts" section (exclude current blog)
    const recentBlogs = await Blog.find({
      status: "published",
      blogId: { $ne: blogId },
    })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    // Get featured blog
    const featuredBlog = await Blog.findOne({
      status: "published",
      featured: true,
      blogId: { $ne: blogId },
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      blog: {
        ...blog,
        formattedCreatedAt: new Date(blog.createdAt).toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric",
            year: "numeric",
          }
        ),
        readTimeDisplay: `${blog.readTime} min read`,
      },
      recentBlogs: recentBlogs.map((b) => ({
        ...b,
        formattedCreatedAt: new Date(b.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        readTimeDisplay: `${b.readTime} min read`,
      })),
      featuredBlog: featuredBlog
        ? {
            ...featuredBlog,
            formattedCreatedAt: new Date(
              featuredBlog.createdAt
            ).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
            readTimeDisplay: `${featuredBlog.readTime} min read`,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching blog:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch blog",
      error: error.message,
    });
  }
};

// Moderator: Create new blog
exports.createBlog = async (req, res) => {
  try {
    // Check if user is moderator
    if (!req.session?.user || req.session.user.role !== "Moderator") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized. Moderator access required.",
      });
    }

    const blogData = req.body;

    // Generate slug from title
    blogData.slug = generateSlug(blogData.title);

    // Create new blog
    const blog = new Blog(blogData);
    await blog.save();

    return res.status(201).json({
      success: true,
      message: "Blog created successfully",
      blog: blog.toJSON(),
    });
  } catch (error) {
    console.error("Error creating blog:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create blog",
      error: error.message,
    });
  }
};

// Moderator: Update blog
exports.updateBlog = async (req, res) => {
  try {
    // Check if user is moderator
    if (!req.session?.user || req.session.user.role !== "Moderator") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized. Moderator access required.",
      });
    }

    const { blogId } = req.params;
    const updates = req.body;

    // Update slug if title changed
    if (updates.title) {
      updates.slug = generateSlug(updates.title);
    }

    const blog = await Blog.findOneAndUpdate({ blogId }, updates, {
      new: true,
      runValidators: true,
    });

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    return res.json({
      success: true,
      message: "Blog updated successfully",
      blog: blog.toJSON(),
    });
  } catch (error) {
    console.error("Error updating blog:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update blog",
      error: error.message,
    });
  }
};

// Moderator: Delete blog
exports.deleteBlog = async (req, res) => {
  try {
    // Check if user is moderator
    if (!req.session?.user || req.session.user.role !== "Moderator") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized. Moderator access required.",
      });
    }

    const { blogId } = req.params;

    const blog = await Blog.findOneAndDelete({ blogId });

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    return res.json({
      success: true,
      message: "Blog deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting blog:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete blog",
      error: error.message,
    });
  }
};

// Moderator: Get all blogs (including drafts)
exports.getModeratorBlogs = async (req, res) => {
  try {
    // Check if user is moderator
    if (!req.session?.user || req.session.user.role !== "Moderator") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized. Moderator access required.",
      });
    }

    const {
      search = "",
      searchBy = "title",
      category = "all",
      featured = "all",
      sortBy = "date-desc",
    } = req.query;

    const rawPage = Number.parseInt(req.query.page, 10);
    const rawLimit = Number.parseInt(req.query.limit, 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 25;
    const skip = (page - 1) * limit;

    const query = {};

    if (category !== "all") {
      query.category = category;
    }

    if (featured === "featured") {
      query.featured = true;
    } else if (featured === "non-featured") {
      query.featured = false;
    }

    const searchText = String(search || "").trim();
    if (searchText) {
      const regex = new RegExp(
        searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );
      if (searchBy === "category") {
        query.category = regex;
      } else if (searchBy === "content") {
        query.excerpt = regex;
      } else {
        query.title = regex;
      }
    }

    const sortMap = {
      "date-desc": { createdAt: -1, _id: -1 },
      "date-asc": { createdAt: 1, _id: 1 },
      "title-asc": { title: 1, _id: 1 },
      "title-desc": { title: -1, _id: -1 },
    };

    const [blogs, total, categories, summaryAggregate] = await Promise.all([
      Blog.find(query)
        .sort(sortMap[sortBy] || sortMap["date-desc"])
        .skip(skip)
        .limit(limit)
        .lean(),
      Blog.countDocuments(query),
      Blog.distinct("category"),
      Blog.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalBlogs: { $sum: 1 },
            publishedBlogs: {
              $sum: {
                $cond: [{ $eq: ["$status", "published"] }, 1, 0],
              },
            },
            featuredBlogs: {
              $sum: {
                $cond: [{ $eq: ["$featured", true] }, 1, 0],
              },
            },
          },
        },
      ]),
    ]);

    const pagination = {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasPrevPage: page > 1,
      hasNextPage: skip + blogs.length < total,
    };

    const filterOptions = {
      categories: (categories || [])
        .filter(Boolean)
        .sort((a, b) => String(a).localeCompare(String(b))),
      featured: ["featured", "non-featured"],
    };

    const summary = {
      totalBlogs: summaryAggregate[0]?.totalBlogs || 0,
      publishedBlogs: summaryAggregate[0]?.publishedBlogs || 0,
      featuredBlogs: summaryAggregate[0]?.featuredBlogs || 0,
    };

    return res.json({
      success: true,
      total,
      pagination,
      filterOptions,
      summary,
      blogs: blogs.map((blog) => ({
        ...blog,
        formattedCreatedAt: new Date(blog.createdAt).toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric",
            year: "numeric",
          }
        ),
        readTimeDisplay: `${blog.readTime} min read`,
      })),
    });
  } catch (error) {
    console.error("Error fetching moderator blogs:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch blogs",
      error: error.message,
    });
  }
};

// Moderator: Get single blog by ID (for editing)
exports.getModeratorBlogById = async (req, res) => {
  try {
    // Check if user is moderator
    if (!req.session?.user || req.session.user.role !== "Moderator") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized. Moderator access required.",
      });
    }

    const { blogId } = req.params;
    const blog = await Blog.findOne({ blogId }).lean();

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    return res.json({
      success: true,
      blog: {
        ...blog,
        formattedCreatedAt: new Date(blog.createdAt).toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric",
            year: "numeric",
          }
        ),
        readTimeDisplay: `${blog.readTime} min read`,
      },
    });
  } catch (error) {
    console.error("Error fetching blog for edit:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch blog",
      error: error.message,
    });
  }
};

// Moderator: Get single blog by slug (for editing)
exports.getModeratorBlogBySlug = async (req, res) => {
  try {
    // Check if user is moderator
    if (!req.session?.user || req.session.user.role !== "Moderator") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized. Moderator access required.",
      });
    }

    const { slug } = req.params;
    let blog = await Blog.findOne({ slug }).lean();

    if (!blog) {
      blog = await Blog.findOne({ blogId: slug }).lean();
    }

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    return res.json({
      success: true,
      blog: {
        ...blog,
        formattedCreatedAt: new Date(blog.createdAt).toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric",
            year: "numeric",
          }
        ),
        readTimeDisplay: `${blog.readTime} min read`,
      },
    });
  } catch (error) {
    console.error("Error fetching blog for edit:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch blog",
      error: error.message,
    });
  }
};

// Moderator: Upload blog image to Cloudinary
exports.uploadBlogImage = async (req, res) => {
  try {
    // Check if user is moderator
    if (!req.session?.user || req.session.user.role !== "Moderator") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized. Moderator access required.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    // Upload to Cloudinary
    const result = await uploadBlogImageToCloudinary(req.file.buffer);

    return res.json({
      success: true,
      message: "Image uploaded successfully",
      imageUrl: result.secure_url,
      publicId: result.public_id,
    });
  } catch (error) {
    console.error("Error uploading blog image:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload image",
      error: error.message,
    });
  }
};
