const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const connectionString =
  process.env.MONGO_URL || "mongodb://127.0.0.1:27017/milestone";

const connectDB = mongoose
  .connect(connectionString, {
    // useNewUrlParser: true,
    // useUnifiedTopology: true,
    serverSelectionTimeoutMS: 20000,
  })
  .then(() => {
    console.log("Connected to MongoDB successfully");
    return mongoose;
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err.message);
    process.exit(1);
  });

module.exports = connectDB;
