const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const backendRoot = path.resolve(__dirname, "..");
const outputPath = path.join(backendRoot, "test", "TEST_REPORT_BACKEND.md");

function runTests() {
  console.log("Running backend tests, please wait while the report is generated. This may take a moment...");
  const startedAt = Date.now();
  const result = spawnSync("npm", ["test", "--", "--runInBand", "--silent", "--forceExit"], {
    cwd: backendRoot,
    shell: true,
    encoding: "utf8",
  });

  return {
    exitCode: result.status,
    durationMs: Date.now() - startedAt,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    command: "npm test -- --runInBand --silent --forceExit",
  };
}

function parseSummary(output) {
  const lines = output.split(/\r?\n/).map((line) => line.trim());
  const patterns = [
    /^PASS\s+.+$/,
    /^FAIL\s+.+$/,
    /^Test Suites:\s+.+$/,
    /^Tests:\s+.+$/,
    /^Snapshots:\s+.+$/,
    /^Time:\s+.+$/,
  ];

  return lines.filter((line) => patterns.some((pattern) => pattern.test(line)));
}

function buildReport(run) {
  const timestamp = new Date().toISOString();
  const merged = `${run.stdout}\n${run.stderr}`;
  const summary = parseSummary(merged);
  const tail = merged.split(/\r?\n/).filter(Boolean).slice(-80).join("\n");
  const status = run.exitCode === 0 ? "PASS" : "FAIL";

  return [
    "# Backend Test Report",
    "",
    `Generated at: ${timestamp}`,
    "",
    `- Status: **${status}**`,
    `- Exit Code: ${run.exitCode}`,
    `- Duration: ${(run.durationMs / 1000).toFixed(2)}s`,
    `- Command: \`${run.command}\``,
    `- Working Directory: \`${backendRoot}\``,
    "",
    "## Summary Lines",
    ...(summary.length ? summary.map((line) => `- ${line}`) : ["- No summary lines captured"]),
    "",
    "## Output Tail",
    "```text",
    tail || "(no output)",
    "```",
    "",
  ].join("\n");
}

function main() {
  const run = runTests();
  const report = buildReport(run);
  fs.writeFileSync(outputPath, report, "utf8");

  console.log(`\nBackend report generated: ${outputPath}`);

  // Also show the stats in the terminal
  const merged = `${run.stdout}\n${run.stderr}`;
  const summary = parseSummary(merged);
  
  console.log("\n--- Test Stats ---");
  if (summary && summary.length > 0) {
    summary.forEach(line => console.log(line));
  } else {
    console.log("No summary stats to display.");
  }
  console.log("------------------\n");

  process.exit(run.exitCode === null ? 1 : run.exitCode);
}

main();