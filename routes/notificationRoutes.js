const express = require("express");
const router = express.Router();
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require("../controllers/notificationController");

// Get all notifications for current user
router.get("/", getNotifications);

// Get unread notification count
router.get("/unread-count", getUnreadCount);

// Mark all notifications as read
router.put("/mark-all-read", markAllAsRead);

// Mark a notification as read
router.put("/:notificationId/read", markAsRead);

// Delete a notification
router.delete("/:notificationId", deleteNotification);

module.exports = router;
