const express = require('express');
const router = express.Router();
const { query } = require('../db/mysql-connection');
const { getMonthlyExpense, getMonthlyLimit, getTPNSettings } = require('../db/database-mysql');

console.log('🔵 Loading routes/ai.js...');
console.log('🔵 GROQ_API_KEY exists:', !!process.env.GROQ_API_KEY);

// Import service
let groqService;
try {
  groqService = require('../services/groqService');
  console.log('🔵 groqService loaded successfully:', Object.keys(groqService));
} catch (err) {
  console.error('🔴 Failed to load groqService:', err.message);
  // Fallback nếu không có groqService
  groqService = {
    classifyExpense: async (desc, amt) => ({ category: 'Khác', confidence: 0.5, reason: 'Service unavailable' }),
    getFinancialAdvice: async () => ({ answer: 'Service unavailable', warnings: [], suggestions: [] }),
    checkSpendingAlert: async () => ({ hasAlert: false, alerts: [], suggestions: [] })
  };
}

const { classifyExpense, getFinancialAdvice, checkSpendingAlert } = groqService;

// ============================================
// 1. Phân loại chi tiêu tự động
// ============================================
router.post('/classify', async (req, res) => {
  console.log('🔵🔵🔵 POST /classify ROUTE HANDLER CALLED 🔵🔵🔵');
  console.log('Request body:', req.body);
  
  try {
    const { description, amount } = req.body;
    
    if (!description) {
      console.log('🔴 No description provided');
      return res.status(400).json({ error: 'Thiếu mô tả chi tiêu' });
    }
    
    console.log('🟡 Calling classifyExpense with:', { description, amount: amount || 0 });
    const result = await classifyExpense(description, amount || 0);
    console.log('🟢 classifyExpense result:', result);
    
    res.json(result);
  } catch (err) {
    console.error('🔴 Classify error:', err.message);
    console.error('🔴 Stack:', err.stack);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 2. Chatbot tư vấn tài chính
// ============================================
router.post('/chat', async (req, res) => {
  console.log('🔵🔵🔵 POST /chat ROUTE HANDLER CALLED 🔵🔵🔵');
  console.log('Request body:', req.body);
  
  try {
    const { question } = req.body;
    const userId = req.session.userId;
    
    if (!question) {
      console.log('🔴 No question provided');
      return res.status(400).json({ error: 'Thiếu câu hỏi' });
    }
    
    console.log('🟡 Fetching user data for userId:', userId);
    
    // Lấy dữ liệu người dùng
    const monthlyLimit = await getMonthlyLimit(userId);
    const monthlySpent = await getMonthlyExpense(userId);
    const daysPassed = new Date().getDate();
    
    // ========== THÊM: LẤY DỮ LIỆU MỤC TIÊU TÀI CHÍNH ==========
    const { query } = require('../db/mysql-connection');
    const userGoal = await query(`
      SELECT goal_title, goal_amount, waste_threshold 
      FROM users WHERE id = ?
    `, [userId]);
    
    const goalTitle = userGoal[0]?.goal_title || 'Chưa đặt mục tiêu';
    const goalAmount = userGoal[0]?.goal_amount || 0;
    const monthlyIncome = 2000000; // Lấy từ transactions hoặc để user nhập
    // ========================================================
    
    // Lấy chi tiêu theo danh mục
    const categories = await query(`
      SELECT category_tag as name, SUM(amount) as spent 
      FROM cashbook_entries 
      WHERE user_id = ? AND type = 'CHI' 
      AND MONTH(entry_date) = MONTH(CURRENT_DATE())
      GROUP BY category_tag
    `, [userId]);
    
    const categorySpending = categories.map(cat => ({
      name: cat.name || 'Khác',
      spent: cat.spent || 0,
      percent: monthlyLimit > 0 ? ((cat.spent / monthlyLimit) * 100).toFixed(1) : 0
    }));
    
    // Lấy giao dịch gần đây
    const recentTransactions = await query(`
      SELECT description as name, amount, category_tag as category
      FROM cashbook_entries 
      WHERE user_id = ? AND type = 'CHI'
      ORDER BY entry_date DESC LIMIT 10
    `, [userId]);
    
    // Lấy thu nhập tháng này
    const incomeResult = await query(`
      SELECT SUM(amount) as total_income
      FROM cashbook_entries 
      WHERE user_id = ? AND type = 'THU' 
      AND MONTH(entry_date) = MONTH(CURRENT_DATE())
    `, [userId]);
    const monthlyIncomeActual = incomeResult[0]?.total_income || 0;
    
    console.log('📊 User goal:', { goalTitle, goalAmount, monthlyIncomeActual });
    
    const result = await getFinancialAdvice(question, {
      monthlyBudget: monthlyLimit,
      monthlySpent,
      daysPassed,
      categorySpending,
      recentTransactions: recentTransactions.map(t => ({
        name: t.name || 'Giao dịch',
        amount: t.amount || 0,
        category: t.category || 'Khác'
      })),
      // THÊM DỮ LIỆU MỤC TIÊU
      goalTitle,
      goalAmount,
      monthlyIncome: monthlyIncomeActual || 2000000,
      wasteThreshold: userGoal[0]?.waste_threshold || 0,
      userId
    });
    
    console.log('🟢 Chat result:', result);
    res.json(result);
  } catch (err) {
    console.error('🔴 Chat error:', err.message);
    console.error('🔴 Stack:', err.stack);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 3. Kiểm tra cảnh báo chi tiêu
// ============================================
router.get('/check-alert', async (req, res) => {
  console.log('🔵🔵🔵 GET /check-alert ROUTE HANDLER CALLED 🔵🔵🔵');
  
  try {
    const userId = req.session.userId;
    
    const monthlyLimit = await getMonthlyLimit(userId);
    const monthlySpent = await getMonthlyExpense(userId);
    const daysPassed = new Date().getDate();
    
    console.log('📊 Checking alert for user:', { monthlyLimit, monthlySpent, daysPassed });
    
    // Tính chi tiêu trung bình tuần
    const avgResult = await query(`
      SELECT AVG(weekly_spent) as avg_weekly
      FROM (
        SELECT SUM(amount) as weekly_spent, WEEK(entry_date) as week_num
        FROM cashbook_entries 
        WHERE user_id = ? AND type = 'CHI' 
        AND entry_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 8 WEEK)
        GROUP BY WEEK(entry_date)
      ) as weekly
    `, [userId]);
    
    // Tính chi tiêu tuần này
    const weekResult = await query(`
      SELECT SUM(amount) as week_spent
      FROM cashbook_entries 
      WHERE user_id = ? AND type = 'CHI' 
      AND YEARWEEK(entry_date) = YEARWEEK(CURRENT_DATE())
    `, [userId]);
    
    const budgetData = {
      monthlyBudget: monthlyLimit,
      monthlySpent,
      daysPassed,
      lastWeekSpent: weekResult[0]?.week_spent || 0,
      avgWeeklySpent: avgResult[0]?.avg_weekly || 0
    };
    
    console.log('📊 Budget data:', budgetData);
    
    const result = await checkSpendingAlert(budgetData);
    console.log('🟢 Alert result:', result);
    
    res.json(result);
  } catch (err) {
    console.error('🔴 Check alert error:', err.message);
    console.error('🔴 Stack:', err.stack);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 4. Test Groq connection
// ============================================
router.get('/test', async (req, res) => {
  console.log('🔵🔵🔵 GET /test ROUTE HANDLER CALLED 🔵🔵🔵');
  
  try {
    // Test với classifyExpense
    const result = await classifyExpense('Mua cà phê trứng tại quán cafe ABC', 45000);
    res.json({ 
      status: 'ok', 
      message: 'Test route working',
      testResult: result,
      groqApiKeySet: !!process.env.GROQ_API_KEY
    });
  } catch (err) {
    console.error('Test error:', err);
    res.json({ 
      status: 'error', 
      message: err.message,
      groqApiKeySet: !!process.env.GROQ_API_KEY
    });
  }
});

// ============================================
// 5. Health check
// ============================================
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'AI Service',
    timestamp: new Date().toISOString()
  });
});

console.log('🔵 Routes registered:', {
  classify: 'POST /classify',
  chat: 'POST /chat',
  checkAlert: 'GET /check-alert',
  test: 'GET /test',
  health: 'GET /health'
});

module.exports = router;