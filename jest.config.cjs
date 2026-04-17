module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testMatch: ["**/*.test.js"],
  collectCoverage: false,
  collectCoverageFrom: [
    "controllers/**/*.js",
    "middleware/**/*.js",
    "graphql/**/*.js",
    "utils/**/*.js",
    "!**/node_modules/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html", "json-summary"],
  clearMocks: true,
};
