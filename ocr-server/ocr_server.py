import os
import re
import io
import easyocr
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

PORT = int(os.environ.get('OCR_PORT', 5001))

# Khởi tạo EasyOCR reader
logger.info("Loading EasyOCR model...")
reader = easyocr.Reader(['vi', 'en'], gpu=False, verbose=False)
logger.info("EasyOCR model loaded!")

def extract_amount(text):
    """Trích xuất số tiền từ text"""
    patterns = [
        r'Tổng cộng[:\s]*([\d.,]+)',
        r'Thành tiền[:\s]*([\d.,]+)',
        r'Total[:\s]*([\d.,]+)',
        r'(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s*(?:đ|vnd|₫)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            amount_str = match.group(1).replace('.', '').replace(',', '')
            try:
                return int(amount_str)
            except:
                pass
    
    numbers = re.findall(r'\b\d{4,}\b', text)
    if numbers:
        return max(int(n) for n in numbers)
    
    return None

def extract_store_name(text, lines):
    """Trích xuất tên cửa hàng"""
    exclude_keywords = ['hotline', 'tel', 'phone', 'email', 'www', 'mst', 'số', 'ngày', 'hóa đơn']
    
    for line in lines[:5]:
        line_lower = line.lower()
        if any(kw in line_lower for kw in exclude_keywords):
            continue
        if len(line) > 3 and len(line) < 100:
            return line.strip()
    
    return None

def extract_date(text):
    """Trích xuất ngày tháng"""
    patterns = [
        r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})',
        r'(\d{4})[/-](\d{1,2})[/-](\d{1,2})',
        r'Ngày[:\s]*(\d{1,2})[/-](\d{1,2})[/-](\d{4})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            groups = match.groups()
            if len(groups) == 3:
                if len(groups[0]) == 4:
                    return f"{groups[0]}-{groups[1].zfill(2)}-{groups[2].zfill(2)}"
                else:
                    return f"{groups[2]}-{groups[1].zfill(2)}-{groups[0].zfill(2)}"
    
    return None

@app.route('/ocr', methods=['POST'])
def ocr_receipt():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image file'}), 400
        
        file = request.files['image']
        
        # Đọc ảnh và xử lý
        image_bytes = file.read()
        image = Image.open(io.BytesIO(image_bytes))
        
        # EasyOCR xử lý trực tiếp
        result = reader.readtext(image_bytes, detail=0, paragraph=False)
        
        full_text = ' '.join(result)
        lines = [line.strip() for line in full_text.split('\n') if line.strip()]
        
        amount = extract_amount(full_text)
        store_name = extract_store_name(full_text, lines)
        date = extract_date(full_text)
        
        logger.info(f"OCR Result: amount={amount}, store={store_name}, date={date}")
        
        return jsonify({
            'success': True,
            'amount': amount,
            'storeName': store_name,
            'date': date,
            'rawText': full_text[:500]
        })
        
    except Exception as e:
        logger.error(f"OCR error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'model_loaded': True})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT)