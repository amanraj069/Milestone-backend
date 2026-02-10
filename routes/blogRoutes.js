const express = require("express");
const router = express.Router();
const blogController = require("../controllers/blogController");
const { upload } = require("../middleware/imageUpload");

// Public routes
router.get("/api/blogs", blogController.getAllBlogs);
router.get("/api/blogs/latest", blogController.getLatestBlogs);
router.get("/api/blogs/featured", blogController.getFeaturedBlog);
router.get("/api/blogs/:blogId", blogController.getBlogById);

// Admin routes (auth check done in controllers)
router.get("/api/admin/blogs", blogController.getAdminBlogs);
router.get("/api/admin/blogs/by-id/:blogId", blogController.getAdminBlogById);
router.get("/api/admin/blogs/by-slug/:slug", blogController.getAdminBlogBySlug);
router.post("/api/admin/blogs", blogController.createBlog);
router.post("/api/admin/blogs/upload-image", upload.single("image"), blogController.uploadBlogImage);
router.put("/api/admin/blogs/:blogId", blogController.updateBlog);
router.delete("/api/admin/blogs/:blogId", blogController.deleteBlog);

module.exports = router;
