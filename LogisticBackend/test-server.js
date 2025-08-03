const express = require('express');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Basic middleware
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Test server running' });
});

// Test individual route files
try {
  console.log('Testing auth routes...');
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.error('❌ Error in auth routes:', error.message);
}

try {
  console.log('Testing admin routes...');
  const adminRoutes = require('./routes/admin');
  app.use('/api/admin', adminRoutes);
  console.log('✅ Admin routes loaded');
} catch (error) {
  console.error('❌ Error in admin routes:', error.message);
}

try {
  console.log('Testing shipments routes...');
  const shipmentRoutes = require('./routes/shipments');
  app.use('/api/shipments', shipmentRoutes);
  console.log('✅ Shipment routes loaded');
} catch (error) {
  console.error('❌ Error in shipment routes:', error.message);
}

try {
  console.log('Testing payments routes...');
  const paymentRoutes = require('./routes/payments');
  app.use('/api/payments', paymentRoutes);
  console.log('✅ Payment routes loaded');
} catch (error) {
  console.error('❌ Error in payment routes:', error.message);
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
});