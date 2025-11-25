const express = require("express");
const router = express.Router();
const blogController = require("../controllers/blogController");

// Public routes
router.get("/api/blogs", blogController.getAllBlogs);
router.get("/api/blogs/latest", blogController.getLatestBlogs);
router.get("/api/blogs/featured", blogController.getFeaturedBlog);
router.get("/api/blogs/:blogId", blogController.getBlogById);

// Admin routes
router.get("/api/admin/blogs", blogController.getAdminBlogs);
router.post("/api/admin/blogs", blogController.createBlog);
router.put("/api/admin/blogs/:blogId", blogController.updateBlog);
router.delete("/api/admin/blogs/:blogId", blogController.deleteBlog);

module.exports = router;
