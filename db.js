const { Pool } = require("pg");
require('dotenv').config();

// Database configuration for both Render and Local
const getPoolConfig = () => {
  // If DATABASE_URL is provided (Render), use that
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Required for Render PostgreSQL
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
  }
  
  // Otherwise use local configuration
  return {
    user: process.env.DB_USERNAME || process.env.PG_USER || 'postgres',
    host: process.env.PG_HOST || 'localhost',
    database: process.env.PG_DATABASE || 'backbencherdb',
    password: process.env.DB_PASSWORD || process.env.PG_PASSWORD || 'password',
    port: process.env.PG_PORT || 5432,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    // SSL not needed for local
    ssl: false
  };
};

const pool = new Pool(getPoolConfig());

// Connection events
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
  console.log('🌐 Environment:', process.env.NODE_ENV || 'development');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL connection error:', err);
});

// Test connection with retry logic
async function testConnection() {
  let retries = 3;
  while (retries > 0) {
    try {
      const client = await pool.connect();
      console.log('✅ Database connection test successful');
      
      // Test query and get database info
      const timeResult = await client.query('SELECT NOW() as current_time');
      const dbResult = await client.query('SELECT current_database() as db_name, version() as version');
      
      console.log('📊 Database:', dbResult.rows[0].db_name);
      console.log('🕒 Database time:', timeResult.rows[0].current_time);
      console.log('🔧 PostgreSQL:', dbResult.rows[0].version.split(',')[0]);
      
      client.release();
      return true;
    } catch (error) {
      retries--;
      console.error(`❌ Database connection failed. Retries left: ${retries}`, error.message);
      
      if (retries === 0) {
        console.error('💥 All connection attempts failed');
        throw error;
      }
      
      // Wait 2 seconds before retry
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

module.exports = {
  pool,
  testConnection
};