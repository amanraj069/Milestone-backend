const express = require("express");
const router = express.Router();
const blogController = require("../controllers/blogController");
const { isAdmin } = require("../middleware/adminAuth");
const { upload } = require("../middleware/imageUpload");

// Public routes
router.get("/api/blogs", blogController.getAllBlogs);
router.get("/api/blogs/latest", blogController.getLatestBlogs);
router.get("/api/blogs/featured", blogController.getFeaturedBlog);
router.get("/api/blogs/:blogId", blogController.getBlogById);

// Admin routes (protected with isAdmin middleware)
router.get("/api/admin/blogs", isAdmin, blogController.getAdminBlogs);
router.get("/api/admin/blogs/by-id/:blogId", isAdmin, blogController.getAdminBlogById);
router.get("/api/admin/blogs/by-slug/:slug", isAdmin, blogController.getAdminBlogBySlug);
router.post("/api/admin/blogs", isAdmin, blogController.createBlog);
router.post("/api/admin/blogs/upload-image", isAdmin, upload.single("image"), blogController.uploadBlogImage);
router.put("/api/admin/blogs/:blogId", isAdmin, blogController.updateBlog);
router.delete("/api/admin/blogs/:blogId", isAdmin, blogController.deleteBlog);

module.exports = router;
