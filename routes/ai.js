const express = require('express');
const router = express.Router();
const { classifyExpense, financialAdvisor } = require('../services/aiService');
const { checkSpendingAlert } = require('../services/budgetAlertService');
const { getMonthlyExpense, getMonthlyLimit } = require('../db/database-mysql');
const { query } = require('../db/mysql-connection');

router.post('/classify', async (req, res) => {
  try {
    const { description, amount } = req.body;
    if (!description) {
      return res.status(400).json({ error: 'Thiếu mô tả chi tiêu' });
    }

    const result = await classifyExpense(description, amount || 0);
    res.json(result);
  } catch (err) {
    console.error('Classify error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { question } = req.body;
    const userId = req.session.userId;

    if (!question) {
      return res.status(400).json({ error: 'Thiếu câu hỏi' });
    }

    const monthlyLimit = await getMonthlyLimit(userId);
    const monthlySpent = await getMonthlyExpense(userId);
    const daysPassed = new Date().getDate();

    const categories = await query(`
      SELECT category_tag as name, SUM(amount) as spent
      FROM cashbook_entries
      WHERE user_id = ? AND type = 'CHI' AND MONTH(entry_date) = MONTH(CURRENT_DATE())
      GROUP BY category_tag
    `, [userId]);

    const categoriesWithPercent = categories.map(cat => ({
      name: cat.name,
      spent: cat.spent,
      percent: monthlyLimit > 0 ? ((cat.spent / monthlyLimit) * 100).toFixed(1) : 0
    }));

    const recentTransactions = await query(`
      SELECT description as name, amount, category_tag as category, entry_date as date
      FROM cashbook_entries
      WHERE user_id = ? AND type = 'CHI'
      ORDER BY entry_date DESC LIMIT 10
    `, [userId]);

    const userContext = {
      monthlyBudget: monthlyLimit,
      monthlySpent,
      daysPassed,
      categories: categoriesWithPercent,
      recentTransactions
    };

    const result = await financialAdvisor(question, userContext);
    res.json(result);
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/check-alert', async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const monthlyLimit = await getMonthlyLimit(userId);
    const monthlySpent = await getMonthlyExpense(userId);
    const daysPassed = new Date().getDate();

    const avgResult = await query(`
      SELECT AVG(daily_spent) as avg_spent
      FROM (
        SELECT SUM(amount) as daily_spent, DATE(entry_date) as day
        FROM cashbook_entries
        WHERE user_id = ? AND type = 'CHI' AND entry_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        GROUP BY DATE(entry_date)
      ) as daily
    `, [userId]);

    const weekResult = await query(`
      SELECT SUM(amount) as week_spent
      FROM cashbook_entries
      WHERE user_id = ? AND type = 'CHI' AND entry_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
    `, [userId]);

    const budgetData = {
      monthlyBudget: monthlyLimit,
      monthlySpent,
      daysPassed,
      recentAvgSpent: avgResult[0]?.avg_spent || 0,
      lastWeekSpent: weekResult[0]?.week_spent || 0
    };

    const result = await checkSpendingAlert(budgetData);
    res.json(result);
  } catch (err) {
    console.error('Check alert error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
