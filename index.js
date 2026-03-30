const express = require("express");
const session = require("express-session");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const rfs = require("rotating-file-stream");
const hpp = require("hpp");
const mongoSanitize = require("express-mongo-sanitize");
const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@apollo/server/express4");
const typeDefs = require("./graphql/typeDefs");
const resolvers = require("./graphql/resolvers");
const { createLoaders } = require("./graphql/loaders");

dotenv.config();

const connectDB = require("./database");
const authRoutes = require("./routes/authRoutes");
const homeRoutes = require("./routes/homeRoutes");
const employerRoutes = require("./routes/employerRoutes");
const freelancerRoutes = require("./routes/freelancerRoutes");
const moderatorRoutes = require("./routes/moderatorRoutes");
const adminRoutes = require("./routes/adminRoutes");
const blogRoutes = require("./routes/blogRoutes");
const chatRoutes = require("./routes/chatRoutes");
const quizRoutes = require("./routes/quizRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const questionRoutes = require("./routes/questionRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const chatLogger = require("./utils/chatLogger");

const app = express();
const server = http.createServer(app);

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

const logStream = rfs.createStream("access.log", {
  interval: "1d",
  path: path.join(__dirname, "logs"),
});

app.use(morgan("combined", { stream: logStream }));

const io = new Server(server, {
  cors: {
    origin: [process.env.FRONTEND_ORIGIN || "http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});

const PORT = process.env.PORT || 9000;

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
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger setup (non-invasive; only serves docs at /api-docs)
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Milestone API",
      version: "1.0.0",
      description: "API documentation for Milestone backend",
    },
    servers: [
      {
        url: "/",
      },
    ],
  },
  apis: [
    path.join(__dirname, "routes", "*.js"),
    path.join(__dirname, "controllers", "*.js"),
  ],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    swaggerOptions: {
      withCredentials: true,
    },
  }),
);

// Only sanitize req.body and req.params,
// skip req.query to avoid read-only property error
// Skip sanitization for /graphql — GraphQL queries contain $ variable refs
// that are safe (not MongoDB operators) and would be wrongly stripped.
app.use((req, res, next) => {
  if (req.path === "/graphql") return next();
  if (req.body) {
    req.body = mongoSanitize.sanitize(req.body);
  }
  if (req.params) {
    req.params = mongoSanitize.sanitize(req.params);
  }
  next();
});

// hpp can strip fields from req.body — skip for /graphql
app.use((req, res, next) => {
  if (req.path === "/graphql") return next();
  hpp()(req, res, next);
});

app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
    next();
  },
  express.static(path.join(__dirname, "uploads")),
);

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "dev_session_secret_change_me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    secure: false,
    httpOnly: true,
    sameSite: "lax",
  },
});

// Use same session middleware for Express and Socket.IO
app.use(sessionMiddleware);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Backend is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/employer", employerRoutes);
app.use("/api/freelancer", freelancerRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/moderator", moderatorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", homeRoutes);
app.use(blogRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payment", paymentRoutes);

// Use Apollo GraphQL endpoint mounted in startServer().
// Do not mount legacy graphql-http handler on /graphql as it can shadow Apollo.

// Socket.IO connection handling with better error handling
const userSockets = new Map(); // Map userId to socket.id
const typingUsers = new Map(); // Map conversationId to Set of typing userIds

// Make express-session available to socket.handshake via session middleware
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, () => {
    // now socket.request.session is available
    if (socket.request.session?.user) {
      socket.user = socket.request.session.user;
    }
    next();
  });
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Attach session user if available (populated via io.use below)
  const connectedUserId =
    socket.request?.session?.user?.id || socket.user?.id || null;

  // Log connection (will show userId if session present)
  chatLogger.logConnection(socket.id, connectedUserId, "CONNECTED");

  // User joins with their userId
  socket.on("user:join", (userId) => {
    console.log(`User ${userId} joined with socket ${socket.id}`);
    userSockets.set(userId, socket.id);
    socket.userId = userId;
    socket.join(`user:${userId}`);

    // Log user connection with userId
    chatLogger.logConnection(socket.id, userId, "USER_JOINED");

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
      `Typing start: User ${userId} in conversation ${conversationId} - notifying ${recipientId}`,
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
      `Typing stop: User ${userId} in conversation ${conversationId}`,
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

    // Log message
    chatLogger.logMessage(message);
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
    chatLogger.logError(error, { socketId: socket.id, userId: socket.userId });
  });

  // Disconnect
  socket.on("disconnect", (reason) => {
    console.log("User disconnected:", socket.id, "Reason:", reason);

    // Log disconnection
    chatLogger.logDisconnection(socket.id, socket.userId, reason);

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

// NOTE: Error handlers are registered inside startServer() below
// so they come AFTER the GraphQL middleware.

// Initialize Apollo Server and start the HTTP server
async function startServer() {
  await connectDB;

  // Create and start Apollo Server
  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true,
  });
  await apolloServer.start();

  // Mount GraphQL middleware — json() runs before expressMiddleware as a safety net.
  // Session is already established globally via app.use(sessionMiddleware) above,
  // so we do NOT apply sessionMiddleware again here (double-init breaks Express 5).
  app.use(
    "/graphql",
    express.json(),
    expressMiddleware(apolloServer, {
      context: async ({ req }) => ({
        session: req.session,
        loaders: createLoaders(),
      }),
    }),
  );

  // Register error handlers AFTER GraphQL middleware
  app.use(notFound);
  app.use(errorHandler);

  // Global Error Handling Middleware
  app.use((err, req, res, next) => {
    console.error("Global Error Handler:", {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });

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

    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: Object.values(err.errors).map((e) => e.message),
      });
    }

    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate entry. This record already exists.",
      });
    }

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

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend running at http://localhost:${PORT}`);
    console.log(
      `CORS enabled for: ${
        process.env.FRONTEND_ORIGIN || "http://localhost:3000"
      }`,
    );
    console.log(`Socket.IO server ready`);
    console.log(`API Documentation available at /api-docs`);
    console.log(`GraphQL endpoint available at /graphql`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
