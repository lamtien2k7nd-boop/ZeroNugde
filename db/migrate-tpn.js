const { query } = require('./mysql-connection');
require('dotenv').config();

async function migrateTPNTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS user_tpn_settings (
        user_id INT PRIMARY KEY,
        intervention_level VARCHAR(20) NOT NULL DEFAULT 'medium',
        monthly_limit BIGINT NOT NULL DEFAULT 3000000,
        warning_trigger INT NOT NULL DEFAULT 70,
        category_enabled TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ user_tpn_settings table created');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrateTPNTable();