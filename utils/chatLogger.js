const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
const chatLogsDir = path.join(logsDir, 'chat');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

if (!fs.existsSync(chatLogsDir)) {
  fs.mkdirSync(chatLogsDir, { recursive: true });
}

/**
 * Log chat-related events to file
 */
class ChatLogger {
  constructor() {
    this.logFile = path.join(chatLogsDir, `chat-${this.getDateString()}.log`);
    this.connectionLogFile = path.join(chatLogsDir, `connections-${this.getDateString()}.log`);
  }

  getDateString() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  logConnection(socketId, userId, action = 'CONNECTED') {
    const logEntry = {
      timestamp: this.getTimestamp(),
      action,
      socketId,
      userId: userId || 'anonymous',
      date: new Date().toLocaleString()
    };

    const logLine = `[${logEntry.timestamp}] ${logEntry.action} - Socket: ${logEntry.socketId} | User: ${logEntry.userId}\n`;

    // Console log
    console.log(`SOCKET ${action}`);
    console.log(`Socket ID: ${socketId}`);
    console.log(`User ID: ${userId || 'Not authenticated'}`);
    console.log(`Time: ${logEntry.timestamp}`);

    // File log
    fs.appendFileSync(this.connectionLogFile, logLine, 'utf8');
  }

  logDisconnection(socketId, userId, reason) {
    const logEntry = {
      timestamp: this.getTimestamp(),
      action: 'DISCONNECTED',
      socketId,
      userId: userId || 'anonymous',
      reason: reason || 'unknown',
      date: new Date().toLocaleString()
    };

    const logLine = `[${logEntry.timestamp}] DISCONNECTED - Socket: ${logEntry.socketId} | User: ${logEntry.userId} | Reason: ${logEntry.reason}\n`;

    // Console log
    console.log('SOCKET DISCONNECTED');
    console.log(`Socket ID: ${socketId}`);
    console.log(`User ID: ${userId || 'Not authenticated'}`);
    console.log(`Reason: ${reason}`);
    console.log(`Time: ${logEntry.timestamp}`);

    // File log
    fs.appendFileSync(this.connectionLogFile, logLine, 'utf8');
  }

  logMessage(messageData) {
    const logEntry = {
      timestamp: this.getTimestamp(),
      action: 'MESSAGE_SENT',
      from: messageData.from,
      to: messageData.to,
      messageId: messageData.messageId,
      conversationId: messageData.conversationId,
      date: new Date().toLocaleString()
    };

    const logLine = `[${logEntry.timestamp}] MESSAGE - Conversation: ${logEntry.conversationId} | From: ${logEntry.from} | To: ${logEntry.to} | MsgID: ${logEntry.messageId}\n`;

    // Console log
    console.log(`Message sent: ${logEntry.from} → ${logEntry.to} (${logEntry.conversationId})`);

    // File log
    fs.appendFileSync(this.logFile, logLine, 'utf8');
  }

  logTyping(data) {
    const logEntry = {
      timestamp: this.getTimestamp(),
      action: data.isTyping ? 'TYPING_START' : 'TYPING_STOP',
      userId: data.userId,
      conversationId: data.conversationId,
      recipientId: data.recipientId
    };

    const logLine = `[${logEntry.timestamp}] ${logEntry.action} - User: ${logEntry.userId} | Conversation: ${logEntry.conversationId} | Recipient: ${logEntry.recipientId}\n`;

    // File log
    fs.appendFileSync(this.logFile, logLine, 'utf8');
  }

  logError(error, context = {}) {
    const logEntry = {
      timestamp: this.getTimestamp(),
      action: 'ERROR',
      error: error.message,
      stack: error.stack,
      context
    };

    const logLine = `[${logEntry.timestamp}] ERROR - ${error.message}\nContext: ${JSON.stringify(context)}\nStack: ${error.stack}\n\n`;

    // Console log
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('CHAT ERROR');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`Message: ${error.message}`);
    console.error(`Context:`, context);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // File log
    fs.appendFileSync(this.logFile, logLine, 'utf8');
  }

  logOnlineUsers(userIds) {
    const logEntry = {
      timestamp: this.getTimestamp(),
      action: 'ONLINE_USERS',
      count: userIds.length,
      userIds
    };

    const logLine = `[${logEntry.timestamp}] ONLINE_USERS - Count: ${logEntry.count} | Users: ${userIds.join(', ')}\n`;

    // File log
    fs.appendFileSync(this.connectionLogFile, logLine, 'utf8');
  }
}

// Export singleton instance
module.exports = new ChatLogger();
