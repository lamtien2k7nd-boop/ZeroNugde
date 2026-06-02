/**
 * Seed payloads mirrored from public/javascripts/script.js, plus extra rows
 * for API/DB flow testing. Bump SEED_VERSION when you change seed data.
 */
const SEED_VERSION = 4;

const tags = [
  { id: 'plastic', label: '#Nhựa_1_lần', color: '#ef4444', green: false },
  { id: 'food', label: '#Ăn_uống', color: '#f59e0b', green: false },
  { id: 'eco', label: '#Sinh_thái', color: '#22c55e', green: true },
  { id: 'transport', label: '#Di_chuyển', color: '#3b82f6', green: false },
  { id: 'material', label: '#Nguyên_liệu', color: '#8b5cf6', green: true },
  { id: 'event', label: '#Sự_kiện', color: '#ec4899', green: false },
  { id: 'digital', label: '#Kỹ_thuật_số', color: '#06b6d4', green: true },
  { id: 'energy', label: '#Năng_lượng_xanh', color: '#84cc16', green: true },
];

const pigAmount = 1350000;
const pigTarget = 3500000;

const transactions = [
  { icon: '☕', type: 'amber', name: 'Cà phê văn phòng', tag: '#Ăn_uống', amount: -85000, saved: false },
  { icon: '🌿', type: 'green', name: 'Túi vải hữu cơ', tag: '#Sinh_thái', amount: -320000, saved: false },
  { icon: '🛍', type: 'red', name: 'Hộp nhựa dùng 1 lần', tag: '#Nhựa_1_lần', amount: -45000, saved: true, savedAmt: 45000 },
  { icon: '💰', type: 'green', name: 'Doanh thu bán hàng', tag: '#Thu_nhập', amount: 4500000, saved: false },
  { icon: '🚌', type: 'amber', name: 'Xe buýt điện', tag: '#Di_chuyển', amount: -25000, saved: false },
  { icon: '🔋', type: 'green', name: 'Hoàn cashback Open API', tag: '#Cashback', amount: 150000, saved: false },
  { icon: '⚡', type: 'green', name: 'Điện mặt trời mái nhà (hoàn tiền)', tag: '#Năng_lượng_xanh', amount: -120000, saved: true, savedAmt: 80000 },
  { icon: '🎉', type: 'amber', name: 'Teambuilding nửa ngày', tag: '#Sự_kiện', amount: -1850000, saved: false },
  { icon: '📦', type: 'green', name: 'Thuê kho xanh (ưu đãi ESG)', tag: '#Nguyên_liệu', amount: -420000, saved: false },
];

const ledgerData = [
  { date: '15/04', desc: 'Túi giấy kraft nhập kho', cat: 'Bao bì sinh thái', qty: 500, price: 3200, cogs: 3200, partner: 'EcoPack VN', esg: 'A', paid: false, fifo: [{ batch: 'Lô T3', qty: 300, price: 3000 }, { batch: 'Lô T4', qty: 200, price: 3500 }] },
  { date: '14/04', desc: 'Hộp tre ép nhiệt', cat: 'Bao bì sinh thái', qty: 200, price: 8500, cogs: 8200, partner: 'BambooWrap HN', esg: 'A', paid: true, fifo: [{ batch: 'Lô T2', qty: 200, price: 8200 }] },
  { date: '12/04', desc: 'Mực in tái chế', cat: 'Vật tư in ấn', qty: 10, price: 180000, cogs: 165000, partner: 'GreenPrint SG', esg: 'B', paid: false, fifo: [{ batch: 'Lô T1', qty: 5, price: 160000 }, { batch: 'Lô T3', qty: 5, price: 170000 }] },
  { date: '10/04', desc: 'Vải linen hữu cơ (m²)', cat: 'Nguyên liệu may', qty: 80, price: 45000, cogs: 42000, partner: 'OrganicTex TP', esg: 'A', paid: true, fifo: [{ batch: 'Lô T2', qty: 80, price: 42000 }] },
  { date: '08/04', desc: 'Nhãn sinh thái in UV', cat: 'Nhãn mác', qty: 1000, price: 1800, cogs: 1750, partner: 'EcoLabel VN', esg: 'B', paid: false, fifo: [{ batch: 'Lô T1', qty: 600, price: 1700 }, { batch: 'Lô T2', qty: 400, price: 1820 }] },
  { date: '07/04', desc: 'Chai thủy tinh tái sử dụng 500ml', cat: 'Bao bì tái sử dụng', qty: 1200, price: 9500, cogs: 9100, partner: 'ReGlass ĐN', esg: 'A', paid: true, fifo: [{ batch: 'Lô G1', qty: 800, price: 9000 }, { batch: 'Lô G2', qty: 400, price: 9300 }] },
  { date: '05/04', desc: 'Phân bón hữu cơ vi sinh', cat: 'Nông nghiệp bền vững', qty: 40, price: 125000, cogs: 118000, partner: 'SoilLife CT', esg: 'A', paid: false, fifo: [{ batch: 'Lô N1', qty: 40, price: 118000 }] },
];

const budgetItems = [
  { name: 'Marketing tổng', key: 'marketing', pct: 20, limit: 25, color: '#22c55e' },
  { name: 'Thương mại điện tử', key: 'ecom', pct: 7, limit: 12, color: '#22c55e' },
  { name: 'Chi phí vận hành', key: 'ops', pct: 15, limit: 20, color: '#22c55e' },
  { name: 'Nghiên cứu & Phát triển', key: 'rnd', pct: 10, limit: 15, color: '#3b82f6' },
  { name: 'Dự phòng rủi ro', key: 'reserve', pct: 5, limit: 10, color: '#f59e0b' },
  { name: 'Logistics xanh', key: 'green_logistics', pct: 8, limit: 14, color: '#14b8a6' },
];

const projects = [
  { name: 'ZeroPlastic Hà Nội', desc: 'Thu gom & tái chế rác thải nhựa thành hạt nhựa tái sinh cho ngành bao bì.', icon: '♻️', risk: 25, riskLabel: 'Thấp', riskClass: 'risk-low', rate: '8.5', period: '12 tháng', target: 50, raised: 38, esg: 'A' },
  { name: 'SolarFarm Ninh Thuận', desc: 'Nông trại điện mặt trời kết hợp trồng trọt, cung cấp năng lượng sạch.', icon: '☀️', risk: 45, riskLabel: 'Trung bình', riskClass: 'risk-mid', rate: '12.0', period: '24 tháng', target: 200, raised: 145, esg: 'A' },
  { name: 'BioChar Đắk Lắk', desc: 'Sản xuất than sinh học từ phế phẩm nông nghiệp, hấp thụ carbon.', icon: '🌱', risk: 60, riskLabel: 'Trung bình', riskClass: 'risk-mid', rate: '15.5', period: '18 tháng', target: 80, raised: 22, esg: 'B' },
  { name: 'MangroveBlue Cà Mau', desc: 'Trồng rừng ngập mặn kết hợp nuôi trồng thuỷ sản bền vững.', icon: '🌊', risk: 30, riskLabel: 'Thấp', riskClass: 'risk-low', rate: '9.0', period: '36 tháng', target: 120, raised: 95, esg: 'A' },
  { name: 'Gió Bình Thuận Phase 2', desc: 'Turbin gió nhỏ cấp điện cho khu công nghiệp xanh, PPA ưu tiên doanh nghiệp NetZero.', icon: '💨', risk: 55, riskLabel: 'Trung bình', riskClass: 'risk-mid', rate: '11.2', period: '20 tháng', target: 90, raised: 41, esg: 'A' },
];

const suppliers = [
  { name: 'EcoPack Vietnam', cat: 'Bao bì sinh thái', icon: '📦', esg: 'A', price1: '3,200₫/túi', price2: '2,900₫/túi (>500)', minOrder: '200 túi', lead: '5 ngày', cert: 'GRS · ISO 14001' },
  { name: 'BambooWrap Hà Nội', cat: 'Bao bì tre & gỗ', icon: '🎋', esg: 'A', price1: '8,500₫/hộp', price2: '7,800₫/hộp (>100)', minOrder: '50 hộp', lead: '7 ngày', cert: 'FSC · Organic' },
  { name: 'GreenPrint Sài Gòn', cat: 'In ấn sinh thái', icon: '🖨️', esg: 'B', price1: '180,000₫/hộp', price2: '165,000₫/hộp (>5)', minOrder: '5 hộp', lead: '3 ngày', cert: 'EcoMark' },
  { name: 'OrganicTex TP.HCM', cat: 'Vải & sợi tự nhiên', icon: '🧵', esg: 'A', price1: '45,000₫/m²', price2: '40,000₫/m² (>50m²)', minOrder: '20m²', lead: '10 ngày', cert: 'GOTS · Oeko-Tex' },
  { name: 'EcoLabel Vietnam', cat: 'Nhãn & tem dán', icon: '🏷️', esg: 'B', price1: '1,800₫/nhãn', price2: '1,500₫/nhãn (>500)', minOrder: '200 nhãn', lead: '4 ngày', cert: 'FSC' },
  { name: 'BioBag Đà Nẵng', cat: 'Túi phân huỷ sinh học', icon: '🌿', esg: 'A', price1: '2,100₫/túi', price2: '1,800₫/túi (>1000)', minOrder: '500 túi', lead: '6 ngày', cert: 'OK Compost · EN13432' },
  { name: 'ReGlass Đà Nẵng', cat: 'Thủy tinh & tái chế', icon: '🫙', esg: 'A', price1: '9,500₫/chai', price2: '8,900₫/chai (>800)', minOrder: '300 chai', lead: '8 ngày', cert: 'Cradle to Cradle Silver' },
];

const suggestions = [
  { text: 'Tắt ngân sách KOL, chuyển sang bán qua Fanpage tự nhiên (organic)' },
  { text: 'Duy trì ngân sách TMĐT ở mức định mức 7%' },
  { text: 'Chuyển dòng tiền sang chiến dịch O2O (Online-to-Offline)' },
  { text: 'Hợp tác micro-KOL (dưới 50K followers) với chi phí thấp hơn 80%' },
  { text: '[TEST DB] Đối chiếu /api/budget với bảng budget_items sau mỗi lần tăng SEED_VERSION' },
  { text: '[TEST DB] Gọi /api/ledger để xác nhận fifo_json parse đúng (2 dòng nhập kho mới)' },
];

/** From renderLedger() summary in script.js */
const ledgerSummary = {
  income: 26800000,
  expense: 16150000,
  net: 10650000,
  assets: 44100000,
  liabilities: 8950000,
  equity: 35150000,
};

/** From renderExchange() header in script.js */
const exchangeSummary = {
  availableBalance: 16200000,
  totalInvested: 9200000,
  cumulativeReturn: 710000,
};

/** Sổ quỹ CLB — mô phỏng Open Banking */
const cashbookEntries = [
  { transactionId: 'CB-001', date: '01/04/2026', type: 'THU', amount: 12000000, categoryTag: 'Thu quỹ nội bộ', description: 'NOP QUY thang 4 - 48 thanh vien', balanceAfter: 12000000 },
  { transactionId: 'CB-002', date: '05/04/2026', type: 'THU', amount: 5000000, categoryTag: 'Tài trợ', description: 'TAI TRO tu GreenCorp VN', balanceAfter: 17000000 },
  { transactionId: 'CB-003', date: '08/04/2026', type: 'CHI', amount: 3200000, categoryTag: 'Thanh toán NCC', description: 'CHI QUY thanh toan EcoPack VN', proofDocument: 'unc-ecopack-0804.jpg', balanceAfter: 13800000, eventId: 1 },
  { transactionId: 'CB-004', date: '10/04/2026', type: 'CHI', amount: 1700000, categoryTag: 'Chi hậu cần', description: 'CHI TIEN thue am thanh su kien', proofDocument: 'unc-sound-1004.jpg', balanceAfter: 12100000, eventId: 1 },
  { transactionId: 'CB-005', date: '12/04/2026', type: 'THU', amount: 9800000, categoryTag: 'Bán vé sự kiện', description: 'BAN VE Chao Tan SV 2026', balanceAfter: 21900000 },
  { transactionId: 'CB-006', date: '14/04/2026', type: 'CHI', amount: 4250000, categoryTag: 'Thanh toán NCC', description: 'THANH TOAN BambooWrap HN - hop tre', proofDocument: 'unc-bamboo-1404.jpg', balanceAfter: 17650000, eventId: 1 },
  { transactionId: 'CB-007', date: '15/04/2026', type: 'CHI', amount: 2100000, categoryTag: 'Chi truyền thông', description: 'CHI QUY in an banner su kien', proofDocument: 'unc-print-1504.jpg', balanceAfter: 15550000, eventId: 1 },
];

const events = [
  {
    name: 'Chào Tân Sinh Viên 2026',
    totalBudget: 25000000,
    backupBudget: 0,
    status: 'active',
    items: [
      { itemName: 'In ấn banner', plannedAmount: 3500000, actualAmount: 2100000 },
      { itemName: 'Thuê âm thanh', plannedAmount: 2500000, actualAmount: 1700000 },
      { itemName: 'Mua F&B', plannedAmount: 8000000, actualAmount: 0 },
      { itemName: 'Bao bì & quà tặng', plannedAmount: 6000000, actualAmount: 7450000 },
    ],
  },
];

module.exports = {
  SEED_VERSION,
  tags,
  pigAmount,
  pigTarget,
  transactions,
  ledgerData,
  budgetItems,
  projects,
  suppliers,
  suggestions,
  ledgerSummary,
  exchangeSummary,
  cashbookEntries,
  events,
};
