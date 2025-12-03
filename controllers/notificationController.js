const Notification = require("../models/Notification");

// Get all notifications for the current user
const getNotifications = async (req, res) => {
  try {
    const user = req.session.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Please login to view notifications",
      });
    }

    const notifications = await Notification.find({ userId: user.id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch notifications",
    });
  }
};

// Get unread notification count
const getUnreadCount = async (req, res) => {
  try {
    const user = req.session.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Please login to view notifications",
      });
    }

    const count = await Notification.countDocuments({
      userId: user.id,
      read: false,
    });

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch unread count",
    });
  }
};

// Mark a notification as read
const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const user = req.session.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Please login",
      });
    }

    const notification = await Notification.findOneAndUpdate(
      { notificationId, userId: user.id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: "Notification not found",
      });
    }

    res.json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark notification as read",
    });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const user = req.session.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Please login",
      });
    }

    await Notification.updateMany(
      { userId: user.id, read: false },
      { read: true }
    );

    res.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark notifications as read",
    });
  }
};

// Delete a notification
const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const user = req.session.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Please login",
      });
    }

    const notification = await Notification.findOneAndDelete({
      notificationId,
      userId: user.id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: "Notification not found",
      });
    }

    res.json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete notification",
    });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
