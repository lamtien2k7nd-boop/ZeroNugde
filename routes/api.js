const express = require('express');
const database = require('../db/database-mysql');
const { fetchAppPayload, /* fetchLedgerPaginated, insertLedgerRow, */ insertTransaction, applyInvestment } = database;

const router = express.Router();

router.get('/app', async (req, res) => {
  try {
    res.json(await fetchAppPayload(req.session.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tags', async (req, res) => {
  try {
    const payload = await fetchAppPayload(req.session.userId);
    res.json(payload.tags);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const payload = await fetchAppPayload(req.session.userId);
    res.json(payload.transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/transactions', async (req, res) => {
  try {
    const transaction = await insertTransaction(req.session.userId, req.body);
    res.status(201).json({ success: true, transaction });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/invest', async (req, res) => {
  try {
    const { projectName, amount } = req.body;
    const result = await applyInvestment(req.session.userId, projectName, amount);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/savings', async (req, res) => {
  try {
    const p = await fetchAppPayload(req.session.userId);
    res.json({ pigAmount: p.pigAmount, pigTarget: p.pigTarget });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/savings/transfer', async (req, res) => {
  try {
    const { amount } = req.body;
    const result = await database.transferToSavings(req.session.userId, amount);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// [DISABLED] GET/POST /ledger - sổ hạch toán
// router.get('/ledger', async (req, res) => {
//   try {
//     const page = parseInt(req.query.page, 10) || 1;
//     const limit = parseInt(req.query.limit, 10) || 5;
//     const search = req.query.search || '';
//     const safeLimit = Math.min(Math.max(limit, 1), 50);
//     res.json(await fetchLedgerPaginated(req.session.userId, page, safeLimit, search));
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// router.post('/ledger', async (req, res) => {
//   try {
//     const pageSize = Math.min(Math.max(parseInt(req.body.pageSize, 10) || 5, 1), 50);
//     const row = await insertLedgerRow(req.session.userId, req.body);
//     const view = await fetchLedgerPaginated(req.session.userId, 999999, pageSize);
//     res.status(201).json({ ok: true, id: row.id, ...view });
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// });

// [DISABLED] GET /budget - ngân sách
// router.get('/budget', async (req, res) => {
//   try {
//     const p = await fetchAppPayload(req.session.userId);
//     res.json({ items: p.budgetItems, suggestions: p.suggestions });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

router.get('/projects', async (req, res) => {
  try {
    const p = await fetchAppPayload(req.session.userId);
    res.json(p.projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/exchange', async (req, res) => {
  try {
    const p = await fetchAppPayload(req.session.userId);
    res.json(p.exchangeSummary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// [DISABLED] GET /suppliers - danh bạ nhà cung cấp
// router.get('/suppliers', async (req, res) => {
//   try {
//     const p = await fetchAppPayload(req.session.userId);
//     res.json(p.suppliers);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

router.post('/onboarding', async (req, res) => {
  try {
    await database.updateUserOnboarding(req.session.userId, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update onboarding' });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const { fullName, goalTitle, goalAmount, wasteThreshold, accountType: newAccountType } = req.body;
    
    // Cập nhật settings
    await database.updateUserSettings(req.session.userId, {
      full_name: fullName,
      goal_title: goalTitle,
      goal_amount: goalAmount,
      waste_threshold: wasteThreshold,
      account_type: newAccountType
    });
    
    // Cập nhật session
    if (newAccountType) {
      req.session.accountType = newAccountType;
    }
    
    // Trả về dữ liệu mới
    const updatedUser = await database.findUserByUsername(req.session.username);
    
    res.json({ 
      success: true, 
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        full_name: updatedUser.full_name,
        goal_title: updatedUser.goal_title,
        goal_amount: updatedUser.goal_amount,
        waste_threshold: updatedUser.waste_threshold,
        account_type: updatedUser.account_type
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings: ' + err.message });
  }
});

router.post('/log', async (req, res) => {
  try {
    await database.logUserAction(req.session.userId, req.body.action);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log action' });
  }
});

// [DISABLED] PUT /budget/:key - cập nhật ngân sách
// router.put('/budget/:key', async (req, res) => { ... });

// [DISABLED] POST /budget/check - kiểm tra chi phí dự toán
// router.post('/budget/check', async (req, res) => { ... });

router.get('/dashboard/stats', async (req, res) => {
  try {
    res.json(await database.fetchDashboardStats(req.session.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// // POST /api/events - tạo sự kiện mới
// router.post('/events', async (req, res) => {
//   try {
//     const { name, fundAmount, allocations } = req.body;
//     if (!name || typeof fundAmount !== 'number' || fundAmount <= 0) {
//       return res.status(400).json({ error: 'Thiếu thông tin' });
//     }
//     const userId = req.session.userId;
//     const result = await database.createClubEvent(userId, name, fundAmount, allocations);
//     res.json(result);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // PUT /api/events/:id/close - đóng sự kiện
// router.put('/events/:id/close', async (req, res) => {
//   try {
//     const eventId = parseInt(req.params.id, 10);
//     const userId = req.session.userId;
//     await database.closeClubEvent(userId, eventId);
//     res.json({ success: true });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // PUT /api/events/:id - cập nhật sự kiện (allocations)
// router.put('/events/:id', async (req, res) => {
//   try {
//     const eventId = parseInt(req.params.id, 10);
//     const { allocations } = req.body;
//     const userId = req.session.userId;
//     await database.updateClubEventAllocations(userId, eventId, allocations);
//     res.json({ success: true });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // DELETE /api/events/:id - xóa sự kiện
// router.delete('/events/:id', async (req, res) => {
//   try {
//     const eventId = parseInt(req.params.id, 10);
//     const userId = req.session.userId;
//     await database.deleteClubEvent(userId, eventId);
//     res.json({ success: true });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// [DISABLED] GET/POST /cashbook - sổ quỹ B2B
// router.get('/cashbook', async (req, res) => { ... });
// router.post('/cashbook', async (req, res) => { ... });

// [DISABLED] POST /expense/precheck - B2B kiểm tra ràng buộc chi tiêu
// router.post('/expense/precheck', async (req, res) => { ... });

// [DISABLED] POST /approvals & /approvals/:id/sign - B2B xác nhận kép
// router.post('/approvals', async (req, res) => { ... });
// router.post('/approvals/:id/sign', async (req, res) => { ... });

// [DISABLED] POST /ledger/:id/pay - thanh toán hàng hóa trong sổ
// router.post('/ledger/:id/pay', async (req, res) => { ... });

// router.get('/events', async (req, res) => {
//   try {
//     res.json(await database.fetchEvents(req.session.userId));
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// router.post('/events/:id/backup', async (req, res) => {
//   try {
//     const eventId = parseInt(req.params.id, 10);
//     const { option, amount } = req.body;
//     const event = await database.approveEventBackup(req.session.userId, eventId, option, amount);
//     const ledgerSummary = await database.recalculateLedgerSummaryFromCashbook(req.session.userId);
//     const events = await database.fetchEvents(req.session.userId);
//     res.json({ success: true, event, ledgerSummary, events });
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// });

// [DISABLED] POST /cashbook/classify - tự động phân loại cashbook entry
// router.post('/cashbook/classify', (req, res) => { ... });

// ============================================
// THE PERFECT NO (TPN) ROUTES
// ============================================

// GET /api/tpn/settings - Lấy cài đặt TPN của user
router.get('/tpn/settings', async (req, res) => {
  console.log('🔵 TPN settings endpoint hit, userId:', req.session?.userId);
  try {
    // Kiểm tra đăng nhập
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const settings = await database.getTPNSettings(req.session.userId);
    res.json(settings);
  } catch (err) {
    console.error('Get TPN settings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tpn/settings - Lưu cài đặt TPN của user
router.post('/tpn/settings', async (req, res) => {
  console.log('🔵 TPN settings save hit, userId:', req.session?.userId);
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { interventionLevel, monthlyLimit, warningTrigger, categoryEnabled } = req.body;
    await database.saveTPNSettings(req.session.userId, {
      interventionLevel,
      monthlyLimit,
      warningTrigger,
      categoryEnabled
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Save TPN settings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tpn/monthly-expense - Lấy tổng chi tiêu tháng hiện tại
router.get('/tpn/monthly-expense', async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const expense = await database.getMonthlyExpense(req.session.userId);
    const limit = await database.getMonthlyLimit(req.session.userId);
    res.json({ monthlyExpense: expense, monthlyLimit: limit });
  } catch (err) {
    console.error('Get monthly expense error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tpn/check-warning - Kiểm tra cảnh báo trước khi chi
router.post('/tpn/check-warning', async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { amount, categoryTagId } = req.body;
    const warning = await database.checkExpenseWarning(req.session.userId, amount, categoryTagId);
    res.json({ warning });
  } catch (err) {
    console.error('Check warning error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ocr/balance - Kiểm tra số dư API key
router.get('/balance', async (req, res) => {
  // Lưu ý: Gemini API không có endpoint check balance trực tiếp
  // Bạn cần theo dõi trên Google Cloud Console
  res.json({ 
    message: 'Check usage at https://console.cloud.google.com/apis/credentials',
    apiKeyConfigured: !!process.env.GEMINI_API_KEY
  });
});
module.exports = router;
