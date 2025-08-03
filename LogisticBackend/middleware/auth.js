const jwt = require('jsonwebtoken');
const Driver = require('../models/Driver');
const Client = require('../models/Client');
const Admin = require('../models/Admin');

// Protect routes - verify JWT token
const protect = (userTypes = ['driver', 'client', 'admin']) => {
  return async (req, res, next) => {
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Check for token in cookies
    else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if user type is allowed
      if (!userTypes.includes(decoded.userType)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied for this user type'
        });
      }

      let user;
      
      // Get user based on user type
      switch (decoded.userType) {
        case 'driver':
          user = await Driver.findById(decoded.id).select('+password');
          break;
        case 'client':
          user = await Client.findById(decoded.id).select('+password');
          break;
        case 'admin':
          user = await Admin.findById(decoded.id).select('+password');
          break;
        default:
          return res.status(401).json({
            success: false,
            message: 'Invalid user type'
          });
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if user account is active
      if (user.status === 'suspended' || user.status === 'inactive' || user.status === 'terminated') {
        return res.status(401).json({
          success: false,
          message: 'Account is not active'
        });
      }

      req.user = user;
      req.userType = decoded.userType;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  };
};

// Check specific roles for admin users
const authorize = (...roles) => {
  return (req, res, next) => {
    if (req.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

// Check admin permissions for specific modules and actions
const checkPermission = (module, action) => {
  return (req, res, next) => {
    if (req.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    if (!req.user.hasPermission(module, action)) {
      return res.status(403).json({
        success: false,
        message: `Permission denied. Required: ${action} access to ${module} module`
      });
    }
    next();
  };
};

// Verify email middleware
const verifyEmail = (req, res, next) => {
  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your email address to access this resource'
    });
  }
  next();
};

// Check KYC status for drivers
const checkKYC = (req, res, next) => {
  if (req.userType === 'driver' && req.user.kycStatus !== 'approved') {
    return res.status(403).json({
      success: false,
      message: 'KYC verification required. Please complete your KYC process.'
    });
  }
  next();
};

// Rate limiting for sensitive operations
const sensitiveOperation = (req, res, next) => {
  // Add additional security checks for sensitive operations
  const userAgent = req.get('User-Agent');
  const ip = req.ip || req.connection.remoteAddress;
  
  // Log the sensitive operation
  if (req.user && req.userType === 'admin') {
    req.user.logActivity(
      'sensitive_operation',
      'security',
      null,
      null,
      `Sensitive operation attempted: ${req.method} ${req.originalUrl}`,
      ip,
      userAgent
    );
  }
  
  next();
};

// Middleware to log admin activities
const logAdminActivity = (action, module) => {
  return (req, res, next) => {
    // Store original send function
    const originalSend = res.send;
    
    // Override send function to log after response
    res.send = function(body) {
      if (req.userType === 'admin') {
        const success = res.statusCode < 400;
        const targetId = req.params.id || req.body.id || null;
        const targetType = req.baseUrl.split('/').pop();
        const description = `${action} ${targetType}${targetId ? ` (ID: ${targetId})` : ''}`;
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');
        
        req.user.logActivity(
          action,
          module,
          targetId,
          targetType,
          description,
          ip,
          userAgent,
          success,
          success ? null : body
        );
        
        // Save the user document to persist the activity log
        req.user.save().catch(err => {
          console.error('Error saving admin activity log:', err);
        });
      }
      
      // Call original send function
      originalSend.call(this, body);
    };
    
    next();
  };
};

// Generate JWT token
const generateToken = (id, userType) => {
  return jwt.sign(
    { id, userType },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

// Send token response
const sendTokenResponse = (user, statusCode, res, userType) => {
  const token = generateToken(user._id, userType);

  const options = {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };

  res.status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token,
      data: {
        user: {
          id: user._id,
          email: user.email,
          userType,
          status: user.status
        }
      }
    });
};

module.exports = {
  protect,
  authorize,
  checkPermission,
  verifyEmail,
  checkKYC,
  sensitiveOperation,
  logAdminActivity,
  generateToken,
  sendTokenResponse
};