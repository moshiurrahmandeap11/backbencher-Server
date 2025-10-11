// db.js
const { Pool } = require("pg");

// Render.com PostgreSQL connection - use DATABASE_URL from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

console.log('🔗 Database URL:', connectionString ? 'Set' : 'Not set');

const pool = new Pool({
  connectionString: connectionString,
  ssl: connectionString.includes('render.com') ? { 
    rejectUnauthorized: false 
  } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  maxUses: 7500,
});

// Connection events
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
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
      
      // Test query
      const result = await client.query('SELECT NOW() as current_time');
      console.log('📊 Database time:', result.rows[0].current_time);
      
      client.release();
      return true;
    } catch (error) {
      retries--;
      console.error(`❌ Database connection failed. Retries left: ${retries}`, error.message);
      
      if (retries === 0) {
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