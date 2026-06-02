const { GoogleGenerativeAI } = require('@google/generative-ai');
const { checkSpendingAlert } = require('./budgetAlertService');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = 'gemini-1.5-flash';

function safeParseJson(text) {
  if (!text || typeof text !== 'string') return null;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    return null;
  }
}

async function classifyExpense(description, amount) {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `
      Bạn là trợ lý phân loại chi tiêu cá nhân. Hãy phân tích giao dịch sau và trả về JSON:
      
      Thông tin giao dịch:
      - Mô tả: "${description}"
      - Số tiền: ${amount.toLocaleString()}₫
      
      Hãy phân loại vào MỘT trong các danh mục sau:
      "Ăn uống", "Mua sắm", "Học tập", "Quần áo", "Giải trí", 
      "Di chuyển", "Hóa đơn", "Sức khỏe", "Nhà cửa", "Khác"
      
      Trả về JSON với cấu trúc:
      {
        "category": "tên danh mục",
        "confidence": 0.0-1.0,
        "reason": "lý do phân loại ngắn gọn",
        "suggestion": "gợi ý tiết kiệm nếu có"
      }
      
      Chỉ trả về JSON, không giải thích thêm.
    `;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    const data = safeParseJson(response);

    if (data && data.category) {
      return {
        category: data.category,
        confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
        reason: data.reason || 'Đã phân loại bằng AI',
        suggestion: data.suggestion || null
      };
    }

    return {
      category: 'Khác',
      confidence: 0.5,
      reason: 'Không thể phân loại',
      suggestion: null
    };
  } catch (err) {
    console.error('AI classify error:', err);
    return {
      category: 'Khác',
      confidence: 0,
      reason: 'Lỗi AI',
      suggestion: null
    };
  }
}

async function financialAdvisor(userQuestion, userContext) {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const contextPrompt = buildContextPrompt(userContext);

    const prompt = `
      Bạn là chuyên gia tư vấn tài chính cá nhân. Hãy phân tích câu hỏi của người dùng dựa trên dữ liệu thực tế.
      
      ${contextPrompt}
      
      Câu hỏi của người dùng: "${userQuestion}"
      
      Hãy trả về JSON với cấu trúc:
      {
        "answer": "câu trả lời chính (tiếng Việt, ngắn gọn, dễ hiểu)",
        "warnings": ["cảnh báo 1", "cảnh báo 2"],
        "suggestions": ["gợi ý 1", "gợi ý 2"],
        "riskLevel": "low/medium/high",
        "actionAdvice": "nên mua / nên cân nhắc / không nên mua"
      }
      
      Chỉ trả về JSON, không giải thích thêm.
    `;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    const data = safeParseJson(response);

    if (data && data.answer) {
      return {
        answer: data.answer,
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
        suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
        riskLevel: data.riskLevel || 'medium',
        actionAdvice: data.actionAdvice || 'cân nhắc'
      };
    }

    return {
      answer: 'Xin lỗi, tôi chưa thể phân tích câu hỏi của bạn. Vui lòng thử lại.',
      warnings: [],
      suggestions: [],
      riskLevel: 'medium',
      actionAdvice: 'cân nhắc'
    };
  } catch (err) {
    console.error('AI advisor error:', err);
    return {
      answer: 'Hiện tại tôi đang gặp sự cố. Vui lòng thử lại sau.',
      warnings: [],
      suggestions: [],
      riskLevel: 'medium',
      actionAdvice: 'cân nhắc'
    };
  }
}

function buildContextPrompt(userContext) {
  const { monthlyBudget, monthlySpent, daysPassed, categories, recentTransactions } = userContext;
  const budgetPercent = monthlyBudget > 0 ? ((monthlySpent / monthlyBudget) * 100).toFixed(0) : 0;
  const remainingBudget = monthlyBudget - monthlySpent;
  const dailySpent = daysPassed > 0 ? monthlySpent / daysPassed : 0;
  const projectedEnd = Math.round(dailySpent * 30);
  const projectedPercent = monthlyBudget > 0 ? ((projectedEnd / monthlyBudget) * 100).toFixed(0) : 0;

  let prompt = `
    Thông tin tài chính hiện tại:
    - Hạn mức tháng: ${monthlyBudget.toLocaleString()}₫
    - Đã chi: ${monthlySpent.toLocaleString()}₫ (${budgetPercent}% hạn mức)
    - Còn lại: ${remainingBudget.toLocaleString()}₫
    - Đã qua ${daysPassed} ngày trong tháng
    - Dự báo cuối tháng: ${projectedEnd.toLocaleString()}₫ (${projectedPercent}% hạn mức)
  `;

  if (Array.isArray(categories) && categories.length > 0) {
    prompt += '\n\nChi tiêu theo danh mục:\n';
    categories.forEach(cat => {
      prompt += `- ${cat.name}: ${cat.spent.toLocaleString()}₫ (${cat.percent}%)\n`;
    });
  }

  if (Array.isArray(recentTransactions) && recentTransactions.length > 0) {
    prompt += '\n\nGiao dịch gần đây:\n';
    recentTransactions.slice(0, 5).forEach(tx => {
      prompt += `- ${tx.name}: ${tx.amount.toLocaleString()}₫ (${tx.category})\n`;
    });
  }

  return prompt;
}

module.exports = {
  classifyExpense,
  financialAdvisor,
  checkSpendingAlert
};
