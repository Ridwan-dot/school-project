const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['30days', '14days', '7days', '3days', 'expired'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'danger', 'critical'],
    default: 'warning'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Alert', alertSchema);
