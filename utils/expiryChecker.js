const Product = require('../models/Product');
const Alert = require('../models/Alert');

const checkAndUpdateProducts = async () => {
  try {
    const products = await Product.find({});
    let alertsCreated = 0;

    for (const product of products) {
      const oldStatus = product.status;
      product.calculateStatus();
      
      if (product.isModified('status') || product.isModified('remainingDays')) {
        await product.save();
      }

      // Create alert only if status changed to a warning/expired state
      if (oldStatus !== product.status && product.status !== 'safe') {
        const existingAlert = await Alert.findOne({
          product: product._id,
          type: product.status,
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // within last 24h
        });

        if (!existingAlert) {
          const messages = {
            '30days': `${product.name} will expire in ${product.remainingDays} days (30-day warning)`,
            '14days': `${product.name} will expire in ${product.remainingDays} days (14-day warning)`,
            '7days': `${product.name} will expire in ${product.remainingDays} days (7-day warning)`,
            '3days': `URGENT: ${product.name} expires in ${product.remainingDays} days!`,
            'expired': `${product.name} has EXPIRED! Immediate action required.`
          };

          const severities = {
            '30days': 'info',
            '14days': 'warning',
            '7days': 'danger',
            '3days': 'critical',
            'expired': 'critical'
          };

          await Alert.create({
            product: product._id,
            productName: product.name,
            type: product.status,
            message: messages[product.status],
            severity: severities[product.status]
          });
          alertsCreated++;
        }
      }
    }

    return { updated: products.length, alertsCreated };
  } catch (error) {
    console.error('Expiry check error:', error);
    return { error: error.message };
  }
};

module.exports = { checkAndUpdateProducts };
