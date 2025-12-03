const accessKeyInput = document.getElementById('accessKey');
const secretKeyInput = document.getElementById('secretKey');
const toggleKeysBtn = document.getElementById('toggleKeys');
const textInput = document.getElementById('textInput');
const csvFileInput = document.getElementById('csvFile');
const queryBtn = document.getElementById('queryBtn');
const downloadBtn = document.getElementById('downloadBtn');
const resultSection = document.getElementById('resultSection');
const progressSection = document.getElementById('progressSection');
const errorMessage = document.getElementById('errorMessage');
const resultBody = document.getElementById('resultBody');

let currentResults = [];

// 탭 전환
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    
    e.target.classList.add('active');
    const tabName = e.target.getAttribute('data-tab');
    document.getElementById(`${tabName}-tab`).classList.add('active');
  });
});

// 비밀번호 표시/숨기기
toggleKeysBtn.addEventListener('click', () => {
  const type = accessKeyInput.type === 'password' ? 'text' : 'password';
  accessKeyInput.type = type;
  secretKeyInput.type = type;
  toggleKeysBtn.textContent = type === 'password' ? '비밀번호 표시' : '비밀번호 숨기기';
});

// CSV 파일 업로드 처리
csvFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/api/upload-csv', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    
    if (response.ok) {
      textInput.value = data.optionIds.join('\n');
      showSuccess('CSV 파일이 로드되었습니다.');
    } else {
      showError(data.error || 'CSV 파일 처리 실패');
    }
  } catch (error) {
    showError('파일 업로드 오류: ' + error.message);
  }
});

// 텍스트 파싱
function parseOptionIds(text) {
  if (!text.trim()) return [];
  
  // 쉼표, 탭, 엔터로 구분
  const ids = text
    .split(/[,\t\n]+/)
    .map(id => id.trim())
    .filter(id => id.length > 0);
  
  return [...new Set(ids)]; // 중복 제거
}

// 에러 메시지 표시
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
  setTimeout(() => {
    errorMessage.style.display = 'none';
  }, 5000);
}

// 성공 메시지 표시
function showSuccess(message) {
  const div = document.createElement('div');
  div.className = 'alert alert-success';
  div.textContent = message;
  div.style.display = 'block';
  errorMessage.parentNode.insertBefore(div, errorMessage);
  setTimeout(() => div.remove(), 3000);
}

// 재고 조회
queryBtn.addEventListener('click', async () => {
  const accessKey = accessKeyInput.value.trim();
  const secretKey = secretKeyInput.value.trim();
  const optionIds = parseOptionIds(textInput.value);

  if (!accessKey || !secretKey) {
    showError('API 키를 입력해주세요.');
    return;
  }

  if (optionIds.length === 0) {
    showError('상품 ID를 입력해주세요.');
    return;
  }

  queryBtn.disabled = true;
  resultSection.style.display = 'none';
  progressSection.style.display = 'block';
  errorMessage.style.display = 'none';

  try {
    const response = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessKey, secretKey, optionIds })
    });

    const data = await response.json();
    
    if (!response.ok) {
      showError(data.error || '조회 실패');
      progressSection.style.display = 'none';
      queryBtn.disabled = false;
      return;
    }

    currentResults = data.results;
    displayResults(currentResults);
  } catch (error) {
    showError('조회 중 오류 발생: ' + error.message);
  } finally {
    progressSection.style.display = 'none';
    queryBtn.disabled = false;
  }
});

// 결과 표시
function displayResults(results) {
  resultBody.innerHTML = '';
  
  const successCount = results.filter(r => r.응답코드 === 'SUCCESS').length;
  const failCount = results.length - successCount;

  document.getElementById('totalCount').textContent = results.length;
  document.getElementById('successCount').textContent = successCount;
  document.getElementById('failCount').textContent = failCount;

  results.forEach(result => {
    const row = document.createElement('tr');
    const isSuccess = result.응답코드 === 'SUCCESS';
    
    row.innerHTML = `
      <td>${result.조회일시}</td>
      <td>${result.옵션ID}</td>
      <td>${result.판매자상품ID}</td>
      <td>${result.재고수량}</td>
      <td>${result.판매가격}</td>
      <td>${result.판매상태}</td>
      <td><span class="status-${isSuccess ? 'success' : 'error'}">${isSuccess ? '✓ 성공' : '✗ 실패'}</span></td>
    `;
    resultBody.appendChild(row);
  });

  resultSection.style.display = 'block';
}

// CSV 다운로드
downloadBtn.addEventListener('click', async () => {
  try {
    const response = await fetch('/api/download-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results: currentResults })
    });

    if (!response.ok) {
      showError('다운로드 실패');
      return;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    showError('다운로드 오류: ' + error.message);
  }
});
