const express = require("express");
const session = require("express-session");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");

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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_ORIGIN || "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:5173",
    ],
    credentials: true,
  },
});

const PORT = process.env.PORT || 9000;

// Enhanced CORS configuration
app.use(
  cors({
    origin: [
      process.env.FRONTEND_ORIGIN || "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_session_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      secure: false,
      httpOnly: true,
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
app.use("/api", homeRoutes);
app.use("/api/employer", employerRoutes);
app.use("/api/freelancer", freelancerRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);
app.use(blogRoutes);
// Public quiz routes
app.use('/api/quizzes', quizRoutes);
// Feedback routes
app.use('/api/feedback', feedbackRoutes);

// Socket.IO connection handling
const userSockets = new Map(); // Map userId to socket.id
const typingUsers = new Map(); // Map conversationId to Set of typing userIds

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // User joins with their userId
  socket.on("user:join", (userId) => {
    userSockets.set(userId, socket.id);
    socket.userId = userId;
    socket.join(`user:${userId}`);
    
    // Notify user's contacts that they're online
    io.emit("user:status", { userId, status: "online" });
  });

  // User starts typing
  socket.on("typing:start", ({ conversationId, userId, recipientId }) => {
    if (!typingUsers.has(conversationId)) {
      typingUsers.set(conversationId, new Set());
    }
    typingUsers.get(conversationId).add(userId);

    // Notify the recipient
    const recipientSocketId = userSockets.get(recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("typing:update", {
        conversationId,
        userId,
        isTyping: true,
      });
    }
  });

  // User stops typing
  socket.on("typing:stop", ({ conversationId, userId, recipientId }) => {
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

  // Disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    
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
