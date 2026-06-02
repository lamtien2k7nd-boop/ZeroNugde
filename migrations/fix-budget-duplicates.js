const { query } = require('../db/mysql-connection');
require('dotenv').config();

async function fixBudgetDuplicates() {
  try {
    console.log('Checking for duplicate budget items...\n');
    
    // Check for duplicates
    const duplicates = await query(`
      SELECT key_name, COUNT(*) as count, GROUP_CONCAT(id ORDER BY id) as ids
      FROM budget_items
      GROUP BY key_name
      HAVING count > 1
    `);
    
    if (duplicates.length === 0) {
      console.log('✓ No duplicates found in budget_items');
      return;
    }
    
    console.log(`Found ${duplicates.length} duplicate key_name(s):`);
    duplicates.forEach(d => {
      console.log(`  - ${d.key_name}: ${d.count} records (IDs: ${d.ids})`);
    });
    
    // Delete duplicates (keep the smallest id)
    console.log('\nDeleting duplicates...');
    for (const dup of duplicates) {
      const ids = dup.ids.split(',').map(Number);
      const keepId = ids[0]; // Keep the smallest id
      const deleteIds = ids.slice(1); // Delete the rest
      
      for (const deleteId of deleteIds) {
        await query('DELETE FROM budget_items WHERE id = ?', [deleteId]);
        console.log(`  ✓ Deleted duplicate ID ${deleteId} for key_name '${dup.key_name}' (kept ID ${keepId})`);
      }
    }
    
    // Verify no more duplicates
    const remaining = await query(`
      SELECT key_name, COUNT(*) as count
      FROM budget_items
      GROUP BY key_name
      HAVING count > 1
    `);
    
    if (remaining.length === 0) {
      console.log('\n✅ All duplicates removed successfully!');
    } else {
      console.log('\n⚠️  Some duplicates still remain. Please check manually.');
    }
    
    // Show final budget items
    const finalItems = await query('SELECT id, key_name, name FROM budget_items ORDER BY sort_order');
    console.log('\nFinal budget items:');
    finalItems.forEach(item => {
      console.log(`  - ID ${item.id}: ${item.key_name} - ${item.name}`);
    });
    
  } catch (err) {
    console.error('Error fixing duplicates:', err);
    process.exit(1);
  }
}

fixBudgetDuplicates().then(() => process.exit(0));
