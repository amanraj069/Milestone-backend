const { getCache, setCache, deleteCachePattern } = require("../utils/cache");

/**
 * Middleware for Caching API responses
 * @param {number} ttl - Time-to-Live for the cached entry (seconds)
 */
const cacheMiddleware = (ttl = 300) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    // Allow bypassing cache for benchmarking or forced fresh fetches
    if (
      req.headers["x-bypass-cache"] === "true" ||
      req.query.bypassCache === "true"
    ) {
      res.setHeader("X-Cache", "BYPASS");
      return next();
    }

    try {
      // Create a unique cache key based on route, queries, and user (if applicable)
      const userIdentifier = req.user ? req.user.id : "guest";
      const cacheKey = `cache:${req.originalUrl || req.url}:${userIdentifier}`;

      // 1. Try fetching from Cache
      const cachedData = await getCache(cacheKey);

      if (cachedData) {
        // Cache hit
        // console.log(`Cache hit: ${cacheKey}`); // Removed to reduce I/O bottleneck
        // Send data directly using express internal methods to bypass JSON serialization overhead
        res.setHeader("Content-Type", "application/json");
        res.setHeader("X-Cache", "HIT");
        return res.status(200).send(cachedData);
      }

      // 2. Cache Miss - Intercept response
      // console.log(`Cache miss: ${cacheKey}`); // Removed to reduce I/O bottleneck
      res.setHeader("X-Cache", "MISS");

      const originalSend = res.json;

      res.json = function (body) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Asynchronously save to Redis to not block response
          setCache(cacheKey, body, ttl);
        }

        // Restore original method and send response
        res.json = originalSend;
        return res.json(body);
      };

      next();
    } catch (err) {
      console.error("Cache Middleware Error:", err);
      next(); // Proceed even if cache fails (graceful fallback)
    }
  };
};

/**
 * Middleware to Invalidate Cache on mutations
 * @param {string} routePattern - The cache pattern to invalidate
 */
const invalidateCacheMiddleware = (routePattern) => {
  return async (req, res, next) => {
    // Intercept mutation methods (POST, PUT, DELETE, PATCH)
    if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
      try {
        const originalSend = res.json;
        res.json = function (body) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`Invalidating cache pattern: ${routePattern}`);
            deleteCachePattern(routePattern);
          }
          res.json = originalSend;
          return res.json(body);
        };
      } catch (err) {
        console.error("Cache Invalidation Error:", err);
      }
    }
    next();
  };
};

module.exports = {
  cacheMiddleware,
  invalidateCacheMiddleware,
};
