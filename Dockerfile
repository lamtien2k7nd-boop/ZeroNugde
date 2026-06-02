# Dockerfile
FROM python:3.11-slim

# Cài đặt Node.js 20
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Tạo thư mục làm việc
WORKDIR /app

# Copy package.json và cài đặt Node dependencies
COPY package*.json ./
RUN npm install --production

# Copy toàn bộ code Node.js
COPY . .

# Copy và cài đặt Python dependencies cho OCR
COPY ocr-server/ ./ocr-server/
RUN pip install --no-cache-dir -r ocr-server/requirements.txt

# Tạo thư mục tạm cho uploads
RUN mkdir -p /tmp/uploads

# Expose ports
EXPOSE 3000 5001

# Khởi động cả 2 services
CMD node server.js & python ocr-server/ocr_server.py