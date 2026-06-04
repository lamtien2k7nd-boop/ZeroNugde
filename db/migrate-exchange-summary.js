const { query } = require('./mysql-connection');
require('dotenv').config();

async function createExchangeSummaryTable() {
  try {
    // Check if table exists
    const tables = await query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'exchange_summary'
    `);
    
    if (tables[0].count === 0) {
      await query(`
        CREATE TABLE exchange_summary (
          user_id INT PRIMARY KEY,
          available_balance BIGINT NOT NULL DEFAULT 0,
          total_invested BIGINT NOT NULL DEFAULT 0,
          cumulative_return BIGINT NOT NULL DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log('✓ exchange_summary table created');
    } else {
      console.log('✓ exchange_summary table already exists');
    }
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

createExchangeSummaryTable();
