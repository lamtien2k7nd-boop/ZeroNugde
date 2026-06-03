// services/groqService.js
const Groq = require('groq-sdk');
const { query } = require('../db/mysql-connection');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

const MODEL = 'llama-3.3-70b-versatile';

// ============================================
// LƯU THU NHẬP VÀO DATABASE
// ============================================
async function saveIncomeToDatabase(userId, amount) {
    console.log('💰 saveIncomeToDatabase:', { userId, amount });
    
    try {
        // Kiểm tra đã có thu nhập tháng này chưa
        const existing = await query(`
            SELECT id FROM cashbook_entries 
            WHERE user_id = ? AND type = 'THU' 
            AND MONTH(entry_date) = MONTH(CURRENT_DATE())
            AND YEAR(entry_date) = YEAR(CURRENT_DATE())
        `, [userId]);
        
        if (existing.length > 0) {
            // Cập nhật thu nhập hiện tại
            await query(`
                UPDATE cashbook_entries 
                SET amount = ?, entry_date = CURDATE()
                WHERE user_id = ? AND type = 'THU' 
                AND MONTH(entry_date) = MONTH(CURRENT_DATE())
                AND YEAR(entry_date) = YEAR(CURRENT_DATE())
            `, [amount, userId]);
            console.log('✅ Updated existing income');
        } else {
            // Thêm mới
            const balanceResult = await query(`
                SELECT COALESCE(SUM(CASE WHEN type = 'THU' THEN amount ELSE -amount END), 0) as balance
                FROM cashbook_entries WHERE user_id = ?
            `, [userId]);
            const currentBalance = balanceResult[0]?.balance || 0;
            
            await query(`
                INSERT INTO cashbook_entries (
                    user_id, transaction_id, entry_date, type, amount, 
                    category_tag, description, balance_after
                ) VALUES (?, CONCAT('INC_', DATE_FORMAT(CURDATE(), '%Y%m%d%H%i%s')), 
                CURDATE(), 'THU', ?, 'Lương', 'Thu nhập tháng', ?)
            `, [userId, amount, currentBalance + amount]);
            console.log('✅ Inserted new income');
        }
        
        // Cập nhật ledger summary
        const { recalculateLedgerSummaryFromCashbook } = require('../db/database-mysql');
        await recalculateLedgerSummaryFromCashbook(userId);
        
        return true;
    } catch (err) {
        console.error('❌ Save income error:', err);
        return false;
    }
}

// ============================================
// PHÁT HIỆN VÀ CẬP NHẬT THU NHẬP TỪ CÂU HỎI
// ============================================
async function detectAndUpdateIncome(question, userId, currentIncome) {
    console.log('🔍 detectAndUpdateIncome:', { question, currentIncome });
    
    // Pattern nhận diện thu nhập
    const patterns = [
        /(?:lương|thu nhập|lãnh|lương của tôi)\s*(?:là|được|khoảng)?\s*(\d{1,3}(?:[.,]\d{3})*)\s*(?:triệu|tr|t)/i,
        /tôi (?:lãnh|lương|nhận) (\d{1,3}(?:[.,]\d{3})*)\s*(?:triệu|tr|t)/i,
        /(?:em|mình|tôi) lương (\d{1,3}(?:[.,]\d{3})*)/i,
        /lương (\d{1,3}(?:[.,]\d{3})*)\s*(?:triệu|tr|t)/i,
        /thu nhập (\d{1,3}(?:[.,]\d{3})*)\s*(?:triệu|tr|t)/i
    ];
    
    let newIncome = null;
    
    for (const pattern of patterns) {
        const match = question.match(pattern);
        if (match) {
            let numStr = match[1].replace(/\./g, '').replace(/,/g, '');
            let num = parseInt(numStr, 10);
            
            // Nếu là triệu (vd: 20tr -> 20,000,000)
            if (question.includes('triệu') || question.includes('tr') || question.includes('t')) {
                num = num * 1000000;
            }
            
            if (num > 0 && num < 1000000000) {
                newIncome = num;
                break;
            }
        }
    }
    
    // Nếu phát hiện thu nhập mới và khác với thu nhập hiện tại
    if (newIncome && Math.abs(newIncome - currentIncome) > 1000000) {
        console.log(`🔄 Income changed: ${currentIncome?.toLocaleString()}₫ → ${newIncome.toLocaleString()}₫`);
        const saved = await saveIncomeToDatabase(userId, newIncome);
        return { updated: saved, newIncome, oldIncome: currentIncome };
    }
    
    return { updated: false };
}

// ============================================
// GET FINANCIAL ADVICE (Cập nhật để tự động lưu thu nhập)
// ============================================
async function getFinancialAdvice(question, context) {
    console.log('🔵 Groq getFinancialAdvice called');
    
    let { monthlyIncome, monthlySpent, goalAmount, currentSavings, daysPassed, userId } = context;
    
    // Tự động phát hiện và cập nhật thu nhập
    const incomeUpdate = await detectAndUpdateIncome(question, userId, monthlyIncome);
    
    if (incomeUpdate.updated) {
        monthlyIncome = incomeUpdate.newIncome;
        // Thêm thông báo vào câu trả lời
        const incomeMessage = `📝 Đã cập nhật thu nhập của bạn từ ${incomeUpdate.oldIncome?.toLocaleString()}₫ lên ${monthlyIncome.toLocaleString()}₫.\n\n`;
        
        const spentPercent = monthlyIncome > 0 ? (monthlySpent / monthlyIncome * 100).toFixed(0) : 0;
        const savingAmount = Math.floor(monthlyIncome * 0.25);
        const essentialAmount = Math.floor(monthlyIncome * 0.55);
        const flexibleAmount = Math.floor(monthlyIncome * 0.20);
        
        let monthsToGoal = 'không xác định';
        if (goalAmount > 0 && goalAmount > currentSavings) {
            const remaining = goalAmount - currentSavings;
            monthsToGoal = Math.ceil(remaining / savingAmount);
        }
        
        const prompt = `Bạn là cố vấn tài chính. Dữ liệu người dùng:
- Thu nhập: ${monthlyIncome?.toLocaleString()}₫/tháng (VỪA ĐƯỢC CẬP NHẬT)
- Đã chi: ${monthlySpent?.toLocaleString()}₫
- Mục tiêu: ${goalAmount?.toLocaleString()}₫
- Đã tiết kiệm: ${currentSavings?.toLocaleString()}₫

Câu hỏi: "${question}"

Hãy trả lời bằng tiếng Việt, tự nhiên, thân thiện. Đưa ra phân bổ chi tiêu cụ thể theo tỷ lệ phần trăm.`;
        
        try {
            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: MODEL,
                temperature: 0.7,
                max_tokens: 500,
            });
            
            const answer = completion.choices[0]?.message?.content || 'Xin lỗi, tôi chưa thể trả lời.';
            
            return {
                success: true,
                answer: incomeMessage + answer,
                warnings: [],
                suggestions: [
                    `💰 Thu nhập mới: ${monthlyIncome.toLocaleString()}₫/tháng`,
                    `📊 Tiết kiệm khuyến nghị: ${savingAmount.toLocaleString()}₫/tháng`
                ],
                incomeUpdated: true
            };
        } catch (err) {
            console.error('Groq error:', err);
        }
    }
    
    // Logic bình thường nếu không cập nhật thu nhập
    const spentPercent = monthlyIncome > 0 ? (monthlySpent / monthlyIncome * 100).toFixed(0) : 0;
    const savingAmount = Math.floor(monthlyIncome * 0.25);
    const essentialAmount = Math.floor(monthlyIncome * 0.55);
    const flexibleAmount = Math.floor(monthlyIncome * 0.20);
    const dailyBudget = Math.floor(monthlyIncome / 30);
    
    let monthsToGoal = 'không xác định';
    if (goalAmount > 0 && goalAmount > currentSavings) {
        const remaining = goalAmount - currentSavings;
        monthsToGoal = Math.ceil(remaining / savingAmount);
    }
    
    const prompt = `Bạn là cố vấn tài chính. Dữ liệu người dùng:
- Thu nhập: ${monthlyIncome?.toLocaleString() || 0}₫/tháng
- Đã chi: ${monthlySpent?.toLocaleString() || 0}₫
- Mục tiêu: ${goalAmount?.toLocaleString() || 0}₫
- Đã tiết kiệm: ${currentSavings?.toLocaleString() || 0}₫

Câu hỏi: "${question}"

Hãy trả lời bằng tiếng Việt, tự nhiên, thân thiện, thực tế. Nếu hỏi về chi tiêu, hãy đưa ra phân bổ: 55% cho thiết yếu (${essentialAmount.toLocaleString()}₫), 25% cho tiết kiệm (${savingAmount.toLocaleString()}₫), 20% linh hoạt (${flexibleAmount.toLocaleString()}₫). Mỗi ngày chỉ nên chi ${dailyBudget.toLocaleString()}₫.`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: MODEL,
            temperature: 0.7,
            max_tokens: 500,
        });
        
        const answer = completion.choices[0]?.message?.content || 'Xin lỗi, tôi chưa thể trả lời.';
        
        const warnings = [];
        const suggestions = [];
        
        if (monthlySpent > monthlyIncome) {
            warnings.push(`🔴 Bạn đã chi vượt ${(monthlySpent - monthlyIncome).toLocaleString()}₫!`);
        } else if (spentPercent > 80) {
            warnings.push(`⚠️ Bạn đã chi ${spentPercent}% thu nhập!`);
        }
        
        suggestions.push(`💰 Tiết kiệm ${savingAmount.toLocaleString()}₫/tháng để đạt mục tiêu`);
        suggestions.push(`📅 Mỗi ngày chỉ nên chi ${dailyBudget.toLocaleString()}₫`);
        
        return {
            success: true,
            answer: answer,
            warnings: warnings,
            suggestions: suggestions,
            riskLevel: spentPercent > 80 ? 'high' : (spentPercent > 60 ? 'medium' : 'low'),
            advice: spentPercent > 80 ? 'cần cắt giảm' : (spentPercent > 60 ? 'cân nhắc' : 'ổn')
        };
        
    } catch (err) {
        console.error('Groq chat error:', err);
        return {
            success: false,
            answer: `Xin lỗi, tôi đang gặp sự cố. Vui lòng thử lại sau.`,
            warnings: [],
            suggestions: []
        };
    }
}

// ============================================
// CLASSIFY EXPENSE & CHECK ALERT
// ============================================
async function classifyExpense(description, amount) {
    try {
        const prompt = `Phân loại chi tiêu: "${description}" với số tiền ${amount?.toLocaleString() || 0}₫.
Chọn một danh mục: "Ăn uống", "Mua sắm", "Di chuyển", "Giải trí", "Hóa đơn", "Sức khỏe", "Học tập", "Nhà cửa", "Khác".
Trả về JSON: {"category": "tên danh mục", "confidence": 0.0-1.0}`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: MODEL,
            temperature: 0.3,
            max_tokens: 100,
        });

        const response = completion.choices[0]?.message?.content || '{}';
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            return { category: result.category || 'Khác', confidence: result.confidence || 0.7 };
        }
        return { category: 'Khác', confidence: 0.5 };
    } catch (err) {
        console.error('Groq classify error:', err);
        return { category: 'Khác', confidence: 0.5 };
    }
}

async function checkSpendingAlert(budgetData) {
    const { monthlyBudget, monthlySpent, daysPassed } = budgetData;
    const spentPercent = monthlyBudget > 0 ? (monthlySpent / monthlyBudget * 100) : 0;
    
    const alerts = [];
    if (spentPercent > 80) {
        alerts.push(`⚠️ Bạn đã chi ${spentPercent.toFixed(0)}% hạn mức!`);
    }
    if (daysPassed <= 10 && spentPercent > 40) {
        alerts.push(`⚠️ Bạn đã chi ${spentPercent.toFixed(0)}% chỉ trong ${daysPassed} ngày!`);
    }
    
    return {
        hasAlert: alerts.length > 0,
        alerts: alerts,
        suggestions: [],
        spentPercent: spentPercent.toFixed(0),
        remainingBudget: monthlyBudget - monthlySpent,
        remainingDays: Math.max(0, 30 - daysPassed)
    };
}

module.exports = {
    classifyExpense,
    getFinancialAdvice,
    checkSpendingAlert,
    saveIncomeToDatabase,
    detectAndUpdateIncome
};