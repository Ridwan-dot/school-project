require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { checkAndUpdateProducts } = require('./utils/expiryChecker');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'pms_super_secret_key_2026',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pms_expiry',
    ttl: 24 * 60 * 60
  }),
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true
  }
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/users', require('./routes/users'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/reports', require('./routes/reports'));

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Connect DB and start
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pms_expiry';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    
    // Run expiry check on startup and every hour
    checkAndUpdateProducts().then(r => console.log('Expiry check:', r));
    setInterval(() => {
      checkAndUpdateProducts().then(r => console.log('Periodic expiry check:', r));
    }, 60 * 60 * 1000);
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📦 Product Management System with Expiry Monitoring`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    console.log('Make sure MongoDB is running locally or update MONGODB_URI in .env');
    process.exit(1);
  });
