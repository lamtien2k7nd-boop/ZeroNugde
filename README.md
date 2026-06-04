# ZeroNudge - Giải Pháp Quản Lý Tài Chính Thông Minh & Bền Vững

![ZeroNudge Banner](public/images/hero.png)

**ZeroNudge** là một nền tảng quản lý tài chính cá nhân thế hệ mới, kết hợp sức mạnh của AI và định hướng phát triển bền vững (ESG). Chúng tôi không chỉ giúp bạn theo dõi chi tiêu mà còn định hướng bạn tới những thói quen tài chính tích cực và các cơ hội đầu tư xanh.

---

## 🚀 Tính Năng Nổi Bật

### 1. Dashboard Phân Tích Thông Minh
- Theo dõi thu nhập, chi tiêu và dòng tiền theo thời gian thực.
- Biểu đồ trực quan hóa dữ liệu chi tiêu qua `Chart.js`.
- Phân tích xu hướng tài chính cá nhân.

### 2. "The Perfect No" (TPN) & Green Saving
- Công cụ giúp bạn nói "Không" với những khoản chi tiêu không cần thiết.
- Tự động chuyển đổi số tiền tiết kiệm được từ việc cắt giảm chi tiêu vào quỹ đầu tư.
- Theo dõi chuỗi ngày tiết kiệm (Streaks) để tạo động lực.

### 3. Sổ Hạch Toán Thông Minh (Smart Ledger)
- Áp dụng phương pháp FIFO trong quản lý giao dịch.
- Tự động phân loại chi tiêu thông minh.

### 4. Quản Lý Ngân Sách Chiến Lược
- Thiết lập ngưỡng chi tiêu cho từng hạng mục.
- Cảnh báo thông minh khi sắp vượt hạn mức.

### 5. AI & OCR Integration
- **Quét hóa đơn (OCR):** Tự động nhập liệu giao dịch từ ảnh chụp hóa đơn sử dụng `Tesseract.js`.
- **Trợ lý AI:** Tư vấn tài chính và phân tích dữ liệu sử dụng `Google Gemini`, `Groq` và `Hugging Face`.

### 6. Đầu Tư Vi Mô ESG
- Kết nối người dùng với các dự án NetZero và quỹ đầu tư bền vững.
- Biến mỗi khoản tiết kiệm nhỏ thành tác động tích cực cho môi trường.

---

## 🛠 Công Nghệ Sử Dụng

### Backend
- **Main Server:** Node.js, Express.js.
- **OCR Server:** Python (xử lý nhận diện hóa đơn chuyên sâu).
- **Database:** MySQL (Primary), SQLite (Session store).
- **Authentication:** Session-based với `bcrypt` mã hóa mật khẩu.

### Frontend
- **Structure:** HTML5, Semantic HTML.
- **Styling:** Vanilla CSS (Custom design system).
- **Icons:** Lucide Icons.
- **Visualization:** Chart.js.
- **PWA:** Hỗ trợ Progressive Web App, có thể cài đặt trên di động.

### AI & Services
- **Generative AI:** Google Gemini API, Groq SDK.
- **OCR Engine:** Python-based OCR Server + Tesseract.js fallback.
- **Tools:** Multer (File upload), Axios.

---

## 📦 Cài Đặt & Khởi Chạy

### Yêu Cầu Hệ Thống
- Node.js (v18 trở lên)
- MySQL Server

### Các Bước Cài Đặt

1. **Clone repository:**
   ```bash
   git clone https://github.com/lamtien2k7nd-boop/ZeroNudge.git
   cd ZeroNudge
   ```

2. **Cài đặt dependencies:**
   ```bash
   npm install
   ```

3. **Cấu hình môi trường:**
   Tạo file `.env` từ file mẫu `.env.example` và điền các thông tin cần thiết:
   ```env
   PORT=3000
   SESSION_SECRET=your_secret_key
   MYSQL_HOST=localhost
   MYSQL_USER=your_user
   MYSQL_PASSWORD=your_password
   MYSQL_DATABASE=zeronudge
   GEMINI_API_KEY=your_gemini_key
   ```

4. **Chạy ứng dụng:**
   ```bash
   # Chế độ phát triển (với nodemon)
   npm run dev

   # Chế độ production
   npm start
   ```

### Docker (Tùy chọn)
```bash
npm run docker:build
npm run docker:run
```

---

## 📱 PWA Support
ZeroNudge hỗ trợ PWA, cho phép bạn cài đặt ứng dụng trực tiếp lên màn hình chính điện thoại hoặc máy tính thông qua trình duyệt Chrome/Edge/Safari.

---

## 📄 Giấy Phép
Dự án được phân phối dưới giấy phép **ISC**.

---

## 🤝 Liên Hệ
Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với đội ngũ phát triển ZeroNudge.

---
*Kiến tạo tương lai tài chính xanh và bền vững.*
