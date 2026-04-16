const redis = require("../config/redis");

/**
 * Set data in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (default: 300s)
 */
const setCache = async (key, value, ttl = 300) => {
  try {
    if (redis.status !== "ready") return; // Skip if Redis is not connected
    const data = JSON.stringify(value);
    await redis.set(key, data, "EX", ttl);
  } catch (error) {
    console.error(`Redis Set Error (${key}):`, error.message);
  }
};

/**
 * Get data from cache
 * @param {string} key - Cache key
 * @returns {string|null} Raw JSON string data or null if not found
 */
const getCache = async (key) => {
  try {
    if (redis.status !== "ready") return null; // Graceful fallback
    // We return the raw string to avoid JSON.parse overhead
    const data = await redis.get(key);
    return data ? data : null;
  } catch (error) {
    console.error(`Redis Get Error (${key}):`, error.message);
    return null; // Graceful fallback on error
  }
};

/**
 * Delete data from cache
 * @param {string} key - Cache key to delete
 */
const deleteCache = async (key) => {
  try {
    if (redis.status !== "ready") return;
    await redis.del(key);
  } catch (error) {
    console.error(`Redis Delete Error (${key}):`, error.message);
  }
};

/**
 * Delete multiple keys using pattern matching
 * Useful for invalidating related routes (e.g. /api/blogs*)
 * @param {string} pattern - Key pattern (e.g., *blogs*)
 */
const deleteCachePattern = async (pattern) => {
  try {
    if (redis.status !== "ready") return;
    const stream = redis.scanStream({ match: `*${pattern}*`, count: 100 });

    stream.on("data", async (keys) => {
      if (keys.length) {
        const pipeline = redis.pipeline();
        keys.forEach((key) => pipeline.del(key));
        await pipeline.exec();
      }
    });
  } catch (error) {
    console.error(`Redis Delete Pattern Error (${pattern}):`, error.message);
  }
};

module.exports = {
  setCache,
  getCache,
  deleteCache,
  deleteCachePattern,
};
