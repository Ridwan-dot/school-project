const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');

// Get all staff (admin only)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find({ role: 'staff' }).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching users' });
  }
});

// Create staff (admin only)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email and password' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'staff'
    });
    
    await logActivity(req.user, 'Created staff account', `Created staff: ${name} (${email})`, req.ip);
    
    res.status(201).json({
      success: true,
      message: 'Staff account created successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error creating staff' });
  }
});

// Update staff (admin only)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role === 'admin') {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }
    
    const { name, email, password, isActive } = req.body;
    
    if (name) user.name = name;
    if (email) {
      const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
      user.email = email.toLowerCase();
    }
    if (password && password.length >= 6) {
      user.password = password;
    }
    if (typeof isActive === 'boolean') {
      user.isActive = isActive;
    }
    
    await user.save();
    
    await logActivity(req.user, 'Updated staff account', `Updated staff: ${user.name}`, req.ip);
    
    res.json({
      success: true,
      message: 'Staff updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating staff' });
  }
});

// Delete staff (admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role === 'admin') {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }
    
    const name = user.name;
    await user.deleteOne();
    
    await logActivity(req.user, 'Deleted staff account', `Deleted staff: ${name}`, req.ip);
    
    res.json({ success: true, message: 'Staff deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting staff' });
  }
});

// Toggle active status
router.patch('/:id/toggle', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role === 'admin') {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }
    
    user.isActive = !user.isActive;
    await user.save();
    
    await logActivity(req.user, user.isActive ? 'Activated staff' : 'Deactivated staff', `${user.name} account ${user.isActive ? 'activated' : 'deactivated'}`, req.ip);
    
    res.json({
      success: true,
      message: `Staff ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: user.isActive
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error toggling status' });
  }
});

module.exports = router;
