const express = require("express");
const chatController = require("../controllers/chatController");

const router = express.Router();

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
    });
  }
  next();
};

// Get all conversations for the logged-in user
router.get("/conversations", requireAuth, chatController.getConversations);

// Get messages for a specific conversation
router.get("/messages/:userId", requireAuth, chatController.getMessages);

// Send a message
router.post("/messages/:userId", requireAuth, chatController.sendMessage);

// Mark conversation as read
router.put(
  "/conversations/:conversationId/read",
  requireAuth,
  chatController.markAsRead
);

// Search users
router.get("/search-users", requireAuth, chatController.searchUsers);

module.exports = router;
