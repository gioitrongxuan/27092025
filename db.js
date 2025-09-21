const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Railway cung cấp biến này
  ssl: { rejectUnauthorized: false }
});

module.exports = pool;
