const Redis = require("ioredis");

// Connect to Redis using REDIS_URL from .env
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const redis = new Redis(redisUrl, {
  retryStrategy: (times) => {
    // Retry connection after a certain delay
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on("connect", () => {
  console.log("Connected to Redis successfully");
});

redis.on("error", (err) => {
  console.error("Redis Connection Error:", err.message);
});

redis.on("reconnecting", () => {
  console.log("Reconnecting to Redis...");
});

module.exports = redis;
