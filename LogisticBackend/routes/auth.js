const express = require('express');
const { body, validationResult } = require('express-validator');
const Driver = require('../models/Driver');
const Client = require('../models/Client');
const Admin = require('../models/Admin');
const { protect, sendTokenResponse, generateToken } = require('../middleware/auth');
const { uploadKYCDocuments, uploadBusinessDocuments, handleMulterError, getFileUrl } = require('../utils/fileUpload');
const path = require('path');

const router = express.Router();

// @desc    Register driver
// @route   POST /api/auth/driver/register
// @access  Public
router.post('/driver/register', [
  body('firstName').trim().isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
  body('lastName').trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('phone').isMobilePhone().withMessage('Please enter a valid phone number'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('driverLicense').notEmpty().withMessage('Driver license is required'),
  body('licenseExpiry').isISO8601().withMessage('Valid license expiry date is required'),
  body('dateOfBirth').isISO8601().withMessage('Valid date of birth is required'),
  body('address.street').notEmpty().withMessage('Street address is required'),
  body('address.city').notEmpty().withMessage('City is required'),
  body('address.state').notEmpty().withMessage('State is required'),
  body('address.zipCode').notEmpty().withMessage('Zip code is required')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      driverLicense,
      licenseExpiry,
      dateOfBirth,
      address,
      vehicle,
      emergencyContact
    } = req.body;

    // Check if driver already exists
    const existingDriver = await Driver.findOne({
      $or: [
        { email },
        { phone },
        { driverLicense }
      ]
    });

    if (existingDriver) {
      return res.status(400).json({
        success: false,
        message: 'Driver with this email, phone, or license number already exists'
      });
    }

    // Validate license expiry date
    if (new Date(licenseExpiry) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Driver license has expired'
      });
    }

    // Validate age (must be at least 18)
    const age = (new Date() - new Date(dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000);
    if (age < 18) {
      return res.status(400).json({
        success: false,
        message: 'Driver must be at least 18 years old'
      });
    }

    // Create driver
    const driver = await Driver.create({
      firstName,
      lastName,
      email,
      phone,
      password,
      driverLicense,
      licenseExpiry,
      dateOfBirth,
      address,
      vehicle,
      emergencyContact
    });

    sendTokenResponse(driver, 201, res, 'driver');
  } catch (error) {
    console.error('Driver registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// @desc    Upload KYC documents for driver
// @route   POST /api/auth/driver/kyc
// @access  Private (Driver)
router.post('/driver/kyc', protect(['driver']), uploadKYCDocuments, handleMulterError, async (req, res) => {
  try {
    const driver = req.user;
    const files = req.files;

    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    // Process uploaded files
    const kycDocuments = {};
    
    Object.keys(files).forEach(fieldName => {
      if (files[fieldName] && files[fieldName][0]) {
        const file = files[fieldName][0];
        kycDocuments[fieldName] = {
          url: getFileUrl(req, path.relative(path.join(__dirname, '../uploads'), file.path)),
          uploadDate: new Date(),
          verified: false
        };
      }
    });

    // Update driver's KYC documents
    driver.kycDocuments = { ...driver.kycDocuments, ...kycDocuments };
    
    // Update KYC status based on completion
    const completion = driver.kycCompletion;
    if (completion >= 100) {
      driver.kycStatus = 'in_review';
    }

    await driver.save();

    res.status(200).json({
      success: true,
      message: 'KYC documents uploaded successfully',
      data: {
        kycDocuments: driver.kycDocuments,
        kycCompletion: driver.kycCompletion,
        kycStatus: driver.kycStatus
      }
    });
  } catch (error) {
    console.error('KYC upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during KYC upload'
    });
  }
});

// @desc    Register client (for web application)
// @route   POST /api/auth/client/register
// @access  Public
router.post('/client/register', [
  body('companyName').trim().isLength({ min: 2, max: 100 }).withMessage('Company name must be between 2 and 100 characters'),
  body('contactPerson.firstName').trim().notEmpty().withMessage('Contact person first name is required'),
  body('contactPerson.lastName').trim().notEmpty().withMessage('Contact person last name is required'),
  body('contactPerson.position').trim().notEmpty().withMessage('Contact person position is required'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('phone').isMobilePhone().withMessage('Please enter a valid phone number'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('businessRegistrationNumber').notEmpty().withMessage('Business registration number is required'),
  body('taxId').notEmpty().withMessage('Tax ID is required'),
  body('industryType').isIn(['Manufacturing', 'Retail', 'E-commerce', 'Healthcare', 'Food & Beverage', 'Automotive', 'Electronics', 'Other']).withMessage('Valid industry type is required')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const {
      companyName,
      contactPerson,
      email,
      phone,
      alternatePhone,
      password,
      businessRegistrationNumber,
      taxId,
      industryType,
      addresses,
      billingInfo,
      preferences
    } = req.body;

    // Check if client already exists
    const existingClient = await Client.findOne({
      $or: [
        { email },
        { businessRegistrationNumber }
      ]
    });

    if (existingClient) {
      return res.status(400).json({
        success: false,
        message: 'Client with this email or business registration number already exists'
      });
    }

    // Create client
    const client = await Client.create({
      companyName,
      contactPerson,
      email,
      phone,
      alternatePhone,
      password,
      businessRegistrationNumber,
      taxId,
      industryType,
      addresses,
      billingInfo,
      preferences
    });

    sendTokenResponse(client, 201, res, 'client');
  } catch (error) {
    console.error('Client registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// @desc    Upload business documents for client
// @route   POST /api/auth/client/documents
// @access  Private (Client)
router.post('/client/documents', protect(['client']), uploadBusinessDocuments, handleMulterError, async (req, res) => {
  try {
    const client = req.user;
    const files = req.files;

    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    // Process uploaded files
    const verification = { ...client.verification };
    
    Object.keys(files).forEach(fieldName => {
      if (files[fieldName] && files[fieldName][0]) {
        const file = files[fieldName][0];
        verification[fieldName] = {
          url: getFileUrl(req, path.relative(path.join(__dirname, '../uploads'), file.path)),
          uploadDate: new Date(),
          verified: false
        };
      }
    });

    // Update client's verification documents
    client.verification = verification;
    
    // Update verification status based on completion
    const completion = client.verificationCompletion;
    if (completion >= 100) {
      client.verification.verificationStatus = 'in_review';
    }

    await client.save();

    res.status(200).json({
      success: true,
      message: 'Business documents uploaded successfully',
      data: {
        verification: client.verification,
        verificationCompletion: client.verificationCompletion
      }
    });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during document upload'
    });
  }
});

// @desc    Login user (driver, client, or admin)
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
  body('userType').isIn(['driver', 'client', 'admin']).withMessage('Valid user type is required')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    console.log('body requets is ',req.body)

    const { email, password, userType } = req.body;

    let User;
    switch (userType) {
      case 'driver':
        User = Driver;
        break;
      case 'client':
        User = Client;
        break;
      case 'admin':
        User = Admin;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid user type'
        });
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);

    console.log('match is ',isMatch)

    if (!isMatch) {
      // Handle failed login attempt for admin users
      if (userType === 'admin') {
        user.handleLoginAttempt(false);
        await user.save();
      }
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (user.status === 'suspended' || user.status === 'inactive' || user.status === 'terminated') {
      return res.status(401).json({
        success: false,
        message: 'Account is not active'
      });
    }

    // Check if admin account is locked
    if (userType === 'admin' && user.isLocked) {
      return res.status(401).json({
        success: false,
        message: 'Account is temporarily locked due to multiple failed login attempts'
      });
    }

    // Handle successful login for admin users
    if (userType === 'admin') {
      const deviceInfo = {
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        device: req.get('User-Agent') || 'Unknown',
        browser: req.get('User-Agent') || 'Unknown',
        os: req.get('User-Agent') || 'Unknown'
      };
      
      user.handleLoginAttempt(true, deviceInfo);
      await user.save();
    }

    sendTokenResponse(user, 200, res, userType);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect(['driver', 'client', 'admin']), async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        user: req.user,
        userType: req.userType
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', protect(['driver', 'client', 'admin']), async (req, res) => {
  try {
    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', protect(['driver', 'client', 'admin']), async (req, res) => {
  try {
    const user = req.user;
    const updates = req.body;

    // Remove sensitive fields that shouldn't be updated via this route
    delete updates.password;
    delete updates.email;
    delete updates.status;
    delete updates.role;
    delete updates.permissions;

    // Update user fields
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        user[key] = updates[key];
      }
    });

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during profile update'
    });
  }
});

module.exports = router;