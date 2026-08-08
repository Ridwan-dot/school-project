const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Alert = require('../models/Alert');
const { protect } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');
const { checkAndUpdateProducts } = require('../utils/expiryChecker');

// Get all products with search, filter, sort, pagination
router.get('/', protect, async (req, res) => {
  try {
    await checkAndUpdateProducts();
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    let query = {};
    
    // Search
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { name: searchRegex },
        { category: searchRegex }
      ];
    }
    
    // Filter by status
    if (req.query.status && req.query.status !== 'all') {
      query.status = req.query.status;
    }
    
    // Filter by category
    if (req.query.category && req.query.category !== 'all') {
      query.category = req.query.category;
    }
    
    // Sort
    let sort = { createdAt: -1 };
    if (req.query.sort) {
      switch (req.query.sort) {
        case 'name_asc': sort = { name: 1 }; break;
        case 'name_desc': sort = { name: -1 }; break;
        case 'expiry_asc': sort = { expiryDate: 1 }; break;
        case 'expiry_desc': sort = { expiryDate: -1 }; break;
        case 'quantity_asc': sort = { quantity: 1 }; break;
        case 'quantity_desc': sort = { quantity: -1 }; break;
        case 'newest': sort = { createdAt: -1 }; break;
        case 'oldest': sort = { createdAt: 1 }; break;
      }
    }
    
    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('addedBy', 'name email')
      .populate('lastUpdatedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    // Get categories for filter
    const categories = await Product.distinct('category');
    
    res.json({
      success: true,
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      categories
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error fetching products' });
  }
});

// Get dashboard stats
router.get('/stats/dashboard', protect, async (req, res) => {
  try {
    await checkAndUpdateProducts();
    
    const totalProducts = await Product.countDocuments();
    const nearExpiry = await Product.countDocuments({ status: { $in: ['30days', '14days', '7days', '3days'] } });
    const expired = await Product.countDocuments({ status: 'expired' });
    const safe = await Product.countDocuments({ status: 'safe' });
    
    // Status breakdown
    const statusCounts = {
      safe: await Product.countDocuments({ status: 'safe' }),
      '30days': await Product.countDocuments({ status: '30days' }),
      '14days': await Product.countDocuments({ status: '14days' }),
      '7days': await Product.countDocuments({ status: '7days' }),
      '3days': await Product.countDocuments({ status: '3days' }),
      expired: await Product.countDocuments({ status: 'expired' })
    };
    
    // Category breakdown
    const categories = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Monthly products added (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlyAdded = await Product.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    
    // Recent alerts
    const recentAlerts = await Alert.find().sort({ createdAt: -1 }).limit(5).populate('product', 'name');
    
    // Unread alerts count
    const unreadAlerts = await Alert.countDocuments({ isRead: false });
    
    let totalStaff = 0;
    if (req.user.role === 'admin') {
      const User = require('../models/User');
      totalStaff = await User.countDocuments({ role: 'staff' });
    }
    
    res.json({
      success: true,
      stats: {
        totalProducts,
        nearExpiry,
        expired,
        safe,
        totalStaff,
        unreadAlerts,
        statusCounts,
        categories,
        monthlyAdded,
        recentAlerts
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error fetching dashboard stats' });
  }
});


// Get single product
router.get('/:id', protect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('addedBy', 'name email')
      .populate('lastUpdatedBy', 'name email');
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    product.calculateStatus();
    await product.save();
    
    // Get alert history for this product
    const alerts = await Alert.find({ product: product._id }).sort({ createdAt: -1 }).limit(20);
    
    res.json({
      success: true,
      product,
      alerts
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching product' });
  }
});

// Create product
router.post('/', protect, async (req, res) => {
  try {
    const { name, category, quantity, manufacturingDate, expiryDate, description } = req.body;
    
    if (!name || !category || quantity === undefined || !manufacturingDate || !expiryDate) {
      return res.status(400).json({ success: false, message: 'Please fill all required fields' });
    }
    
    if (new Date(expiryDate) <= new Date(manufacturingDate)) {
      return res.status(400).json({ success: false, message: 'Expiry date must be after manufacturing date' });
    }
    
    const product = new Product({
      name,
      category,
      quantity,
      manufacturingDate,
      expiryDate,
      description: description || '',
      addedBy: req.user._id,
      lastUpdatedBy: req.user._id
    });
    
    product.calculateStatus();
    await product.save();
    
    // Create alert if needed
    if (product.status !== 'safe') {
      const messages = {
        '30days': `${product.name} will expire in ${product.remainingDays} days`,
        '14days': `${product.name} will expire in ${product.remainingDays} days`,
        '7days': `${product.name} will expire in ${product.remainingDays} days`,
        '3days': `URGENT: ${product.name} expires in ${product.remainingDays} days!`,
        'expired': `${product.name} has EXPIRED!`
      };
      await Alert.create({
        product: product._id,
        productName: product.name,
        type: product.status,
        message: messages[product.status] || `${product.name} status: ${product.status}`,
        severity: product.status === 'expired' || product.status === '3days' ? 'critical' : 'warning'
      });
    }
    
    await logActivity(req.user, 'Added product', `Added product: ${name}`, req.ip);
    
    res.status(201).json({
      success: true,
      message: 'Product added successfully',
      product
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error creating product' });
  }
});

// Update product
router.put('/:id', protect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    const { name, category, quantity, manufacturingDate, expiryDate, description } = req.body;
    
    if (name) product.name = name;
    if (category) product.category = category;
    if (quantity !== undefined) product.quantity = quantity;
    if (manufacturingDate) product.manufacturingDate = manufacturingDate;
    if (expiryDate) product.expiryDate = expiryDate;
    if (description !== undefined) product.description = description;
    
    product.lastUpdatedBy = req.user._id;
    product.calculateStatus();
    await product.save();
    
    await logActivity(req.user, 'Edited product', `Edited product: ${product.name}`, req.ip);
    
    res.json({
      success: true,
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error updating product' });
  }
});

// Delete product
router.delete('/:id', protect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    const productName = product.name;
    await Alert.deleteMany({ product: product._id });
    await product.deleteOne();
    
    await logActivity(req.user, 'Deleted product', `Deleted product: ${productName}`, req.ip);
    
    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting product' });
  }
});

module.exports = router;
