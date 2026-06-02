const Database = require('better-sqlite3');
const db = new Database('./db/zeronudge.db');

const items = db.prepare('SELECT * FROM budget_items').all();
console.log('SQLite budget items count:', items.length);
items.forEach(i => {
  console.log(`ID ${i.id}: ${i.key} - ${i.name}`);
});
