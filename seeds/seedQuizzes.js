/**
 * Seed one sample quiz and one badge for testing.
 * Usage: node seeds/seedQuizzes.js
 */
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
const Quiz = require("../models/Quiz");
const Badge = require("../models/Badge");
const User = require("../models/user");

async function main() {
  await mongoose.connect(
    "mongodb+srv://amanraj3567:Passw0rd@react-m-cluster.gz7cugu.mongodb.net/milestone_db?retryWrites=true&w=majority"
  );
  console.log("Connected to DB");

  // Create sample quiz
  const quiz = new Quiz({
    title: "JavaScript Basics",
    skillName: "JavaScript",
    description: "Basic JavaScript quiz",
    timeLimitMinutes: 15,
    passingScore: 70,
    questions: [
      {
        text: "Which of these is a primitive type in JS?",
        marks: 1,
        options: [
          { text: "Object", isCorrect: false },
          { text: "String", isCorrect: true },
          { text: "Function", isCorrect: false },
        ],
      },
      {
        text: "Which keyword declares a block-scoped variable?",
        marks: 1,
        options: [
          { text: "var", isCorrect: false },
          { text: "let", isCorrect: true },
          { text: "function", isCorrect: false },
        ],
      },
    ],
  });
  await quiz.save();
  console.log("Created quiz:", quiz._id);

  // Create badge for passing this quiz
  const badge = new Badge({
    title: "JS Basics Badge",
    skillName: "JavaScript",
    description: "Awarded for passing the JavaScript Basics quiz with >= 70%",
    criteria: {
      type: "pass_quiz",
      quizId: String(quiz._id),
      minPercentage: 70,
    },
  });
  await badge.save();
  console.log("Created badge:", badge._id);

  console.log("Seeding complete");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
