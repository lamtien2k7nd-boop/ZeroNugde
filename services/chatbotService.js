const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function getFinancialAdvice(userQuestion, userContext) {
  const { monthlyBudget, monthlySpent, daysPassed, recentTransactions } = userContext;
  
  const spentPercent = monthlyBudget > 0 ? (monthlySpent / monthlyBudget * 100).toFixed(0) : 0;
  const remaining = monthlyBudget - monthlySpent;
  
  const prompt = `
    Bạn là cố vấn tài chính cá nhân chuyên nghiệp. Hãy trả lời câu hỏi của người dùng dựa trên dữ liệu thực tế.
    
    DỮ LIỆU NGƯỜI DÙNG:
    - Hạn mức tháng: ${monthlyBudget.toLocaleString()}₫
    - Đã chi: ${monthlySpent.toLocaleString()}₫ (${spentPercent}%)
    - Còn lại: ${remaining.toLocaleString()}₫
    - Ngày trong tháng: ${daysPassed}/30
    - Giao dịch gần đây: ${recentTransactions.map(t => `${t.name} (${t.amount.toLocaleString()}₫)`).join(', ')}
    
    CÂU HỎI: "${userQuestion}"
    
    Hãy trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu, và đưa ra lời khuyên cụ thể.
    Nếu câu hỏi liên quan đến mua sắm, hãy phân tích xem có nên mua không dựa trên số tiền còn lại.
  `;
  
  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 500,
    });
    
    return {
      success: true,
      answer: completion.choices[0]?.message?.content || 'Xin lỗi, tôi chưa thể trả lời câu hỏi này.',
      warnings: spentPercent > 80 ? [`⚠️ Bạn đã chi ${spentPercent}% hạn mức!`] : [],
      suggestions: spentPercent > 70 ? ['Cân nhắc cắt giảm chi tiêu những ngày cuối tháng.'] : []
    };
  } catch (err) {
    console.error('Groq chatbot error:', err);
    return {
      success: false,
      answer: 'Hiện tại tôi đang gặp sự cố. Vui lòng thử lại sau.',
      warnings: [],
      suggestions: []
    };
  }
}

module.exports = { getFinancialAdvice };