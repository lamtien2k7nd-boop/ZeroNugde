const { query } = require('./mysql-connection');
const bcrypt = require('bcrypt');
const sample = require('../lib/sampleData');

// Get database connection (for compatibility)
function getDb() {
  return null; // MySQL uses connection pool, not single connection
}

// Find user by username
function findUserByUsername(username) {
  return new Promise((resolve, reject) => {
    query('SELECT * FROM users WHERE username = ?', [username])
      .then(users => {
        resolve(users[0] || null);
      })
      .catch(reject);
  });
}

// Create user
function createUser(username, password, fullName) {
  const hashedPassword = bcrypt.hashSync(password, 10);
  return new Promise((resolve, reject) => {
    query('INSERT INTO users (username, password, full_name, account_type, has_onboarded) VALUES (?, ?, ?, ?, ?)', 
      [username, hashedPassword, fullName, 'b2c', false])
      .then(result => {
        resolve(result.insertId);
      })
      .catch(reject);
  });
}

// Get cashbook totals
async function getCashbookTotals(userId, filters = {}) {
  let where = 'user_id = ?';
  const params = [userId];

  if (filters.type) {
    where += ' AND type = ?';
    params.push(filters.type);
  }
  if (filters.categoryTag) {
    where += ' AND category_tag = ?';
    params.push(filters.categoryTag);
  }
  if (filters.period) {
    where += ' AND entry_date LIKE ?';
    params.push(`${filters.period}%`);
  }

  const rows = await query(`SELECT type, amount FROM cashbook_entries WHERE ${where}`, params);

  let income = 0;
  let expense = 0;
  rows.forEach((r) => {
    if (r.type === 'THU') income += r.amount;
    else expense += r.amount;
  });

  const latest = await query('SELECT balance_after FROM cashbook_entries WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);
  const fundBalance = latest.length > 0 ? latest[0].balance_after : 0;

  return { income, expense, net: income - expense, fundBalance };
}

// Fetch cashbook entries
async function fetchCashbook(userId, filters = {}) {
  let where = 'user_id = ?';
  const params = [userId];

  if (filters.type) {
    where += ' AND type = ?';
    params.push(filters.type);
  }
  if (filters.categoryTag) {
    where += ' AND category_tag = ?';
    params.push(filters.categoryTag);
  }
  if (filters.period) {
    where += ' AND entry_date LIKE ?';
    params.push(`%${filters.period}%`);
  }

  const entries = await query(`SELECT * FROM cashbook_entries WHERE ${where} ORDER BY id ASC`, params);
  const totals = await getCashbookTotals(userId, filters);

  return { entries, totals };
}

// Add cashbook entry
async function addCashbookEntry(userId, entry) {
  const result = await query(
    `INSERT INTO cashbook_entries (user_id, transaction_id, entry_date, type, amount, category_tag, description, proof_document, balance_after, event_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, entry.transaction_id, entry.entry_date, entry.type, entry.amount, entry.category_tag, entry.description, entry.proof_document, entry.balance_after, entry.event_id]
  );
  return result.insertId;
}

// Insert cashbook entry (alias)
async function insertCashbookEntry(userId, entry) {
  return await addCashbookEntry(userId, entry);
}

// Get events
async function fetchEvents(userId) {
  return await query('SELECT * FROM events WHERE user_id = ? ORDER BY created_at DESC', [userId]);
}

// Add event
// async function addEvent(event) {
//   const result = await query(
//     `INSERT INTO events (user_id, name, total_budget, backup_budget, status)
//      VALUES (?, ?, ?, ?, ?)`,
//     [event.user_id, event.name, event.total_budget, event.backup_budget, event.status]
//   );
//   return result.insertId;
// }

// Get budget items
async function getBudgetItems() {
  return await query('SELECT * FROM budget_items ORDER BY sort_order');
}

// Update budget item percentage
async function updateBudgetItemPct(key, pct) {
  // Validate input
  if (!key || key === 'undefined') {
    throw new Error('Invalid budget key');
  }
  if (typeof pct !== 'number' || isNaN(pct) || pct < 0 || pct > 100) {
    throw new Error('Invalid percentage value');
  }

  // Dùng key_name thay vì id
  await query('UPDATE budget_items SET pct = ? WHERE key_name = ?', [pct, key]);
}

// Classify cashbook description
function classifyCashbookDescription(description) {
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

  const upper = String(description || '').toUpperCase();
  for (const rule of THU_KEYWORDS) {
    if (rule.pattern.test(upper)) return { type: 'THU', category: rule.category };
  }
  for (const rule of CHI_KEYWORDS) {
    if (rule.pattern.test(upper)) return { type: 'CHI', category: rule.category };
  }
  return { type: 'CHI', category: 'Chi khác' };
}

// Recalculate ledger summary from cashbook
async function recalculateLedgerSummaryFromCashbook(userId) {
  const entries = await query('SELECT type, amount FROM cashbook_entries WHERE user_id = ?', [userId]);

  let income = 0;
  let expense = 0;
  entries.forEach((e) => {
    if (e.type === 'THU') income += e.amount;
    else expense += e.amount;
  });

  const net = income - expense;
  const assets = net > 0 ? net : 0;
  const liabilities = net < 0 ? Math.abs(net) : 0;
  const equity = assets - liabilities;

  await query(`
    INSERT INTO ledger_summary (user_id, income, expense, net, assets, liabilities, equity)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE income = VALUES(income), expense = VALUES(expense), net = VALUES(net), assets = VALUES(assets), liabilities = VALUES(liabilities), equity = VALUES(equity)
  `, [userId, income, expense, net, assets, liabilities, equity]);

  return { income, expense, net, assets, liabilities, equity };
}

// Fetch ledger summary
async function fetchLedgerSummary(userId) {
  const summary = await query('SELECT * FROM ledger_summary WHERE user_id = ?', [userId]);
  return summary.length > 0 ? summary[0] : null;
}

// Fetch dashboard stats
async function fetchDashboardStats(userId) {
  const cashbookTotals = await getCashbookTotals(userId);
  const ledgerSummary = await fetchLedgerSummary(userId);

  return {
    income: cashbookTotals.income,
    expense: cashbookTotals.expense,
    net: cashbookTotals.net,
    fundBalance: cashbookTotals.fundBalance,
    ledgerSummary
  };
}

// Log user action
async function logUserAction(userId, action) {
  await query('INSERT INTO user_logs (user_id, action) VALUES (?, ?)', [userId, action]);
}

// Update user settings
async function updateUserSettings(userId, settings) {
  const updates = [];
  const params = [];

  if (settings.full_name !== undefined) {
    updates.push('full_name = ?');
    params.push(settings.full_name);
  }
  if (settings.goal_title !== undefined) {
    updates.push('goal_title = ?');
    params.push(settings.goal_title);
  }
  if (settings.goal_amount !== undefined) {
    updates.push('goal_amount = ?');
    params.push(settings.goal_amount);
  }
  if (settings.waste_threshold !== undefined) {
    updates.push('waste_threshold = ?');
    params.push(settings.waste_threshold);
  }
  if (settings.account_type !== undefined) {
    updates.push('account_type = ?');
    params.push(settings.account_type);
  }

  if (updates.length > 0) {
    params.push(userId);
    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  // Log action
  await logUserAction(userId, 'settings_updated');
}

// Check if user has completed onboarding
async function hasUserOnboarded(userId) {
  const result = await query(
    'SELECT has_onboarded FROM users WHERE id = ?',
    [userId]
  );
  return result.length > 0 ? result[0].has_onboarded === 1 : false;
}

// Mark user as onboarded
async function markUserOnboarded(userId) {
  await query(
    'UPDATE users SET has_onboarded = TRUE, onboarding_completed_at = NOW() WHERE id = ?',
    [userId]
  );
}

// Update user onboarding
async function updateUserOnboarding(userId, data) {
  await updateUserSettings(userId, data);
  // Mark as onboarded after saving onboarding data
  await markUserOnboarded(userId);
}

// Transfer to savings
async function transferToSavings(userId, amount) {
  const transferAmount = parseInt(amount, 10);
  if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
    throw new Error('Số tiền không hợp lệ');
  }

  // Get current savings
  const savings = await query('SELECT * FROM savings WHERE user_id = ?', [userId]);
  const currentSavings = savings.length > 0 ? savings[0].pig_amount : 0;
  const target = savings.length > 0 ? savings[0].pig_target : 0;

  const newSavings = currentSavings + transferAmount;

  // Update savings table
  await query(`
    INSERT INTO savings (user_id, pig_amount, pig_target)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE pig_amount = VALUES(pig_amount)
  `, [userId, newSavings, target]);

  // Record a NEGATIVE transaction to deduct from balance (money leaves wallet into savings fund)
  const result = await query('SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM transactions WHERE user_id = ?', [userId]);
  const nextSort = result.length > 0 ? result[0].max_sort + 1 : 0;
  await query(`
    INSERT INTO transactions (user_id, sort_order, icon, type, name, tag, amount, saved, saved_amt)
    VALUES (?, ?, '🐷', 'green', 'Chuyển vào Quỹ TPN', '#Tiết_kiệm', ?, 1, ?)
  `, [userId, nextSort, -transferAmount, transferAmount]);

  // GET OR CREATE exchange_summary record first
  let exchangeRow = await query('SELECT * FROM exchange_summary WHERE user_id = ?', [userId]);
  let totalInvested = 0;
  
  if (exchangeRow.length === 0) {
    // Create exchange_summary record if it doesn't exist
    await query(
      'INSERT INTO exchange_summary (user_id, available_balance, total_invested, cumulative_return) VALUES (?, ?, ?, ?)',
      [userId, newSavings, 0, 0]
    );
    totalInvested = 0;
  } else {
    totalInvested = exchangeRow[0].total_invested || 0;
  }
  
  // Calculate new available balance
  const newAvailable = Math.max(0, newSavings - totalInvested);
  const rate = 0.085;
  const cumulativeReturn = Math.round(newSavings * rate * 0.15);
  
  // Update exchange_summary
  await query(
    'UPDATE exchange_summary SET available_balance = ?, cumulative_return = ? WHERE user_id = ?',
    [newAvailable, cumulativeReturn, userId]
  );
  
  const exchangeSummary = {
    availableBalance: newAvailable,
    totalInvested: totalInvested,
    cumulativeReturn: cumulativeReturn,
  };

  return {
    pigAmount: newSavings,
    pigTarget: target,
    exchangeSummary,
    co2ReducedKg: (transferAmount / 50000).toFixed(1),
    projectedInterest: Math.round(newSavings * 0.085)
  };
}

// Precheck expense
async function precheckExpense(userId, expense) {
  const summary = await fetchLedgerSummary(userId);
  if (!summary) {
    throw new Error('Không tìm thấy ledger summary');
  }

  const fundBalance = summary.net > 0 ? summary.net : 0;
  const allowedAmount = fundBalance;

  return {
    allowed: expense.amount <= allowedAmount,
    fundBalance,
    requestedAmount: expense.amount
  };
}

// Create expense approval
async function createExpenseApproval(userId, approval) {
  const result = await query(
    `INSERT INTO expense_approvals (user_id, amount, event_id, description, status)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, approval.amount, approval.event_id, approval.description, 'pending']
  );
  return { id: result.insertId, ...approval, status: 'pending' };
}

// Sign expense approval
async function signExpenseApproval(userId, approvalId, signerLabel) {
  const approval = await query('SELECT * FROM expense_approvals WHERE id = ? AND user_id = ?', [approvalId, userId]);
  if (approval.length === 0) {
    throw new Error('Không tìm thấy approval');
  }

  const currentApproval = approval[0];
  if (!currentApproval.approver_1) {
    await query('UPDATE expense_approvals SET approver_1 = ? WHERE id = ?', [signerLabel, approvalId]);
  } else if (!currentApproval.approver_2) {
    await query('UPDATE expense_approvals SET approver_2 = ?, status = ? WHERE id = ?', [signerLabel, 'approved', approvalId]);
  } else {
    throw new Error('Approval đã được ký đầy đủ');
  }

  return await query('SELECT * FROM expense_approvals WHERE id = ?', [approvalId]);
}

// Pay ledger row
async function payLedgerRow(userId, ledgerRowId, payment) {
  const result = await query('UPDATE ledger_rows SET paid = paid + ? WHERE id = ? AND user_id = ?', [payment.amount, ledgerRowId, userId]);
  return { success: true, paid: payment.amount };
}

// Approve event backup
async function approveEventBackup(userId, eventId, option, amount) {
  if (option === 'approve') {
    await query('UPDATE events SET backup_budget = backup_budget + ? WHERE id = ? AND user_id = ?', [amount, eventId, userId]);
  } else {
    await query('UPDATE events SET status = ? WHERE id = ? AND user_id = ?', ['completed', eventId, userId]);
  }

  return await query('SELECT * FROM events WHERE id = ?', [eventId]);
}

// Fetch app payload (simplified version)
async function fetchAppPayload(userId) {
  const user = await query('SELECT username, full_name, created_at, goal_title, goal_amount, waste_threshold, account_type, has_onboarded FROM users WHERE id = ?', [userId]);
  if (user.length === 0) {
    throw new Error('Người dùng không tồn tại');
  }

  const userData = user[0];

  // Global data
  const tags = await query('SELECT id, label, color, green FROM tags ORDER BY sort_order');

  const tpnSettings = await getTPNSettings(userId);


  // Per-user data
  const savings = await query('SELECT pig_amount AS pigAmount, pig_target AS pigTarget FROM savings WHERE user_id = ?', [userId]);

  const transactions = await query('SELECT *, created_at as date FROM transactions WHERE user_id = ? ORDER BY id DESC', [userId]);

  // Fetch budget items from database
  const budgetItems = await query('SELECT id, sort_order, name, key_name as `key`, pct, cap_pct as `limit`, color FROM budget_items ORDER BY sort_order');

  const projects = await query('SELECT * FROM projects ORDER BY sort_order');

  const suppliers = await query('SELECT * FROM suppliers ORDER BY sort_order');

  const suggestions = await query('SELECT text FROM suggestions ORDER BY sort_order');

  const ledgerSummary = await fetchLedgerSummary(userId);

  const exchangeRow = await query('SELECT * FROM exchange_summary WHERE user_id = ?', [userId]);
  const exchangeSummary = exchangeRow.length > 0 ? {
    availableBalance: exchangeRow[0].available_balance,
    totalInvested: exchangeRow[0].total_invested,
    cumulativeReturn: exchangeRow[0].cumulative_return,
  } : null;

  const logs = await query('SELECT action FROM user_logs WHERE user_id = ?', [userId]);

  const events = await fetchEvents(userId);
  const cashbook = await fetchCashbook(userId);

  return {
    user: {
      ...userData,
      has_onboarded: userData.has_onboarded === 1
    },
    tags,
    pigAmount: savings.length > 0 ? savings[0].pigAmount : 0,
    pigTarget: savings.length > 0 ? savings[0].pigTarget : 0,
    transactions,
    budgetItems,
    projects,
    suppliers,
    suggestions,
    ledgerSummary,
    exchangeSummary,
    events,
    cashbook,
    logs,
    dashboardStats: await fetchDashboardStats(userId),
    tpnSettings  // THÊM DÒNG NÀY

  };
}

// Fetch ledger paginated (placeholder)
async function fetchLedgerPaginated(userId, page = 1, limit = 50, search = '') {
  const offset = (page - 1) * limit;
  let sql = `SELECT * FROM ledger_rows WHERE user_id = ?`;
  const params = [userId];

  if (search) {
    sql += ` AND \`desc\` LIKE ?`;
    params.push(`%${search}%`);
  }

  sql += ` ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`;
  const rows = await query(sql, params);
  return rows;
}

// Insert ledger row (placeholder)
async function insertLedgerRow(userId, row) {
  const result = await query(
    `INSERT INTO ledger_rows (user_id, sort_order, date, \`desc\`, cat, qty, price, cogs, partner, esg, paid, fifo_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, row.sort_order, row.date, row.desc, row.cat, row.qty, row.price, row.cogs, row.partner, row.esg, row.paid, JSON.stringify(row.fifo_json || {})]
  );
  return result.insertId;
}

// Insert transaction (placeholder)
async function insertTransaction(userId, transaction) {
  // Ensure no undefined bind parameters are passed to the query.
  // Compute next sort_order and provide sensible defaults for missing fields.
  const nextSortRow = await query('SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM transactions WHERE user_id = ?', [userId]);
  const nextSort = nextSortRow && nextSortRow.length > 0 ? nextSortRow[0].max_sort + 1 : 0;

  const icon = transaction.icon !== undefined ? transaction.icon : null;
  const type = transaction.type !== undefined ? transaction.type : null;
  const name = transaction.name !== undefined ? transaction.name : null;
  const tag = transaction.tag !== undefined ? transaction.tag : null;
  const amount = transaction.amount !== undefined ? transaction.amount : 0;
  const saved = transaction.saved !== undefined ? transaction.saved : false;
  const saved_amt = transaction.saved_amt !== undefined ? transaction.saved_amt : 0;

  const result = await query(
    `INSERT INTO transactions (user_id, sort_order, icon, type, name, tag, amount, saved, saved_amt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, nextSort, icon, type, name, tag, amount, saved ? 1 : 0, saved_amt || null]
  );
  // Return a full transaction object (same shape the frontend expects)
  return {
    id: result.insertId,
    icon: icon || (amount > 0 ? '💰' : '💸'),
    type: type || (amount < 0 ? 'expense' : 'income'),
    name: name || 'Giao dịch',
    tag: tag || '',
    amount: amount || 0,
    saved: Boolean(saved),
    created_at: new Date().toISOString(),
    date: new Date().toISOString(),
  };
}

// Apply investment (placeholder)
async function applyInvestment(userId, projectName, amount) {
  const investAmount = parseInt(amount, 10);
  if (!Number.isFinite(investAmount) || investAmount <= 0) throw new Error('Số tiền đầu tư không hợp lệ');

  const exchangeRows = await query('SELECT available_balance, total_invested, cumulative_return FROM exchange_summary WHERE user_id = ?', [userId]);
  if (exchangeRows.length === 0) throw new Error('Không tìm thấy thông tin sàn vốn');
  
  const exchangeRow = exchangeRows[0];
  if (investAmount > exchangeRow.available_balance) throw new Error('Số dư không đủ để đầu tư');

  const projectRows = await query('SELECT * FROM projects WHERE name = ?', [projectName]);
  if (projectRows.length === 0) throw new Error('Dự án không tồn tại');
  const projectRow = projectRows[0];

  const newAvailable = exchangeRow.available_balance - investAmount;
  const newTotalInvested = (exchangeRow.total_invested || 0) + investAmount;

  await query('UPDATE exchange_summary SET available_balance = ?, total_invested = ? WHERE user_id = ?', [newAvailable, newTotalInvested, userId]);

  // UI assumes 'raised' is in billions (tỷ)
  const raisedDelta = investAmount / 1000000000;
  await query('UPDATE projects SET raised = raised + ? WHERE id = ?', [raisedDelta, projectRow.id]);

  const updatedProjectRows = await query('SELECT * FROM projects WHERE id = ?', [projectRow.id]);

  return {
    exchangeSummary: {
      availableBalance: newAvailable,
      totalInvested: newTotalInvested,
      cumulativeReturn: exchangeRow.cumulative_return,
    },
    project: updatedProjectRows[0],
  };
}

// // Create club event
// async function createClubEvent(userId, name, fundAmount, allocations) {
//   const result = await query(
//     `INSERT INTO club_events (user_id, name, fund_amount, allocations, status)
//      VALUES (?, ?, ?, ?, 'active')`,
//     [userId, name, fundAmount, JSON.stringify(allocations || {})]
//   );
//   return { id: result.insertId, name, fundAmount, allocations, status: 'active' };
// }

// // Close club event
// async function closeClubEvent(userId, eventId) {
//   await query('UPDATE club_events SET status = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', ['closed', eventId, userId]);
//   return { success: true };
// }

// // Update club event allocations
// async function updateClubEventAllocations(userId, eventId, allocations) {
//   await query('UPDATE club_events SET allocations = ? WHERE id = ? AND user_id = ?', [JSON.stringify(allocations || {}), eventId, userId]);
//   return { success: true };
// }

// // Delete club event
// async function deleteClubEvent(userId, eventId) {
//   await query('DELETE FROM club_events WHERE id = ? AND user_id = ?', [eventId, userId]);
//   return { success: true };
// }

// Seed sample data
async function seed(userId) {
  const sampleUserId = userId || 1;

  // Clear existing data for user
  await query('DELETE FROM cashbook_entries WHERE user_id = ?', [sampleUserId]);
  await query('DELETE FROM events WHERE user_id = ?', [sampleUserId]);

  // Insert sample cashbook entries
  for (const entry of sample.cashbookEntries) {
    await query(
      `INSERT INTO cashbook_entries (user_id, transaction_id, entry_date, type, amount, category_tag, description, balance_after)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sampleUserId, entry.transaction_id, entry.entry_date, entry.type, entry.amount, entry.category_tag, entry.description, entry.balance_after]
    );
  }

  // Insert sample events
  for (const event of sample.events) {
    await query(
      `INSERT INTO events (user_id, name, total_budget, backup_budget, status)
       VALUES (?, ?, ?, ?, ?)`,
      [sampleUserId, event.name, event.total_budget, event.backup_budget, event.status]
    );
  }
}
async function getEvents(userId) {
  return await fetchEvents(userId);
}

// ============================================
// THE PERFECT NO SETTINGS - PER USER
// ============================================

// Get TPN settings for a user
async function getTPNSettings(userId) {
  const rows = await query(
    'SELECT intervention_level, monthly_limit, warning_trigger, category_enabled FROM user_tpn_settings WHERE user_id = ?',
    [userId]
  );
  
  if (rows.length === 0) {
    // Return default settings
    return {
      interventionLevel: 'medium',
      monthlyLimit: 3000000,
      warningTrigger: 70,
      categoryEnabled: {}
    };
  }
  
  const row = rows[0];
  return {
    interventionLevel: row.intervention_level,
    monthlyLimit: row.monthly_limit,
    warningTrigger: row.warning_trigger,
    categoryEnabled: row.category_enabled ? JSON.parse(row.category_enabled) : {}
  };
}

// Save TPN settings for a user
async function saveTPNSettings(userId, settings) {
  const { interventionLevel, monthlyLimit, warningTrigger, categoryEnabled } = settings;
  
  await query(
    `INSERT INTO user_tpn_settings (user_id, intervention_level, monthly_limit, warning_trigger, category_enabled)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       intervention_level = VALUES(intervention_level),
       monthly_limit = VALUES(monthly_limit),
       warning_trigger = VALUES(warning_trigger),
       category_enabled = VALUES(category_enabled)`,
    [userId, interventionLevel, monthlyLimit, warningTrigger, JSON.stringify(categoryEnabled || {})]
  );
  
  return { success: true };
}

// Get monthly expense for user (current month)
async function getMonthlyExpense(userId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const periodPattern = `${year}-${month}`;
  
  const rows = await query(
    `SELECT COALESCE(SUM(amount), 0) as total 
     FROM cashbook_entries 
     WHERE user_id = ? 
       AND type = 'CHI' 
       AND entry_date LIKE ?`,
    [userId, `${periodPattern}%`]
  );
  
  return rows[0]?.total || 0;
}

// Get monthly limit for user
async function getMonthlyLimit(userId) {
  const settings = await getTPNSettings(userId);
  return settings.monthlyLimit;
}

// Check if expense should be warned (Rule-based)
async function checkExpenseWarning(userId, amount, categoryTagId) {
  const settings = await getTPNSettings(userId);
  const monthlyExpense = await getMonthlyExpense(userId);
  const monthlyLimit = settings.monthlyLimit;
  
  if (monthlyLimit <= 0) return null;
  
  const expensePercent = (monthlyExpense / monthlyLimit) * 100;
  const remaining = monthlyLimit - monthlyExpense;
  
  // Rule 1: Check if category is enabled
  if (categoryTagId && settings.categoryEnabled[categoryTagId] === false) {
    return null;
  }
  
  // Rule 2: Threshold warning
  if (expensePercent >= settings.warningTrigger) {
    return {
      type: 'threshold',
      title: '💰 Sắp hết hạn mức!',
      message: `Bạn đã chi ${expensePercent.toFixed(0)}% hạn mức tháng này (${monthlyExpense.toLocaleString()}₫ / ${monthlyLimit.toLocaleString()}₫).`,
      suggestion: `Còn ${remaining.toLocaleString()}₫ cho đến cuối tháng. Hãy tiết kiệm nhé!`,
      severity: expensePercent >= 90 ? 'high' : 'medium'
    };
  }
  
  // Rule 3: Large expense warning (>= 30% of remaining)
  if (amount > remaining * 0.3 && remaining > 0) {
    return {
      type: 'large_expense',
      title: '💸 Khoản chi lớn!',
      message: `Khoản chi ${amount.toLocaleString()}₫ chiếm ${Math.round((amount / remaining) * 100)}% số tiền còn lại của tháng.`,
      suggestion: `Bạn có thực sự cần món này không? Còn ${remaining.toLocaleString()}₫ cho đến cuối tháng.`,
      severity: 'high'
    };
  }
  
  return null;
}

// Fetch transactions for a specific date (YYYY-MM-DD)
async function fetchTransactionsByDate(userId, date) {
  // date expected in YYYY-MM-DD
  const rows = await query('SELECT *, created_at as date FROM transactions WHERE user_id = ? AND created_at LIKE ? ORDER BY sort_order', [userId, `${date}%`]);
  return rows;
}

// Fetch totals (income/expense) for a specific date
async function fetchTotalsByDate(userId, date) {
  const rows = await query(`SELECT
      SUM(CASE WHEN type = 'green' OR type = 'income' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type = 'red' OR type = 'expense' THEN amount ELSE 0 END) as expense
    FROM transactions WHERE user_id = ? AND created_at LIKE ?`, [userId, `${date}%`]);
  return rows && rows.length > 0 ? rows[0] : { income: 0, expense: 0 };
}

// Simple search over transactions by name/tag/description
async function searchTransactions(userId, term) {
  if (!term || term.trim() === '') return [];
  const like = `%${term}%`;
  const rows = await query(`SELECT *, created_at as date FROM transactions WHERE user_id = ? AND (name LIKE ? OR tag LIKE ? OR icon LIKE ?) ORDER BY sort_order LIMIT 200`, [userId, like, like, like]);
  return rows;
}

module.exports = {
  getDb,
  findUserByUsername,
  createUser,
  getCashbookTotals,
  fetchCashbook,
  addCashbookEntry,
  insertCashbookEntry,
  // getEvents,
  // fetchEvents,
  // addEvent,
  getBudgetItems,
  updateBudgetItemPct,
  classifyCashbookDescription,
  recalculateLedgerSummaryFromCashbook,
  fetchLedgerSummary,
  fetchDashboardStats,
  logUserAction,
  updateUserSettings,
  updateUserOnboarding,
  transferToSavings,
  precheckExpense,
  createExpenseApproval,
  signExpenseApproval,
  payLedgerRow,
  approveEventBackup,
  fetchAppPayload,
  fetchLedgerPaginated,
  insertLedgerRow,
  insertTransaction,
  applyInvestment,
  getEvents,
  fetchEvents,
  seed,
  getTPNSettings,
  saveTPNSettings,
  getMonthlyExpense,
  getMonthlyLimit,
  checkExpenseWarning,
  // new helpers
  fetchTransactionsByDate,
  fetchTotalsByDate,
  searchTransactions,
  hasUserOnboarded,
  markUserOnboarded
};
