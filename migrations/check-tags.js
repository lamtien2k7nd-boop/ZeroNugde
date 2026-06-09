const { query } = require('../db/mysql-connection');
require('dotenv').config();

async function checkTags() {
  try {
    const tags = await query('SELECT id, label, color, green FROM tags ORDER BY sort_order');
    console.log('Current tags in database:');
    tags.forEach(t => {
      console.log(`- ${t.id}: ${t.label} (${t.color}) - green: ${t.green}`);
    });
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkTags();
