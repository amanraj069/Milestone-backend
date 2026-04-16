const express = require("express");
const router = express.Router();
const blogController = require("../controllers/blogController");
const { upload } = require("../middleware/imageUpload");
const {
  cacheMiddleware,
  invalidateCacheMiddleware,
} = require("../middleware/cacheMiddleware");

// Invalidate all blog caches when mutations happen
router.use(invalidateCacheMiddleware("api/blogs"));

/**
 * @swagger
 * tags:
 *   - name: Blog
 *     description: Public blog access and moderator blog management
 *
 * /api/blogs:
 *   get:
 *     summary: Get all published blogs
 *     tags: [Blog]
 *     responses:
 *       200:
 *         description: List of blogs
 *
 * /api/blogs/latest:
 *   get:
 *     summary: Get latest blogs
 *     tags: [Blog]
 *     responses:
 *       200:
 *         description: Latest blogs returned
 *
 * /api/blogs/featured:
 *   get:
 *     summary: Get featured blog
 *     tags: [Blog]
 *     responses:
 *       200:
 *         description: Featured blog returned
 *
 * /api/blogs/{blogId}:
 *   get:
 *     summary: Get a blog by ID
 *     tags: [Blog]
 *     parameters:
 *       - in: path
 *         name: blogId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Blog details returned
 *       404:
 *         description: Blog not found
 *
 * /api/moderator/blogs:
 *   get:
 *     summary: Get all blogs (moderator view)
 *     tags: [Blog]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: All blogs returned
 *       403:
 *         description: Access denied
 *   post:
 *     summary: Create a new blog
 *     tags: [Blog]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               excerpt:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               status:
 *                 type: string
 *                 enum: [draft, published]
 *               featured:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Blog created
 *       400:
 *         description: Validation error
 *
 * /api/moderator/blogs/by-id/{blogId}:
 *   get:
 *     summary: Get blog by ID (moderator)
 *     tags: [Blog]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: blogId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Blog returned
 *       404:
 *         description: Blog not found
 *
 * /api/moderator/blogs/by-slug/{slug}:
 *   get:
 *     summary: Get blog by slug (moderator)
 *     tags: [Blog]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Blog returned
 *       404:
 *         description: Blog not found
 *
 * /api/moderator/blogs/upload-image:
 *   post:
 *     summary: Upload blog image
 *     tags: [Blog]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image uploaded
 *       400:
 *         description: File missing
 *
 * /api/moderator/blogs/{blogId}:
 *   put:
 *     summary: Update a blog
 *     tags: [Blog]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: blogId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               excerpt:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               status:
 *                 type: string
 *               featured:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Blog updated
 *       404:
 *         description: Blog not found
 *   delete:
 *     summary: Delete a blog
 *     tags: [Blog]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: blogId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Blog deleted
 *       404:
 *         description: Blog not found
 */

// Public routes
router.get("/api/blogs", cacheMiddleware(300), blogController.getAllBlogs);
router.get(
  "/api/blogs/latest",
  cacheMiddleware(300),
  blogController.getLatestBlogs
);
router.get(
  "/api/blogs/featured",
  cacheMiddleware(300),
  blogController.getFeaturedBlog
);
router.get(
  "/api/blogs/:blogId",
  cacheMiddleware(300),
  blogController.getBlogById
);

// Moderator routes (auth check done in controllers)
router.get(
  "/api/moderator/blogs",
  cacheMiddleware(300),
  blogController.getModeratorBlogs
);
router.get(
  "/api/moderator/blogs/by-id/:blogId",
  cacheMiddleware(300),
  blogController.getModeratorBlogById
);
router.get(
  "/api/moderator/blogs/by-slug/:slug",
  cacheMiddleware(300),
  blogController.getModeratorBlogBySlug
);
router.post("/api/moderator/blogs", blogController.createBlog);
router.post(
  "/api/moderator/blogs/upload-image",
  upload.single("image"),
  blogController.uploadBlogImage
);
router.put("/api/moderator/blogs/:blogId", blogController.updateBlog);
router.delete("/api/moderator/blogs/:blogId", blogController.deleteBlog);

module.exports = router;
