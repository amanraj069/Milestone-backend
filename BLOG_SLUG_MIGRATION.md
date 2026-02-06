# Blog Slug Migration

This guide will help you add slugs to existing blog posts and update the blog edit routes to use only the blog title slug (no blog ID).

## What Changed

- Blog edit URLs now use only the slug: `/admin/blogs/edit/financial-planning-for-freelancers-a-practical-guide`
- Previously used: `/admin/blogs/edit/69550c67-2ef7-44fe-bfd1-c643aa63d5b2/financial-planning-for-freelancers-a-practical-guide`
- Backend now supports fetching blogs by slug for cleaner URLs

## Migration Steps

### 1. Run the Migration Script

This script will add slugs to all existing blog posts in your database:

```bash
cd Milestone-B
node scripts/addSlugsToBlogs.js
```

**Expected Output:**
```
Connected to MongoDB
Found X blogs without slugs
✓ Added slug "financial-planning-for-freelancers" to blog: Financial Planning for Freelancers: A Practical Guide
✓ Added slug "top-10-tools-every-freelancer-should-use" to blog: Top 10 Tools Every Freelancer Should Use in 2025
...
✅ Successfully added slugs to X blogs!
```

### 2. Restart Backend Server

After running the migration, restart your backend server to apply the model changes:

```bash
# In Milestone-B directory
npm start
```

### 3. Test the Edit Route

1. Go to `/admin/blogs`
2. Click "Edit" on any blog
3. The URL should now be: `/admin/blogs/edit/your-blog-title-slug`

## Technical Details

### Backend Changes

1. **Model** (`models/blog.js`):
   - Added `slug` field (unique, auto-generated from title)
   - Added pre-save hook to auto-generate slugs for new blogs

2. **Controller** (`controllers/blogController.js`):
   - Added `generateSlug()` helper function
   - Added `getAdminBlogBySlug()` endpoint to fetch blogs by slug
   - Updated `createBlog()` to auto-generate slug
   - Updated `updateBlog()` to update slug when title changes

3. **Routes** (`routes/blogRoutes.js`):
   - Added `/api/admin/blogs/by-slug/:slug` route
   - Kept `/api/admin/blogs/by-id/:blogId` for backwards compatibility

### Frontend Changes

1. **App.jsx**:
   - Updated route to `/admin/blogs/edit/:slug`

2. **Blogs.jsx** (Admin blogs list):
   - Updated edit button to navigate using only slug

3. **EditBlog.jsx**:
   - Changed to use `slug` param instead of `blogId`
   - Fetches blog using `/api/admin/blogs/by-slug/:slug`

## Troubleshooting

### "Blog not found" error on edit page
- Make sure you've run the migration script
- Verify slugs were added to all blogs in the database
- Check that the backend server was restarted

### Duplicate slug errors
The migration script handles duplicate titles by appending numbers (e.g., `my-blog-2`, `my-blog-3`)

### Need to reset migration
If you need to re-run the migration:
```bash
# Remove all slugs from database (optional)
mongosh
use freelancer-hub
db.blogs.updateMany({}, { $unset: { slug: "" } })

# Re-run migration
node scripts/addSlugsToBlogs.js
```

## Notes

- Slugs are automatically generated when creating new blogs
- Slugs are automatically updated when editing blog titles
- The old blog ID is still used internally for database operations
- URLs now only show the human-readable slug for better SEO and user experience
