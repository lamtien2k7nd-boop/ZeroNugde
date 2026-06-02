const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const router = express.Router();
const upload = multer({ dest: '/tmp/uploads/' });

// Trong Docker container, OCR server chạy ở localhost:5001
const OCR_SERVER_URL = process.env.OCR_SERVER_URL || 'http://localhost:5001';

router.post('/receipt', upload.single('image'), async (req, res) => {
  let tempFilePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    tempFilePath = req.file.path;

    console.log('Processing receipt:', req.file.originalname);
    console.log('Sending to OCR server:', OCR_SERVER_URL);

    const formData = new FormData();
    formData.append('image', fs.createReadStream(tempFilePath));

    const response = await axios.post(`${OCR_SERVER_URL}/ocr`, formData, {
      headers: { ...formData.getHeaders() },
      timeout: 30000
    });

    // Xóa file tạm
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    res.json(response.data);
    
  } catch (err) {
    console.error('OCR error:', err.message);
    
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    
    // Kiểm tra OCR server có đang chạy không
    if (err.code === 'ECONNREFUSED') {
      res.status(500).json({ 
        error: 'OCR server not running. Please try again later.' 
      });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Health check - kiểm tra cả 2 services
router.get('/health', async (req, res) => {
  try {
    const ocrHealth = await axios.get(`${OCR_SERVER_URL}/health`, { timeout: 3000 });
    res.json({ 
      status: 'ok', 
      ocrServer: ocrHealth.data,
      nodeServer: 'running'
    });
  } catch (err) {
    res.json({ 
      status: 'degraded', 
      ocrServer: 'offline',
      nodeServer: 'running',
      error: err.message
    });
  }
});

module.exports = router;