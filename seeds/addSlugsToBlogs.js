/**
 * Migration Script: Add slugs to existing blogs
 * Run this once to add slug field to all existing blog posts
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Blog = require("../models/blog");

dotenv.config();

const generateSlug = (title) => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
};

const addSlugsToBlogs = async () => {
  try {
    await mongoose.connect(
      process.env.MONGO_URL ||
        "mongodb+srv://amanraj3567:Passw0rd@react-m-cluster.gz7cugu.mongodb.net/milestone_db?retryWrites=true&w=majority",
    );
    console.log("Connected to MongoDB");

    // Find all blogs without slug
    const blogsWithoutSlug = await Blog.find({ slug: { $exists: false } });
    console.log(`Found ${blogsWithoutSlug.length} blogs without slugs`);

    if (blogsWithoutSlug.length === 0) {
      console.log("All blogs already have slugs!");
      process.exit(0);
    }

    // Update each blog with a slug
    let updated = 0;
    const slugs = new Set();

    for (const blog of blogsWithoutSlug) {
      let slug = generateSlug(blog.title);

      // Handle duplicate slugs by appending a number
      let counter = 1;
      let uniqueSlug = slug;
      while (
        slugs.has(uniqueSlug) ||
        (await Blog.findOne({ slug: uniqueSlug }))
      ) {
        uniqueSlug = `${slug}-${counter}`;
        counter++;
      }

      slugs.add(uniqueSlug);

      // Update the blog
      await Blog.updateOne({ _id: blog._id }, { $set: { slug: uniqueSlug } });

      console.log(`Added slug "${uniqueSlug}" to blog: ${blog.title}`);
      updated++;
    }

    console.log(`\nSuccessfully added slugs to ${updated} blogs!`);
    process.exit(0);
  } catch (error) {
    console.error("Error adding slugs to blogs:", error);
    process.exit(1);
  }
};

// Run the migration
addSlugsToBlogs();
