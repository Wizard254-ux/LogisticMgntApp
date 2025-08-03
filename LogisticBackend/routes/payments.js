const express = require('express');
const { body, validationResult, query } = require('express-validator');
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Shipment = require('../models/Shipment');
const Client = require('../models/Client');
const { protect, checkPermission, logAdminActivity } = require('../middleware/auth');

const router = express.Router();

// @desc    Create payment for shipment
// @route   POST /api/payments
// @access  Private (Admin)
router.post('/', protect(['admin']), checkPermission('payments', 'create'), [
  body('shipmentId').isMongoId().withMessage('Valid shipment ID is required'),
  body('amount.subtotal').isFloat({ min: 0 }).withMessage('Valid subtotal amount is required'),
  body('amount.total').isFloat({ min: 0 }).withMessage('Valid total amount is required'),
  body('dueDate').isISO8601().withMessage('Valid due date is required'),
  body('terms').optional().isIn(['immediate', 'net_15', 'net_30', 'net_45', 'net_60'])
], logAdminActivity('create', 'payments'), async (req, res) => {
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
      shipmentId,
      amount,
      charges,
      dueDate,
      terms,
      invoice,
      notes
    } = req.body;

    // Verify shipment exists
    const shipment = await Shipment.findById(shipmentId).populate('client');
    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Shipment not found'
      });
    }

    // Check if payment already exists for this shipment
    const existingPayment = await Payment.findOne({ shipment: shipmentId });
    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: 'Payment already exists for this shipment'
      });
    }

    // Create payment
    const payment = await Payment.create({
      client: shipment.client._id,
      shipment: shipmentId,
      amount,
      charges,
      dueDate,
      terms: terms || shipment.client.billingInfo?.paymentTerms || 'net_30',
      invoice,
      notes
    });

    await payment.populate('client', 'companyName email phone');
    await payment.populate('shipment', 'shipmentId trackingNumber description');

    res.status(201).json({
      success: true,
      message: 'Payment created successfully',
      data: { payment }
    });
  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating payment'
    });
  }
});

// @desc    Get payments with filtering
// @route   GET /api/payments
// @access  Private
router.get('/', protect(['client', 'admin']), [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded'])
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

    // User-specific filters
    if (req.userType === 'client') {
      query.client = req.user._id;
    } else if (req.query.clientId && req.userType === 'admin') {
      query.client = req.query.clientId;
    }

    // Status filter
    if (req.query.status) {
      query.status = req.query.status;
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

    // Due date filters
    if (req.query.overdue === 'true') {
      query.dueDate = { $lt: new Date() };
      query.status = { $ne: 'completed' };
    }

    // Search by payment ID or invoice number
    if (req.query.search) {
      query.$or = [
        { paymentId: { $regex: req.query.search, $options: 'i' } },
        { 'invoice.invoiceNumber': { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Execute query
    const payments = await Payment.find(query)
      .populate('client', 'companyName contactPerson email phone')
      .populate('shipment', 'shipmentId trackingNumber description status')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip(startIndex);

    const total = await Payment.countDocuments(query);

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
      count: payments.length,
      total,
      pagination,
      data: { payments }
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving payments'
    });
  }
});

// @desc    Get single payment
// @route   GET /api/payments/:id
// @access  Private
router.get('/:id', protect(['client', 'admin']), async (req, res) => {
  try {
    let query = { _id: req.params.id };

    // Clients can only see their own payments
    if (req.userType === 'client') {
      query.client = req.user._id;
    }

    const payment = await Payment.findOne(query)
      .populate('client', 'companyName contactPerson email phone billingInfo')
      .populate('shipment', 'shipmentId trackingNumber description items pickupAddress deliveryAddress');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { payment }
    });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving payment'
    });
  }
});

// @desc    Update payment status
// @route   PUT /api/payments/:id/status
// @access  Private (Admin)
router.put('/:id/status', protect(['admin']), checkPermission('payments', 'update'), [
  body('status').isIn(['processing', 'completed', 'failed', 'cancelled']).withMessage('Valid status is required'),
  body('notes').optional().trim().isLength({ max: 500 }),
  body('transactionId').optional().trim().notEmpty()
], logAdminActivity('update', 'payments'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { status, notes, transactionId, gatewayResponse } = req.body;

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Update payment
    payment.updateStatus(status, notes, 'admin', req.user._id);

    if (transactionId) {
      payment.transactionId = transactionId;
    }

    if (gatewayResponse) {
      payment.gateway.gatewayResponse = gatewayResponse;
    }

    await payment.save();

    await payment.populate('client', 'companyName email');
    await payment.populate('shipment', 'shipmentId trackingNumber');

    res.status(200).json({
      success: true,
      message: 'Payment status updated successfully',
      data: { payment }
    });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating payment status'
    });
  }
});

// @desc    Process refund
// @route   POST /api/payments/:id/refund
// @access  Private (Admin)
router.post('/:id/refund', protect(['admin']), checkPermission('payments', 'update'), [
  body('amount').isFloat({ min: 0.01 }).withMessage('Valid refund amount is required'),
  body('reason').isIn(['cancelled_shipment', 'service_issue', 'overcharge', 'duplicate_payment', 'client_request', 'other']).withMessage('Valid refund reason is required'),
  body('reasonDescription').optional().trim().isLength({ max: 500 })
], logAdminActivity('update', 'payments'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { amount, reason, reasonDescription, refundMethod } = req.body;

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Can only refund completed payments'
      });
    }

    // Check if refund amount is valid
    const totalRefunded = payment.totalRefunded;
    if (amount > (payment.amount.total - totalRefunded)) {
      return res.status(400).json({
        success: false,
        message: 'Refund amount exceeds available balance'
      });
    }

    // Add refund
    payment.addRefund({
      amount,
      reason,
      reasonDescription,
      refundMethod: refundMethod || 'original_method',
      processedBy: req.user._id
    });

    await payment.save();

    res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      data: { payment }
    });
  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing refund'
    });
  }
});

// @desc    Record partial payment
// @route   POST /api/payments/:id/partial
// @access  Private (Admin)
router.post('/:id/partial', protect(['admin']), checkPermission('payments', 'update'), [
  body('amount').isFloat({ min: 0.01 }).withMessage('Valid payment amount is required'),
  body('method').isIn(['credit_card', 'debit_card', 'bank_transfer', 'paypal', 'cash', 'check']).withMessage('Valid payment method is required'),
  body('transactionId').optional().trim().notEmpty()
], logAdminActivity('update', 'payments'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { amount, method, transactionId } = req.body;

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if partial payment amount is valid
    const remainingBalance = payment.remainingBalance;
    if (amount > remainingBalance) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount exceeds remaining balance'
      });
    }

    // Add partial payment
    const partialPaymentId = `PAR${Date.now().toString(36)}${Math.random().toString(36).substr(2, 4)}`.toUpperCase();
    
    payment.partialPayments.push({
      paymentId: partialPaymentId,
      amount,
      paidDate: new Date(),
      method,
      transactionId,
      status: 'completed'
    });

    // Update payment status if fully paid
    const newRemainingBalance = remainingBalance - amount;
    if (newRemainingBalance <= 0) {
      payment.updateStatus('completed', 'Payment completed with partial payments', 'admin', req.user._id);
    } else {
      payment.updateStatus('processing', `Partial payment received: $${amount}`, 'admin', req.user._id, amount);
    }

    await payment.save();

    res.status(200).json({
      success: true,
      message: 'Partial payment recorded successfully',
      data: { 
        payment,
        remainingBalance: newRemainingBalance
      }
    });
  } catch (error) {
    console.error('Record partial payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error recording partial payment'
    });
  }
});

// @desc    Get payment summary for client
// @route   GET /api/payments/client/:clientId/summary
// @access  Private (Admin)
router.get('/client/:clientId/summary', protect(['admin']), checkPermission('payments', 'read'), async (req, res) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate } = req.query;

    // Verify client exists
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Get payment summary
    const summary = await Payment.getClientSummary(clientId, startDate, endDate);

    // Get overdue payments
    const overduePayments = await Payment.find({
      client: clientId,
      dueDate: { $lt: new Date() },
      status: { $ne: 'completed' }
    }).countDocuments();

    // Calculate totals
    let totalPaid = 0;
    let totalPending = 0;
    let totalOverdue = 0;

    summary.forEach(stat => {
      if (stat._id === 'completed') {
        totalPaid = stat.totalAmount;
      } else if (['pending', 'processing'].includes(stat._id)) {
        totalPending += stat.totalAmount;
      }
    });

    // Get overdue amount
    const overdueAmount = await Payment.aggregate([
      {
        $match: {
          client: new mongoose.Types.ObjectId(clientId),
          dueDate: { $lt: new Date() },
          status: { $ne: 'completed' }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount.total' }
        }
      }
    ]);

    totalOverdue = overdueAmount.length > 0 ? overdueAmount[0].total : 0;

    res.status(200).json({
      success: true,
      data: {
        client: {
          id: client._id,
          companyName: client.companyName,
          email: client.email
        },
        summary: {
          totalPaid,
          totalPending,
          totalOverdue,
          overdueCount: overduePayments
        },
        breakdown: summary
      }
    });
  } catch (error) {
    console.error('Get payment summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving payment summary'
    });
  }
});

// @desc    Generate payment reports
// @route   GET /api/payments/reports
// @access  Private (Admin)
router.get('/reports', protect(['admin']), checkPermission('reports', 'read'), async (req, res) => {
  try {
    const { period = '30d', type = 'revenue' } = req.query;

    let startDate;
    switch (period) {
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

    let reportData;

    if (type === 'revenue') {
      // Revenue report
      reportData = await Payment.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$paidDate' },
              month: { $month: '$paidDate' },
              day: { $dayOfMonth: '$paidDate' }
            },
            totalRevenue: { $sum: '$amount.total' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]);
    } else if (type === 'status') {
      // Status report
      reportData = await Payment.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount.total' }
          }
        }
      ]);
    }

    res.status(200).json({
      success: true,
      data: {
        reportType: type,
        period,
        data: reportData
      }
    });
  } catch (error) {
    console.error('Generate payment report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error generating payment report'
    });
  }
});

module.exports = router;