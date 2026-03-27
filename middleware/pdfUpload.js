const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary (expects env vars to be set)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Disk storage (used for resume uploads) - keep compatibility
const path = require('path');
const fs = require('fs');
const uploadDir = path.join(__dirname, '..', 'uploads', 'resumes');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, uniqueSuffix + '-' + sanitizedName);
  },
});

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

const uploadVerification = multer({
  storage: verificationStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Accept standard PDF mimetype or files with .pdf extension (some browsers/os may set generic mimetype)
    const nameLower = (file.originalname || '').toLowerCase();
    if (file.mimetype === 'application/pdf' || nameLower.endsWith('.pdf') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed for verification documents!'), false);
    }
  },
});

// Memory storage for files that will be uploaded to Cloudinary directly
const memoryStorage = multer.memoryStorage();

// Create multer upload middleware for disk-based resumes
const upload = multer({
  storage: diskStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const nameLower = (file.originalname || '').toLowerCase();
    if (file.mimetype === 'application/pdf' || nameLower.endsWith('.pdf') || file.mimetype === 'application/octet-stream') cb(null, true);
    else cb(new Error('Only PDF files are allowed!'), false);
  },
});

// Create multer upload middleware for memory uploads (Cloudinary)
const uploadCloud = multer({
  storage: memoryStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const nameLower = (file.originalname || '').toLowerCase();
    if (file.mimetype === 'application/pdf' || nameLower.endsWith('.pdf') || file.mimetype === 'application/octet-stream') cb(null, true);
    else cb(new Error('Only PDF files are allowed!'), false);
  },
});

const resolvePdfBuffer = async (fileOrBuffer) => {
  if (Buffer.isBuffer(fileOrBuffer)) {
    return fileOrBuffer;
  }

  if (fileOrBuffer && Buffer.isBuffer(fileOrBuffer.buffer)) {
    return fileOrBuffer.buffer;
  }

  if (fileOrBuffer && typeof fileOrBuffer.path === 'string') {
    return fs.promises.readFile(fileOrBuffer.path);
  }

  throw new Error('Invalid PDF payload. Expected buffer or multer file object.');
};

// Upload buffer to Cloudinary as raw file (for PDF proof documents)
const uploadBufferToCloudinary = async (fileOrBuffer, filename) => {
  const buffer = await resolvePdfBuffer(fileOrBuffer);

  return new Promise((resolve, reject) => {
    // Normalize public_id (strip .pdf if present) and set format: 'pdf'
    const derivedName = fileOrBuffer?.originalname || fileOrBuffer?.filename;
    const provided = filename ? filename.toString() : (derivedName || `proof_${Date.now()}`);
    const publicIdBase = provided.replace(/\.pdf$/i, '');
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: 'raw', folder: 'company-proofs', public_id: publicIdBase, format: 'pdf' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
};

module.exports = {
  upload,
  uploadCloud,
  uploadVerification,
  uploadToCloudinary: uploadBufferToCloudinary,
};
