require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// CORS configuration for production
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://backbencher-coder.moshiurrahman.online', 
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files for uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url}`);
  next();
});

// Firebase Setup for production
let serviceAccount;
try {
  serviceAccount = {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
}

// PostgreSQL Connection
const pool = require('./db');

// Create users table if not exists with profileImage and coverPhoto columns
async function createTable() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        uid VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        age INTEGER,
        profileimage VARCHAR(500),
        coverphoto VARCHAR(500),
        privacysettings JSONB DEFAULT '{
          "name": "public",
          "email": "public", 
          "age": "public",
          "profileImage": "public",
          "coverPhoto": "public"
        }',
        lastlogin TIMESTAMP,
        createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await pool.query(createTableQuery);
    console.log('✅ Users table ready with profile image and cover photo support');
  } catch (error) {
    console.error('❌ Table creation error:', error);
  }
}

// Initialize app
async function startApp() {
  try {
    // Test database connection
    const client = await pool.connect();
    console.log('✅ PostgreSQL connected successfully');
    client.release();

    // Create table
    await createTable();

    // Setup routes
    const userRoutes = require("./routes/userRoute/users")(pool, admin);
    app.use('/bb/v1/users', userRoutes);

    // Default route
    app.get('/', (req, res) => {
      res.json({ 
        success: true, 
        message: '🚀 Server running with PostgreSQL & Image Upload Support',
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // Health check endpoint
    app.get('/health', async (req, res) => {
      try {
        await pool.query('SELECT 1');
        res.json({ 
          success: true, 
          message: 'Server & Database OK',
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'development',
          features: ['PostgreSQL', 'Profile Image Upload', 'Cover Photo Upload', 'Firebase Auth']
        });
      } catch (error) {
        console.error('Health check failed:', error);
        res.status(500).json({ 
          success: false, 
          message: 'Database connection failed',
          error: error.message 
        });
      }
    });

    // 404 handler
    app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    });

    // Error handling middleware
    app.use((error, req, res, next) => {
      console.error('Unhandled error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'production' ? {} : error.message
      });
    });

    app.listen(port, () => {
      console.log(`✅ Server running on port ${port}`);
      console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📁 Profile images served from: /uploads/profiles/`);
      console.log(`📁 Cover photos served from: /uploads/covers/`);
    });

  } catch (error) {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  }
}

startApp();