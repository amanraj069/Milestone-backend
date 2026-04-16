const mongoose = require('mongoose');
const Blog = require('./models/blog');
mongoose.connect('mongodb://root:rootpass@localhost:27017/milestone?authSource=admin').then(async () => {
  const count = await Blog.countDocuments();
  console.log('Total blogs in DB:', count);
  process.exit(0);
}).catch(console.error);
