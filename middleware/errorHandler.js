// Error handler middleware
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Not Found Error Handler (404)
const notFound = (req, res, next) => {
  const error = new AppError(`Not Found - ${req.originalUrl}`, 404);
  next(error);
};

// Global Error Handler
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  // Enhanced error logging
  console.error('ERROR OCCURRED');
  console.error(`Path: ${req.method} ${req.originalUrl}`);
  console.error(`Time: ${new Date().toISOString()}`);
  console.error(`Status Code: ${error.statusCode}`);
  console.error(`Message: ${err.message}`);
  
  if (req.session?.user) {
    console.error(`User: ${req.session.user.name} (${req.session.user.id}) - Role: ${req.session.user.role}`);
  }
  
  if (req.body && Object.keys(req.body).length > 0) {
    // Hide sensitive data
    const sanitizedBody = { ...req.body };
    if (sanitizedBody.password) sanitizedBody.password = '[HIDDEN]';
    if (sanitizedBody.otp) sanitizedBody.otp = '[HIDDEN]';
    console.error('Request Body:', JSON.stringify(sanitizedBody, null, 2));
  }
  
  if (req.params && Object.keys(req.params).length > 0) {
    console.error('Request Params:', req.params);
  }
  
  if (req.query && Object.keys(req.query).length > 0) {
    console.error('Query Params:', req.query);
  }

  if (err.stack) {
    console.error('Stack Trace:');
    console.error(err.stack);
  }
  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${err.value}`;
    error = new AppError(message, 404);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate field value: ${field}. Please use another value`;
    error = new AppError(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
    error = new AppError(message, 400);
  }

  // Multer file upload errors
  if (err.name === 'MulterError') {
    let message = 'File upload error';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size is too large';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field';
    }
    error = new AppError(message, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token. Please log in again';
    error = new AppError(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired. Please log in again';
    error = new AppError(message, 401);
  }

  // Send error response
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
    statusCode: error.statusCode || 500,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err,
    }),
  });
};

module.exports = { AppError, notFound, errorHandler };
