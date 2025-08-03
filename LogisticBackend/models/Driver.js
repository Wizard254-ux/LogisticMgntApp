const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const driverSchema = new mongoose.Schema({
  // Basic Profile Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
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
    unique: true,
    // match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  
  // Account Information
  driverLicense: {
    type: String,
    required: [true, 'Driver license number is required'],
    unique: true,
    trim: true
  },
  licenseExpiry: {
    type: Date,
    required: [true, 'License expiry date is required']
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required']
  },
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true, default: 'US' }
  },
  
  // KYC Documents
  kycDocuments: {
    profilePhoto: {
      url: String,
      uploadDate: Date,
      verified: { type: Boolean, default: false }
    },
    licensePhoto: {
      url: String,
      uploadDate: Date,
      verified: { type: Boolean, default: false }
    },
    nationalId: {
      url: String,
      uploadDate: Date,
      verified: { type: Boolean, default: false }
    },
    proofOfAddress: {
      url: String,
      uploadDate: Date,
      verified: { type: Boolean, default: false }
    }
  },
  
  // Vehicle Information
  vehicle: {
    make: String,
    model: String,
    year: Number,
    licensePlate: String,
    capacity: {
      weight: Number, // in kg
      volume: Number  // in cubic meters
    },
    insuranceNumber: String,
    insuranceExpiry: Date
  },
  
  // Status and Verification
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended'],
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
  kycStatus: {
    type: String,
    enum: ['pending', 'in_review', 'approved', 'rejected'],
    default: 'pending'
  },
  
  // Activity Tracking
  currentLocation: {
    latitude: Number,
    longitude: Number,
    address: String,
    lastUpdated: Date
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastLogin: Date,
  
  // Statistics
  totalTrips: {
    type: Number,
    default: 0
  },
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  
  // Emergency Contact
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Encrypt password before saving
driverSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
driverSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for full name
driverSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for KYC completion percentage
driverSchema.virtual('kycCompletion').get(function() {
  const documents = this.kycDocuments;
  const totalDocs = 4; // profilePhoto, licensePhoto, nationalId, proofOfAddress
  let completedDocs = 0;
  
  if (documents.profilePhoto?.url) completedDocs++;
  if (documents.licensePhoto?.url) completedDocs++;
  if (documents.nationalId?.url) completedDocs++;
  if (documents.proofOfAddress?.url) completedDocs++;
  
  return Math.round((completedDocs / totalDocs) * 100);
});

// Index for efficient queries
driverSchema.index({ email: 1 });
driverSchema.index({ phone: 1 });
driverSchema.index({ driverLicense: 1 });
driverSchema.index({ status: 1 });
driverSchema.index({ kycStatus: 1 });
driverSchema.index({ isOnline: 1 });

module.exports = mongoose.model('Driver', driverSchema);