const { query } = require('./mysql-connection');
require('dotenv').config();

async function addOnboardedColumn() {
  try {
    // Check if column exists
    const columns = await query(`
      SELECT COUNT(*) as count 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() 
      AND table_name = 'users' 
      AND column_name = 'has_onboarded'
    `);
    
    if (columns[0].count === 0) {
      await query(`
        ALTER TABLE users 
        ADD COLUMN has_onboarded BOOLEAN DEFAULT FALSE,
        ADD COLUMN onboarding_completed_at TIMESTAMP NULL
      `);
      console.log('✓ Added has_onboarded and onboarding_completed_at columns to users table');
    } else {
      console.log('✓ Onboarding columns already exist');
    }
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

addOnboardedColumn();
