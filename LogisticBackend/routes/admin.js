const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Driver = require('../models/Driver');
const Client = require('../models/Client');
const Admin = require('../models/Admin');
const Shipment = require('../models/Shipment');
const Payment = require('../models/Payment');
const { protect, authorize, checkPermission, logAdminActivity, sendTokenResponse } = require('../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(protect(['admin']));

// @desc    Create admin user (super admin only)
// @route   POST /api/admin/users
// @access  Private (Super Admin)
router.post('/users', authorize('super_admin'), [
  body('firstName').trim().isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
  body('lastName').trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('phone').isMobilePhone().withMessage('Please enter a valid phone number'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').isIn(['admin', 'manager', 'operator']).withMessage('Valid role is required'),
  body('department').isIn(['Operations', 'Customer Service', 'Finance', 'IT', 'Management', 'HR']).withMessage('Valid department is required'),
  body('position').trim().notEmpty().withMessage('Position is required'),
  body('employeeId').trim().notEmpty().withMessage('Employee ID is required')
], logAdminActivity('create', 'users'), async (req, res) => {
  try {
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
      role,
      department,
      position,
      employeeId,
      permissions,
      address,
      emergencyContact
    } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({
      $or: [{ email }, { employeeId }]
    });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Admin with this email or employee ID already exists'
      });
    }

    // Create admin
    const admin = await Admin.create({
      firstName,
      lastName,
      email,
      phone,
      password,
      role,
      department,
      position,
      employeeId,
      permissions,
      address,
      emergencyContact,
      hireDate: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: {
        admin: {
          id: admin._id,
          fullName: admin.fullName,
          email: admin.email,
          role: admin.role,
          department: admin.department,
          status: admin.status
        }
      }
    });
  } catch (error) {
    console.error('Admin creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating admin user'
    });
  }
});

// @desc    Get all drivers with filtering
// @route   GET /api/admin/drivers
// @access  Private (Admin with drivers read permission)
router.get('/drivers', checkPermission('drivers', 'read'), [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'approved', 'rejected', 'suspended']),
  query('kycStatus').optional().isIn(['pending', 'in_review', 'approved', 'rejected'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const startIndex = (page - 1) * limit;

    // Build query
    let query = {};

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.kycStatus) {
      query.kycStatus = req.query.kycStatus;
    }

    if (req.query.search) {
      query.$or = [
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { lastName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { driverLicense: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const drivers = await Driver.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip(startIndex);

    const total = await Driver.countDocuments(query);

    // Pagination
    const pagination = {};
    if (startIndex + limit < total) {
      pagination.next = { page: page + 1, limit };
    }
    if (startIndex > 0) {
      pagination.prev = { page: page - 1, limit };
    }

    res.status(200).json({
      success: true,
      count: drivers.length,
      total,
      pagination,
      data: { drivers }
    });
  } catch (error) {
    console.error('Get drivers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving drivers'
    });
  }
});

// @desc    Get single driver
// @route   GET /api/admin/drivers/:id
// @access  Private (Admin with drivers read permission)
router.get('/drivers/:id', checkPermission('drivers', 'read'), async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id).select('-password');

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Get driver's shipment statistics
    const shipmentStats = await Shipment.aggregate([
      { $match: { driver: driver._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        driver,
        shipmentStats
      }
    });
  } catch (error) {
    console.error('Get driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving driver'
    });
  }
});

// @desc    Update driver status (approve/reject/suspend)
// @route   PUT /api/admin/drivers/:id/status
// @access  Private (Admin with drivers approve permission)
router.put('/drivers/:id/status', checkPermission('drivers', 'approve'), [
  body('status').isIn(['approved', 'rejected', 'suspended']).withMessage('Valid status is required'),
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters')
], logAdminActivity('update', 'drivers'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { status, reason } = req.body;

    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const oldStatus = driver.status;
    driver.status = status;

    // If rejecting or suspending, add reason to notes
    if (reason && (status === 'rejected' || status === 'suspended')) {
      driver.adminNotes = driver.adminNotes || [];
      driver.adminNotes.push({
        note: reason,
        addedBy: req.user._id,
        addedAt: new Date(),
        type: status
      });
    }

    await driver.save();

    res.status(200).json({
      success: true,
      message: `Driver status updated from ${oldStatus} to ${status}`,
      data: { driver }
    });
  } catch (error) {
    console.error('Update driver status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating driver status'
    });
  }
});

// @desc    Verify driver KYC documents
// @route   PUT /api/admin/drivers/:id/kyc
// @access  Private (Admin with drivers approve permission)
router.put('/drivers/:id/kyc', checkPermission('drivers', 'approve'), [
  body('kycStatus').isIn(['approved', 'rejected']).withMessage('Valid KYC status is required'),
  body('documentVerifications').isArray().withMessage('Document verifications must be an array'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
], logAdminActivity('update', 'drivers'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { kycStatus, documentVerifications, notes } = req.body;

    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Update individual document verifications
    documentVerifications.forEach(verification => {
      const { documentType, verified } = verification;
      if (driver.kycDocuments[documentType]) {
        driver.kycDocuments[documentType].verified = verified;
      }
    });

    driver.kycStatus = kycStatus;

    // Add admin notes
    if (notes) {
      driver.adminNotes = driver.adminNotes || [];
      driver.adminNotes.push({
        note: notes,
        addedBy: req.user._id,
        addedAt: new Date(),
        type: 'kyc_review'
      });
    }

    await driver.save();

    res.status(200).json({
      success: true,
      message: `Driver KYC status updated to ${kycStatus}`,
      data: { driver }
    });
  } catch (error) {
    console.error('Update KYC status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating KYC status'
    });
  }
});

// @desc    Create new driver (admin only)
// @route   POST /api/admin/drivers
// @access  Private (Admin with drivers create permission)
router.post('/drivers', checkPermission('drivers', 'create'), [
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
], logAdminActivity('create', 'drivers'), async (req, res) => {
  try {
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
      $or: [{ email }, { phone }, { driverLicense }]
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
      emergencyContact,
      status: 'pending' // Admin created drivers start as pending
    });

    res.status(201).json({
      success: true,
      message: 'Driver created successfully',
      data: {
        driver: {
          id: driver._id,
          fullName: driver.fullName,
          email: driver.email,
          phone: driver.phone,
          status: driver.status,
          kycStatus: driver.kycStatus
        }
      }
    });
  } catch (error) {
    console.error('Create driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating driver'
    });
  }
});

// @desc    Update driver information
// @route   PUT /api/admin/drivers/:id
// @access  Private (Admin with drivers update permission)
router.put('/drivers/:id', checkPermission('drivers', 'update'), [
  body('firstName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
  body('lastName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('phone').optional().isMobilePhone().withMessage('Please enter a valid phone number'),
  body('driverLicense').optional().notEmpty().withMessage('Driver license is required'),
  body('licenseExpiry').optional().isISO8601().withMessage('Valid license expiry date is required'),
  body('dateOfBirth').optional().isISO8601().withMessage('Valid date of birth is required')
], logAdminActivity('update', 'drivers'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const updates = req.body;
    
    // Remove sensitive fields that shouldn't be updated via this route
    delete updates.password;
    delete updates.kycDocuments;
    delete updates.kycStatus;
    delete updates.status;

    // Check for duplicate email, phone, or license if being updated
    if (updates.email || updates.phone || updates.driverLicense) {
      const query = { _id: { $ne: req.params.id } };
      const orConditions = [];
      
      if (updates.email) orConditions.push({ email: updates.email });
      if (updates.phone) orConditions.push({ phone: updates.phone });
      if (updates.driverLicense) orConditions.push({ driverLicense: updates.driverLicense });
      
      if (orConditions.length > 0) {
        query.$or = orConditions;
        const existingDriver = await Driver.findOne(query);
        
        if (existingDriver) {
          return res.status(400).json({
            success: false,
            message: 'Driver with this email, phone, or license number already exists'
          });
        }
      }
    }

    // Validate license expiry date if being updated
    if (updates.licenseExpiry && new Date(updates.licenseExpiry) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Driver license has expired'
      });
    }

    // Update driver fields
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        driver[key] = updates[key];
      }
    });

    await driver.save();

    res.status(200).json({
      success: true,
      message: 'Driver updated successfully',
      data: { driver }
    });
  } catch (error) {
    console.error('Update driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating driver'
    });
  }
});

// @desc    Delete driver
// @route   DELETE /api/admin/drivers/:id
// @access  Private (Admin with drivers delete permission)
router.delete('/drivers/:id', checkPermission('drivers', 'delete'), logAdminActivity('delete', 'drivers'), async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Check if driver has active shipments
    const activeShipments = await Shipment.countDocuments({
      driver: driver._id,
      status: { $in: ['assigned', 'picked', 'in_transit'] }
    });

    if (activeShipments > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete driver with active shipments'
      });
    }

    // Soft delete by setting status to terminated
    driver.status = 'terminated';
    driver.isActive = false;
    await driver.save();

    res.status(200).json({
      success: true,
      message: 'Driver deleted successfully'
    });
  } catch (error) {
    console.error('Delete driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting driver'
    });
  }
});

// @desc    Get all clients with filtering
// @route   GET /api/admin/clients
// @access  Private (Admin with clients read permission)
router.get('/clients', checkPermission('clients', 'read'), [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'active', 'suspended', 'inactive']),
  query('verificationStatus').optional().isIn(['pending', 'in_review', 'approved', 'rejected'])
], async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const startIndex = (page - 1) * limit;

    let query = {};

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.verificationStatus) {
      query['verification.verificationStatus'] = req.query.verificationStatus;
    }

    if (req.query.search) {
      query.$or = [
        { companyName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { businessRegistrationNumber: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const clients = await Client.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip(startIndex);

    const total = await Client.countDocuments(query);

    // Pagination
    const pagination = {};
    if (startIndex + limit < total) {
      pagination.next = { page: page + 1, limit };
    }
    if (startIndex > 0) {
      pagination.prev = { page: page - 1, limit };
    }

    res.status(200).json({
      success: true,
      count: clients.length,
      total,
      pagination,
      data: { clients }
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving clients'
    });
  }
});

// @desc    Get single client with shipments
// @route   GET /api/admin/clients/:id
// @access  Private (Admin with clients read permission)
router.get('/clients/:id', checkPermission('clients', 'read'), async (req, res) => {
  try {
    const client = await Client.findById(req.params.id).select('-password');

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Get client's shipments with pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;

    const shipments = await Shipment.find({ client: client._id })
      .populate('driver', 'firstName lastName email phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip(startIndex);

    const totalShipments = await Shipment.countDocuments({ client: client._id });

    // Get shipment statistics
    const shipmentStats = await Shipment.aggregate([
      { $match: { client: client._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$totalValue' }
        }
      }
    ]);

    // Get payment statistics
    const paymentStats = await Payment.aggregate([
      { $match: { client: client._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount.total' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        client,
        shipments,
        totalShipments,
        shipmentStats,
        paymentStats
      }
    });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving client'
    });
  }
});

// @desc    Update client status
// @route   PUT /api/admin/clients/:id/status
// @access  Private (Admin with clients approve permission)
router.put('/clients/:id/status', checkPermission('clients', 'approve'), [
  body('status').isIn(['active', 'suspended', 'inactive']).withMessage('Valid status is required'),
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters')
], logAdminActivity('update', 'clients'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { status, reason } = req.body;

    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    const oldStatus = client.status;
    client.status = status;

    // Add admin notes if reason provided
    if (reason) {
      client.adminNotes = client.adminNotes || [];
      client.adminNotes.push({
        note: reason,
        addedBy: req.user._id,
        addedAt: new Date(),
        type: 'status_change'
      });
    }

    await client.save();

    res.status(200).json({
      success: true,
      message: `Client status updated from ${oldStatus} to ${status}`,
      data: { client }
    });
  } catch (error) {
    console.error('Update client status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating client status'
    });
  }
});

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin)
router.get('/dashboard', async (req, res) => {
  try {
    const timeFilter = req.query.period || '30d'; // 7d, 30d, 90d, 1y
    let startDate;

    switch (timeFilter) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get totals
    const [
      totalDrivers,
      totalClients,
      totalShipments,
      activeDrivers,
      pendingShipments,
      recentShipments,
      shipmentStats,
      paymentStats
    ] = await Promise.all([
      Driver.countDocuments(),
      Client.countDocuments(),
      Shipment.countDocuments(),
      Driver.countDocuments({ status: 'approved', isOnline: true }),
      Shipment.countDocuments({ status: { $in: ['pending', 'assigned'] } }),
      
      Shipment.find({ createdAt: { $gte: startDate } })
        .populate('client', 'companyName')
        .populate('driver', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(10),
      
      Shipment.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalValue: { $sum: '$totalValue' }
          }
        }
      ]),
      
      Payment.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount.total' }
          }
        }
      ])
    ]);

    // Calculate revenue
    const totalRevenue = paymentStats
      .filter(stat => stat._id === 'completed')
      .reduce((sum, stat) => sum + stat.totalAmount, 0);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalDrivers,
          totalClients,
          totalShipments,
          activeDrivers,
          pendingShipments,
          totalRevenue
        },
        recentShipments,
        shipmentStats,
        paymentStats,
        period: timeFilter
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving dashboard data'
    });
  }
});

module.exports = router;