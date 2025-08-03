const express = require('express');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());

console.log('Starting debug server...');

// Test basic routes first
app.get('/', (req, res) => {
  res.json({ message: 'Debug server running' });
});

console.log('Basic routes loaded...');

// Load routes one by one
try {
  console.log('Loading auth routes...');
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
  console.log('✅ Auth routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading auth routes:', error.message);
  process.exit(1);
}

try {
  console.log('Loading admin routes...');
  const adminRoutes = require('./routes/admin');
  app.use('/api/admin', adminRoutes);
  console.log('✅ Admin routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading admin routes:', error.message);
  process.exit(1);
}

try {
  console.log('Loading payments routes...');
  const paymentRoutes = require('./routes/payments');
  app.use('/api/payments', paymentRoutes);
  console.log('✅ Payment routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading payment routes:', error.message);
  process.exit(1);
}

try {
  console.log('Loading shipments routes...');
  const shipmentRoutes = require('./routes/shipments');
  app.use('/api/shipments', shipmentRoutes);
  console.log('✅ Shipment routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading shipment routes:', error.message);
  process.exit(1);
}

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`🚀 Debug server running on port ${PORT}`);
  console.log('All routes loaded successfully!');
});