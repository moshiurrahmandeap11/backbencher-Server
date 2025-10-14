// db.js
const { Pool } = require("pg");

// Local PostgreSQL connection using .env variables
const pool = new Pool({
  user: process.env.DB_USERNAME || process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.DB_PASSWORD || process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
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