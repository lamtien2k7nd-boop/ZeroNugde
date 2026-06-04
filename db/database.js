const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const sample = require('../lib/sampleData');

const DB_PATH = path.join(__dirname, 'zeronudge.db');

function ensureDbDir() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      goal_title TEXT,
      goal_amount INTEGER DEFAULT 0,
      waste_threshold INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL,
      label TEXT NOT NULL,
      color TEXT NOT NULL,
      green INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS savings (
      user_id INTEGER PRIMARY KEY,
      pig_amount INTEGER NOT NULL,
      pig_target INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      icon TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      tag TEXT NOT NULL,
      amount INTEGER NOT NULL,
      saved INTEGER NOT NULL DEFAULT 0,
      saved_amt INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ledger_rows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      date TEXT NOT NULL,
      desc TEXT NOT NULL,
      cat TEXT NOT NULL,
      qty INTEGER NOT NULL,
      price INTEGER NOT NULL,
      cogs INTEGER NOT NULL,
      partner TEXT NOT NULL,
      esg TEXT NOT NULL,
      paid INTEGER NOT NULL DEFAULT 0,
      fifo_json TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS budget_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sort_order INTEGER NOT NULL,
      name TEXT NOT NULL,
      key TEXT UNIQUE NOT NULL,
      pct INTEGER NOT NULL,
      cap_pct INTEGER NOT NULL,
      color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sort_order INTEGER NOT NULL,
      name TEXT UNIQUE NOT NULL,
      desc TEXT NOT NULL,
      icon TEXT NOT NULL,
      risk INTEGER NOT NULL,
      risk_label TEXT NOT NULL,
      risk_class TEXT NOT NULL,
      rate TEXT NOT NULL,
      period TEXT NOT NULL,
      target INTEGER NOT NULL,
      raised INTEGER NOT NULL,
      esg TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sort_order INTEGER NOT NULL,
      name TEXT UNIQUE NOT NULL,
      cat TEXT NOT NULL,
      icon TEXT NOT NULL,
      esg TEXT NOT NULL,
      price1 TEXT NOT NULL,
      price2 TEXT NOT NULL,
      min_order TEXT NOT NULL,
      lead_time TEXT NOT NULL,
      cert TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sort_order INTEGER NOT NULL,
      text TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ledger_summary (
      user_id INTEGER PRIMARY KEY,
      income INTEGER NOT NULL,
      expense INTEGER NOT NULL,
      net INTEGER NOT NULL,
      assets INTEGER NOT NULL,
      liabilities INTEGER NOT NULL,
      equity INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS exchange_summary (
      user_id INTEGER PRIMARY KEY,
      available_balance INTEGER NOT NULL,
      total_invested INTEGER NOT NULL,
      cumulative_return INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS club_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      fund_amount INTEGER NOT NULL,
      allocations TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cashbook_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      transaction_id TEXT NOT NULL,
      entry_date TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      category_tag TEXT NOT NULL,
      description TEXT NOT NULL,
      proof_document TEXT,
      balance_after INTEGER NOT NULL,
      event_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      total_budget INTEGER NOT NULL,
      backup_budget INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS event_budget_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      planned_amount INTEGER NOT NULL,
      actual_amount INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS monthly_closings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      period_key TEXT NOT NULL,
      opening_balance INTEGER NOT NULL,
      closing_balance INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, period_key),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS expense_approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      event_id INTEGER,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      approver_1 TEXT,
      approver_2 TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
}

const THU_KEYWORDS = [
  { pattern: /NOP\s*QUY|DONG\s*QUY|NOP\s*TIEN|NOP\s*QU/i, category: 'Thu quỹ nội bộ' },
  { pattern: /TAI\s*TRO|SPONSOR/i, category: 'Tài trợ' },
  { pattern: /BAN\s*VE|VE\s*SU\s*KIEN/i, category: 'Bán vé sự kiện' },
];

const CHI_KEYWORDS = [
  { pattern: /CHI\s*QUY|CHI\s*TIEN/i, category: 'Chi quỹ nội bộ' },
  { pattern: /THANH\s*TOAN|PAYMENT/i, category: 'Thanh toán NCC' },
  { pattern: /HAU\s*CAN|LOGISTICS/i, category: 'Chi hậu cần' },
  { pattern: /TRUYEN\s*THONG|MARKETING/i, category: 'Chi truyền thông' },
];

function isClubAccount(accountType) {
  return ['b2b', 'club', 'team'].includes(accountType);
}

function classifyCashbookDescription(description) {
  const upper = String(description || '').toUpperCase();
  for (const rule of THU_KEYWORDS) {
    if (rule.pattern.test(upper)) return { type: 'THU', category: rule.category };
  }
  for (const rule of CHI_KEYWORDS) {
    if (rule.pattern.test(upper)) return { type: 'CHI', category: rule.category };
  }
  return { type: 'CHI', category: 'Chi khác' };
}

function ensureMigrations(db) {
  const userCols = db.prepare('PRAGMA table_info(users)').all();
  if (!userCols.some((c) => c.name === 'account_type')) {
    db.exec("ALTER TABLE users ADD COLUMN account_type TEXT NOT NULL DEFAULT 'b2c'");
  }
}

function getSeedVersion(db) {
  try {
    const row = db.prepare("SELECT value FROM meta WHERE key = 'seed_version'").get();
    return row ? parseInt(row.value, 10) : 0;
  } catch (e) {
    return 0;
  }
}

function clearSeedData(db, sampleUserId) {
  db.exec(`
    DELETE FROM suggestions;
    DELETE FROM suppliers;
    DELETE FROM projects;
    DELETE FROM budget_items;
    DELETE FROM tags;
    DELETE FROM meta WHERE key = 'seed_version';
  `);

  if (sampleUserId != null) {
    db.prepare('DELETE FROM event_budget_items WHERE event_id IN (SELECT id FROM events WHERE user_id = ?)').run(sampleUserId);
    db.prepare('DELETE FROM events WHERE user_id = ?').run(sampleUserId);
    db.prepare('DELETE FROM cashbook_entries WHERE user_id = ?').run(sampleUserId);
    db.prepare('DELETE FROM monthly_closings WHERE user_id = ?').run(sampleUserId);
    db.prepare('DELETE FROM expense_approvals WHERE user_id = ?').run(sampleUserId);
    db.prepare('DELETE FROM transactions WHERE user_id = ?').run(sampleUserId);
    db.prepare('DELETE FROM ledger_rows WHERE user_id = ?').run(sampleUserId);
    db.prepare('DELETE FROM savings WHERE user_id = ?').run(sampleUserId);
    db.prepare('DELETE FROM ledger_summary WHERE user_id = ?').run(sampleUserId);
    db.prepare('DELETE FROM exchange_summary WHERE user_id = ?').run(sampleUserId);
    db.prepare('DELETE FROM user_logs WHERE user_id = ?').run(sampleUserId);
  }
}

function seed(db) {
  if (getSeedVersion(db) >= sample.SEED_VERSION) return;

  const insertUser = db.prepare(
    'INSERT INTO users (username, password, full_name) VALUES (@username, @password, @full_name)'
  );
  const insertTag = db.prepare(
    'INSERT INTO tags (id, sort_order, label, color, green) VALUES (@id, @sort_order, @label, @color, @green)'
  );
  const insertTx = db.prepare(`
    INSERT INTO transactions (user_id, sort_order, icon, type, name, tag, amount, saved, saved_amt)
    VALUES (@user_id, @sort_order, @icon, @type, @name, @tag, @amount, @saved, @saved_amt)
  `);
  const insertLedger = db.prepare(`
    INSERT INTO ledger_rows (user_id, sort_order, date, desc, cat, qty, price, cogs, partner, esg, paid, fifo_json)
    VALUES (@user_id, @sort_order, @date, @desc, @cat, @qty, @price, @cogs, @partner, @esg, @paid, @fifo_json)
  `);
  const insertBudget = db.prepare(`
    INSERT INTO budget_items (sort_order, name, key, pct, cap_pct, color)
    VALUES (@sort_order, @name, @key, @pct, @cap_pct, @color)
  `);
  const insertProject = db.prepare(`
    INSERT INTO projects (sort_order, name, desc, icon, risk, risk_label, risk_class, rate, period, target, raised, esg)
    VALUES (@sort_order, @name, @desc, @icon, @risk, @risk_label, @risk_class, @rate, @period, @target, @raised, @esg)
  `);
  const insertSupplier = db.prepare(`
    INSERT INTO suppliers (sort_order, name, cat, icon, esg, price1, price2, min_order, lead_time, cert)
    VALUES (@sort_order, @name, @cat, @icon, @esg, @price1, @price2, @min_order, @lead_time, @cert)
  `);
  const insertSuggestion = db.prepare(
    'INSERT INTO suggestions (sort_order, text) VALUES (@sort_order, @text)'
  );

  const run = db.transaction(() => {
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('test_user');
    const userId = existingUser ? existingUser.id : null;

    clearSeedData(db, userId || undefined);

    let sampleUserId = userId;
    if (!sampleUserId) {
      const hashedPassword = bcrypt.hashSync('test123', 10);
      const userResult = insertUser.run({
        username: 'test_user',
        password: hashedPassword,
        full_name: 'Test User'
      });
      sampleUserId = Number(userResult.lastInsertRowid);
    }
    db.prepare("UPDATE users SET account_type = 'b2b' WHERE id = ?").run(sampleUserId);

    sample.tags.forEach((t, i) =>
      insertTag.run({ id: t.id, sort_order: i, label: t.label, color: t.color, green: t.green ? 1 : 0 })
    );

    db.prepare(
      'INSERT INTO savings (user_id, pig_amount, pig_target) VALUES (?, ?, ?)'
    ).run(sampleUserId, sample.pigAmount, sample.pigTarget);

    sample.transactions.forEach((t, i) =>
      insertTx.run({
        user_id: sampleUserId,
        sort_order: i,
        icon: t.icon,
        type: t.type,
        name: t.name,
        tag: t.tag,
        amount: t.amount,
        saved: t.saved ? 1 : 0,
        saved_amt: t.savedAmt != null ? t.savedAmt : null,
      })
    );

    sample.ledgerData.forEach((row, i) =>
      insertLedger.run({
        user_id: sampleUserId,
        sort_order: i,
        date: row.date,
        desc: row.desc,
        cat: row.cat,
        qty: row.qty,
        price: row.price,
        cogs: row.cogs,
        partner: row.partner,
        esg: row.esg,
        paid: row.paid ? 1 : 0,
        fifo_json: JSON.stringify(row.fifo),
      })
    );

    sample.budgetItems.forEach((b, i) =>
      insertBudget.run({
        sort_order: i,
        name: b.name,
        key: b.key,
        pct: b.pct,
        cap_pct: b.limit,
        color: b.color,
      })
    );

    sample.projects.forEach((p, i) =>
      insertProject.run({
        sort_order: i,
        name: p.name,
        desc: p.desc,
        icon: p.icon,
        risk: p.risk,
        risk_label: p.riskLabel,
        risk_class: p.riskClass,
        rate: p.rate,
        period: p.period,
        target: p.target,
        raised: p.raised,
        esg: p.esg,
      })
    );

    sample.suppliers.forEach((s, i) =>
      insertSupplier.run({
        sort_order: i,
        name: s.name,
        cat: s.cat,
        icon: s.icon,
        esg: s.esg,
        price1: s.price1,
        price2: s.price2,
        min_order: s.minOrder,
        lead_time: s.lead,
        cert: s.cert,
      })
    );

    sample.suggestions.forEach((s, i) =>
      insertSuggestion.run({ sort_order: i, text: s.text })
    );

    const ls = sample.ledgerSummary;
    db.prepare(`
      INSERT INTO ledger_summary (user_id, income, expense, net, assets, liabilities, equity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sampleUserId, ls.income, ls.expense, ls.net, ls.assets, ls.liabilities, ls.equity);

    const es = sample.exchangeSummary;
    db.prepare(`
      INSERT INTO exchange_summary (user_id, available_balance, total_invested, cumulative_return)
      VALUES (?, ?, ?, ?)
    `).run(sampleUserId, es.availableBalance, es.totalInvested, es.cumulativeReturn);

    let defaultEventId = null;
    if (sample.events && sample.events.length) {
      const insertEvent = db.prepare(`
        INSERT INTO events (user_id, name, total_budget, backup_budget, status)
        VALUES (@user_id, @name, @total_budget, @backup_budget, @status)
      `);
      const insertItem = db.prepare(`
        INSERT INTO event_budget_items (event_id, item_name, planned_amount, actual_amount, sort_order)
        VALUES (@event_id, @item_name, @planned_amount, @actual_amount, @sort_order)
      `);
      sample.events.forEach((ev) => {
        const evInfo = insertEvent.run({
          user_id: sampleUserId,
          name: ev.name,
          total_budget: ev.totalBudget,
          backup_budget: ev.backupBudget || 0,
          status: ev.status || 'active',
        });
        const eventId = Number(evInfo.lastInsertRowid);
        if (!defaultEventId) defaultEventId = eventId;
        (ev.items || []).forEach((item, idx) =>
          insertItem.run({
            event_id: eventId,
            item_name: item.itemName,
            planned_amount: item.plannedAmount,
            actual_amount: item.actualAmount || 0,
            sort_order: idx,
          })
        );
      });
    }

    if (sample.cashbookEntries && sample.cashbookEntries.length) {
      const insertCash = db.prepare(`
        INSERT INTO cashbook_entries (user_id, transaction_id, entry_date, type, amount, category_tag, description, proof_document, balance_after, event_id)
        VALUES (@user_id, @transaction_id, @entry_date, @type, @amount, @category_tag, @description, @proof_document, @balance_after, @event_id)
      `);
      sample.cashbookEntries.forEach((e) =>
        insertCash.run({
          user_id: sampleUserId,
          transaction_id: e.transactionId,
          entry_date: e.date,
          type: e.type,
          amount: e.amount,
          category_tag: e.categoryTag,
          description: e.description,
          proof_document: e.proofDocument || null,
          balance_after: e.balanceAfter,
          event_id: e.eventId ? defaultEventId : null,
        })
      );
      const lastBal = sample.cashbookEntries[sample.cashbookEntries.length - 1].balanceAfter;
      const totalThu = sample.cashbookEntries.filter((e) => e.type === 'THU').reduce((s, e) => s + e.amount, 0);
      const totalChi = sample.cashbookEntries.filter((e) => e.type === 'CHI').reduce((s, e) => s + e.amount, 0);
      db.prepare(
        `UPDATE ledger_summary SET income = ?, expense = ?, net = ? WHERE user_id = ?`
      ).run(totalThu, totalChi, lastBal, sampleUserId);
    }

    db.prepare(`INSERT INTO meta (key, value) VALUES ('seed_version', ?)`).run(String(sample.SEED_VERSION));
  });

  run();
}

function ensureTransactionCreatedAt(db) {
  const cols = db.prepare("PRAGMA table_info(transactions)").all();
  if (!cols.some((c) => c.name === 'created_at')) {
    db.exec("ALTER TABLE transactions ADD COLUMN created_at DATETIME");
    db.exec("UPDATE transactions SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL");
  }
}

function ensureClubEventsTable(db) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='club_events'").all();
  if (tables.length === 0) {
    db.exec(`
      CREATE TABLE club_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        fund_amount INTEGER NOT NULL,
        allocations TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
  }
}

function openDatabase() {
  ensureDbDir();
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  createSchema(db);
  ensureMigrations(db);
  ensureTransactionCreatedAt(db);
  ensureClubEventsTable(db);
  seed(db);
  return db;
}

let _db;
function getDb() {
  if (!_db) _db = openDatabase();
  return _db;
}

function rowToTransaction(r) {
  const o = {
    id: r.id,
    icon: r.icon || (r.amount > 0 ? '💰' : '💸'),
    type: r.type,
    name: r.name || 'Giao dịch',
    tag: r.tag || '',
    amount: r.amount,
    saved: Boolean(r.saved),
    created_at: r.created_at || null,
    date: r.date || r.created_at || null,
  };
  if (r.saved && r.saved_amt != null) o.savedAmt = r.saved_amt;
  return o;
}

function insertTransaction(userId, body) {
  const db = getDb();
  if (!userId) throw new Error('Người dùng không hợp lệ');

  const tag = String(body.tag || '').trim();
  const amount = parseInt(body.amount, 10);
  if (!tag) throw new Error('Tag không hợp lệ');
  if (!Number.isFinite(amount) || amount === 0) throw new Error('Số tiền phải khác 0');

  const name = String(body.name || (amount < 0 ? 'Giao dịch mới' : 'Thu nhập mới')).trim();
  const icon = String(body.icon || (amount < 0 ? '💸' : '💰')).trim();
  const type = String(body.type || (amount < 0 ? 'expense' : 'income')).trim();
  const saved = body.saved ? 1 : 0;
  const savedAmt = Number.isFinite(parseInt(body.savedAmt, 10)) ? parseInt(body.savedAmt, 10) : null;

  const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM transactions WHERE user_id = ?').get(userId).m;
  const sortOrder = maxSort + 1;

  const info = db
    .prepare(
      `INSERT INTO transactions (user_id, sort_order, icon, type, name, tag, amount, saved, saved_amt)
       VALUES (@user_id, @sort_order, @icon, @type, @name, @tag, @amount, @saved, @saved_amt)`
    )
    .run({
      user_id: userId,
      sort_order: sortOrder,
      icon,
      type,
      name,
      tag,
      amount,
      saved,
      saved_amt: savedAmt,
    });

  return {
    id: Number(info.lastInsertRowid),
    icon,
    type,
    name,
    tag,
    amount,
    saved: Boolean(saved),
    ...(savedAmt != null ? { savedAmt } : {}),
  };
}

function applyInvestment(userId, projectName, amount) {
  const db = getDb();
  if (!userId) throw new Error('Người dùng không hợp lệ');
  if (!projectName || typeof projectName !== 'string') throw new Error('Dự án không hợp lệ');
  const investAmount = parseInt(amount, 10);
  if (!Number.isFinite(investAmount) || investAmount <= 0) throw new Error('Số tiền đầu tư không hợp lệ');

  const exchangeRow = db.prepare('SELECT available_balance, total_invested, cumulative_return FROM exchange_summary WHERE user_id = ?').get(userId);
  if (!exchangeRow) throw new Error('Không tìm thấy thông tin sàn vốn');
  if (investAmount > exchangeRow.available_balance) throw new Error('Số dư không đủ để đầu tư');

  const projectRow = db.prepare('SELECT * FROM projects WHERE name = ?').get(projectName);
  if (!projectRow) throw new Error('Dự án không tồn tại');

  const newAvailable = exchangeRow.available_balance - investAmount;
  const newTotalInvested = exchangeRow.total_invested + investAmount;
  db.prepare('UPDATE exchange_summary SET available_balance = ?, total_invested = ? WHERE user_id = ?')
    .run(newAvailable, newTotalInvested, userId);

  const raisedDelta = investAmount / 1000000000;
  db.prepare('UPDATE projects SET raised = raised + ? WHERE id = ?').run(raisedDelta, projectRow.id);

  const updatedProjectRow = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectRow.id);

  return {
    exchangeSummary: {
      availableBalance: newAvailable,
      totalInvested: newTotalInvested,
      cumulativeReturn: exchangeRow.cumulative_return,
    },
    project: rowToProject(updatedProjectRow),
  };
}

function rowToLedger(r) {
  return {
    id: r.id,
    date: r.date,
    desc: r.desc,
    cat: r.cat,
    qty: r.qty,
    price: r.price,
    cogs: r.cogs,
    partner: r.partner,
    esg: r.esg,
    paid: Boolean(r.paid),
    fifo: JSON.parse(r.fifo_json),
  };
}

function getCashbookTotals(db, userId, filters = {}) {
  // Validate filter keys to prevent SQL injection
  const allowedFilters = ['type', 'categoryTag', 'period'];
  const filterKeys = Object.keys(filters);
  const invalidKeys = filterKeys.filter(key => !allowedFilters.includes(key));
  if (invalidKeys.length > 0) {
    throw new Error(`Invalid filter keys: ${invalidKeys.join(', ')}`);
  }

  let where = 'user_id = ?';
  const params = [userId];
  if (filters.type) {
    // Validate type value (only THU or CHI allowed)
    if (!['THU', 'CHI'].includes(filters.type)) {
      throw new Error('Invalid type value');
    }
    where += ' AND type = ?';
    params.push(filters.type);
  }
  if (filters.categoryTag) {
    // Sanitize categoryTag to prevent injection
    const sanitizedTag = String(filters.categoryTag).replace(/[^a-zA-Z0-9_]/g, '');
    where += ' AND category_tag = ?';
    params.push(sanitizedTag);
  }
  if (filters.period) {
    // Validate period format (YYYY-MM)
    const periodPattern = /^\d{4}-\d{2}$/;
    if (!periodPattern.test(filters.period)) {
      throw new Error('Invalid period format');
    }
    where += ' AND entry_date LIKE ?';
    params.push(`${filters.period}%`);
  }
  const rows = db.prepare(`SELECT type, amount FROM cashbook_entries WHERE ${where}`).all(...params);
  let income = 0;
  let expense = 0;
  rows.forEach((r) => {
    if (r.type === 'THU') income += r.amount;
    else expense += r.amount;
  });
  const latest = db
    .prepare('SELECT balance_after FROM cashbook_entries WHERE user_id = ? ORDER BY id DESC LIMIT 1')
    .get(userId);
  const fundBalance = latest ? latest.balance_after : 0;
  return { income, expense, net: income - expense, fundBalance };
}

function recalculateLedgerSummaryFromCashbook(userId) {
  const db = getDb();
  const totals = getCashbookTotals(db, userId);
  const paidDebt = db
    .prepare(
      `SELECT COALESCE(SUM(qty * cogs), 0) AS debt FROM ledger_rows WHERE user_id = ? AND paid = 0`
    )
    .get(userId).debt;
  const assets = totals.fundBalance + paidDebt;
  const existing = db.prepare('SELECT * FROM ledger_summary WHERE user_id = ?').get(userId);
  if (existing) {
    db.prepare(
      `UPDATE ledger_summary SET income = ?, expense = ?, net = ?, assets = ?, liabilities = ?, equity = ?
       WHERE user_id = ?`
    ).run(
      totals.income,
      totals.expense,
      totals.fundBalance,
      assets,
      paidDebt,
      totals.fundBalance - paidDebt,
      userId
    );
  } else {
    db.prepare(
      `INSERT INTO ledger_summary (user_id, income, expense, net, assets, liabilities, equity)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, totals.income, totals.expense, totals.fundBalance, assets, paidDebt, totals.fundBalance - paidDebt);
  }
  return fetchLedgerSummary(db, userId);
}

function fetchLedgerSummary(db, userId) {
  const ledgerSummaryRow = db.prepare('SELECT * FROM ledger_summary WHERE user_id = ?').get(userId);
  if (!ledgerSummaryRow) return null;
  return {
    income: ledgerSummaryRow.income,
    expense: ledgerSummaryRow.expense,
    net: ledgerSummaryRow.net,
    fundBalance: ledgerSummaryRow.net,
    assets: ledgerSummaryRow.assets,
    liabilities: ledgerSummaryRow.liabilities,
    equity: ledgerSummaryRow.equity,
  };
}

function rowToCashbook(r) {
  return {
    id: r.id,
    transactionId: r.transaction_id,
    date: r.entry_date,
    type: r.type,
    amount: r.amount,
    categoryTag: r.category_tag,
    description: r.description,
    proofDocument: r.proof_document,
    balanceAfter: r.balance_after,
    eventId: r.event_id,
  };
}

function fetchCashbook(userId, filters = {}) {
  const db = getDb();
  // Validate filter keys to prevent SQL injection
  const allowedFilters = ['type', 'categoryTag', 'period'];
  const filterKeys = Object.keys(filters);
  const invalidKeys = filterKeys.filter(key => !allowedFilters.includes(key));
  if (invalidKeys.length > 0) {
    throw new Error(`Invalid filter keys: ${invalidKeys.join(', ')}`);
  }

  let where = 'user_id = ?';
  const params = [userId];
  if (filters.type) {
    // Validate type value (only THU or CHI allowed)
    if (!['THU', 'CHI'].includes(filters.type)) {
      throw new Error('Invalid type value');
    }
    where += ' AND type = ?';
    params.push(filters.type);
  }
  if (filters.categoryTag) {
    // Sanitize categoryTag to prevent injection
    const sanitizedTag = String(filters.categoryTag).replace(/[^a-zA-Z0-9_]/g, '');
    where += ' AND category_tag = ?';
    params.push(sanitizedTag);
  }
  if (filters.period) {
    // Validate period format (YYYY-MM)
    const periodPattern = /^\d{4}-\d{2}$/;
    if (!periodPattern.test(filters.period)) {
      throw new Error('Invalid period format');
    }
    where += ' AND entry_date LIKE ?';
    params.push(`%${filters.period}%`);
  }
  const entries = db
    .prepare(`SELECT * FROM cashbook_entries WHERE ${where} ORDER BY id ASC`)
    .all(...params)
    .map(rowToCashbook);
  const totals = getCashbookTotals(db, userId, filters);
  return { entries, totals };
}

function applyEventExpense(eventId, amount) {
  const db = getDb();
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!event) return null;
  const items = db
    .prepare('SELECT * FROM event_budget_items WHERE event_id = ? ORDER BY sort_order')
    .all(eventId);
  if (items.length === 0) return { alerts: [] };
  const target = items.reduce((best, item) => {
    const pct = item.planned_amount > 0 ? item.actual_amount / item.planned_amount : 0;
    return pct > (best.pct || 0) ? { item, pct } : best;
  }, { item: items[0], pct: 0 });
  db.prepare('UPDATE event_budget_items SET actual_amount = actual_amount + ? WHERE id = ?').run(
    amount,
    target.item.id
  );
  return buildEventAlerts(eventId);
}

function getUnpaidDebt(db, userId) {
  return db
    .prepare(
      `SELECT COALESCE(SUM(qty * cogs), 0) AS d FROM ledger_rows WHERE user_id = ? AND paid = 0`
    )
    .get(userId).d;
}

function getFundBalance(db, userId) {
  const latest = db
    .prepare('SELECT balance_after FROM cashbook_entries WHERE user_id = ? ORDER BY id DESC LIMIT 1')
    .get(userId);
  return latest ? latest.balance_after : 0;
}

function isApprovalValid(db, userId, approvalId, amount) {
  if (!approvalId) return false;
  const row = db
    .prepare('SELECT * FROM expense_approvals WHERE id = ? AND user_id = ?')
    .get(approvalId, userId);
  return Boolean(row && row.status === 'approved' && row.amount >= amount);
}

function precheckExpense(userId, opts = {}) {
  const db = getDb();
  const amount = parseInt(opts.amount, 10);
  const type = String(opts.type || 'CHI').toUpperCase();
  const fundBalance = getFundBalance(db, userId);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { allowed: false, reason: 'INVALID_AMOUNT', message: 'Số tiền không hợp lệ' };
  }

  if (type === 'THU') {
    return { allowed: true, reason: null, fundBalance, needsBackup: false, needsDualApproval: false };
  }

  const result = {
    allowed: true,
    reason: null,
    message: 'Trong hạn mức, có thể chi',
    fundBalance,
    needsBackup: false,
    needsDualApproval: false,
    projectedRemaining: null,
    eventId: null,
    eventName: null,
    allowedAmount: null,
    warnings: [],
    balanceAfter: fundBalance - amount,
  };

  if (opts.categoryKey) {
    const item = db.prepare('SELECT name, pct FROM budget_items WHERE key = ?').get(opts.categoryKey);
    if (item) {
      const allowedAmount = Math.round((item.pct / 100) * fundBalance);
      result.allowedAmount = allowedAmount;
      if (amount > allowedAmount) {
        result.allowed = false;
        result.reason = 'STRATEGIC_OVER_LIMIT';
        result.message = `Vượt định mức ${item.name}! Tối đa ${allowedAmount.toLocaleString()}₫ (${item.pct}% tồn quỹ)`;
      }
    }
  }

  if (opts.eventId) {
    const eventId = parseInt(opts.eventId, 10);
    const ev = db.prepare('SELECT * FROM events WHERE user_id = ? AND id = ?').get(userId, eventId);
    if (ev) {
      const items = db
        .prepare('SELECT * FROM event_budget_items WHERE event_id = ? ORDER BY sort_order')
        .all(eventId);
      const totalActual = items.reduce((s, i) => s + i.actual_amount, 0);
      const unpaidDebt = getUnpaidDebt(db, userId);
      const approvedLimit = ev.total_budget + ev.backup_budget;
      const projectedRemaining = approvedLimit - totalActual - amount + unpaidDebt;
      result.projectedRemaining = projectedRemaining;
      result.eventId = eventId;
      result.eventName = ev.name;

      items.forEach((item) => {
        const pct =
          item.planned_amount > 0
            ? ((item.actual_amount + amount) / item.planned_amount) * 100
            : 0;
        if (pct > 100) {
          result.warnings.push(
            `Hạng mục ${item.item_name} sẽ đạt ${Math.round(pct)}% dự toán`
          );
        }
      });

      if (projectedRemaining < 0) {
        result.allowed = false;
        result.needsBackup = true;
        result.reason = 'EVENT_OVER_BUDGET';
        result.message = `Sự kiện "${ev.name}" thiếu ${Math.abs(projectedRemaining).toLocaleString()}₫ — cần Quỹ Backup trước khi chi`;
      }
    }
  }

  if (result.balanceAfter < 0) {
    if (isApprovalValid(db, userId, opts.approvalId, amount)) {
      if (result.needsBackup) {
        /* vẫn cần backup sự kiện */
      } else {
        result.allowed = true;
        result.needsDualApproval = false;
        result.reason = result.reason || null;
        if (!result.reason) result.message = 'Đã có xác nhận kép 2/2 — được phép chi';
      }
    } else {
      result.needsDualApproval = true;
      if (!result.needsBackup) {
        result.allowed = false;
        result.reason = result.reason || 'NEGATIVE_FUND_BALANCE';
        result.message =
          result.message ||
          `Tồn quỹ sau chi còn ${result.balanceAfter.toLocaleString()}₫ — cần xác nhận kép (Thủ quỹ + Trưởng ban)`;
      } else {
        result.message = `${result.message} Đồng thời cần xác nhận kép vì tồn quỹ âm.`;
      }
    }
  }

  return result;
}

function createExpenseApproval(userId, body) {
  const db = getDb();
  const amount = parseInt(body.amount, 10);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Số tiền không hợp lệ');
  const eventId = body.eventId ? parseInt(body.eventId, 10) : null;
  const info = db
    .prepare(
      `INSERT INTO expense_approvals (user_id, amount, event_id, description, status)
       VALUES (?, ?, ?, ?, 'pending')`
    )
    .run(userId, amount, eventId, body.description || null);
  return {
    id: Number(info.lastInsertRowid),
    status: 'pending',
    approver1: null,
    approver2: null,
    amount,
  };
}

function signExpenseApproval(userId, approvalId, signerLabel) {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM expense_approvals WHERE id = ? AND user_id = ?')
    .get(approvalId, userId);
  if (!row) throw new Error('Không tìm thấy phiếu duyệt');
  if (row.status === 'approved') {
    return { id: row.id, status: 'approved', approver1: row.approver_1, approver2: row.approver_2 };
  }

  const label = String(signerLabel || '').trim();
  if (!label) throw new Error('Thiếu tên người duyệt');

  let approver1 = row.approver_1;
  let approver2 = row.approver_2;

  if (!approver1) {
    approver1 = label;
  } else if (!approver2 && approver1 !== label) {
    approver2 = label;
  } else if (approver1 === label || approver2 === label) {
    throw new Error('Người này đã duyệt hoặc trùng vai trò');
  } else {
    throw new Error('Đã đủ 2 người duyệt');
  }

  let status = 'pending';
  if (approver1 && approver2) status = 'approved';

  db.prepare(
    'UPDATE expense_approvals SET approver_1 = ?, approver_2 = ?, status = ? WHERE id = ?'
  ).run(approver1, approver2, status, approvalId);

  return { id: approvalId, status, approver1, approver2 };
}

function buildEventAlerts(eventId) {
  const db = getDb();
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  const items = db
    .prepare('SELECT * FROM event_budget_items WHERE event_id = ? ORDER BY sort_order')
    .all(eventId);
  const alerts = [];
  const totalActual = items.reduce((s, i) => s + i.actual_amount, 0);
  const approvedLimit = event.total_budget + event.backup_budget;
  const remaining = approvedLimit - totalActual;
  items.forEach((item) => {
    const pct = item.planned_amount > 0 ? (item.actual_amount / item.planned_amount) * 100 : 0;
    if (pct > 100) {
      alerts.push(
        `Hạng mục ${item.item_name} đã vượt dự toán ${Math.round(pct - 100)}%, vui lòng cắt giảm chi phí khác để bù đắp ngân sách tổng!`
      );
    }
  });
  if (remaining < 0) {
    alerts.push(`Sự kiện "${event.name}" đã vượt hạn mức ${Math.abs(remaining).toLocaleString()}₫ — cần kích hoạt Quỹ Backup.`);
  }
  return { alerts, remaining, approvedLimit, totalActual };
}

function insertCashbookEntry(userId, body) {
  const db = getDb();
  const description = String(body.description || body.desc || '').trim();
  if (!description) throw new Error('Nội dung giao dịch không được trống');

  let type = body.type ? String(body.type).toUpperCase() : null;
  let categoryTag = body.categoryTag || body.category_tag || null;
  if (!type || !categoryTag) {
    const classified = classifyCashbookDescription(description);
    type = type || classified.type;
    categoryTag = categoryTag || classified.category;
  }

  const amount = parseInt(body.amount, 10);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Số tiền không hợp lệ');

  const eventId = body.eventId ? parseInt(body.eventId, 10) : null;

  if (!body.skipPrecheck && type === 'CHI') {
    const check = precheckExpense(userId, {
      amount,
      eventId,
      categoryKey: body.categoryKey,
      type: 'CHI',
      approvalId: body.approvalId,
    });
    if (!check.allowed) {
      const err = new Error(check.message || 'Smart CFO: Chi tiêu không được phép');
      err.precheck = check;
      throw err;
    }
  }

  const latest = db
    .prepare('SELECT balance_after FROM cashbook_entries WHERE user_id = ? ORDER BY id DESC LIMIT 1')
    .get(userId);
  const prevBalance = latest ? latest.balance_after : 0;
  const balanceAfter = type === 'THU' ? prevBalance + amount : prevBalance - amount;

  const transactionId =
    body.transactionId ||
    `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const entryDate = body.date || body.entry_date || new Date().toLocaleString('vi-VN');

  if (type === 'CHI' && !body.proofDocument && !body.proof_document) {
    throw new Error('Dòng CHI bắt buộc có hình ảnh minh chứng (UNC/hóa đơn)');
  }

  const info = db
    .prepare(
      `INSERT INTO cashbook_entries (user_id, transaction_id, entry_date, type, amount, category_tag, description, proof_document, balance_after, event_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      transactionId,
      entryDate,
      type,
      amount,
      categoryTag,
      description,
      body.proofDocument || body.proof_document || null,
      balanceAfter,
      eventId
    );

  if (type === 'CHI' && eventId) {
    applyEventExpense(eventId, amount);
  }

  recalculateLedgerSummaryFromCashbook(userId);
  closeMonthlyPeriodIfNeeded(userId);

  return rowToCashbook(
    db.prepare('SELECT * FROM cashbook_entries WHERE id = ?').get(Number(info.lastInsertRowid))
  );
}

function closeMonthlyPeriodIfNeeded(userId) {
  const db = getDb();
  const now = new Date();
  const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastInPeriod = db
    .prepare(
      `SELECT balance_after FROM cashbook_entries WHERE user_id = ? AND entry_date LIKE ? ORDER BY id DESC LIMIT 1`
    )
    .get(userId, `%${periodKey.slice(5)}%`);
  if (!lastInPeriod) return;
  const existing = db
    .prepare('SELECT id FROM monthly_closings WHERE user_id = ? AND period_key = ?')
    .get(userId, periodKey);
  if (existing) {
    db.prepare('UPDATE monthly_closings SET closing_balance = ? WHERE id = ?').run(
      lastInPeriod.balance_after,
      existing.id
    );
  } else {
    const prevPeriod = db
      .prepare('SELECT closing_balance FROM monthly_closings WHERE user_id = ? ORDER BY period_key DESC LIMIT 1')
      .get(userId);
    db.prepare(
      `INSERT INTO monthly_closings (user_id, period_key, opening_balance, closing_balance) VALUES (?, ?, ?, ?)`
    ).run(userId, periodKey, prevPeriod ? prevPeriod.closing_balance : 0, lastInPeriod.balance_after);
  }
}

function syncExchangeFromSavings(userId) {
  const db = getDb();
  const savings = db.prepare('SELECT pig_amount, pig_target FROM savings WHERE user_id = ?').get(userId);
  if (!savings) return null;
  const rate = 0.085;
  const cumulativeReturn = Math.round(savings.pig_amount * rate * 0.15);
  const row = db.prepare('SELECT total_invested FROM exchange_summary WHERE user_id = ?').get(userId);
  const totalInvested = row ? row.total_invested : 0;
  const available = Math.max(0, savings.pig_amount - totalInvested);
  db.prepare(
    'UPDATE exchange_summary SET available_balance = ?, cumulative_return = ? WHERE user_id = ?'
  ).run(available, cumulativeReturn, userId);
  return {
    availableBalance: available,
    totalInvested,
    cumulativeReturn,
    expectedAnnualRate: rate,
    projectedInterest: Math.round(savings.pig_amount * rate),
  };
}

function fetchEvents(userId) {
  const db = getDb();
  const events = db.prepare('SELECT * FROM club_events WHERE user_id = ? ORDER BY id DESC').all(userId);
  return events.map((ev) => ({
    id: ev.id,
    name: ev.name,
    fundAmount: ev.fund_amount,
    allocations: ev.allocations ? JSON.parse(ev.allocations) : {},
    status: ev.status,
    createdAt: ev.created_at,
    closedAt: ev.closed_at
  }));
}

function approveEventBackup(userId, eventId, option, amount) {
  const db = getDb();
  const event = db.prepare('SELECT * FROM events WHERE user_id = ? AND id = ?').get(userId, eventId);
  if (!event) throw new Error('Không tìm thấy sự kiện');
  const backupAmount = parseInt(amount, 10);
  if (!Number.isFinite(backupAmount) || backupAmount <= 0) throw new Error('Số tiền backup không hợp lệ');

  db.prepare('UPDATE events SET backup_budget = backup_budget + ? WHERE id = ?').run(backupAmount, eventId);

  if (option === 'A') {
    insertCashbookEntry(userId, {
      description: `TRICH QUY COT LOI CHO SU KIEN ${event.name}`,
      amount: backupAmount,
      type: 'CHI',
      categoryTag: 'Chi quỹ cốt lõi',
      proofDocument: 'internal-transfer',
      skipPrecheck: true,
    });
  } else {
    insertCashbookEntry(userId, {
      description: `TAI TRO KHAN CAP CHO SU KIEN ${event.name}`,
      amount: backupAmount,
      type: 'THU',
      categoryTag: 'Tài trợ khẩn cấp',
      skipPrecheck: true,
    });
  }

  return fetchEvents(userId).find((e) => e.id === eventId);
}

function fetchDashboardStats(userId) {
  const db = getDb();
  const user = db
    .prepare('SELECT account_type, goal_title, goal_amount FROM users WHERE id = ?')
    .get(userId);
  const savings = db.prepare('SELECT pig_amount, pig_target FROM savings WHERE user_id = ?').get(userId);
  const accountType = user?.account_type || 'b2c';

  if (isClubAccount(accountType)) {
    recalculateLedgerSummaryFromCashbook(userId);
    const summary = fetchLedgerSummary(db, userId);
    const rows = db.prepare('SELECT cat, qty, cogs, paid FROM ledger_rows WHERE user_id = ?').all(userId);
    const byCat = {};
    rows.forEach((r) => {
      const spend = r.qty * r.cogs;
      byCat[r.cat] = (byCat[r.cat] || 0) + spend;
    });
    const pieLabels = Object.keys(byCat);
    const pieData = pieLabels.map((k) => byCat[k]);
    return {
      accountType,
      balance: summary?.fundBalance ?? summary?.net ?? 0,
      ledgerSummary: summary,
      groupSpendPie: { labels: pieLabels, data: pieData },
    };
  }

  const pigAmount = savings?.pig_amount || 0;
  const pigTarget = savings?.pig_target || user?.goal_amount || 0;
  syncExchangeFromSavings(userId);
  return {
    accountType,
    goalTitle: user?.goal_title,
    pigAmount,
    pigTarget,
    progressPct: pigTarget > 0 ? Math.min(100, (pigAmount / pigTarget) * 100) : 0,
    greenSaving: { pigAmount, pigTarget },
  };
}

function payLedgerRow(userId, ledgerRowId, body = {}) {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM ledger_rows WHERE id = ? AND user_id = ?')
    .get(ledgerRowId, userId);
  if (!row) throw new Error('Không tìm thấy dòng hạch toán');
  if (row.paid) throw new Error('Khoản này đã thanh toán');

  const amount = row.qty * row.cogs;
  const eventId = body.eventId ? parseInt(body.eventId, 10) : null;

  const check = precheckExpense(userId, {
    amount,
    eventId,
    type: 'CHI',
    approvalId: body.approvalId,
  });

  if (!check.allowed) {
    const err = new Error(check.message || 'Không được thanh toán');
    err.precheck = check;
    throw err;
  }

  const entry = insertCashbookEntry(userId, {
    description:
      body.description ||
      `CHI QUY thanh toan ${row.desc} - ${row.partner}`,
    amount,
    type: 'CHI',
    proofDocument: body.proofDocument || `ledger-${ledgerRowId}.pdf`,
    eventId,
    approvalId: body.approvalId,
    skipPrecheck: true,
  });

  db.prepare('UPDATE ledger_rows SET paid = 1 WHERE id = ?').run(ledgerRowId);
  recalculateLedgerSummaryFromCashbook(userId);

  return { entry, check, ledgerRowId };
}

function getLedgerSpendByCategory(userId) {
  const db = getDb();
  const rows = db.prepare('SELECT cat, qty, cogs FROM ledger_rows WHERE user_id = ?').all(userId);
  const byCat = {};
  rows.forEach((r) => {
    byCat[r.cat] = (byCat[r.cat] || 0) + r.qty * r.cogs;
  });
  return byCat;
}

function fetchLedgerPaginated(userId, page = 1, pageSize = 5, search = '') {
  const db = getDb();
  let totalQuery = 'SELECT COUNT(*) AS c FROM ledger_rows WHERE user_id = ?';
  let rowsQuery = 'SELECT * FROM ledger_rows WHERE user_id = ?';
  const params = [userId];

  if (search) {
    totalQuery += " AND (desc LIKE ? OR partner LIKE ? OR cat LIKE ?)";
    rowsQuery += " AND (desc LIKE ? OR partner LIKE ? OR cat LIKE ?)";
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam);
  }

  const total = db.prepare(totalQuery).get(...params).c;
  const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);
  let p = Math.max(1, parseInt(page, 10) || 1);
  if (p > totalPages) p = totalPages;
  const offset = (p - 1) * pageSize;

  rowsQuery += ' ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?';
  const rowsParams = [...params, pageSize, offset];

  const rows = db.prepare(rowsQuery).all(...rowsParams).map(rowToLedger);
  const summary = fetchLedgerSummary(db, userId);
  return {
    rows,
    summary,
    page: p,
    pageSize,
    total,
    totalPages,
  };
}

function insertLedgerRow(userId, body) {
  const db = getDb();
  const date = String(body.date || '').trim();
  const desc = String(body.desc || '').trim();
  const cat = String(body.cat || '').trim();
  const partner = String(body.partner || '').trim();
  const esg = String(body.esg || 'A').trim().toUpperCase();
  if (!['A', 'B', 'C'].includes(esg)) {
    throw new Error('ESG phải là A, B hoặc C');
  }

  const qty = parseInt(body.qty, 10);
  const price = parseInt(body.price, 10);
  const cogs = parseInt(body.cogs, 10);

  if (!date || !desc || !cat || !partner) {
    throw new Error('Thiếu trường bắt buộc');
  }
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('SL không hợp lệ');
  if (!Number.isFinite(price) || price < 0) throw new Error('Đơn giá không hợp lệ');
  if (!Number.isFinite(cogs) || cogs < 0) throw new Error('COGS không hợp lệ');

  let fifo = body.fifo;
  if (Array.isArray(fifo) && fifo.length > 0) {
    fifo = fifo.map((line) => ({
      batch: String(line.batch || '').trim() || 'Lô',
      qty: parseInt(line.qty, 10),
      price: parseInt(line.price, 10),
    }));
    for (const line of fifo) {
      if (!Number.isFinite(line.qty) || line.qty <= 0 || !Number.isFinite(line.price) || line.price < 0) {
        throw new Error('FIFO không hợp lệ');
      }
    }
  } else {
    fifo = [{ batch: 'Lô 1', qty, price: cogs }];
  }

  const paid = Boolean(body.paid);
  const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM ledger_rows WHERE user_id = ?').get(userId).m;
  const sortOrder = maxSort + 1;

  const info = db
    .prepare(`
    INSERT INTO ledger_rows (user_id, sort_order, date, desc, cat, qty, price, cogs, partner, esg, paid, fifo_json)
    VALUES (@user_id, @sort_order, @date, @desc, @cat, @qty, @price, @cogs, @partner, @esg, @paid, @fifo_json)
  `)
    .run({
      user_id: userId,
      sort_order: sortOrder,
      date,
      desc,
      cat,
      qty,
      price,
      cogs,
      partner,
      esg,
      paid: paid ? 1 : 0,
      fifo_json: JSON.stringify(fifo),
    });

  return { id: Number(info.lastInsertRowid), sortOrder };
}

function rowToBudget(r) {
  return {
    name: r.name,
    key: r.key,
    pct: r.pct,
    limit: r.cap_pct,
    color: r.color,
  };
}

function rowToProject(r) {
  return {
    name: r.name,
    desc: r.desc,
    icon: r.icon,
    risk: r.risk,
    riskLabel: r.risk_label,
    riskClass: r.risk_class,
    rate: r.rate,
    period: r.period,
    target: r.target,
    raised: r.raised,
    esg: r.esg,
  };
}

function rowToSupplier(r) {
  return {
    name: r.name,
    cat: r.cat,
    icon: r.icon,
    esg: r.esg,
    price1: r.price1,
    price2: r.price2,
    minOrder: r.min_order,
    lead: r.lead_time,
    cert: r.cert,
  };
}

function fetchAppPayload(userId) {
  const db = getDb();

  const user = db.prepare('SELECT username, full_name, created_at, goal_title, goal_amount, waste_threshold, account_type FROM users WHERE id = ?').get(userId);
  if (!user) {
    throw new Error('Người dùng không tồn tại');
  }

  // Global data (shared across all users)
  const tags = db
    .prepare('SELECT id, label, color, green FROM tags ORDER BY sort_order')
    .all()
    .map((t) => ({ id: t.id, label: t.label, color: t.color, green: Boolean(t.green) }));

  // Per-user data
  const savings = db.prepare('SELECT pig_amount AS pigAmount, pig_target AS pigTarget FROM savings WHERE user_id = ?').get(userId);

  const transactions = db
    .prepare('SELECT *, created_at as date FROM transactions WHERE user_id = ? ORDER BY id DESC')
    .all(userId)
    .map(rowToTransaction);

  // Global data
  const budgetItems = db
    .prepare('SELECT * FROM budget_items ORDER BY sort_order')
    .all()
    .map(rowToBudget);

  const projects = db
    .prepare('SELECT * FROM projects ORDER BY sort_order')
    .all()
    .map(rowToProject);

  const suppliers = db
    .prepare('SELECT * FROM suppliers ORDER BY sort_order')
    .all()
    .map(rowToSupplier);

  const suggestions = db
    .prepare('SELECT text FROM suggestions ORDER BY sort_order')
    .all()
    .map((s) => ({ text: s.text }));

  const ledgerSummary = fetchLedgerSummary(db, userId);

  const exchangeRow = db.prepare('SELECT * FROM exchange_summary WHERE user_id = ?').get(userId);
  const exchangeSummary = exchangeRow ? {
    availableBalance: exchangeRow.available_balance,
    totalInvested: exchangeRow.total_invested,
    cumulativeReturn: exchangeRow.cumulative_return,
  } : null;

  const logs = db.prepare('SELECT action FROM user_logs WHERE user_id = ?').all(userId).map(l => l.action);

  if (user && isClubAccount(user.account_type)) {
    recalculateLedgerSummaryFromCashbook(userId);
  } else {
    syncExchangeFromSavings(userId);
  }

  const refreshedLedger = fetchLedgerSummary(db, userId);
  const refreshedExchange = db.prepare('SELECT * FROM exchange_summary WHERE user_id = ?').get(userId);
  const exchangeSummaryOut = refreshedExchange ? {
    availableBalance: refreshedExchange.available_balance,
    totalInvested: refreshedExchange.total_invested,
    cumulativeReturn: refreshedExchange.cumulative_return,
  } : null;

  const events = user && isClubAccount(user.account_type) ? fetchEvents(userId) : [];
  const cashbook = user && isClubAccount(user.account_type) ? fetchCashbook(userId) : null;

  return {
    user,
    tags,
    pigAmount: savings ? savings.pigAmount : 0,
    pigTarget: savings ? savings.pigTarget : 0,
    transactions,
    budgetItems,
    projects,
    suppliers,
    suggestions,
    ledgerSummary: refreshedLedger || ledgerSummary,
    exchangeSummary: exchangeSummaryOut || exchangeSummary,
    events,
    cashbook,
    logs,
    dashboardStats: fetchDashboardStats(userId),
  };
}

function findUserByUsername(username) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function createUser(username, password, fullName) {
  const db = getDb();
  const hashedPassword = bcrypt.hashSync(password, 10);
  const accountType = 'b2c';
  const info = db.prepare('INSERT INTO users (username, password, full_name, goal_title, goal_amount, waste_threshold, account_type) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(username, hashedPassword, fullName, 'Tiết kiệm mới', 0, 0, accountType);
  
  const userId = Number(info.lastInsertRowid);
  
  db.prepare('INSERT INTO savings (user_id, pig_amount, pig_target) VALUES (?, 0, 10000000)').run(userId);
  db.prepare('INSERT INTO ledger_summary (user_id, income, expense, net, assets, liabilities, equity) VALUES (?, 0, 0, 0, 0, 0, 0)').run(userId);
  db.prepare('INSERT INTO exchange_summary (user_id, available_balance, total_invested, cumulative_return) VALUES (?, 0, 0, 0)').run(userId);

  return userId;
}

function updateUserOnboarding(userId, data) {
  const db = getDb();
  db.prepare('UPDATE users SET goal_title = ?, goal_amount = ?, waste_threshold = ? WHERE id = ?')
    .run(data.goalTitle, data.goalAmount, data.wasteThreshold, userId);
  
  // Also update savings target
  db.prepare('UPDATE savings SET pig_target = ? WHERE user_id = ?').run(data.goalAmount, userId);
}

function updateUserSettings(userId, data) {
  const db = getDb();
  const accountType = data.accountType && ['b2c', 'b2b', 'club', 'team'].includes(data.accountType)
    ? data.accountType
    : undefined;
  if (accountType) {
    db.prepare('UPDATE users SET full_name = ?, goal_title = ?, goal_amount = ?, waste_threshold = ?, account_type = ? WHERE id = ?')
      .run(data.fullName, data.goalTitle, data.goalAmount, data.wasteThreshold, accountType, userId);
  } else {
    db.prepare('UPDATE users SET full_name = ?, goal_title = ?, goal_amount = ?, waste_threshold = ? WHERE id = ?')
      .run(data.fullName, data.goalTitle, data.goalAmount, data.wasteThreshold, userId);
  }
  
  // Also update savings target
  db.prepare('UPDATE savings SET pig_target = ? WHERE user_id = ?').run(data.goalAmount, userId);
}

function transferToSavings(userId, amount) {
  const db = getDb();
  if (!userId) throw new Error('Người dùng không hợp lệ');
  const transferAmount = parseInt(amount, 10);
  if (!Number.isFinite(transferAmount) || transferAmount <= 0) throw new Error('Số tiền không hợp lệ');

  // Update savings table (add to piggybank)
  const info = db.prepare('UPDATE savings SET pig_amount = pig_amount + ? WHERE user_id = ?').run(transferAmount, userId);
  if (info.changes === 0) {
    // If no row exists, create one (though it should exist from createUser)
    db.prepare('INSERT INTO savings (user_id, pig_amount, pig_target) VALUES (?, ?, 10000000)').run(userId, transferAmount);
  }

  // Record a NEGATIVE transaction to deduct from balance (money leaves wallet into savings fund)
  const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM transactions WHERE user_id = ?').get(userId).m;
  db.prepare(`
    INSERT INTO transactions (user_id, sort_order, icon, type, name, tag, amount, saved, saved_amt)
    VALUES (?, ?, '🐷', 'green', 'Chuyển vào Quỹ TPN', '#Tiết_kiệm', ?, 1, ?)
  `).run(userId, maxSort + 1, -transferAmount, transferAmount);

  // Sync exchange summary so new savings are available for investment
  const updatedSavings = db.prepare('SELECT pig_amount, pig_target FROM savings WHERE user_id = ?').get(userId);
  const exchange = syncExchangeFromSavings(userId);
  return {
    pigAmount: updatedSavings.pig_amount,
    pigTarget: updatedSavings.pig_target,
    exchangeSummary: exchange,
    co2ReducedKg: (transferAmount / 50000).toFixed(1),
    projectedInterest: exchange?.projectedInterest || 0,
    expectedAnnualRate: exchange?.expectedAnnualRate || 0.085,
  };
}

function logUserAction(userId, action) {
  const db = getDb();
  db.prepare('INSERT INTO user_logs (user_id, action) VALUES (?, ?)').run(userId, action);
}

// Thêm vào cuối file database.js
function updateBudgetItemPct(key, newPct) {
  const db = getDb();
  const stmt = db.prepare('UPDATE budget_items SET pct = ? WHERE key = ?');
  const info = stmt.run(newPct, key);
  if (info.changes === 0) throw new Error('Không tìm thấy mục ngân sách');
  return { key, pct: newPct };
}
// module.exports.updateBudgetItemPct = updateBudgetItemPct;

module.exports = {
  DB_PATH,
  getDb,
  fetchAppPayload,
  fetchLedgerPaginated,
  insertLedgerRow,
  insertTransaction,
  applyInvestment,
  findUserByUsername,
  createUser,
  updateUserOnboarding,
  updateUserSettings,
  logUserAction,
  updateBudgetItemPct,
  transferToSavings,
  fetchCashbook,
  insertCashbookEntry,
  fetchEvents,
  approveEventBackup,
  fetchDashboardStats,
  recalculateLedgerSummaryFromCashbook,
  classifyCashbookDescription,
  syncExchangeFromSavings,
  getLedgerSpendByCategory,
  precheckExpense,
  createExpenseApproval,
  signExpenseApproval,
  payLedgerRow,
};
