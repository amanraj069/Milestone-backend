const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

// Configure Cloudinary (same as before)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Use memory storage for multer (same as before)
const storage = multer.memoryStorage();

// Create multer upload middleware for PDF files
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for PDFs
  },
  fileFilter: (req, file, cb) => {
    // Check if file is a PDF
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  },
});

// Function to upload PDF to Cloudinary or an alternative storage solution
const uploadToCloudinary = (buffer, originalName) => {
  return new Promise((resolve, reject) => {
    // Cloudinary doesn't support PDF transformations like images,
    // but we can upload the PDF as a resource
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'freelancer-resume', // Store PDF files in a specific folder
        resource_type: 'raw', // Cloudinary treats PDF as raw files
        public_id: originalName.replace(/\.[^/.]+$/, ''), // Remove extension for a clean public ID
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);
    readableStream.pipe(uploadStream);
  });
};

module.exports = {
  upload,
  cloudinary,
  uploadToCloudinary,
};
