const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import Admin model
const Admin = require('../models/Admin');

const createSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Check if super admin already exists
    const existingSuperAdmin = await Admin.findOne({ role: 'super_admin' });
    if (existingSuperAdmin) {
      console.log('Super admin already exists:', existingSuperAdmin.email);
      process.exit(0);
    }

    // Create super admin
    const superAdminData = {
      firstName: 'Super',
      lastName: 'Admin',
      email: 'superadmin@logistics.com',
      phone: '+1234567890',
      password: 'SuperAdmin123!', // Change this to a secure password
      role: 'super_admin',
      department: 'Management',
      position: 'System Administrator',
      employeeId: 'SUPER001',
      hireDate: new Date(),
      status: 'active',
      isEmailVerified: true,
      permissions: [
        {
          module: 'drivers',
          actions: ['create', 'read', 'update', 'delete', 'approve', 'reject']
        },
        {
          module: 'clients',
          actions: ['create', 'read', 'update', 'delete', 'approve', 'reject']
        },
        {
          module: 'shipments',
          actions: ['create', 'read', 'update', 'delete', 'approve', 'reject']
        },
        {
          module: 'payments',
          actions: ['create', 'read', 'update', 'delete', 'approve', 'reject']
        },
        {
          module: 'reports',
          actions: ['create', 'read', 'update', 'delete']
        },
        {
          module: 'settings',
          actions: ['create', 'read', 'update', 'delete']
        },
        {
          module: 'users',
          actions: ['create', 'read', 'update', 'delete', 'approve', 'reject']
        }
      ]
    };

    const superAdmin = await Admin.create(superAdminData);
    
    console.log('✅ Super admin created successfully!');
    console.log('📧 Email:', superAdmin.email);
    console.log('🔑 Password: SuperAdmin123!');
    console.log('🆔 ID:', superAdmin._id);
    console.log('\n⚠️  IMPORTANT: Change the default password after first login!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating super admin:', error);
    process.exit(1);
  }
};

// Run the script
createSuperAdmin();