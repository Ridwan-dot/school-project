const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: 0
  },
  manufacturingDate: {
    type: Date,
    required: [true, 'Manufacturing date is required']
  },
  expiryDate: {
    type: Date,
    required: [true, 'Expiry date is required']
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['safe', '30days', '14days', '7days', '3days', 'expired'],
    default: 'safe'
  },
  remainingDays: {
    type: Number,
    default: 0
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Calculate status and remaining days
productSchema.methods.calculateStatus = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(this.expiryDate);
  expiry.setHours(0, 0, 0, 0);
  
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  this.remainingDays = diffDays;
  
  if (diffDays < 0) {
    this.status = 'expired';
  } else if (diffDays <= 3) {
    this.status = '3days';
  } else if (diffDays <= 7) {
    this.status = '7days';
  } else if (diffDays <= 14) {
    this.status = '14days';
  } else if (diffDays <= 30) {
    this.status = '30days';
  } else {
    this.status = 'safe';
  }
  
  return this;
};

productSchema.pre('save', function(next) {
  this.calculateStatus();
  next();
});

module.exports = mongoose.model('Product', productSchema);
