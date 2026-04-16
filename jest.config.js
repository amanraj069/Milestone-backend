module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  clearMocks: true,
  restoreMocks: true,
  collectCoverage: true,
  collectCoverageFrom: [
    "controllers/**/*.js",
    "graphql/**/*.js",
    "middleware/**/*.js",
    "utils/**/*.js",
    "!**/node_modules/**",
  ],
  coverageDirectory: "<rootDir>/test-reports/coverage",
  coverageReporters: ["text-summary", "lcov", "html", "json-summary"],
  reporters: [
    "default",
    [
      "jest-junit",
      {
        outputDirectory: "<rootDir>/test-reports/junit",
        outputName: "backend-junit.xml",
      },
    ],
  ],
};
