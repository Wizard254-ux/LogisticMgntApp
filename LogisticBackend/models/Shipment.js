const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema({
  // Shipment Identification
  shipmentId: {
    type: String,
    unique: true,
    required: true
  },
  trackingNumber: {
    type: String,
    unique: true,
    required: true
  },
  
  // Related Documents
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Client is required']
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null
  },
  
  // Shipment Details
  description: {
    type: String,
    required: [true, 'Shipment description is required'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  // Items in the shipment
  items: [{
    name: {
      type: String,
      required: true
    },
    description: String,
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1']
    },
    weight: {
      type: Number,
      required: true,
      min: [0.1, 'Weight must be at least 0.1 kg']
    },
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
      unit: {
        type: String,
        enum: ['cm', 'inch'],
        default: 'cm'
      }
    },
    value: {
      amount: Number,
      currency: {
        type: String,
        default: 'USD'
      }
    },
    category: {
      type: String,
      enum: ['Electronics', 'Clothing', 'Food', 'Documents', 'Machinery', 'Chemicals', 'Other'],
      required: true
    },
    isFragile: {
      type: Boolean,
      default: false
    },
    specialHandling: String
  }],
  
  // Total Shipment Info
  totalWeight: {
    type: Number,
    required: true
  },
  totalValue: {
    type: Number,
    required: true
  },
  
  // Addresses
  pickupAddress: {
    name: String,
    contactPerson: String,
    phone: String,
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true },
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    specialInstructions: String
  },
  
  deliveryAddress: {
    name: String,
    contactPerson: String,
    phone: String,
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true },
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    specialInstructions: String
  },
  
  // Shipping Details
  serviceType: {
    type: String,
    enum: ['standard', 'express', 'overnight', 'same_day'],
    required: true,
    default: 'standard'
  },
  
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Status Tracking
  status: {
    type: String,
    enum: ['pending', 'assigned', 'picked', 'packed', 'processing', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled'],
    default: 'pending'
  },
  
  // Timeline tracking
  timeline: [{
    status: {
      type: String,
      enum: ['pending', 'assigned', 'picked', 'packed', 'processing', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    location: {
      name: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    },
    notes: String,
    updatedBy: {
      type: String,
      enum: ['system', 'driver', 'admin', 'client']
    },
    updatedByUser: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'timeline.updatedByUserModel'
    },
    updatedByUserModel: {
      type: String,
      enum: ['Driver', 'Client', 'Admin']
    }
  }],
  
  // Dates
  requestedPickupDate: {
    type: Date,
    required: true
  },
  requestedDeliveryDate: {
    type: Date,
    required: true
  },
  actualPickupDate: Date,
  actualDeliveryDate: Date,
  
  // Time windows
  pickupTimeWindow: {
    start: String, // format: "HH:MM"
    end: String    // format: "HH:MM"
  },
  deliveryTimeWindow: {
    start: String, // format: "HH:MM"
    end: String    // format: "HH:MM"
  },
  
  // Pricing
  pricing: {
    baseRate: Number,
    distanceRate: Number,
    weightRate: Number,
    urgencyRate: Number,
    specialHandlingRate: Number,
    totalAmount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  
  // Insurance
  insurance: {
    isInsured: {
      type: Boolean,
      default: false
    },
    provider: String,
    policyNumber: String,
    coverage: Number
  },
  
  // Documents and Photos
  documents: [{
    type: {
      type: String,
      enum: ['pickup_receipt', 'delivery_receipt', 'invoice', 'insurance', 'customs', 'other']
    },
    name: String,
    url: String,
    uploadDate: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'documents.uploadedByModel'
    },
    uploadedByModel: {
      type: String,
      enum: ['Driver', 'Client', 'Admin']
    }
  }],
  
  photos: [{
    type: {
      type: String,
      enum: ['pickup_proof', 'delivery_proof', 'damage', 'package_condition', 'other']
    },
    url: String,
    description: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    location: {
      latitude: Number,
      longitude: Number
    },
    takenBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'photos.takenByModel'
    },
    takenByModel: {
      type: String,
      enum: ['Driver', 'Client', 'Admin']
    }
  }],
  
  // Special Requirements
  requirements: {
    temperatureControlled: {
      type: Boolean,
      default: false
    },
    temperatureRange: {
      min: Number,
      max: Number,
      unit: {
        type: String,
        enum: ['celsius', 'fahrenheit'],
        default: 'celsius'
      }
    },
    hazardousMaterial: {
      type: Boolean,
      default: false
    },
    hazardClass: String,
    signatureRequired: {
      type: Boolean,
      default: false
    },
    ageVerificationRequired: {
      type: Boolean,
      default: false
    }
  },
  
  // Delivery Information
  delivery: {
    recipient: {
      name: String,
      signature: String,
      relationToRecipient: String,
      idVerified: Boolean
    },
    deliveryNotes: String,
    deliveryProof: [{
      type: String,
      url: String
    }]
  },
  
  // Rating and Feedback
  rating: {
    clientRating: {
      rating: { type: Number, min: 1, max: 5 },
      feedback: String,
      date: Date
    },
    driverRating: {
      rating: { type: Number, min: 1, max: 5 },
      feedback: String,
      date: Date
    }
  },
  
  // Issues and Exceptions
  issues: [{
    type: {
      type: String,
      enum: ['delay', 'damage', 'lost', 'wrong_address', 'recipient_unavailable', 'weather', 'vehicle_breakdown', 'other']
    },
    description: String,
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'issues.reportedByModel'
    },
    reportedByModel: {
      type: String,
      enum: ['Driver', 'Client', 'Admin']
    },
    reportedAt: {
      type: Date,
      default: Date.now
    },
    resolved: {
      type: Boolean,
      default: false
    },
    resolution: String,
    resolvedAt: Date
  }],
  
  // Cancellation
  cancellation: {
    isCancelled: {
      type: Boolean,
      default: false
    },
    reason: String,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'cancellation.cancelledByModel'
    },
    cancelledByModel: {
      type: String,
      enum: ['Driver', 'Client', 'Admin']
    },
    cancelledAt: Date,
    refundAmount: Number
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Pre-save middleware to generate shipment ID and tracking number
shipmentSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Generate shipment ID
    if (!this.shipmentId) {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substr(2, 5);
      this.shipmentId = `SH${timestamp}${random}`.toUpperCase();
    }
    
    // Generate tracking number
    if (!this.trackingNumber) {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substr(2, 8);
      this.trackingNumber = `TRK${timestamp}${random}`.toUpperCase();
    }
    
    // Add initial timeline entry
    this.timeline.push({
      status: 'pending',
      timestamp: new Date(),
      notes: 'Shipment request created',
      updatedBy: 'system'
    });
  }
  next();
});

// Virtual for estimated delivery time
shipmentSchema.virtual('estimatedTransitTime').get(function() {
  if (!this.requestedPickupDate || !this.requestedDeliveryDate) return null;
  return Math.ceil((this.requestedDeliveryDate - this.requestedPickupDate) / (1000 * 60 * 60 * 24));
});

// Virtual for current status info
shipmentSchema.virtual('currentStatusInfo').get(function() {
  if (this.timeline.length === 0) return null;
  return this.timeline[this.timeline.length - 1];
});

// Method to update status
shipmentSchema.methods.updateStatus = function(newStatus, location, notes, updatedBy, updatedByUser) {
  this.status = newStatus;
  this.timeline.push({
    status: newStatus,
    timestamp: new Date(),
    location,
    notes,
    updatedBy,
    updatedByUser
  });
  
  // Update specific date fields
  if (newStatus === 'picked') {
    this.actualPickupDate = new Date();
  } else if (newStatus === 'delivered') {
    this.actualDeliveryDate = new Date();
  }
};

// Index for efficient queries
shipmentSchema.index({ shipmentId: 1 });
shipmentSchema.index({ trackingNumber: 1 });
shipmentSchema.index({ client: 1 });
shipmentSchema.index({ driver: 1 });
shipmentSchema.index({ status: 1 });
shipmentSchema.index({ requestedPickupDate: 1 });
shipmentSchema.index({ requestedDeliveryDate: 1 });
shipmentSchema.index({ priority: 1 });
shipmentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Shipment', shipmentSchema);