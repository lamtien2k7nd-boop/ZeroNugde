const Database = require('better-sqlite3');
const { query } = require('../db/mysql-connection');
require('dotenv').config();

// SQLite connection
const sqliteDb = new Database('./db/zeronudge.db');

async function migrateData() {
  try {
    console.log('Starting data migration from SQLite to MySQL...\n');
    
    // Add account_type column to users table if it doesn't exist
    try {
      await query('ALTER TABLE users ADD COLUMN account_type VARCHAR(255) NOT NULL DEFAULT \'b2c\'');
      console.log('✓ Added account_type column to users table');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ account_type column already exists');
      } else {
        throw err;
      }
    }
    
    // Migrate users
    console.log('Migrating users...');
    const users = sqliteDb.prepare('SELECT * FROM users').all();
    for (const user of users) {
      await query(`
        INSERT INTO users (id, username, password, full_name, created_at, goal_title, goal_amount, waste_threshold, account_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE username = VALUES(username), password = VALUES(password), full_name = VALUES(full_name)
      `, [user.id, user.username, user.password, user.full_name, user.created_at, user.goal_title, user.goal_amount, user.waste_threshold, user.account_type || 'b2c']);
    }
    console.log(`✓ Migrated ${users.length} users`);
    
    // Migrate user logs
    console.log('Migrating user logs...');
    const userLogs = sqliteDb.prepare('SELECT * FROM user_logs').all();
    for (const log of userLogs) {
      await query(`
        INSERT INTO user_logs (id, user_id, action, timestamp)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE action = VALUES(action), timestamp = VALUES(timestamp)
      `, [log.id, log.user_id, log.action, log.timestamp]);
    }
    console.log(`✓ Migrated ${userLogs.length} user logs`);
    
    // Migrate tags
    console.log('Migrating tags...');
    const tags = sqliteDb.prepare('SELECT * FROM tags').all();
    for (const tag of tags) {
      await query(`
        INSERT INTO tags (id, sort_order, label, color, green)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order), label = VALUES(label), color = VALUES(color), green = VALUES(green)
      `, [tag.id, tag.sort_order, tag.label, tag.color, tag.green]);
    }
    console.log(`✓ Migrated ${tags.length} tags`);
    
    // Migrate savings
    console.log('Migrating savings...');
    const savings = sqliteDb.prepare('SELECT * FROM savings').all();
    for (const saving of savings) {
      await query(`
        INSERT INTO savings (user_id, pig_amount, pig_target)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE pig_amount = VALUES(pig_amount), pig_target = VALUES(pig_target)
      `, [saving.user_id, saving.pig_amount, saving.pig_target]);
    }
    console.log(`✓ Migrated ${savings.length} savings`);
    
    // Migrate transactions
    console.log('Migrating transactions...');
    const transactions = sqliteDb.prepare('SELECT * FROM transactions').all();
    for (const tx of transactions) {
      await query(`
        INSERT INTO transactions (id, user_id, sort_order, icon, type, name, tag, amount, saved, saved_amt, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order), icon = VALUES(icon), type = VALUES(type), name = VALUES(name), tag = VALUES(tag), amount = VALUES(amount), saved = VALUES(saved), saved_amt = VALUES(saved_amt)
      `, [tx.id, tx.user_id, tx.sort_order, tx.icon, tx.type, tx.name, tx.tag, tx.amount, tx.saved, tx.saved_amt, tx.created_at]);
    }
    console.log(`✓ Migrated ${transactions.length} transactions`);
    
    // Migrate ledger rows
    console.log('Migrating ledger rows...');
    const ledgerRows = sqliteDb.prepare('SELECT * FROM ledger_rows').all();
    for (const row of ledgerRows) {
      await query(`
        INSERT INTO ledger_rows (id, user_id, sort_order, date, \`desc\`, cat, qty, price, cogs, partner, esg, paid, fifo_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order), date = VALUES(date), \`desc\` = VALUES(\`desc\`), cat = VALUES(cat), qty = VALUES(qty), price = VALUES(price), cogs = VALUES(cogs), partner = VALUES(partner), esg = VALUES(esg), paid = VALUES(paid), fifo_json = VALUES(fifo_json)
      `, [row.id, row.user_id, row.sort_order, row.date, row.desc, row.cat, row.qty, row.price, row.cogs, row.partner, row.esg, row.paid, row.fifo_json]);
    }
    console.log(`✓ Migrated ${ledgerRows.length} ledger rows`);
    
    // Migrate budget items
    console.log('Migrating budget items...');
    const budgetItems = sqliteDb.prepare('SELECT * FROM budget_items').all();
    for (const item of budgetItems) {
      await query(`
        INSERT INTO budget_items (id, sort_order, name, key_name, pct, cap_pct, color)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order), name = VALUES(name), pct = VALUES(pct), cap_pct = VALUES(cap_pct), color = VALUES(color)
      `, [item.id, item.sort_order, item.name, item.key, item.pct, item.cap_pct, item.color]);
    }
    console.log(`✓ Migrated ${budgetItems.length} budget items`);
    
    // Migrate projects
    console.log('Migrating projects...');
    const projects = sqliteDb.prepare('SELECT * FROM projects').all();
    for (const project of projects) {
      await query(`
        INSERT INTO projects (id, sort_order, name, \`desc\`, icon, risk, risk_label, risk_class, rate, period, target, raised, esg)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order), name = VALUES(name), \`desc\` = VALUES(\`desc\`), icon = VALUES(icon), risk = VALUES(risk), risk_label = VALUES(risk_label), risk_class = VALUES(risk_class), rate = VALUES(rate), period = VALUES(period), target = VALUES(target), raised = VALUES(raised), esg = VALUES(esg)
      `, [project.id, project.sort_order, project.name, project.desc, project.icon, project.risk, project.risk_label, project.risk_class, project.rate, project.period, project.target, project.raised, project.esg]);
    }
    console.log(`✓ Migrated ${projects.length} projects`);
    
    // Migrate suppliers
    console.log('Migrating suppliers...');
    const suppliers = sqliteDb.prepare('SELECT * FROM suppliers').all();
    for (const supplier of suppliers) {
      await query(`
        INSERT INTO suppliers (id, sort_order, name, cat, icon, esg, price1, price2, min_order, lead_time, cert)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order), name = VALUES(name), cat = VALUES(cat), icon = VALUES(icon), esg = VALUES(esg), price1 = VALUES(price1), price2 = VALUES(price2), min_order = VALUES(min_order), lead_time = VALUES(lead_time), cert = VALUES(cert)
      `, [supplier.id, supplier.sort_order, supplier.name, supplier.cat, supplier.icon, supplier.esg, supplier.price1, supplier.price2, supplier.min_order, supplier.lead_time, supplier.cert]);
    }
    console.log(`✓ Migrated ${suppliers.length} suppliers`);
    
    // Migrate suggestions
    console.log('Migrating suggestions...');
    const suggestions = sqliteDb.prepare('SELECT * FROM suggestions').all();
    for (const suggestion of suggestions) {
      await query(`
        INSERT INTO suggestions (id, sort_order, text)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order), text = VALUES(text)
      `, [suggestion.id, suggestion.sort_order, suggestion.text]);
    }
    console.log(`✓ Migrated ${suggestions.length} suggestions`);
    
    // Migrate ledger summary
    console.log('Migrating ledger summary...');
    const ledgerSummary = sqliteDb.prepare('SELECT * FROM ledger_summary').all();
    for (const summary of ledgerSummary) {
      await query(`
        INSERT INTO ledger_summary (user_id, income, expense, net, assets, liabilities, equity)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE income = VALUES(income), expense = VALUES(expense), net = VALUES(net), assets = VALUES(assets), liabilities = VALUES(liabilities), equity = VALUES(equity)
      `, [summary.user_id, summary.income, summary.expense, summary.net, summary.assets, summary.liabilities, summary.equity]);
    }
    console.log(`✓ Migrated ${ledgerSummary.length} ledger summaries`);
    
    // Migrate exchange summary
    console.log('Migrating exchange summary...');
    const exchangeSummary = sqliteDb.prepare('SELECT * FROM exchange_summary').all();
    for (const summary of exchangeSummary) {
      await query(`
        INSERT INTO exchange_summary (user_id, available_balance, total_invested, cumulative_return)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE available_balance = VALUES(available_balance), total_invested = VALUES(total_invested), cumulative_return = VALUES(cumulative_return)
      `, [summary.user_id, summary.available_balance, summary.total_invested, summary.cumulative_return]);
    }
    console.log(`✓ Migrated ${exchangeSummary.length} exchange summaries`);
    
    // Migrate club events
    console.log('Migrating club events...');
    const clubEvents = sqliteDb.prepare('SELECT * FROM club_events').all();
    for (const event of clubEvents) {
      await query(`
        INSERT INTO club_events (id, user_id, name, fund_amount, allocations, status, created_at, closed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name), fund_amount = VALUES(fund_amount), allocations = VALUES(allocations), status = VALUES(status), created_at = VALUES(created_at), closed_at = VALUES(closed_at)
      `, [event.id, event.user_id, event.name, event.fund_amount, event.allocations, event.status, event.created_at, event.closed_at]);
    }
    console.log(`✓ Migrated ${clubEvents.length} club events`);
    
    // Migrate meta
    console.log('Migrating meta...');
    const meta = sqliteDb.prepare('SELECT * FROM meta').all();
    for (const m of meta) {
      await query(`
        INSERT INTO meta (key_name, value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE value = VALUES(value)
      `, [m.key, m.value]);
    }
    console.log(`✓ Migrated ${meta.length} meta entries`);
    
    // Migrate cashbook entries
    console.log('Migrating cashbook entries...');
    const entries = sqliteDb.prepare('SELECT * FROM cashbook_entries').all();
    for (const entry of entries) {
      await query(`
        INSERT INTO cashbook_entries (id, user_id, transaction_id, entry_date, type, amount, category_tag, description, proof_document, balance_after, event_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE transaction_id = VALUES(transaction_id), entry_date = VALUES(entry_date), type = VALUES(type), amount = VALUES(amount), category_tag = VALUES(category_tag), description = VALUES(description), proof_document = VALUES(proof_document), balance_after = VALUES(balance_after), event_id = VALUES(event_id)
      `, [entry.id, entry.user_id, entry.transaction_id, entry.entry_date, entry.type, entry.amount, entry.category_tag, entry.description, entry.proof_document, entry.balance_after, entry.event_id, entry.created_at]);
    }
    console.log(`✓ Migrated ${entries.length} cashbook entries`);
    
    // Migrate events
    console.log('Migrating events...');
    const events = sqliteDb.prepare('SELECT * FROM events').all();
    for (const event of events) {
      await query(`
        INSERT INTO events (id, user_id, name, total_budget, backup_budget, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name), total_budget = VALUES(total_budget), backup_budget = VALUES(backup_budget), status = VALUES(status), created_at = VALUES(created_at)
      `, [event.id, event.user_id, event.name, event.total_budget, event.backup_budget, event.status, event.created_at]);
    }
    console.log(`✓ Migrated ${events.length} events`);
    
    // Migrate event budget items
    console.log('Migrating event budget items...');
    const eventBudgetItems = sqliteDb.prepare('SELECT * FROM event_budget_items').all();
    for (const item of eventBudgetItems) {
      await query(`
        INSERT INTO event_budget_items (id, event_id, item_name, planned_amount, actual_amount, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE item_name = VALUES(item_name), planned_amount = VALUES(planned_amount), actual_amount = VALUES(actual_amount), sort_order = VALUES(sort_order)
      `, [item.id, item.event_id, item.item_name, item.planned_amount, item.actual_amount, item.sort_order]);
    }
    console.log(`✓ Migrated ${eventBudgetItems.length} event budget items`);
    
    console.log('\n✅ Data migration completed successfully!');
    
    // Reset auto-increment to match SQLite
    console.log('\nResetting auto-increment values...');
    const tables = ['users', 'user_logs', 'transactions', 'ledger_rows', 'budget_items', 'projects', 'suppliers', 'suggestions', 'club_events', 'cashbook_entries', 'events', 'event_budget_items'];
    for (const table of tables) {
      const maxId = sqliteDb.prepare(`SELECT MAX(id) as max_id FROM ${table}`).get();
      if (maxId && maxId.max_id) {
        await query(`ALTER TABLE ${table} AUTO_INCREMENT = ${maxId.max_id + 1}`);
      }
    }
    console.log('✓ Auto-increment values reset');
    
  } catch (error) {
    console.error('Error migrating data:', error);
    process.exit(1);
  } finally {
    sqliteDb.close();
    process.exit(0);
  }
}

migrateData();
