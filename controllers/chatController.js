const Message = require("../models/message");
const Conversation = require("../models/conversation");
const User = require("../models/user");

// Get all conversations for a user
exports.getConversations = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const conversations = await Conversation.find({
      participants: userId,
    })
      .sort({ updatedAt: -1 })
      .lean();

    // Populate participant details
    const conversationsWithDetails = await Promise.all(
      conversations.map(async (conv) => {
        const otherUserId = conv.participants.find((p) => p !== userId);
        const otherUser = await User.findOne({ userId: otherUserId })
          .select("userId name picture role")
          .lean();

        // Handle unreadCount properly - it's an object when using lean()
        let unreadCount = 0;
        if (conv.unreadCount && typeof conv.unreadCount === 'object') {
          unreadCount = conv.unreadCount[userId] || 0;
        }

        return {
          conversationId: conv.conversationId,
          participant: otherUser || {
            userId: otherUserId,
            name: "Unknown User",
            picture:
              "https://cdn.pixabay.com/photo/2018/04/18/18/56/user-3331256_1280.png",
            role: "Unknown",
          },
          lastMessage: conv.lastMessage,
          unreadCount: unreadCount,
          updatedAt: conv.updatedAt,
        };
      })
    );

    res.json({
      success: true,
      conversations: conversationsWithDetails,
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch conversations",
    });
  }
};

// Get messages for a conversation
exports.getMessages = async (req, res) => {
  try {
    const { userId: otherUserId } = req.params;
    const currentUserId = req.session.user.id;

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, otherUserId] },
    });

    if (!conversation) {
      return res.json({
        success: true,
        messages: [],
        conversationId: null,
      });
    }

    // Fetch messages
    const messages = await Message.find({
      conversationId: conversation.conversationId,
    })
      .sort({ createdAt: 1 })
      .lean();

    // Mark messages as read
    await Message.updateMany(
      {
        conversationId: conversation.conversationId,
        to: currentUserId,
        isRead: false,
      },
      {
        $set: { isRead: true, readAt: new Date() },
      }
    );

    // Reset unread count - use proper Map method
    if (!conversation.unreadCount) {
      conversation.unreadCount = new Map();
    }
    conversation.unreadCount.set(currentUserId, 0);
    await conversation.save();

    res.json({
      success: true,
      messages,
      conversationId: conversation.conversationId,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch messages",
    });
  }
};

// Send a message
exports.sendMessage = async (req, res) => {
  try {
    const { userId: recipientId } = req.params;
    const { messageData, replyTo } = req.body;
    const senderId = req.session.user.id;

    if (!messageData || !messageData.trim()) {
      return res.status(400).json({
        success: false,
        error: "Message cannot be empty",
      });
    }

    // Validate recipient exists
    const recipient = await User.findOne({ userId: recipientId });
    if (!recipient) {
      return res.status(404).json({
        success: false,
        error: "Recipient not found",
      });
    }

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId] },
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, recipientId],
        unreadCount: new Map([
          [senderId, 0],
          [recipientId, 0],
        ]),
      });
      await conversation.save(); // Save the new conversation
    }

    // Create message
    const messageObj = {
      conversationId: conversation.conversationId,
      from: senderId,
      to: recipientId,
      messageData: messageData.trim(),
    };

    // Add reply reference if provided
    if (replyTo) {
      const replyMessage = await Message.findOne({ messageId: replyTo });
      if (replyMessage) {
        messageObj.replyTo = {
          messageId: replyMessage.messageId,
          text: replyMessage.messageData,
          sender: replyMessage.from,
        };
      }
    }

    const message = new Message(messageObj);
    await message.save();

    // Update conversation
    conversation.lastMessage = {
      messageId: message.messageId,
      text: messageData.trim(),
      sender: senderId,
      timestamp: message.createdAt,
    };

    // Increment unread count for recipient
    if (!conversation.unreadCount) {
      conversation.unreadCount = new Map();
    }
    const currentUnread = conversation.unreadCount.get(recipientId) || 0;
    conversation.unreadCount.set(recipientId, currentUnread + 1);

    await conversation.save();

    res.json({
      success: true,
      message: message,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send message",
    });
  }
};

// Mark messages as read
exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.session.user.id;

    await Message.updateMany(
      {
        conversationId,
        to: userId,
        isRead: false,
      },
      {
        $set: { isRead: true, readAt: new Date() },
      }
    );

    const conversation = await Conversation.findOne({ conversationId });
    if (conversation) {
      if (!conversation.unreadCount) {
        conversation.unreadCount = new Map();
      }
      conversation.unreadCount.set(userId, 0);
      await conversation.save();
    }

    res.json({
      success: true,
    });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark messages as read",
    });
  }
};

// Search users for starting a new conversation
exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    const currentUserId = req.session.user.id;

    if (!query || query.trim().length < 2) {
      return res.json({
        success: true,
        users: [],
      });
    }

    const users = await User.find({
      userId: { $ne: currentUserId },
      $or: [
        { name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
        { userId: query }, // Exact match for userId
      ],
    })
      .select("userId name picture role")
      .limit(10)
      .lean();

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Error searching users:", error);
    res.status(500).json({
      success: false,
      error: "Failed to search users",
    });
  }
};

// Delete a message
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.session.user.id;

    // Find the message
    const message = await Message.findOne({ messageId });
    if (!message) {
      return res.status(404).json({
        success: false,
        error: "Message not found",
      });
    }

    // Check if user is the sender
    if (message.from !== userId) {
      return res.status(403).json({
        success: false,
        error: "You can only delete your own messages",
      });
    }

    // Delete the message
    await Message.deleteOne({ messageId });

    // Update conversation's last message if this was the last message
    const conversation = await Conversation.findOne({
      conversationId: message.conversationId,
    });

    if (conversation && conversation.lastMessage?.messageId === messageId) {
      // Find the new last message
      const lastMessage = await Message.findOne({
        conversationId: message.conversationId,
      })
        .sort({ createdAt: -1 })
        .lean();

      if (lastMessage) {
        conversation.lastMessage = {
          messageId: lastMessage.messageId,
          text: lastMessage.messageData,
          sender: lastMessage.from,
          timestamp: lastMessage.createdAt,
        };
      } else {
        conversation.lastMessage = null;
      }

      await conversation.save();
    }

    res.json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete message",
    });
  }
};
