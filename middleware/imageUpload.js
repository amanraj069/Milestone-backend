const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Disk storage for verification documents
const verificationDir = path.join(__dirname, '..', 'uploads', 'verification_doc');
if (!fs.existsSync(verificationDir)) fs.mkdirSync(verificationDir, { recursive: true });

const verificationStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, verificationDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, uniqueSuffix + '-' + sanitizedName);
  },
});

const upload = multer({
  storage: verificationStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed!'), false);
  },
});

module.exports = {
  upload,
  uploadLocalImage: upload,
};