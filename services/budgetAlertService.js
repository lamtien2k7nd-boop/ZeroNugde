async function checkSpendingAlert(budgetData) {
  const { monthlyBudget, monthlySpent, daysPassed } = budgetData;
  if (monthlyBudget <= 0) {
    return { hasAlert: false, alerts: [], suggestions: [] };
  }

  const spentPercent = (monthlySpent / monthlyBudget) * 100;
  const alerts = [];
  const suggestions = [];

  if (daysPassed <= 10 && spentPercent >= 40) {
    alerts.push(`⚠️ Bạn đã chi ${spentPercent.toFixed(0)}% hạn mức chỉ trong ${daysPassed} ngày đầu tháng!`);
    suggestions.push(`Hãy cắt giảm ${Math.max(0, Math.ceil(spentPercent - 40))}% chi tiêu trong 20 ngày tới để không vượt hạn mức.`);
  }

  if (daysPassed > 10 && daysPassed <= 20 && spentPercent >= 70) {
    alerts.push(`⚠️ Bạn đã chi ${spentPercent.toFixed(0)}% hạn mức sau ${daysPassed} ngày!`);
    const remainingDays = Math.max(1, 30 - daysPassed);
    const allowedDaily = Math.round((monthlyBudget * 0.3) / remainingDays);
    suggestions.push(`Những ngày còn lại, mỗi ngày chỉ nên chi tối đa ${allowedDaily.toLocaleString()}₫.`);
  }

  if (daysPassed > 20 && spentPercent >= 90) {
    alerts.push(`⚠️ Chỉ còn ${Math.max(0, 30 - daysPassed)} ngày nhưng bạn đã chi ${spentPercent.toFixed(0)}% hạn mức!`);
    const remaining = monthlyBudget - monthlySpent;
    suggestions.push(`Còn ${remaining.toLocaleString()}₫ cho ${Math.max(0, 30 - daysPassed)} ngày. Hãy tiết kiệm tối đa!`);
  }

  if (budgetData.recentAvgSpent && budgetData.lastWeekSpent) {
    const increasePercent = budgetData.recentAvgSpent > 0 ? ((budgetData.lastWeekSpent - budgetData.recentAvgSpent) / budgetData.recentAvgSpent) * 100 : 0;
    if (increasePercent > 50) {
      alerts.push(`⚠️ Chi tiêu tuần này tăng ${increasePercent.toFixed(0)}% so với trung bình!`);
      suggestions.push('Kiểm tra lại các khoản chi bất thường và cân nhắc cắt giảm.');
    }
  }

  return {
    hasAlert: alerts.length > 0,
    alerts,
    suggestions,
    spentPercent,
    remainingBudget: monthlyBudget - monthlySpent,
    remainingDays: Math.max(0, 30 - daysPassed)
  };
}

module.exports = { checkSpendingAlert };