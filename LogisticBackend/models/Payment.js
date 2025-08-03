const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // Payment Identification
  paymentId: {
    type: String,
    unique: true,
    required: true
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  
  // Related Documents
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Client is required']
  },
  shipment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shipment',
    required: [true, 'Shipment is required']
  },
  invoice: {
    invoiceNumber: String,
    invoiceDate: Date,
    dueDate: Date,
    invoiceUrl: String
  },
  
  // Payment Details
  amount: {
    subtotal: {
      type: Number,
      required: true,
      min: [0, 'Subtotal cannot be negative']
    },
    tax: {
      type: Number,
      default: 0,
      min: [0, 'Tax cannot be negative']
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative']
    },
    total: {
      type: Number,
      required: true,
      min: [0, 'Total amount cannot be negative']
    },
    currency: {
      type: String,
      required: true,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
    }
  },
  
  // Payment Breakdown
  charges: [{
    description: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['base_rate', 'distance', 'weight', 'urgency', 'special_handling', 'fuel_surcharge', 'insurance', 'other'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      default: 1
    },
    rate: Number
  }],
  
  // Payment Method
  paymentMethod: {
    type: {
      type: String,
      enum: ['credit_card', 'debit_card', 'bank_transfer', 'paypal', 'stripe', 'cash', 'check', 'account_credit'],
      required: true
    },
    details: {
      // For card payments
      cardLast4: String,
      cardBrand: String,
      cardExpiry: String,
      
      // For bank transfer
      bankName: String,
      accountLast4: String,
      
      // For digital wallets
      walletProvider: String,
      walletId: String,
      
      // For check
      checkNumber: String
    }
  },
  
  // Payment Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded'],
    default: 'pending'
  },
  
  // Payment Gateway Information
  gateway: {
    provider: {
      type: String,
      enum: ['stripe', 'paypal', 'square', 'authorize_net', 'manual'],
      default: 'manual'
    },
    gatewayTransactionId: String,
    gatewayResponse: {
      code: String,
      message: String,
      details: mongoose.Schema.Types.Mixed
    },
    fees: {
      gatewayFee: Number,
      processingFee: Number
    }
  },
  
  // Payment Timeline
  timeline: [{
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    notes: String,
    amount: Number, // For partial payments/refunds
    updatedBy: {
      type: String,
      enum: ['system', 'admin', 'client', 'gateway']
    },
    updatedByUser: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'timeline.updatedByUserModel'
    },
    updatedByUserModel: {
      type: String,
      enum: ['Client', 'Admin']
    }
  }],
  
  // Important Dates
  createdDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true
  },
  paidDate: Date,
  
  // Payment Terms
  terms: {
    type: String,
    enum: ['immediate', 'net_15', 'net_30', 'net_45', 'net_60'],
    default: 'immediate'
  },
  
  // Refund Information
  refunds: [{
    refundId: String,
    amount: {
      type: Number,
      required: true
    },
    reason: {
      type: String,
      enum: ['cancelled_shipment', 'service_issue', 'overcharge', 'duplicate_payment', 'client_request', 'other'],
      required: true
    },
    reasonDescription: String,
    refundDate: {
      type: Date,
      default: Date.now
    },
    refundMethod: {
      type: String,
      enum: ['original_method', 'bank_transfer', 'check', 'account_credit'],
      default: 'original_method'
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending'
    },
    gatewayRefundId: String,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    }
  }],
  
  // Partial Payments (for installments)
  partialPayments: [{
    paymentId: String,
    amount: Number,
    paidDate: Date,
    method: {
      type: String,
      enum: ['credit_card', 'debit_card', 'bank_transfer', 'paypal', 'cash', 'check']
    },
    transactionId: String,
    status: {
      type: String,
      enum: ['completed', 'failed'],
      default: 'completed'
    }
  }],
  
  // Late Payment Information
  latePayment: {
    isLate: {
      type: Boolean,
      default: false
    },
    daysLate: {
      type: Number,
      default: 0
    },
    lateFee: {
      type: Number,
      default: 0
    },
    remindersSent: [{
      date: Date,
      type: {
        type: String,
        enum: ['email', 'sms', 'call']
      },
      status: {
        type: String,
        enum: ['sent', 'delivered', 'opened', 'failed']
      }
    }]
  },
  
  // Dispute Information
  disputes: [{
    disputeId: String,
    reason: String,
    description: String,
    amount: Number,
    raisedDate: {
      type: Date,
      default: Date.now
    },
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'disputes.raisedByModel'
    },
    raisedByModel: {
      type: String,
      enum: ['Client', 'Admin']
    },
    status: {
      type: String,
      enum: ['open', 'investigating', 'resolved', 'closed'],
      default: 'open'
    },
    resolution: String,
    resolvedDate: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    }
  }],
  
  // Receipt and Documentation
  receipt: {
    receiptNumber: String,
    receiptUrl: String,
    generatedDate: Date
  },
  
  // Notes and Comments
  notes: {
    internal: String, // For admin use
    client: String   // Visible to client
  },
  
  // Accounting Information
  accounting: {
    accountingPeriod: String,
    revenueRecognitionDate: Date,
    bookingDate: Date,
    chartOfAccounts: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Pre-save middleware to generate payment ID
paymentSchema.pre('save', async function(next) {
  if (this.isNew && !this.paymentId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 6);
    this.paymentId = `PAY${timestamp}${random}`.toUpperCase();
  }
  
  // Calculate total amount if not set
  if (this.isModified('amount') && !this.amount.total) {
    this.amount.total = this.amount.subtotal + this.amount.tax - this.amount.discount;
  }
  
  // Add timeline entry for new payments
  if (this.isNew) {
    this.timeline.push({
      status: 'pending',
      timestamp: new Date(),
      notes: 'Payment record created',
      updatedBy: 'system'
    });
  }
  
  next();
});

// Virtual for payment status display
paymentSchema.virtual('statusDisplay').get(function() {
  const statusMap = {
    'pending': 'Pending Payment',
    'processing': 'Processing Payment',
    'completed': 'Payment Completed',
    'failed': 'Payment Failed',
    'cancelled': 'Payment Cancelled',
    'refunded': 'Fully Refunded',
    'partially_refunded': 'Partially Refunded'
  };
  return statusMap[this.status] || this.status;
});

// Virtual for days overdue
paymentSchema.virtual('daysOverdue').get(function() {
  if (this.status === 'completed' || !this.dueDate) return 0;
  const today = new Date();
  const dueDate = new Date(this.dueDate);
  if (today > dueDate) {
    return Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
  }
  return 0;
});

// Virtual for total refunded amount
paymentSchema.virtual('totalRefunded').get(function() {
  return this.refunds
    .filter(refund => refund.status === 'completed')
    .reduce((total, refund) => total + refund.amount, 0);
});

// Virtual for remaining balance
paymentSchema.virtual('remainingBalance').get(function() {
  const totalPaid = this.partialPayments
    .filter(payment => payment.status === 'completed')
    .reduce((total, payment) => total + payment.amount, 0);
  
  if (this.status === 'completed') {
    return 0;
  }
  
  return this.amount.total - totalPaid;
});

// Method to update payment status
paymentSchema.methods.updateStatus = function(newStatus, notes, updatedBy, updatedByUser, amount = null) {
  this.status = newStatus;
  this.timeline.push({
    status: newStatus,
    timestamp: new Date(),
    notes,
    amount,
    updatedBy,
    updatedByUser
  });
  
  if (newStatus === 'completed') {
    this.paidDate = new Date();
  }
};

// Method to add refund
paymentSchema.methods.addRefund = function(refundData) {
  const refundId = `REF${Date.now().toString(36)}${Math.random().toString(36).substr(2, 4)}`.toUpperCase();
  
  this.refunds.push({
    refundId,
    ...refundData
  });
  
  // Update payment status if fully refunded
  const totalRefunded = this.totalRefunded + refundData.amount;
  if (totalRefunded >= this.amount.total) {
    this.status = 'refunded';
  } else if (totalRefunded > 0) {
    this.status = 'partially_refunded';
  }
};

// Static method to get payment summary for a client
paymentSchema.statics.getClientSummary = function(clientId, startDate, endDate) {
  const match = { client: clientId };
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount.total' }
      }
    }
  ]);
};

// Index for efficient queries
paymentSchema.index({ paymentId: 1 });
paymentSchema.index({ client: 1 });
paymentSchema.index({ shipment: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ dueDate: 1 });
paymentSchema.index({ paidDate: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ 'gateway.gatewayTransactionId': 1 });

module.exports = mongoose.model('Payment', paymentSchema);