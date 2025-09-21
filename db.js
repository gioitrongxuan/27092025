const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Railway cung cấp biến này
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database tables
async function initDatabase() {
  try {
    // Create guestbook table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS guestbook (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'confirmed',
        ip VARCHAR(45),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create stats table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stats (
        id INTEGER PRIMARY KEY DEFAULT 1,
        confirmed INTEGER DEFAULT 0,
        declined INTEGER DEFAULT 0,
        CONSTRAINT single_row CHECK (id = 1)
      )
    `);

    // Initialize stats if not exists
    await pool.query(`
      INSERT INTO stats (id, confirmed, declined) 
      VALUES (1, 0, 0) 
      ON CONFLICT (id) DO NOTHING
    `);

    // Create live_location table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS live_location (
        id INTEGER PRIMARY KEY DEFAULT 1,
        is_active BOOLEAN DEFAULT FALSE,
        description TEXT,
        map_url TEXT,
        phone VARCHAR(20),
        note TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated_by VARCHAR(45),
        CONSTRAINT single_location CHECK (id = 1)
      )
    `);

    // Initialize location if not exists
    await pool.query(`
      INSERT INTO live_location (id, is_active) 
      VALUES (1, FALSE) 
      ON CONFLICT (id) DO NOTHING
    `);

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

module.exports = { pool, initDatabase };