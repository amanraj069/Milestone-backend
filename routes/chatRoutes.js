const express = require("express");
const chatController = require("../controllers/chatController");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();
const {
  cacheMiddleware,
  invalidateCacheMiddleware,
} = require("../middleware/cacheMiddleware");

// Invalidate chat caches on mutations
router.use(invalidateCacheMiddleware("api/chat"));

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    console.error('UNAUTHORIZED CHAT ACCESS ATTEMPT');
    console.error(`Path: ${req.method} ${req.originalUrl}`);
    console.error(`IP: ${req.ip}`);
    return res.status(401).json({
      success: false,
      error: "Authentication required",
    });
  }
  next();
};

/**
 * @swagger
 * tags:
 *   - name: Chat
 *     description: Real-time chat and messaging (requires authentication)
 *
 * /api/chat/messages/{userId}:
 *   post:
 *     summary: Send a message to a user
 *     tags: [Chat]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Message sent
 *       401:
 *         description: Authentication required
 *
 * /api/chat/messages/{messageId}:
 *   delete:
 *     summary: Delete a message
 *     tags: [Chat]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Message deleted
 *       404:
 *         description: Message not found
 *
 * /api/chat/conversations/{conversationId}/read:
 *   put:
 *     summary: Mark a conversation as read
 *     tags: [Chat]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conversation marked as read
 *
 * /api/chat/search-users:
 *   get:
 *     summary: Search users to start a chat
 *     tags: [Chat]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: Matching users returned
 *       401:
 *         description: Authentication required
 */

// Send a message
router.post("/messages/:userId", requireAuth, asyncHandler(chatController.sendMessage));

// Delete a message
router.delete("/messages/:messageId", requireAuth, asyncHandler(chatController.deleteMessage));

// Mark conversation as read
router.put(
  "/conversations/:conversationId/read",
  requireAuth,
  asyncHandler(chatController.markAsRead)
);

// Search users
router.get(
  "/search-users",
  requireAuth,
  cacheMiddleware(60),
  asyncHandler(chatController.searchUsers)
);

module.exports = router;
