const express = require('express');
const multer = require('multer');
const axios = require('axios');
const crypto = require('crypto');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.static('public'));
app.use(express.json());

const API_GATEWAY = "https://api-gateway.coupang.com";

// HMAC 서명 생성 (Python 코드와 동일 로직)
function generateHmac(method, path, accessKey, secretKey, query = "") {
  const now = new Date();
  
  // Python과 동일한 포맷: YYMMDDTHHMMSSz (2자리 연도)
  const year = String(now.getUTCFullYear()).slice(-2);
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const date = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');
  
  const timestamp = `${year}${month}${date}T${hours}${minutes}${seconds}Z`;
  
  const pathAndQuery = path + (query ? `?${query}` : "");
  const message = timestamp + method + pathAndQuery;
  
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('hex');
  
  return {
    'Authorization': `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${timestamp}, signature=${signature}`,
    'Content-Type': 'application/json;charset=UTF-8'
  };
}

// 재고 조회 API
app.post('/api/inventory', async (req, res) => {
  const { accessKey, secretKey, optionIds } = req.body;
  
  if (!accessKey || !secretKey || !optionIds || optionIds.length === 0) {
    return res.status(400).json({ error: '필수 정보가 부족합니다.' });
  }
  
  const results = [];
  const apiDelay = 500; // ms
  
  for (let i = 0; i < optionIds.length; i++) {
    const optionId = optionIds[i].trim();
    if (!optionId) continue;
    
    const method = 'GET';
    const path = `/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/${optionId}/inventories`;
    const url = API_GATEWAY + path;
    
    const headers = generateHmac(method, path, accessKey, secretKey);
    const currentTime = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    
    try {
      const response = await axios.get(url, { headers });
      const data = response.data.data || {};
      
      results.push({
        '조회일시': currentTime,
        '옵션ID': optionId,
        '판매자상품ID': data.sellerItemId || 'N/A',
        '재고수량': data.amountInStock || 'N/A',
        '판매가격': data.salePrice || 'N/A',
        '판매상태': data.onSale ? '판매중' : '판매중지',
        '응답코드': response.data.code || 'SUCCESS',
        '메시지': response.data.message || ''
      });
    } catch (error) {
      const currentTime = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      results.push({
        '조회일시': currentTime,
        '옵션ID': optionId,
        '판매자상품ID': 'ERROR',
        '재고수량': 'ERROR',
        '판매가격': 'ERROR',
        '판매상태': 'ERROR',
        '응답코드': 'ERROR',
        '메시지': error.response?.data?.message || error.message || 'API 호출 실패'
      });
    }
    
    // API 호출 제한 방지
    if (i < optionIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, apiDelay));
    }
  }
  
  res.json({ results });
});

// CSV 다운로드
app.post('/api/download-csv', (req, res) => {
  const { results } = req.body;
  
  if (!results || results.length === 0) {
    return res.status(400).json({ error: 'CSV 데이터가 없습니다.' });
  }
  
  try {
    const csv = stringify(results, {
      header: true,
      encoding: 'utf-8'
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8-sig');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory.csv"');
    res.send('\ufeff' + csv); // BOM 추가
  } catch (error) {
    res.status(500).json({ error: 'CSV 생성 실패' });
  }
});

// CSV 파일 업로드 처리
app.post('/api/upload-csv', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '파일이 없습니다.' });
  }
  
  try {
    const content = req.file.buffer.toString('utf-8');
    const records = parse(content, {
      skip_empty_lines: true,
      trim: true
    });
    
    // 첫 번째 열의 모든 데이터 추출 (헤더 제외)
    const optionIds = records.slice(1).map(row => row[0]).filter(Boolean);
    
    res.json({ optionIds });
  } catch (error) {
    res.status(400).json({ error: 'CSV 파싱 실패: ' + error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
