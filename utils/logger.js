const ActivityLog = require('../models/ActivityLog');

const logActivity = async (user, action, details = '', ip = '') => {
  try {
    await ActivityLog.create({
      user: user._id || user.id,
      userName: user.name,
      action,
      details,
      ipAddress: ip
    });
  } catch (error) {
    console.error('Activity log error:', error.message);
  }
};

module.exports = { logActivity };
