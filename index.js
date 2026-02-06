const express = require("express");
const session = require("express-session");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

dotenv.config();

const connectDB = require("./database");
const authRoutes = require("./routes/authRoutes");
const homeRoutes = require("./routes/homeRoutes");
const employerRoutes = require("./routes/employerRoutes");
const freelancerRoutes = require("./routes/freelancerRoutes");
const adminRoutes = require("./routes/adminRoutes");
const blogRoutes = require("./routes/blogRoutes");
const chatRoutes = require("./routes/chatRoutes");
const quizRoutes = require("./routes/quizRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const questionRoutes = require("./routes/questionRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const app = express();
const server = http.createServer(app);

// Enhanced Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_ORIGIN || "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:5173",
    ],
    credentials: true,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});

const PORT = process.env.PORT || 9000;

// Enhanced CORS configuration
app.use(
  cors({
    origin: [
      process.env.FRONTEND_ORIGIN || "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:5173",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory with proper headers
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
    next();
  },
  express.static(path.join(__dirname, "uploads"))
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_session_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      secure: false,
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Backend is running" });
});

// Logging middleware for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/employer", employerRoutes);
app.use("/api/freelancer", freelancerRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", homeRoutes);
app.use(blogRoutes);
// Public quiz routes
app.use("/api/quizzes", quizRoutes);
// Feedback routes
app.use("/api/feedback", feedbackRoutes);
// Question routes for Q&A on jobs
app.use("/api/questions", questionRoutes);
// Notification routes
app.use("/api/notifications", notificationRoutes);

// Socket.IO connection handling with better error handling
const userSockets = new Map(); // Map userId to socket.id
const typingUsers = new Map(); // Map conversationId to Set of typing userIds

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // User joins with their userId
  socket.on("user:join", (userId) => {
    console.log(`User ${userId} joined with socket ${socket.id}`);
    userSockets.set(userId, socket.id);
    socket.userId = userId;
    socket.join(`user:${userId}`);

    // Send current online users to the newly joined user
    const onlineUserIds = Array.from(userSockets.keys());
    console.log(`Sending online users to ${userId}:`, onlineUserIds);
    console.log(`Emitting to socket ${socket.id}`);
    socket.emit("users:online", { userIds: onlineUserIds });

    // Notify ALL users (including the new one) that this user is online
    console.log(`Broadcasting user:status online for ${userId} to all clients`);
    io.emit("user:status", { userId, status: "online" });
  });

  // Handle request for current online users
  socket.on("request:online-users", () => {
    const onlineUserIds = Array.from(userSockets.keys());
    console.log(`User ${socket.userId} requested online users:`, onlineUserIds);
    socket.emit("users:online", { userIds: onlineUserIds });
  });

  // User starts typing
  socket.on("typing:start", ({ conversationId, userId, recipientId }) => {
    console.log(
      `⌨️  Typing start: User ${userId} in conversation ${conversationId} - notifying ${recipientId}`
    );
    if (!typingUsers.has(conversationId)) {
      typingUsers.set(conversationId, new Set());
    }
    typingUsers.get(conversationId).add(userId);

    // Notify the recipient
    const recipientSocketId = userSockets.get(recipientId);
    console.log(`   Recipient socket ID: ${recipientSocketId}`);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("typing:update", {
        conversationId,
        userId,
        isTyping: true,
      });
      console.log(`   Sent typing:update (true) to ${recipientId}`);
    } else {
      console.log(`   Recipient ${recipientId} not found in userSockets`);
    }
  });

  // User stops typing
  socket.on("typing:stop", ({ conversationId, userId, recipientId }) => {
    console.log(
      `⌨️  Typing stop: User ${userId} in conversation ${conversationId}`
    );
    if (typingUsers.has(conversationId)) {
      typingUsers.get(conversationId).delete(userId);
      if (typingUsers.get(conversationId).size === 0) {
        typingUsers.delete(conversationId);
      }
    }

    // Notify the recipient
    const recipientSocketId = userSockets.get(recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("typing:update", {
        conversationId,
        userId,
        isTyping: false,
      });
      console.log(`   Sent typing:update (false) to ${recipientId}`);
    }
  });

  // New message sent
  socket.on("message:send", (messageData) => {
    const { recipientId, message } = messageData;
    const recipientSocketId = userSockets.get(recipientId);

    if (recipientSocketId) {
      // Send to recipient
      io.to(recipientSocketId).emit("message:new", message);
    }

    // Send back to sender for confirmation
    socket.emit("message:sent", message);
  });

  // Message read
  socket.on("message:read", ({ conversationId, userId, recipientId }) => {
    const recipientSocketId = userSockets.get(recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("message:read", {
        conversationId,
        readBy: userId,
      });
    }
  });

  // Message deleted
  socket.on("message:delete", ({ messageId, recipientId }) => {
    const recipientSocketId = userSockets.get(recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("message:deleted", {
        messageId,
      });
    }
  });

  // Error handling
  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });

  // Disconnect
  socket.on("disconnect", (reason) => {
    console.log("User disconnected:", socket.id, "Reason:", reason);

    if (socket.userId) {
      userSockets.delete(socket.userId);

      // Notify contacts that user is offline
      io.emit("user:status", {
        userId: socket.userId,
        status: "offline",
      });
    }
  });
});

// Make io accessible to routes
app.set("io", io);
// Public quiz routes
app.use("/api/quizzes", quizRoutes);

// Global Error Handling Middleware
// This must be defined after all other routes and middleware
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Handle Multer errors
  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 5MB.",
      });
    }
    return res.status(400).json({
      success: false,
      message: `File upload error: ${err.message}`,
    });
  }

  // Handle validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: Object.values(err.errors).map((e) => e.message),
    });
  }

  // Handle MongoDB duplicate key errors
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Duplicate entry. This record already exists.",
    });
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token. Please log in again.",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expired. Please log in again.",
    });
  }

  // Default error response
  const statusCode = err.statusCode || err.status || 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "An unexpected error occurred"
      : err.message || "Internal server error";

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
  });
});

connectDB
  .then(() => {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Backend running at http://localhost:${PORT}`);
      console.log(
        `CORS enabled for: ${
          process.env.FRONTEND_ORIGIN || "http://localhost:3000"
        }`
      );
      console.log(`Socket.IO server ready`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server due to DB error:", err);
    process.exit(1);
  });
