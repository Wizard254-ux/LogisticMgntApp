const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const clientSchema = new mongoose.Schema({
  // Basic Information
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters']
  },
  contactPerson: {
    firstName: {
      type: String,
      required: [true, 'Contact person first name is required'],
      trim: true
    },
    lastName: {
      type: String,
      required: [true, 'Contact person last name is required'],
      trim: true
    },
    position: {
      type: String,
      required: [true, 'Contact person position is required']
    }
  },
  
  // Contact Information
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number']
  },
  alternatePhone: {
    type: String,
    match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number']
  },
  
  // Authentication
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  
  // Business Information
  businessRegistrationNumber: {
    type: String,
    required: [true, 'Business registration number is required'],
    unique: true
  },
  taxId: {
    type: String,
    required: [true, 'Tax ID is required']
  },
  industryType: {
    type: String,
    required: [true, 'Industry type is required'],
    enum: ['Manufacturing', 'Retail', 'E-commerce', 'Healthcare', 'Food & Beverage', 'Automotive', 'Electronics', 'Other']
  },
  
  // Address Information
  addresses: [{
    type: {
      type: String,
      enum: ['headquarters', 'warehouse', 'pickup', 'delivery'],
      required: true
    },
    name: String,
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true, default: 'US' },
    isDefault: { type: Boolean, default: false },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  }],
  
  // Account Status
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'inactive'],
    default: 'pending'
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  
  // Business Verification
  verification: {
    businessLicense: {
      url: String,
      uploadDate: Date,
      verified: { type: Boolean, default: false }
    },
    taxCertificate: {
      url: String,
      uploadDate: Date,
      verified: { type: Boolean, default: false }
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'in_review', 'approved', 'rejected'],
      default: 'pending'
    }
  },
  
  // Billing Information
  billingInfo: {
    billingAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    },
    paymentTerms: {
      type: String,
      enum: ['immediate', 'net_15', 'net_30', 'net_45', 'net_60'],
      default: 'net_30'
    },
    creditLimit: {
      type: Number,
      default: 0
    },
    currentBalance: {
      type: Number,
      default: 0
    }
  },
  
  // Preferences
  preferences: {
    preferredPickupTime: {
      start: String, // format: "HH:MM"
      end: String    // format: "HH:MM"
    },
    specialInstructions: String,
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    }
  },
  
  // Statistics
  statistics: {
    totalShipments: { type: Number, default: 0 },
    totalValue: { type: Number, default: 0 },
    onTimeDeliveryRate: { type: Number, default: 0 },
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 }
    }
  },
  
  // Activity
  lastLogin: Date,
  lastOrderDate: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Encrypt password before saving
clientSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
clientSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for contact person full name
clientSchema.virtual('contactPersonFullName').get(function() {
  return `${this.contactPerson.firstName} ${this.contactPerson.lastName}`;
});

// Virtual for verification completion percentage
clientSchema.virtual('verificationCompletion').get(function() {
  const verification = this.verification;
  let completed = 0;
  const total = 2; // businessLicense, taxCertificate
  
  if (verification.businessLicense?.url) completed++;
  if (verification.taxCertificate?.url) completed++;
  
  return Math.round((completed / total) * 100);
});

// Method to get default address
clientSchema.methods.getDefaultAddress = function(type) {
  return this.addresses.find(addr => addr.type === type && addr.isDefault) || 
         this.addresses.find(addr => addr.type === type);
};

// Index for efficient queries
clientSchema.index({ email: 1 });
clientSchema.index({ businessRegistrationNumber: 1 });
clientSchema.index({ status: 1 });
clientSchema.index({ 'verification.verificationStatus': 1 });
clientSchema.index({ companyName: 'text' });

module.exports = mongoose.model('Client', clientSchema);