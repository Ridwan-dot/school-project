const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');
const { checkAndUpdateProducts } = require('../utils/expiryChecker');

router.get('/', protect, async (req, res) => {
  try {
    await checkAndUpdateProducts();
    
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ status: { $ne: 'expired' } });
    const nearExpiry = await Product.countDocuments({ status: { $in: ['30days', '14days', '7days', '3days'] } });
    const expired = await Product.countDocuments({ status: 'expired' });
    const safe = await Product.countDocuments({ status: 'safe' });
    
    const totalQuantity = await Product.aggregate([
      { $group: { _id: null, total: { $sum: '$quantity' } } }
    ]);
    
    const byCategory = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalQty: { $sum: '$quantity' },
          expired: { $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] } },
          nearExpiry: { $sum: { $cond: [{ $in: ['$status', ['30days', '14days', '7days', '3days']] }, 1, 0] } }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    const byStatus = await Product.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalQty: { $sum: '$quantity' }
        }
      }
    ]);
    
    const expiringSoon = await Product.find({
      status: { $in: ['7days', '3days', 'expired'] }
    }).sort({ expiryDate: 1 }).limit(15).select('name category quantity expiryDate status remainingDays');
    
    res.json({
      success: true,
      report: {
        summary: {
          totalProducts,
          activeProducts,
          nearExpiry,
          expired,
          safe,
          totalQuantity: totalQuantity[0]?.total || 0
        },
        byCategory,
        byStatus,
        expiringSoon,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error generating report' });
  }
});

module.exports = router;
