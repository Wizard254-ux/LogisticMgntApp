# Logistics Management System

A comprehensive logistics management application built with React Native (Expo) frontend and Node.js backend, designed for managing shipments, drivers, clients, and payments in a logistics operation.

## 🚀 Features

### Driver App Features
- **Authentication**: Secure login/registration with JWT
- **KYC Verification**: Document upload and verification system
- **Shipment Management**: View, accept, and track assigned shipments
- **Real-time Tracking**: GPS location tracking and status updates
- **Profile Management**: Update personal and vehicle information
- **Dashboard**: Overview of earnings, trips, and performance metrics

### Admin Features
- **Driver Management**: Approve/reject driver applications
- **Shipment Oversight**: Monitor all shipments and their status
- **Client Management**: Manage client accounts and relationships
- **Payment Processing**: Handle payments and financial transactions
- **Analytics**: Performance metrics and reporting

### Core Functionality
- **Multi-role Authentication**: Drivers, Clients, and Admins
- **Real-time Status Updates**: Live shipment tracking
- **Document Management**: Upload and manage KYC documents
- **Rating System**: Driver and client rating system
- **Payment Integration**: Comprehensive payment processing
- **Issue Tracking**: Report and resolve delivery issues

## 🏗️ Architecture

### Backend (Node.js + Express + MongoDB)
```
LogisticBackend/
├── config/          # Database configuration
├── middleware/      # Authentication and security middleware
├── models/          # MongoDB schemas (Driver, Client, Shipment, etc.)
├── routes/          # API endpoints
├── scripts/         # Utility scripts
├── uploads/         # File storage for documents
└── utils/           # Helper functions
```

### Frontend (React Native + Expo)
```
logisticsMgnt/
├── app/             # Expo Router pages
│   ├── (auth)/      # Authentication screens
│   ├── (tabs)/      # Main app tabs
│   ├── client/      # Client-specific screens
│   ├── kyc/         # KYC document upload
│   └── shipment/    # Shipment details
├── components/      # Reusable UI components
├── services/        # API integration
└── constants/       # App constants and themes
```

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: Helmet, CORS, Rate Limiting, XSS Protection
- **File Upload**: Multer
- **Password Hashing**: bcryptjs

### Frontend
- **Framework**: React Native with Expo
- **Navigation**: Expo Router
- **HTTP Client**: Axios
- **Storage**: AsyncStorage
- **UI Components**: Custom components with React Native
- **Image Handling**: Expo Image Picker

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- Expo CLI
- Android Studio/Xcode (for device testing)

## 🚀 Installation & Setup

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd LogisticBackend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Configuration**:
   Create a `.env` file with:
   ```env
   NODE_ENV=development
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/logistics
   JWT_SECRET=your_jwt_secret_key
   CLIENT_URL=http://localhost:3000
   ```

4. **Start the server**:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd logisticsMgnt
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Update API Configuration**:
   Edit `services/api.ts` to match your backend URL:
   ```typescript
   baseURL: 'http://your-backend-ip:3000/api'
   ```

4. **Start the development server**:
   ```bash
   npm start
   ```

## 📱 Running the App

### Development
- **Web**: `npm run web`
- **iOS**: `npm run ios` (requires Xcode)
- **Android**: `npm run android` (requires Android Studio)

### Testing
- Use Expo Go app on your mobile device
- Scan the QR code from the terminal

## 🔐 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Shipments
- `GET /api/shipments` - Get all shipments
- `POST /api/shipments` - Create new shipment
- `GET /api/shipments/:id` - Get shipment details
- `PUT /api/shipments/:id` - Update shipment

### Admin
- `GET /api/admin/drivers` - Get all drivers
- `PUT /api/admin/drivers/:id/approve` - Approve driver
- `GET /api/admin/dashboard` - Admin dashboard data

### Payments
- `GET /api/payments` - Get payment history
- `POST /api/payments` - Process payment

## 📊 Database Schema

### Key Models
- **Driver**: Profile, KYC documents, vehicle info, ratings
- **Client**: Company details, contact information
- **Shipment**: Detailed tracking, items, addresses, timeline
- **Payment**: Transaction records and payment status
- **Admin**: Administrative user management

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting to prevent abuse
- CORS protection
- XSS protection
- Input validation and sanitization
- Secure file upload handling

## 📈 Performance Optimizations

- Database indexing for efficient queries
- Image compression for uploads
- API response caching
- Lazy loading of components
- Optimized bundle size with Expo

## 🧪 Testing

Run tests with:
```bash
# Backend tests
cd LogisticBackend
npm test

# Frontend tests
cd logisticsMgnt
npm test
```

## 📦 Deployment

### Backend Deployment
1. Set production environment variables
2. Deploy to services like Heroku, AWS, or DigitalOcean
3. Configure MongoDB Atlas for production database

### Frontend Deployment
1. Build the app: `expo build`
2. Deploy to app stores or web hosting
3. Configure production API endpoints

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

For support and questions, please open an issue in the repository.

---

**Built with ❤️ for efficient logistics management**
