/**
 * Admin Authentication Middleware
 * Ensures that the user is authenticated and has Admin role
 */

const isAdmin = (req, res, next) => {
  // Check if session exists and user is logged in
  if (!req.session?.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.',
    });
  }

  // Check if user has Admin role
  if (req.session.user.role !== 'Admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.',
    });
  }

  // User is authenticated and is an admin
  next();
};

/**
 * General Authentication Middleware
 * Ensures that the user is logged in (any role)
 */
const isAuthenticated = (req, res, next) => {
  if (!req.session?.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.',
    });
  }
  next();
};

/**
 * Role-based Authentication Middleware Factory
 * Creates middleware that checks for specific roles
 * @param {string[]} allowedRoles - Array of allowed role names
 */
const hasRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.session?.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.',
      });
    }

    if (!allowedRoles.includes(req.session.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
      });
    }

    next();
  };
};

module.exports = {
  isAdmin,
  isAuthenticated,
  hasRole,
};
