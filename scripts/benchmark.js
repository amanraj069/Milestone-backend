const autocannon = require("autocannon");
const fs = require("fs");
const path = require("path");
const Redis = require("ioredis");

const URL = "http://localhost:9000/api/jobs/api"; // Ensure the port matches your running backend
const DURATION = 10; // seconds per test
const CONNECTIONS = 100;

// Check if Redis is running before starting the benchmark
const checkRedis = () => {
  return new Promise((resolve) => {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 0, // Don't retry, fail fast if it's not up
      lazyConnect: true,
      retryStrategy: null,
    });

    redis.on("error", () => {
      resolve(false);
      redis.disconnect();
    });

    redis
      .connect()
      .then(() => {
        resolve(true);
        redis.disconnect();
      })
      .catch(() => {
        resolve(false);
      });
  });
};

console.log(`Starting Automated Benchmark for: ${URL}\n`);
console.log(
  `Parameters: ${CONNECTIONS} connections for ${DURATION} seconds per test.\n`
);

const runTest = (name, bypassCache) => {
  return new Promise((resolve, reject) => {
    console.log(`Running Test: ${name}...`);
    const instance = autocannon(
      {
        url: URL,
        connections: CONNECTIONS,
        duration: DURATION,
        headers: bypassCache ? { "x-bypass-cache": "true" } : {},
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );

    autocannon.track(instance, { renderProgressBar: true });
  });
};

const startBenchmark = async () => {
  try {
    const isRedisRunning = await checkRedis();
    if (!isRedisRunning) {
      console.log("\n[WARNING] Redis is NOT running!");
      console.log(
        "Redis must be running to capture caching metrics effectively."
      );
      console.log("Please start Redis (e.g., via Docker) and try again.\n");
      return;
    }

    console.log("Redis is running. Starting tests...\n");

    // 1. Run without Redis (Bypassing Cache)
    const resultWithoutCache = await runTest("Without Redis (Direct DB)", true);

    console.log("\n----------------------------------------\n");

    // 2. Run with Redis (Hitting Cache)
    const resultWithCache = await runTest("With Redis (Cached)", false);

    console.log("\nBenchmarks Completed. Generating Report...\n");

    // Calculate Improvements
    const avgLatencyWithout = resultWithoutCache.latency.average;
    const avgLatencyWith = resultWithCache.latency.average;

    let improvementLatency = 0;
    if (avgLatencyWithout > 0) {
      improvementLatency = (
        ((avgLatencyWithout - avgLatencyWith) / avgLatencyWithout) *
        100
      ).toFixed(2);
    }

    const reqSecWithout = resultWithoutCache.requests.average;
    const reqSecWith = resultWithCache.requests.average;

    let improvementThroughput = 0;
    if (reqSecWithout > 0) {
      improvementThroughput = (
        ((reqSecWith - reqSecWithout) / reqSecWithout) *
        100
      ).toFixed(2);
    }

    // Display Results in a clear tabular format
    const tableData = {
      Metric: {
        "Without Redis": "",
        "With Redis": "",
        Improvement: "",
      },
      "Avg Latency (ms)": {
        "Without Redis": avgLatencyWithout,
        "With Redis": avgLatencyWith,
        Improvement: `${improvementLatency}% faster`,
      },
      "Max Latency (ms)": {
        "Without Redis": resultWithoutCache.latency.max,
        "With Redis": resultWithCache.latency.max,
        Improvement: "-",
      },
      "Requests/sec (avg)": {
        "Without Redis": reqSecWithout,
        "With Redis": reqSecWith,
        Improvement: `${improvementThroughput}% more`,
      },
      "Total Requests": {
        "Without Redis": resultWithoutCache.requests.total,
        "With Redis": resultWithCache.requests.total,
        Improvement: "-",
      },
      "Total Errors/Timeouts": {
        "Without Redis":
          resultWithoutCache.errors + resultWithoutCache.timeouts,
        "With Redis": resultWithCache.errors + resultWithCache.timeouts,
        Improvement: "-",
      },
    };

    console.table(tableData);

    let summaryText = "";
    console.log("\nSummary:");
    if (avgLatencyWith < avgLatencyWithout) {
      summaryText = `Redis caching made the API roughly ${Math.round(
        avgLatencyWithout / Math.max(avgLatencyWith, 1)
      )}x faster!`;
    } else {
      summaryText = `Redis didn't show improvement. Ensure Redis is running and the route is cacheable.`;
    }
    console.log(summaryText);

    // Save metrics to a file
    const reportDir = path.join(__dirname, "..", "logs");
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir);
    }
    const reportPath = path.join(reportDir, "benchmark-results.json");

    const report = {
      timestamp: new Date().toISOString(),
      url: URL,
      parameters: { connections: CONNECTIONS, duration: DURATION },
      results: tableData,
      summary: summaryText,
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nBenchmark report saved to: ${reportPath}`);
  } catch (error) {
    console.error("Benchmark failed:", error.message);
  }
};

startBenchmark();
