const express = require("express");
const session = require("express-session");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const connectDB = require("./database");
const authRoutes = require("./routes/authRoutes");
const homeRoutes = require("./routes/homeRoutes");
const employerRoutes = require("./routes/employerRoutes");
const blogRoutes = require("./routes/blogRoutes");

const app = express();
const PORT = process.env.PORT || 9000;

app.use(
  cors({
    origin: [
      process.env.FRONTEND_ORIGIN || "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002"
    ],
    credentials: true,
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

app.use("/api/auth", authRoutes);
app.use("/api", homeRoutes);
app.use("/api/employer", employerRoutes);
app.use(blogRoutes);

connectDB
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server due to DB error:", err);
    process.exit(1);
  });
