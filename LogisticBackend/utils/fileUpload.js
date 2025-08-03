const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath;
    
    // Determine upload path based on file type and user type
    if (req.userType === 'driver') {
      uploadPath = path.join(__dirname, '../uploads/drivers/kyc');
    } else if (req.userType === 'client') {
      uploadPath = path.join(__dirname, '../uploads/clients/documents');
    } else if (req.userType === 'admin') {
      uploadPath = path.join(__dirname, '../uploads/admin');
    } else {
      uploadPath = path.join(__dirname, '../uploads/misc');
    }
    
    // Create directory if it doesn't exist
    ensureDirectoryExists(uploadPath);
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);
    
    // Clean filename
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${cleanBaseName}_${uniqueSuffix}${extension}`;
    
    cb(null, filename);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Define allowed file types
  const allowedMimeTypes = {
    image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    all: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  };

  // Check file type based on field name
  let isValid = false;
  
  if (file.fieldname.includes('photo') || file.fieldname.includes('image')) {
    isValid = allowedMimeTypes.image.includes(file.mimetype);
  } else if (file.fieldname.includes('document') || file.fieldname.includes('license') || file.fieldname.includes('certificate')) {
    isValid = allowedMimeTypes.all.includes(file.mimetype);
  } else {
    isValid = allowedMimeTypes.all.includes(file.mimetype);
  }

  if (isValid) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type for ${file.fieldname}. Allowed types: ${allowedMimeTypes.all.join(', ')}`), false);
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Maximum 10 files
  },
  fileFilter: fileFilter
});

// KYC document upload for drivers
const uploadKYCDocuments = upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'licensePhoto', maxCount: 1 },
  { name: 'nationalId', maxCount: 1 },
  { name: 'proofOfAddress', maxCount: 1 }
]);

// Business documents upload for clients
const uploadBusinessDocuments = upload.fields([
  { name: 'businessLicense', maxCount: 1 },
  { name: 'taxCertificate', maxCount: 1 }
]);

// Shipment documents upload
const uploadShipmentDocuments = upload.fields([
  { name: 'pickupReceipt', maxCount: 1 },
  { name: 'deliveryReceipt', maxCount: 1 },
  { name: 'invoice', maxCount: 1 },
  { name: 'insurance', maxCount: 1 },
  { name: 'customs', maxCount: 1 }
]);

// Shipment photos upload
const uploadShipmentPhotos = upload.array('photos', 10);

// Single file upload
const uploadSingle = upload.single('file');

// Error handling middleware for multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 10MB.'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Too many files. Maximum is 10 files.'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: 'Unexpected file field.'
        });
      default:
        return res.status(400).json({
          success: false,
          message: 'File upload error.'
        });
    }
  } else if (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  next();
};

// Utility function to get file URL
const getFileUrl = (req, filename) => {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}/uploads/${filename}`;
};

// Utility function to delete file
const deleteFile = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err && err.code !== 'ENOENT') {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

// Utility function to validate image
const validateImage = (filePath) => {
  return new Promise((resolve, reject) => {
    // Basic validation - check if file exists and has valid extension
    if (!fs.existsSync(filePath)) {
      reject(new Error('File does not exist'));
      return;
    }
    
    const ext = path.extname(filePath).toLowerCase();
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    
    if (validExtensions.includes(ext)) {
      resolve(true);
    } else {
      reject(new Error('Invalid image format'));
    }
  });
};

module.exports = {
  upload,
  uploadKYCDocuments,
  uploadBusinessDocuments,
  uploadShipmentDocuments,
  uploadShipmentPhotos,
  uploadSingle,
  handleMulterError,
  getFileUrl,
  deleteFile,
  validateImage
};