const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  // Basic Information
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
    match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number']
  },
  
  // Authentication
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  
  // Role and Permissions
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'manager', 'operator'],
    required: true,
    default: 'operator'
  },
  
  permissions: [{
    module: {
      type: String,
      enum: ['drivers', 'clients', 'shipments', 'payments', 'reports', 'settings', 'users'],
      required: true
    },
    actions: [{
      type: String,
      enum: ['create', 'read', 'update', 'delete', 'approve', 'reject'],
      required: true
    }]
  }],
  
  // Employment Information
  employeeId: {
    type: String,
    unique: true,
    required: true
  },
  department: {
    type: String,
    enum: ['Operations', 'Customer Service', 'Finance', 'IT', 'Management', 'HR'],
    required: true
  },
  position: {
    type: String,
    required: true
  },
  hireDate: {
    type: Date,
    required: true
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  
  // Contact Information
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'US' }
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
  },
  
  // Account Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'terminated'],
    default: 'active'
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  
  // Security
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false
  },
  lastPasswordChange: {
    type: Date,
    default: Date.now
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  
  // Activity Tracking
  lastLogin: Date,
  lastActive: Date,
  loginAttempts: {
    count: { type: Number, default: 0 },
    lastAttempt: Date,
    lockedUntil: Date
  },
  
  // Session Management
  activeSessions: [{
    sessionId: String,
    deviceInfo: {
      userAgent: String,
      ip: String,
      device: String,
      browser: String,
      os: String
    },
    loginTime: Date,
    lastActivity: Date,
    isActive: { type: Boolean, default: true }
  }],
  
  // Audit Trail
  activityLog: [{
    action: {
      type: String,
      enum: ['login', 'logout', 'create', 'update', 'delete', 'approve', 'reject', 'view', 'export'],
      required: true
    },
    module: {
      type: String,
      enum: ['drivers', 'clients', 'shipments', 'payments', 'reports', 'settings', 'users', 'system']
    },
    targetId: String, // ID of the record being acted upon
    targetType: String, // Type of record (Driver, Client, etc.)
    description: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String,
    success: {
      type: Boolean,
      default: true
    },
    errorMessage: String
  }],
  
  // Preferences
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light'
    },
    language: {
      type: String,
      default: 'en'
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    dashboard: {
      layout: String,
      widgets: [String]
    }
  },
  
  // Performance Metrics
  metrics: {
    totalLogins: { type: Number, default: 0 },
    totalActions: { type: Number, default: 0 },
    shipmentsProcessed: { type: Number, default: 0 },
    driversApproved: { type: Number, default: 0 },
    clientsOnboarded: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Encrypt password before saving
adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  this.lastPasswordChange = new Date();
  next();
});

// Compare password method
adminSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for full name
adminSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account locked status
adminSchema.virtual('isLocked').get(function() {
  return !!(this.loginAttempts.lockedUntil && this.loginAttempts.lockedUntil > Date.now());
});

// Method to check if admin has permission
adminSchema.methods.hasPermission = function(module, action) {
  if (this.role === 'super_admin') return true;
  
  const modulePermission = this.permissions.find(p => p.module === module);
  return modulePermission && modulePermission.actions.includes(action);
};

// Method to log activity
adminSchema.methods.logActivity = function(action, module, targetId, targetType, description, ipAddress, userAgent, success = true, errorMessage = null) {
  this.activityLog.push({
    action,
    module,
    targetId,
    targetType,
    description,
    ipAddress,
    userAgent,
    success,
    errorMessage
  });
  
  // Keep only last 1000 activities
  if (this.activityLog.length > 1000) {
    this.activityLog = this.activityLog.slice(-1000);
  }
  
  this.metrics.totalActions += 1;
  this.lastActive = new Date();
};

// Method to handle login attempt
adminSchema.methods.handleLoginAttempt = function(success, deviceInfo) {
  if (success) {
    this.loginAttempts.count = 0;
    this.loginAttempts.lockedUntil = undefined;
    this.lastLogin = new Date();
    this.metrics.totalLogins += 1;
    
    // Add session
    this.activeSessions.push({
      sessionId: require('crypto').randomBytes(32).toString('hex'),
      deviceInfo,
      loginTime: new Date(),
      lastActivity: new Date()
    });
    
    // Keep only last 5 active sessions
    if (this.activeSessions.length > 5) {
      this.activeSessions = this.activeSessions.slice(-5);
    }
  } else {
    this.loginAttempts.count += 1;
    this.loginAttempts.lastAttempt = new Date();
    
    // Lock account after 5 failed attempts
    if (this.loginAttempts.count >= 5) {
      this.loginAttempts.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    }
  }
};

// Method to end session
adminSchema.methods.endSession = function(sessionId) {
  const session = this.activeSessions.find(s => s.sessionId === sessionId);
  if (session) {
    session.isActive = false;
  }
};

// Static method to get admin performance report
adminSchema.statics.getPerformanceReport = function(startDate, endDate) {
  const match = {};
  if (startDate || endDate) {
    match['activityLog.timestamp'] = {};
    if (startDate) match['activityLog.timestamp'].$gte = new Date(startDate);
    if (endDate) match['activityLog.timestamp'].$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $unwind: '$activityLog' },
    { $match: match },
    {
      $group: {
        _id: {
          adminId: '$_id',
          fullName: { $concat: ['$firstName', ' ', '$lastName'] },
          action: '$activityLog.action'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: {
          adminId: '$_id.adminId',
          fullName: '$_id.fullName'
        },
        actions: {
          $push: {
            action: '$_id.action',
            count: '$count'
          }
        },
        totalActions: { $sum: '$count' }
      }
    }
  ]);
};

// Index for efficient queries
adminSchema.index({ email: 1 });
adminSchema.index({ employeeId: 1 });
adminSchema.index({ role: 1 });
adminSchema.index({ status: 1 });
adminSchema.index({ department: 1 });
adminSchema.index({ lastLogin: -1 });
adminSchema.index({ 'activityLog.timestamp': -1 });

module.exports = mongoose.model('Admin', adminSchema);