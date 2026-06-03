// services/hfService.js
const { HfInference } = require('@huggingface/inference');

// Khởi tạo HF client
const hf = new HfInference(process.env.HF_API_TOKEN);

// Model text generation (phi-2 chạy tốt trên CPU, miễn phí)
// Các model khác có thể thử: "microsoft/phi-2", "HuggingFaceH4/zephyr-7b-beta", "google/flan-t5-large"
const TEXT_GEN_MODEL = "microsoft/phi-2";

// Model zero-shot classification cho phân loại nhanh hơn
const ZERO_SHOT_MODEL = "facebook/bart-large-mnli";

// Danh sách category cho zero-shot
const CATEGORIES = ["food", "shopping", "transport", "entertainment", "bills", "health", "education", "other"];

const CATEGORY_MAP = {
    "food": "Ăn uống",
    "shopping": "Mua sắm",
    "transport": "Di chuyển",
    "entertainment": "Giải trí",
    "bills": "Hóa đơn",
    "health": "Sức khỏe",
    "education": "Học tập",
    "other": "Khác"
};

// ============================================
// 1. PHÂN LOẠI CHI TIÊU
// ============================================
async function classifyExpense(description, amount) {
    console.log('🔵 HF classifyExpense called:', { description, amount });
    
    if (!process.env.HF_API_TOKEN) {
        console.log('🟡 Using fallback (no HF token)');
        return fallbackClassify(description);
    }
    
    try {
        // Dùng zero-shot classification (nhanh hơn text generation)
        const result = await hf.zeroShotClassification({
            model: ZERO_SHOT_MODEL,
            inputs: description,
            parameters: { candidate_labels: CATEGORIES }
        });
        
        const topLabel = result[0]?.label || "other";
        const confidence = result[0]?.score || 0.5;
        const category = CATEGORY_MAP[topLabel] || "Khác";
        
        console.log('🟢 HF classify result (zero-shot):', { category, confidence });
        
        return {
            category: category,
            confidence: confidence,
            reason: `Phân loại bởi AI (${topLabel})`
        };
        
    } catch (err) {
        console.error('🔴 Zero-shot error, trying text generation:', err.message);
        
        // Fallback: dùng text generation
        try {
            const prompt = `Phân loại chi tiêu: "${description}" vào một trong các danh mục: Ăn uống, Mua sắm, Di chuyển, Giải trí, Hóa đơn, Sức khỏe, Học tập, Nhà cửa, Khác. Chỉ trả về tên danh mục.`;
            
            const result = await hf.textGeneration({
                model: TEXT_GEN_MODEL,
                inputs: prompt,
                parameters: {
                    max_new_tokens: 20,
                    temperature: 0.3,
                    return_full_text: false
                }
            });
            
            let category = result.generated_text?.trim() || "Khác";
            category = category.replace(/[.,!?]/g, '');
            
            const validCategories = ['Ăn uống', 'Mua sắm', 'Di chuyển', 'Giải trí', 'Hóa đơn', 'Sức khỏe', 'Học tập', 'Nhà cửa', 'Khác'];
            if (!validCategories.includes(category)) category = 'Khác';
            
            return {
                category: category,
                confidence: 0.7,
                reason: `Phân loại bởi AI (${TEXT_GEN_MODEL})`
            };
            
        } catch (genErr) {
            console.error('🔴 Text generation also failed:', genErr.message);
            return fallbackClassify(description);
        }
    }
}

// ============================================
// 2. CHATBOT TƯ VẤN TÀI CHÍNH (FinChain style)
// ============================================
// services/hfService.js - Cập nhật hàm getFinancialAdvice

// services/hfService.js
// Thêm hàm phát hiện và xử lý thu nhập từ câu hỏi

async function detectAndHandleIncome(question, userId) {
    // Pattern nhận diện thu nhập
    const incomePatterns = [
        /lương(?: của tôi)? (?:là|được|khoảng)?\s*(\d{1,3}(?:[.,]\d{3})*)\s*(?:triệu|tr|t)/i,
        /thu nhập(?: của tôi)? (?:là|được|khoảng)?\s*(\d{1,3}(?:[.,]\d{3})*)\s*(?:triệu|tr|t)/i,
        /tôi (?:có|lãnh|nhận) lương (\d{1,3}(?:[.,]\d{3})*)\s*(?:triệu|tr|t)/i,
        /lương (\d{1,3}(?:[.,]\d{3})*)/i,
        /thu nhập (\d{1,3}(?:[.,]\d{3})*)/i
    ];
    
    let amount = null;
    
    for (const pattern of incomePatterns) {
        const match = question.match(pattern);
        if (match) {
            let numStr = match[1].replace(/\./g, '').replace(/,/g, '');
            let num = parseInt(numStr, 10);
            
            // Nếu là triệu (vd: 20tr -> 20,000,000)
            if (question.includes('triệu') || question.includes('tr') || question.includes('t')) {
                num = num * 1000000;
            }
            
            if (num > 0 && num < 1000000000) {
                amount = num;
                break;
            }
        }
    }
    
    if (amount) {
        return {
            detected: true,
            amount: amount,
            message: `Tôi thấy bạn đề cập thu nhập ${amount.toLocaleString()}₫. Bạn có muốn tôi lưu thông tin này làm thu nhập hàng tháng không?`
        };
    }
    
    return { detected: false };
}

async function saveIncomeToDatabase(userId, amount) {
    const { query } = require('../db/mysql-connection');
    
    // Kiểm tra đã có thu nhập tháng này chưa
    const existing = await query(`
        SELECT id FROM cashbook_entries 
        WHERE user_id = ? AND type = 'THU' 
        AND MONTH(entry_date) = MONTH(CURRENT_DATE())
        AND YEAR(entry_date) = YEAR(CURRENT_DATE())
    `, [userId]);
    
    if (existing.length > 0) {
        // Cập nhật
        await query(`
            UPDATE cashbook_entries 
            SET amount = ?, entry_date = CURDATE()
            WHERE user_id = ? AND type = 'THU' 
            AND MONTH(entry_date) = MONTH(CURRENT_DATE())
        `, [amount, userId]);
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
    }
    
    // Cập nhật ledger summary
    const { recalculateLedgerSummaryFromCashbook } = require('../db/database-mysql');
    await recalculateLedgerSummaryFromCashbook(userId);
    
    return true;
}

async function getFinancialAdvice(question, context) {
    console.log('🔵 HF getFinancialAdvice called');
    
    if (!process.env.HF_API_TOKEN) {
        return {
            success: true,
            answer: 'Vui lòng cấu hình HF_API_TOKEN trong file .env để dùng AI chatbot.',
            warnings: [],
            suggestions: []
        };
    }
    
    const { 
        monthlyBudget, monthlySpent, daysPassed, 
        goalTitle, goalAmount, monthlyIncome,
        recentTransactions, wasteThreshold, currentSavings
    } = context;
    
    const spentPercent = monthlyBudget > 0 ? (monthlySpent / monthlyBudget * 100).toFixed(0) : 0;
    const remainingBudget = monthlyBudget - monthlySpent;
    const remainingDays = Math.max(0, 30 - daysPassed);
    
    // Tính số tiền có thể tiết kiệm trong tháng
    const potentialSavings = Math.max(0, monthlyIncome - monthlySpent);
    const currentSavingsAmount = currentSavings || 0;
    const remainingToGoal = Math.max(0, goalAmount - currentSavingsAmount);
    
    // Tính số tháng cần để đạt mục tiêu
    let monthsToGoal = 'không xác định';
    let monthlySavings = 0;
    if (goalAmount > 0 && monthlyIncome > 0) {
        // Khuyến nghị tiết kiệm 20-30% thu nhập
        monthlySavings = monthlyIncome * 0.25;
        if (monthlySavings > 0) {
            monthsToGoal = Math.ceil(remainingToGoal / monthlySavings);
        }
    }
    
    // Lấy 5 giao dịch gần nhất
    const recentTx = recentTransactions?.slice(0, 5).map(t => 
        `- ${t.name}: ${t.amount?.toLocaleString()}₫ (${t.category || 'Khác'})`
    ).join('\n') || 'Chưa có giao dịch nào';
    
    // Prompt được tối ưu cho câu hỏi về chi tiêu với thu nhập thấp
    const prompt = `Bạn là cố vấn tài chính cá nhân chuyên nghiệp. Hãy phân tích và trả lời câu hỏi của người dùng.

=== DỮ LIỆU THỰC TẾ ===
💰 THU NHẬP:
- Thu nhập tháng: ${monthlyIncome?.toLocaleString() || 0}₫
- Đây là toàn bộ số tiền bạn có để chi tiêu và tiết kiệm trong tháng

🎯 MỤC TIÊU TÀI CHÍNH:
- Mục tiêu: ${goalTitle || 'Chưa đặt mục tiêu'}
- Số tiền cần: ${goalAmount?.toLocaleString() || 0}₫
- Đã tiết kiệm được: ${currentSavingsAmount?.toLocaleString() || 0}₫
- Còn thiếu: ${remainingToGoal?.toLocaleString() || 0}₫

💳 CHI TIÊU THÁNG NÀY:
- Đã chi: ${monthlySpent?.toLocaleString() || 0}₫
- Còn lại trong tháng: ${remainingDays} ngày

📊 KHUYẾN NGHỊ CHI TIÊU CHO THU NHẬP ${monthlyIncome?.toLocaleString()}₫:
- Chi tiêu thiết yếu (ăn uống, đi lại, hóa đơn): 50-60% = ${Math.round(monthlyIncome * 0.55).toLocaleString()}₫
- Tiết kiệm cho mục tiêu: 20-30% = ${Math.round(monthlyIncome * 0.25).toLocaleString()}₫
- Giải trí & linh hoạt: 10-20% = ${Math.round(monthlyIncome * 0.15).toLocaleString()}₫

📝 GIAO DỊCH GẦN ĐÂY:
${recentTx}

=== CÂU HỎI ===
"${question}"

=== HƯỚNG DẪN TRẢ LỜI ===
1. Nếu hỏi "nên tiêu thế nào", hãy đưa ra phân bổ cụ thể theo % thu nhập
2. Đưa ra con số CỤ THỂ (ví dụ: "nên tiêu tối đa X đồng/ngày")
3. Nếu thu nhập thấp hơn hạn mức chi, hãy KHUYÊN KHÔNG NÊN chi tiêu vượt quá thu nhập
4. Đưa ra lời khuyên THIẾT THỰC, phù hợp với mức thu nhập
5. KHÔNG khuyến khích chi tiêu vượt quá khả năng

=== CÂU TRẢ LỜI:`;

    try {
        const result = await hf.textGeneration({
            model: TEXT_GEN_MODEL,
            inputs: prompt,
            parameters: {
                max_new_tokens: 500,
                temperature: 0.7,
                do_sample: true,
                top_p: 0.95,
                repetition_penalty: 1.1,
                return_full_text: false
            }
        });
        
        let answer = result.generated_text?.trim() || 'Xin lỗi, tôi chưa thể trả lời câu hỏi này.';
        answer = answer.replace(/=== CÂU TRẢ LỜI:/g, '').trim();
        
        // Tạo warnings và suggestions phù hợp
        const warnings = [];
        const suggestions = [];
        
        // Cảnh báo nếu chi tiêu vượt thu nhập
        if (monthlySpent > monthlyIncome) {
            warnings.push(`🔴 CẢNH BÁO! Bạn đã chi ${monthlySpent.toLocaleString()}₫, vượt quá thu nhập ${monthlyIncome.toLocaleString()}₫!`);
            suggestions.push(`Ngừng chi tiêu ngay và chỉ chi tiêu những thứ thực sự cần thiết.`);
        } else if (monthlySpent > monthlyIncome * 0.7) {
            warnings.push(`⚠️ Bạn đã chi ${Math.round(monthlySpent / monthlyIncome * 100)}% thu nhập.`);
            suggestions.push(`Cố gắng tiết kiệm ${Math.round(monthlyIncome * 0.2).toLocaleString()}₫ trong tháng này.`);
        }
        
        // Gợi ý cụ thể cho thu nhập 2tr
        if (monthlyIncome <= 3000000) {
            suggestions.push(`💡 Với thu nhập ${monthlyIncome.toLocaleString()}₫, mỗi ngày chỉ nên chi tối đa ${Math.round(monthlyIncome / 30).toLocaleString()}₫.`);
            suggestions.push(`🍜 Nên ăn cơm nhà, hạn chế ăn ngoài để tiết kiệm.`);
            suggestions.push(`🚌 Đi xe buýt hoặc xe máy thay vì taxi/Grab để tiết kiệm chi phí đi lại.`);
        }
        
        // Gợi ý về mục tiêu
        if (goalAmount > 0 && monthlyIncome > 0 && monthsToGoal > 0 && monthsToGoal !== 'không xác định') {
            if (monthsToGoal > 24) {
                suggestions.push(`🎯 Mục tiêu ${goalAmount.toLocaleString()}₫ cần ${monthsToGoal} tháng. Hãy cân nhắc tăng thu nhập hoặc giảm mục tiêu.`);
            } else {
                suggestions.push(`🎯 Tiết kiệm ${Math.round(monthlySavings).toLocaleString()}₫/tháng, bạn sẽ đạt mục tiêu sau ${monthsToGoal} tháng.`);
            }
        }
        
        return {
            success: true,
            answer: answer,
            warnings: warnings,
            suggestions: suggestions,
            riskLevel: monthlySpent > monthlyIncome ? 'high' : (monthlySpent > monthlyIncome * 0.7 ? 'medium' : 'low'),
            advice: monthlySpent > monthlyIncome ? 'cần cắt giảm ngay' : 'ổn'
        };
        
    } catch (err) {
        console.error('🔴 HF chat error:', err.message);
        
        // Fallback response khi API lỗi
        let fallbackAnswer = `Với thu nhập ${monthlyIncome?.toLocaleString()}₫/tháng, bạn nên phân bổ:
- Chi tiêu thiết yếu: ${Math.round(monthlyIncome * 0.55).toLocaleString()}₫
- Tiết kiệm: ${Math.round(monthlyIncome * 0.25).toLocaleString()}₫
- Giải trí: ${Math.round(monthlyIncome * 0.15).toLocaleString()}₫

Mỗi ngày chỉ nên chi tối đa ${Math.round(monthlyIncome / 30).toLocaleString()}₫. Hãy ăn cơm nhà, hạn chế grab để tiết kiệm.`;
        
        return {
            success: false,
            answer: fallbackAnswer,
            warnings: monthlySpent > monthlyIncome ? [`Bạn đã chi vượt thu nhập!`] : [],
            suggestions: [`Tiết kiệm ${Math.round(monthlyIncome * 0.25).toLocaleString()}₫/tháng để đạt mục tiêu.`]
        };
    }
}

// ============================================
// 3. CẢNH BÁO CHI TIÊU (Rule-based)
// ============================================
async function checkSpendingAlert(budgetData) {
    console.log('🔵 checkSpendingAlert called');
    
    const { monthlyBudget, monthlySpent, daysPassed, lastWeekSpent, avgWeeklySpent } = budgetData;
    const alerts = [];
    const suggestions = [];
    
    if (monthlyBudget <= 0) {
        return { hasAlert: false, alerts: [], suggestions: [], spentPercent: 0, remainingBudget: 0, remainingDays: 30 };
    }
    
    const spentPercent = (monthlySpent / monthlyBudget) * 100;
    const remainingBudget = monthlyBudget - monthlySpent;
    const remainingDays = Math.max(0, 30 - daysPassed);
    
    // Rule 1: Cảnh báo theo tiến độ thời gian
    const expectedPercent = (daysPassed / 30) * 100;
    if (spentPercent > expectedPercent + 20) {
        alerts.push(`⚠️ Bạn đã chi ${spentPercent.toFixed(0)}% hạn mức trong khi mới qua ${daysPassed} ngày!`);
        suggestions.push(`Hãy cắt giảm ${Math.ceil(spentPercent - expectedPercent)}% chi tiêu trong những ngày tới.`);
    } else if (spentPercent > expectedPercent + 10) {
        alerts.push(`⚠️ Chi tiêu hơi nhanh: ${spentPercent.toFixed(0)}% sau ${daysPassed} ngày.`);
        suggestions.push(`Cố gắng chi tiêu chậm lại để không vượt hạn mức.`);
    }
    
    // Rule 2: Cảnh báo ngưỡng
    if (spentPercent >= 90) {
        alerts.push(`🔴 CẢNH BÁO KHẨN! Bạn đã chi ${spentPercent.toFixed(0)}% hạn mức!`);
        suggestions.push(`Chỉ còn ${remainingBudget.toLocaleString()}₫ cho ${remainingDays} ngày. Hãy tiết kiệm tối đa!`);
    } else if (spentPercent >= 75) {
        alerts.push(`⚠️ Bạn đã chi ${spentPercent.toFixed(0)}% hạn mức.`);
        suggestions.push(`Còn ${remainingBudget.toLocaleString()}₫ cho ${remainingDays} ngày. Mỗi ngày chỉ nên chi ${Math.max(0, Math.round(remainingBudget / remainingDays)).toLocaleString()}₫.`);
    } else if (spentPercent >= 50 && remainingDays <= 15) {
        alerts.push(`⚠️ Đã chi ${spentPercent.toFixed(0)}% hạn mức, còn ${remainingDays} ngày.`);
        suggestions.push(`Hãy cân nhắc các khoản chi còn lại.`);
    }
    
    // Rule 3: Chi tiêu bất thường (tăng đột biến)
    if (avgWeeklySpent > 0 && lastWeekSpent > avgWeeklySpent * 1.5) {
        const increase = ((lastWeekSpent - avgWeeklySpent) / avgWeeklySpent * 100).toFixed(0);
        alerts.push(`⚠️ Chi tiêu tuần này tăng ${increase}% so với trung bình!`);
        suggestions.push(`Kiểm tra lại các khoản chi bất thường tuần này.`);
    }
    
    return {
        hasAlert: alerts.length > 0,
        alerts,
        suggestions,
        spentPercent: spentPercent.toFixed(0),
        remainingBudget,
        remainingDays,
        expectedPercent: expectedPercent.toFixed(0),
        aiAnalysis: alerts.length > 0 ? 'Hãy xem lại các khoản chi không cần thiết và điều chỉnh kế hoạch chi tiêu.' : null
    };
}

// ============================================
// 4. FALLBACK RULE-BASED
// ============================================
function fallbackClassify(description) {
    const lowerDesc = description.toLowerCase();
    
    const rules = [
        { keywords: ['cà phê', 'cafe', 'ăn', 'com', 'phở', 'bún', 'cơm'], category: 'Ăn uống' },
        { keywords: ['mua', 'shop', 'siêu thị', 'chợ', 'giày', 'áo'], category: 'Mua sắm' },
        { keywords: ['taxi', 'grab', 'xe buýt', 'xăng', 'bus', 'train'], category: 'Di chuyển' },
        { keywords: ['netflix', 'game', 'phim', 'cinema', 'vé'], category: 'Giải trí' },
        { keywords: ['điện', 'nước', 'internet', 'wifi', 'bill'], category: 'Hóa đơn' },
        { keywords: ['thuốc', 'bệnh viện', 'khám', 'bác sĩ'], category: 'Sức khỏe' },
        { keywords: ['học phí', 'sách', 'khóa học'], category: 'Học tập' }
    ];
    
    for (const rule of rules) {
        for (const keyword of rule.keywords) {
            if (lowerDesc.includes(keyword)) {
                return { category: rule.category, confidence: 0.7, reason: 'Rule-based' };
            }
        }
    }
    
    return { category: 'Khác', confidence: 0.5, reason: 'Rule-based fallback' };
}

module.exports = {
    classifyExpense,
    detectAndHandleIncome,    // THÊM DÒNG NÀY
    saveIncomeToDatabase,       // THÊM DÒNG NÀY
    getFinancialAdvice,
    checkSpendingAlert
};