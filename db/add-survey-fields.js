const { query } = require('./mysql-connection');
require('dotenv').config();

async function addSurveyFields() {
  try {
    console.log('Starting migration: adding survey fields...');
    
    // Check gender
    const resGender = await query(`
      SELECT COUNT(*) as count FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'gender'
    `);
    if (resGender[0].count === 0) {
      await query("ALTER TABLE users ADD COLUMN gender VARCHAR(20)");
      console.log('✓ Added gender column');
    }

    // Check age
    const resAge = await query(`
      SELECT COUNT(*) as count FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'age'
    `);
    if (resAge[0].count === 0) {
      await query("ALTER TABLE users ADD COLUMN age INT");
      console.log('✓ Added age column');
    }

    // Check occupation
    const resOccupation = await query(`
      SELECT COUNT(*) as count FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'occupation'
    `);
    if (resOccupation[0].count === 0) {
      await query("ALTER TABLE users ADD COLUMN occupation VARCHAR(255)");
      console.log('✓ Added occupation column');
    }

    console.log('✓ Migration finished successfully');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

addSurveyFields();
