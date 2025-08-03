const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Shipment = require('../models/Shipment');
const Driver = require('../models/Driver');
const Client = require('../models/Client');
const { protect, checkPermission, logAdminActivity } = require('../middleware/auth');
const { uploadShipmentDocuments, uploadShipmentPhotos, handleMulterError, getFileUrl } = require('../utils/fileUpload');
const path = require('path');

const router = express.Router();

// @desc    Create new shipment
// @route   POST /api/shipments
// @access  Private (Client)
router.post('/', protect(['client', 'admin']), [
  body('description').trim().isLength({ min: 10, max: 500 }).withMessage('Description must be between 10 and 500 characters'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.name').trim().notEmpty().withMessage('Item name is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Item quantity must be at least 1'),
  body('items.*.weight').isFloat({ min: 0.1 }).withMessage('Item weight must be at least 0.1 kg'),
  body('items.*.category').isIn(['Electronics', 'Clothing', 'Food', 'Documents', 'Machinery', 'Chemicals', 'Other']).withMessage('Valid item category is required'),
  body('pickupAddress.street').trim().notEmpty().withMessage('Pickup street address is required'),
  body('pickupAddress.city').trim().notEmpty().withMessage('Pickup city is required'),
  body('pickupAddress.state').trim().notEmpty().withMessage('Pickup state is required'),
  body('pickupAddress.zipCode').trim().notEmpty().withMessage('Pickup zip code is required'),
  body('deliveryAddress.street').trim().notEmpty().withMessage('Delivery street address is required'),
  body('deliveryAddress.city').trim().notEmpty().withMessage('Delivery city is required'),
  body('deliveryAddress.state').trim().notEmpty().withMessage('Delivery state is required'),
  body('deliveryAddress.zipCode').trim().notEmpty().withMessage('Delivery zip code is required'),
  body('requestedPickupDate').isISO8601().withMessage('Valid pickup date is required'),
  body('requestedDeliveryDate').isISO8601().withMessage('Valid delivery date is required'),
  body('serviceType').isIn(['standard', 'express', 'overnight', 'same_day']).withMessage('Valid service type is required')
], logAdminActivity('create', 'shipments'), async (req, res) => {
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
      description,
      items,
      pickupAddress,
      deliveryAddress,
      serviceType,
      priority,
      requestedPickupDate,
      requestedDeliveryDate,
      pickupTimeWindow,
      deliveryTimeWindow,
      requirements,
      pricing
    } = req.body;

    // Validate dates
    const pickupDate = new Date(requestedPickupDate);
    const deliveryDate = new Date(requestedDeliveryDate);
    const now = new Date();

    if (pickupDate < now) {
      return res.status(400).json({
        success: false,
        message: 'Pickup date cannot be in the past'
      });
    }

    if (deliveryDate <= pickupDate) {
      return res.status(400).json({
        success: false,
        message: 'Delivery date must be after pickup date'
      });
    }

    // Calculate total weight and value
    let totalWeight = 0;
    let totalValue = 0;

    items.forEach(item => {
      totalWeight += item.weight * item.quantity;
      if (item.value && item.value.amount) {
        totalValue += item.value.amount * item.quantity;
      }
    });

    // Get client ID (if admin is creating, client should be specified in body)
    const clientId = req.userType === 'admin' ? req.body.clientId : req.user._id;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: 'Client ID is required'
      });
    }

    // Create shipment
    const shipment = await Shipment.create({
      client: clientId,
      description,
      items,
      totalWeight,
      totalValue,
      pickupAddress,
      deliveryAddress,
      serviceType,
      priority: priority || 'medium',
      requestedPickupDate,
      requestedDeliveryDate,
      pickupTimeWindow,
      deliveryTimeWindow,
      pricing,
      requirements
    });

    await shipment.populate('client', 'companyName email phone');

    res.status(201).json({
      success: true,
      message: 'Shipment created successfully',
      data: {
        shipment
      }
    });
  } catch (error) {
    console.error('Shipment creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during shipment creation'
    });
  }
});

// @desc    Get all shipments with filtering and pagination
// @route   GET /api/shipments
// @access  Private
router.get('/', protect(['driver', 'client', 'admin']), [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['pending', 'assigned', 'picked', 'packed', 'processing', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled']),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  query('serviceType').optional().isIn(['standard', 'express', 'overnight', 'same_day'])
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

    // Build query based on user type and filters
    let query = {};

    // User-specific filters
    if (req.userType === 'driver') {
      query.driver = req.user._id;
    } else if (req.userType === 'client') {
      query.client = req.user._id;
    }

    // Status filter
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Priority filter
    if (req.query.priority) {
      query.priority = req.query.priority;
    }

    // Service type filter
    if (req.query.serviceType) {
      query.serviceType = req.query.serviceType;
    }

    // Date range filters
    if (req.query.startDate || req.query.endDate) {
      query.createdAt = {};
      if (req.query.startDate) {
        query.createdAt.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        query.createdAt.$lte = new Date(req.query.endDate);
      }
    }

    // Search by tracking number or shipment ID
    if (req.query.search) {
      query.$or = [
        { trackingNumber: { $regex: req.query.search, $options: 'i' } },
        { shipmentId: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Execute query
    const shipments = await Shipment.find(query)
      .populate('client', 'companyName contactPerson email phone')
      .populate('driver', 'firstName lastName email phone vehicle')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip(startIndex);

    // Get total count for pagination
    const total = await Shipment.countDocuments(query);

    // Pagination result
    const pagination = {};

    if (startIndex + limit < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }

    res.status(200).json({
      success: true,
      count: shipments.length,
      total,
      pagination,
      data: {
        shipments
      }
    });
  } catch (error) {
    console.error('Get shipments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving shipments'
    });
  }
});

// @desc    Get shipment tracking history
// @route   GET /api/shipments/track/:trackingNumber
// @access  Public (with tracking number)
router.get('/track/:trackingNumber', async (req, res) => {
  try {
    const { trackingNumber } = req.params;

    const shipment = await Shipment.findOne({ trackingNumber })
      .select('shipmentId trackingNumber status timeline pickupAddress deliveryAddress estimatedTransitTime currentStatusInfo')
      .populate('client', 'companyName');

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Shipment not found with this tracking number'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        shipment: {
          shipmentId: shipment.shipmentId,
          trackingNumber: shipment.trackingNumber,
          status: shipment.status,
          timeline: shipment.timeline,
          estimatedTransitTime: shipment.estimatedTransitTime,
          currentStatusInfo: shipment.currentStatusInfo,
          client: shipment.client,
          pickupAddress: {
            city: shipment.pickupAddress.city,
            state: shipment.pickupAddress.state
          },
          deliveryAddress: {
            city: shipment.deliveryAddress.city,
            state: shipment.deliveryAddress.state
          }
        }
      }
    });
  } catch (error) {
    console.error('Track shipment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error tracking shipment'
    });
  }
});

// @desc    Get single shipment
// @route   GET /api/shipments/:id
// @access  Private
router.get('/:id', protect(['driver', 'client', 'admin']), async (req, res) => {
  try {
    let query = { _id: req.params.id };

    // Add user-specific filters
    if (req.userType === 'driver') {
      query.driver = req.user._id;
    } else if (req.userType === 'client') {
      query.client = req.user._id;
    }

    const shipment = await Shipment.findOne(query)
      .populate('client', 'companyName contactPerson email phone addresses')
      .populate('driver', 'firstName lastName email phone vehicle currentLocation rating');

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Shipment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        shipment
      }
    });
  } catch (error) {
    console.error('Get shipment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving shipment'
    });
  }
});

// @desc    Update shipment status
// @route   PUT /api/shipments/:id/status
// @access  Private (Driver, Admin)
router.put('/:id/status', protect(['driver', 'admin']), [
  body('status').isIn(['assigned', 'picked', 'packed', 'processing', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled']).withMessage('Valid status is required'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
], logAdminActivity('update', 'shipments'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { status, notes, location } = req.body;

    let query = { _id: req.params.id };

    // Drivers can only update their assigned shipments
    if (req.userType === 'driver') {
      query.driver = req.user._id;
    }

    const shipment = await Shipment.findOne(query);

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Shipment not found or not authorized'
      });
    }

    // Validate status transition
    const validTransitions = {
      'pending': ['assigned', 'cancelled'],
      'assigned': ['picked', 'cancelled'],
      'picked': ['packed', 'processing', 'failed'],
      'packed': ['processing', 'in_transit'],
      'processing': ['in_transit', 'failed'],
      'in_transit': ['out_for_delivery', 'delivered', 'failed'],
      'out_for_delivery': ['delivered', 'failed', 'returned'],
      'delivered': [],
      'failed': ['processing', 'cancelled'],
      'returned': [],
      'cancelled': []
    };

    if (!validTransitions[shipment.status].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from ${shipment.status} to ${status}`
      });
    }

    // Update status with timeline
    shipment.updateStatus(
      status,
      location,
      notes,
      req.userType,
      req.user._id
    );

    await shipment.save();

    // Populate updated shipment
    await shipment.populate('client', 'companyName email phone');
    await shipment.populate('driver', 'firstName lastName email phone');

    res.status(200).json({
      success: true,
      message: 'Shipment status updated successfully',
      data: {
        shipment
      }
    });
  } catch (error) {
    console.error('Update shipment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating shipment status'
    });
  }
});

// @desc    Assign driver to shipment
// @route   PUT /api/shipments/:id/assign
// @access  Private (Admin)
router.put('/:id/assign', protect(['admin']), checkPermission('shipments', 'update'), [
  body('driverId').isMongoId().withMessage('Valid driver ID is required')
], logAdminActivity('update', 'shipments'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { driverId } = req.body;

    // Check if driver exists and is approved
    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    if (driver.status !== 'approved' || driver.kycStatus !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Driver is not approved or KYC not completed'
      });
    }

    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Shipment not found'
      });
    }

    if (shipment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Can only assign drivers to pending shipments'
      });
    }

    // Assign driver and update status
    shipment.driver = driverId;
    shipment.updateStatus(
      'assigned',
      null,
      `Assigned to driver ${driver.fullName}`,
      'admin',
      req.user._id
    );

    await shipment.save();

    // Populate updated shipment
    await shipment.populate('client', 'companyName email phone');
    await shipment.populate('driver', 'firstName lastName email phone vehicle');

    res.status(200).json({
      success: true,
      message: 'Driver assigned successfully',
      data: {
        shipment
      }
    });
  } catch (error) {
    console.error('Assign driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error assigning driver'
    });
  }
});

// @desc    Upload shipment documents
// @route   POST /api/shipments/:id/documents
// @access  Private (Driver, Admin)
router.post('/:id/documents', protect(['driver', 'admin']), uploadShipmentDocuments, handleMulterError, async (req, res) => {
  try {
    let query = { _id: req.params.id };

    // Drivers can only upload to their assigned shipments
    if (req.userType === 'driver') {
      query.driver = req.user._id;
    }

    const shipment = await Shipment.findOne(query);
    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Shipment not found or not authorized'
      });
    }

    const files = req.files;
    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    // Process uploaded files
    const documents = [];
    
    Object.keys(files).forEach(fieldName => {
      if (files[fieldName] && files[fieldName][0]) {
        const file = files[fieldName][0];
        documents.push({
          type: fieldName.replace(/([A-Z])/g, '_$1').toLowerCase(),
          name: file.originalname,
          url: getFileUrl(req, path.relative(path.join(__dirname, '../uploads'), file.path)),
          uploadDate: new Date(),
          uploadedBy: req.user._id,
          uploadedByModel: req.userType === 'driver' ? 'Driver' : 'Admin'
        });
      }
    });

    // Add documents to shipment
    shipment.documents.push(...documents);
    await shipment.save();

    res.status(200).json({
      success: true,
      message: 'Documents uploaded successfully',
      data: {
        documents: shipment.documents
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

// @desc    Upload shipment photos
// @route   POST /api/shipments/:id/photos
// @access  Private (Driver)
router.post('/:id/photos', protect(['driver']), uploadShipmentPhotos, handleMulterError, [
  body('type').isIn(['pickup_proof', 'delivery_proof', 'damage', 'package_condition', 'other']).withMessage('Valid photo type is required'),
  body('description').optional().trim().isLength({ max: 200 }).withMessage('Description cannot exceed 200 characters')
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

    const shipment = await Shipment.findOne({
      _id: req.params.id,
      driver: req.user._id
    });

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Shipment not found or not authorized'
      });
    }

    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No photos uploaded'
      });
    }

    const { type, description, latitude, longitude } = req.body;

    // Process uploaded photos
    const photos = files.map(file => ({
      type,
      url: getFileUrl(req, path.relative(path.join(__dirname, '../uploads'), file.path)),
      description,
      timestamp: new Date(),
      location: latitude && longitude ? { latitude, longitude } : undefined,
      takenBy: req.user._id,
      takenByModel: 'Driver'
    }));

    // Add photos to shipment
    shipment.photos.push(...photos);
    await shipment.save();

    res.status(200).json({
      success: true,
      message: 'Photos uploaded successfully',
      data: {
        photos: shipment.photos
      }
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during photo upload'
    });
  }
});

module.exports = router;