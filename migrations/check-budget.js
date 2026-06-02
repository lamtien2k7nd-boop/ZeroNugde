const { query } = require('../db/mysql-connection');
require('dotenv').config();

async function checkBudgetItems() {
  try {
    const items = await query('SELECT id, key_name, name FROM budget_items ORDER BY sort_order');
    console.log('Budget items count:', items.length);
    items.forEach(i => {
      console.log(`ID ${i.id}: ${i.key_name} - ${i.name}`);
    });
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkBudgetItems();
