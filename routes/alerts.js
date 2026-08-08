const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const { protect } = require('../middleware/auth');
const { checkAndUpdateProducts } = require('../utils/expiryChecker');

// Get all alerts
router.get('/', protect, async (req, res) => {
  try {
    await checkAndUpdateProducts();
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    let query = {};
    if (req.query.unread === 'true') {
      query.isRead = false;
    }
    if (req.query.type && req.query.type !== 'all') {
      query.type = req.query.type;
    }
    
    const total = await Alert.countDocuments(query);
    const alerts = await Alert.find(query)
      .populate('product', 'name category expiryDate status remainingDays')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const unreadCount = await Alert.countDocuments({ isRead: false });
    
    res.json({
      success: true,
      alerts,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching alerts' });
  }
});

// Mark alert as read
router.patch('/:id/read', protect, async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }
    res.json({ success: true, alert });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating alert' });
  }
});

// Mark all as read
router.patch('/read-all', protect, async (req, res) => {
  try {
    await Alert.updateMany({ isRead: false }, { isRead: true });
    res.json({ success: true, message: 'All alerts marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating alerts' });
  }
});

// Delete alert
router.delete('/:id', protect, async (req, res) => {
  try {
    await Alert.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Alert deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting alert' });
  }
});

// Get unread count (for bell)
router.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await Alert.countDocuments({ isRead: false });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
});

module.exports = router;
