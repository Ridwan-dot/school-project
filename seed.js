require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Product = require('./models/Product');
const Alert = require('./models/Alert');
const ActivityLog = require('./models/ActivityLog');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pms_expiry';

const categories = [
  'Dairy', 'Beverages', 'Snacks', 'Bakery', 'Frozen Foods',
  'Canned Goods', 'Personal Care', 'Household', 'Baby Products', 'Condiments'
];

const productNames = [
  // Dairy
  { name: 'Peak Milk Powder 400g', category: 'Dairy' },
  { name: 'Dano Full Cream Milk', category: 'Dairy' },
  { name: 'Hollandia Yoghurt 1L', category: 'Dairy' },
  { name: 'Fan Milk Ice Cream', category: 'Dairy' },
  { name: 'Three Crowns Milk', category: 'Dairy' },
  // Beverages
  { name: 'Coca-Cola 50cl', category: 'Beverages' },
  { name: 'Pepsi 50cl', category: 'Beverages' },
  { name: 'Fanta Orange 50cl', category: 'Beverages' },
  { name: 'Sprite 50cl', category: 'Beverages' },
  { name: 'Maltina Classic', category: 'Beverages' },
  { name: 'Chivita Active Juice', category: 'Beverages' },
  { name: 'Ribena Blackcurrant', category: 'Beverages' },
  // Snacks
  { name: 'Gala Sausage Roll', category: 'Snacks' },
  { name: 'Rite Bite Biscuits', category: 'Snacks' },
  { name: 'Oreo Cookies', category: 'Snacks' },
  { name: 'Pringles Original', category: 'Snacks' },
  { name: 'Doritos Nacho Cheese', category: 'Snacks' },
  { name: 'Indomie Instant Noodles', category: 'Snacks' },
  // Bakery
  { name: 'Agege Bread Loaf', category: 'Bakery' },
  { name: 'Butter Croissant Pack', category: 'Bakery' },
  { name: 'Digestive Biscuits', category: 'Bakery' },
  // Frozen
  { name: 'Frozen Chicken Wings 1kg', category: 'Frozen Foods' },
  { name: 'Fish Fillet Frozen', category: 'Frozen Foods' },
  { name: 'Mixed Vegetables Frozen', category: 'Frozen Foods' },
  // Canned
  { name: 'Geisha Mackerel in Tomato', category: 'Canned Goods' },
  { name: 'Titus Sardines', category: 'Canned Goods' },
  { name: 'Baked Beans Heinz', category: 'Canned Goods' },
  // Personal Care
  { name: 'Lux Soap Bar', category: 'Personal Care' },
  { name: 'Colgate Toothpaste', category: 'Personal Care' },
  { name: 'Nivea Body Lotion', category: 'Personal Care' },
  // Household
  { name: 'Omo Washing Powder', category: 'Household' },
  { name: 'Harpic Toilet Cleaner', category: 'Household' },
  { name: 'Air Freshener Glade', category: 'Household' },
  // Baby
  { name: 'Pampers Diapers Size 4', category: 'Baby Products' },
  { name: 'SMA Gold Baby Formula', category: 'Baby Products' },
  // Condiments
  { name: 'Maggi Seasoning Cubes', category: 'Condiments' },
  { name: 'Knorr Chicken Cubes', category: 'Condiments' },
  { name: 'Heinz Tomato Ketchup', category: 'Condiments' },
  { name: 'Dangote Salt 1kg', category: 'Condiments' },
  { name: 'Vegetable Oil 5L', category: 'Condiments' }
];

function randomDate(startDays, endDays) {
  const start = new Date();
  start.setDate(start.getDate() + startDays);
  const end = new Date();
  end.setDate(end.getDate() + endDays);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing
    await User.deleteMany({});
    await Product.deleteMany({});
    await Alert.deleteMany({});
    await ActivityLog.deleteMany({});
    console.log('Cleared existing data');

    // Create Admin
    const admin = await User.create({
      name: 'System Administrator',
      email: 'admin@company.com',
      password: 'admin123',
      role: 'admin',
      isActive: true
    });
    console.log('Admin created: admin@company.com / admin123');

    // Create 5 staff
    const staffData = [
      { name: 'John Okonkwo', email: 'john@company.com', password: 'staff123' },
      { name: 'Mary Adebayo', email: 'mary@company.com', password: 'staff123' },
      { name: 'David Eze', email: 'david@company.com', password: 'staff123' },
      { name: 'Sarah Ibrahim', email: 'sarah@company.com', password: 'staff123' },
      { name: 'Michael Okafor', email: 'michael@company.com', password: 'staff123' }
    ];

    const staffUsers = [];
    for (const s of staffData) {
      const u = await User.create({ ...s, role: 'staff', isActive: true });
      staffUsers.push(u);
      console.log(`Staff created: ${s.email} / staff123`);
    }

    // Create products with varied expiry
    const products = [];
    const allUsers = [admin, ...staffUsers];

    // Ensure variety of statuses
    const expiryOffsets = [
      // Safe (>30 days)
      45, 60, 90, 120, 150, 180, 200, 250,
      // 30 days
      25, 28, 30, 22,
      // 14 days
      10, 12, 14, 11,
      // 7 days
      5, 6, 7, 4,
      // 3 days
      1, 2, 3, 0,
      // Expired
      -5, -10, -15, -2, -20, -30, -1, -8
    ];

    for (let i = 0; i < productNames.length; i++) {
      const p = productNames[i];
      const offset = expiryOffsets[i % expiryOffsets.length];
      const expiry = daysFromNow(offset);
      const mfg = new Date(expiry);
      mfg.setMonth(mfg.getMonth() - Math.floor(Math.random() * 6 + 3)); // 3-9 months before

      const product = new Product({
        name: p.name,
        category: p.category,
        quantity: Math.floor(Math.random() * 200) + 10,
        manufacturingDate: mfg,
        expiryDate: expiry,
        description: `High quality ${p.name} for retail inventory.`,
        addedBy: allUsers[Math.floor(Math.random() * allUsers.length)]._id,
        lastUpdatedBy: allUsers[Math.floor(Math.random() * allUsers.length)]._id
      });
      product.calculateStatus();
      await product.save();
      products.push(product);
    }

    console.log(`Created ${products.length} products`);

    // Generate some alerts for non-safe products
    let alertCount = 0;
    for (const product of products) {
      if (product.status !== 'safe') {
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
          severity: severities[product.status],
          isRead: Math.random() > 0.6
        });
        alertCount++;
      }
    }
    console.log(`Created ${alertCount} alerts`);

    // Some activity logs
    const actions = [
      { user: admin, action: 'Logged in', details: 'Administrator logged in' },
      { user: staffUsers[0], action: 'Logged in', details: 'John logged in' },
      { user: staffUsers[1], action: 'Added product', details: 'Added product: Peak Milk Powder 400g' },
      { user: staffUsers[2], action: 'Edited product', details: 'Edited product: Coca-Cola 50cl' },
      { user: staffUsers[0], action: 'Added product', details: 'Added product: Indomie Instant Noodles' },
      { user: staffUsers[3], action: 'Logged in', details: 'Sarah logged in' },
      { user: admin, action: 'Created staff account', details: 'Created staff: Michael Okafor' },
      { user: staffUsers[4], action: 'Edited product', details: 'Edited product: Maggi Seasoning Cubes' },
      { user: staffUsers[1], action: 'Deleted product', details: 'Deleted product: Old Stock Item' },
      { user: admin, action: 'Viewed reports', details: 'Generated inventory report' }
    ];

    for (const a of actions) {
      await ActivityLog.create({
        user: a.user._id,
        userName: a.user.name,
        action: a.action,
        details: a.details
      });
    }
    console.log('Created activity logs');

    console.log('\n✅ Seed completed successfully!');
    console.log('\n--- Login Credentials ---');
    console.log('Admin: admin@company.com / admin123');
    console.log('Staff: john@company.com / staff123');
    console.log('       mary@company.com / staff123');
    console.log('       david@company.com / staff123');
    console.log('       sarah@company.com / staff123');
    console.log('       michael@company.com / staff123');
    console.log(`\nTotal Products: ${products.length}`);
    console.log(`Total Alerts: ${alertCount}`);

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
