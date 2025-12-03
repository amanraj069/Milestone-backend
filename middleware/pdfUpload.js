const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '..', 'uploads', 'resumes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure disk storage for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create unique filename: timestamp-randomstring-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, uniqueSuffix + '-' + sanitizedName);
  }
});

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

// Function to save PDF to local file system (replaces uploadToCloudinary)
const uploadToLocalStorage = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'));
      return;
    }

    // The file is already saved by multer, just return the URL path
    // Use absolute URL with localhost for proper access
    const fileUrl = `/uploads/resumes/${file.filename}`;
    
    resolve({
      secure_url: fileUrl,
      url: fileUrl,
      public_id: file.filename,
      original_filename: file.originalname,
      bytes: file.size,
      format: 'pdf',
      resource_type: 'raw'
    });
  });
};

module.exports = {
  upload,
  uploadToCloudinary: uploadToLocalStorage, // Keep same export name for compatibility
  uploadToLocalStorage,
};
