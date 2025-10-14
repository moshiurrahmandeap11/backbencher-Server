require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// CORS configuration for both production and development
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://backbencher-coder.moshiurrahman.online',
      'https://backbencher-coder.onrender.com', // Add your Render URL
      process.env.FRONTEND_URL // Dynamic frontend URL from env
    ].filter(Boolean);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('🚫 CORS blocked for origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files for uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url} - Origin: ${req.headers.origin || 'No Origin'}`);
  next();
});

// Firebase Setup for both environments
let serviceAccount;
try {
  // Check if we're in production and use service account from env
  if (process.env.NODE_ENV === 'production') {
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
  } else {
    // For local development, you might want to use a different method
    // or keep the service account key file
    serviceAccount = require('./path/to/your/serviceAccountKey.json');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
}

// PostgreSQL Connection
const { pool, testConnection } = require('./db');

// Create all necessary tables
async function createTables() {
  try {
    // Users table
    const usersTableQuery = `
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
    
    // Site settings table
    const siteSettingsTableQuery = `
      CREATE TABLE IF NOT EXISTS site_settings (
        id SERIAL PRIMARY KEY,
        site_name VARCHAR(255) DEFAULT 'Backbencher Coder',
        site_description TEXT DEFAULT 'Empowering developers worldwide',
        site_url VARCHAR(500) DEFAULT 'https://backbenchercoder.com',
        contact_email VARCHAR(255) DEFAULT 'info@backbenchercoder.com',
        maintenance_mode BOOLEAN DEFAULT false,
        allow_registrations BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Subscribers table (if needed)
    const subscribersTableQuery = `
      CREATE TABLE IF NOT EXISTS subscribers (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT true,
        subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await pool.query(usersTableQuery);
    console.log('✅ Users table ready');
    
    await pool.query(siteSettingsTableQuery);
    console.log('✅ Site settings table ready');
    
    await pool.query(subscribersTableQuery);
    console.log('✅ Subscribers table ready');

    // Insert default site settings if not exists
    const defaultSettingsQuery = `
      INSERT INTO site_settings (site_name, site_description, site_url, contact_email) 
      VALUES ('Backbencher Coder', 'Empowering developers worldwide', 'https://backbenchercoder.com', 'info@backbenchercoder.com')
      ON CONFLICT DO NOTHING
    `;
    await pool.query(defaultSettingsQuery);
    console.log('✅ Default site settings inserted');

  } catch (error) {
    console.error('❌ Table creation error:', error);
  }
}

// Initialize app
async function startApp() {
  try {
    console.log('🚀 Starting Backbencher Coder API...');
    console.log('🌐 Environment:', process.env.NODE_ENV || 'development');
    console.log('📊 Database URL:', process.env.DATABASE_URL ? 'Using DATABASE_URL' : 'Using local config');
    
    // Test database connection with retry
    await testConnection();
    console.log('✅ PostgreSQL connected successfully');

    // Create tables
    await createTables();
    console.log('✅ All database tables ready');

    // Import routes
    const userRoutes = require("./routes/userRoute/users")(pool, admin);
    const subsRoutes = require("./routes/subsRoute/subscribers")(pool, admin);
    const logosRoutes = require("./routes/logosRoute/logos")(pool, admin);
    const siteSettingsRoutes = require("./routes/siteSettings/sitesettings")(pool, admin);
    const seoRoutes = require("./routes/seoRoute/seo")(pool, admin);

    // Setup routes
    app.use('/bb/v1/users', userRoutes);
    app.use("/bb/v1/subscribers", subsRoutes);
    app.use("/bb/v1/logos", logosRoutes);
    app.use("/bb/v1/site-settings", siteSettingsRoutes);
    app.use("/bb/v1/seo", seoRoutes);

    // Default route
    app.get('/', (req, res) => {
      res.json({ 
        success: true, 
        message: '🚀 Backbencher Coder API is running!',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        database: process.env.DATABASE_URL ? 'Render PostgreSQL' : 'Local PostgreSQL',
        version: '1.0.0'
      });
    });

    // Enhanced health check endpoint
    app.get('/health', async (req, res) => {
      try {
        const dbResult = await pool.query('SELECT NOW() as db_time, current_database() as db_name');
        res.json({ 
          success: true, 
          message: '✅ Server & Database OK',
          timestamp: new Date().toISOString(),
          database: {
            time: dbResult.rows[0].db_time,
            name: dbResult.rows[0].db_name,
            status: 'connected'
          },
          environment: process.env.NODE_ENV || 'development',
          features: ['PostgreSQL', 'Firebase Auth', 'Image Upload', 'Site Settings']
        });
      } catch (error) {
        console.error('Health check failed:', error);
        res.status(500).json({ 
          success: false, 
          message: 'Database connection failed',
          error: process.env.NODE_ENV === 'production' ? 'Database error' : error.message 
        });
      }
    });

    // Database test endpoint
    app.get('/test-db', async (req, res) => {
      try {
        const client = await pool.connect();
        const timeResult = await client.query('SELECT NOW() as current_time');
        const dbResult = await client.query('SELECT current_database() as db_name, version() as version');
        const tablesResult = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
          ORDER BY table_name
        `);
        client.release();

        res.json({
          success: true,
          message: 'Database connected successfully',
          database: {
            name: dbResult.rows[0].db_name,
            version: dbResult.rows[0].version.split(',')[0],
            time: timeResult.rows[0].current_time
          },
          tables: tablesResult.rows.map(row => row.table_name),
          environment: process.env.NODE_ENV || 'development'
        });
      } catch (error) {
        console.error('Database test failed:', error);
        res.status(500).json({
          success: false,
          message: 'Database connection failed',
          error: error.message
        });
      }
    });

    // 404 handler
    app.use((req, res, next) => {
      res.status(404).json({
        success: false,
        message: 'Route not found',
        path: req.path,
        method: req.method
      });
    });

    // Error handling middleware
    app.use((error, req, res, next) => {
      console.error('Unhandled error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
      });
    });

    app.listen(port, () => {
      console.log(`✅ Server running on port ${port}`);
      console.log(`🌐 Server URL: ${process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`}`);
      console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🚀 Ready to accept requests!`);
    });

  } catch (error) {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startApp();