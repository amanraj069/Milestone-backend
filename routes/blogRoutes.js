const express = require("express");
const router = express.Router();
const blogController = require("../controllers/blogController");
const { upload } = require("../middleware/imageUpload");

// Public routes
router.get("/api/blogs", blogController.getAllBlogs);
router.get("/api/blogs/latest", blogController.getLatestBlogs);
router.get("/api/blogs/featured", blogController.getFeaturedBlog);
router.get("/api/blogs/:blogId", blogController.getBlogById);

// Moderator routes (auth check done in controllers)
router.get("/api/moderator/blogs", blogController.getModeratorBlogs);
router.get(
  "/api/moderator/blogs/by-id/:blogId",
  blogController.getModeratorBlogById,
);
router.get(
  "/api/moderator/blogs/by-slug/:slug",
  blogController.getModeratorBlogBySlug,
);
router.post("/api/moderator/blogs", blogController.createBlog);
router.post(
  "/api/moderator/blogs/upload-image",
  upload.single("image"),
  blogController.uploadBlogImage,
);
router.put("/api/moderator/blogs/:blogId", blogController.updateBlog);
router.delete("/api/moderator/blogs/:blogId", blogController.deleteBlog);

module.exports = router;
