const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const blogSchema = new Schema(
  {
    blogId: {
      type: String,
      required: true,
      unique: true,
      default: uuidv4,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    tagline: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "Freelancing Tips",
        "Career Advice",
        "Productivity",
        "Success Stories",
        "Tools & Resources",
        "Industry News",
        "Other",
      ],
      default: "Other",
    },
    imageUrl: {
      type: String,
      required: true,
      default: "/assets/blog-default.jpg",
    },
    author: {
      type: String,
      default: "FreelancerHub Team",
      trim: true,
    },
    content: [
      {
        heading: {
          type: String,
          required: true,
          trim: true,
        },
        description: {
          type: String,
          required: true,
        },
      },
    ],
    readTime: {
      type: Number,
      default: 5, // in minutes
    },
    featured: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
    },
    views: {
      type: Number,
      default: 0,
    },
    likes: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for formatted created date
blogSchema.virtual("formattedCreatedAt").get(function () {
  return this.createdAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
});

// Virtual for read time display
blogSchema.virtual("readTimeDisplay").get(function () {
  return `${this.readTime} min read`;
});

// Ensure virtuals are included when converting to JSON
blogSchema.set("toJSON", { virtuals: true });
blogSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Blog", blogSchema);
