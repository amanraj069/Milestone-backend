const express = require("express");
const chatController = require("../controllers/chatController");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

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

// Get all conversations for the logged-in user
router.get("/conversations", requireAuth, asyncHandler(chatController.getConversations));

// Get messages for a specific conversation
router.get("/messages/:userId", requireAuth, asyncHandler(chatController.getMessages));

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
router.get("/search-users", requireAuth, asyncHandler(chatController.searchUsers));

module.exports = router;
