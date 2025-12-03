import hmac
import hashlib
import time
import csv
import requests
import os
import logging
from datetime import datetime, timezone

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 설정 상수
INPUT_FILE = "option_id.csv"
OUTPUT_FILE = "inventory.csv"
API_DELAY = 0.5  # API 호출 간격 (초)

class CoupangAPI:
    def __init__(self, access_key, secret_key):
        self.access_key = access_key
        self.secret_key = secret_key
        self.api_url = "https://api-gateway.coupang.com"
    
    def generate_hmac(self, method, path, query=""):
        """쿠팡 API HMAC 서명 생성 (JavaScript 코드와 동일한 로직)"""
        timestamp = datetime.now(timezone.utc).strftime('%y%m%d') + 'T' + \
                    datetime.now(timezone.utc).strftime('%H%M%S') + 'Z'
        
        # JavaScript와 동일하게 path + query 조합
        path_and_query = path + (f"?{query}" if query else "")
        message = timestamp + method + path_and_query
        
        signature = hmac.new(
            self.secret_key.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        return {
            'Authorization': f'CEA algorithm=HmacSHA256, access-key={self.access_key}, signed-date={timestamp}, signature={signature}',
            'Content-Type': 'application/json;charset=UTF-8'
        }
    
    def get_inventory(self, vendor_item_id):
        """상품 아이템별 수량/가격/상태 조회"""
        method = "GET"
        path = f"/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendor_item_id}/inventories"
        
        headers = self.generate_hmac(method, path)
        url = self.api_url + path
        
        try:
            response = requests.get(url, headers=headers)
            
            # HTTP 상태 코드 확인
            if response.status_code != 200:
                logger.error(f"HTTP 오류 (옵션ID: {vendor_item_id}, Code: {response.status_code})")
                return None
                
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"API 호출 오류 (옵션ID: {vendor_item_id}): {e}")
            return None

def read_option_ids(csv_file):
    """CSV 파일에서 옵션 ID 읽기"""
    option_ids = []
    try:
        with open(csv_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # CSV 헤더가 '옵션 id', 'option_id', 'vendorItemId' 등 다양할 수 있음
                option_id = row.get('옵션 id') or row.get('option_id') or row.get('vendorItemId')
                if option_id:
                    option_ids.append(option_id.strip())
        logger.info(f"✓ {len(option_ids)}개의 옵션 ID를 읽어왔습니다.")
    except FileNotFoundError:
        logger.error(f"오류: '{csv_file}' 파일을 찾을 수 없습니다.")
    except Exception as e:
        logger.error(f"CSV 파일 읽기 오류: {e}")
    
    return option_ids

def save_to_csv(data_list, output_file):
    """재고 데이터를 CSV로 저장"""
    if not data_list:
        logger.warning("저장할 데이터가 없습니다.")
        return
    
    try:
        with open(output_file, 'w', newline='', encoding='utf-8-sig') as f:
            fieldnames = ['조회일시', '옵션ID', '판매자상품ID', '재고수량', '판매가격', '판매상태', '응답코드', '메시지']
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            
            writer.writeheader()
            writer.writerows(data_list)
        
        logger.info(f"✓ 재고 데이터가 '{output_file}'에 저장되었습니다.")
    except Exception as e:
        logger.error(f"CSV 저장 오류: {e}")

def main():
    # ===== 설정 부분 =====
    # 환경변수에서 다다허아부 API 키 읽기 (보안 강화)
    ACCESS_KEY = os.getenv('COUPANG_ACCESS_KEY', "5d8e37c6-be9b-40e7-a3ca-f723594acd73")
    SECRET_KEY = os.getenv('COUPANG_SECRET_KEY', "e1dd2dc4b64e7a9fb343194b7bfe49936b021501")
    # ====================
    
    logger.info("=" * 60)
    logger.info("쿠팡 재고 조회 프로그램 시작")
    logger.info("=" * 60)
    
    # API 클라이언트 생성
    api = CoupangAPI(ACCESS_KEY, SECRET_KEY)
    
    # 옵션 ID 읽기
    option_ids = read_option_ids(INPUT_FILE)
    if not option_ids:
        return
    
    # 재고 조회 및 데이터 수집
    inventory_data = []
    success_count = 0
    fail_count = 0
    
    for idx, option_id in enumerate(option_ids, 1):
        logger.info(f"\n[{idx}/{len(option_ids)}] 옵션 ID: {option_id} 조회 중...")
        
        result = api.get_inventory(option_id)
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        if result and result.get('code') == 'SUCCESS':
            data = result.get('data', {})
            inventory_data.append({
                '조회일시': current_time,
                '옵션ID': option_id,
                '판매자상품ID': data.get('sellerItemId', 'N/A'),
                '재고수량': data.get('amountInStock', 'N/A'),
                '판매가격': data.get('salePrice', 'N/A'),
                '판매상태': '판매중' if data.get('onSale') else '판매중지',
                '응답코드': result.get('code'),
                '메시지': result.get('message', '')
            })
            success_count += 1
            logger.info(f"  ✓ 성공 - 재고: {data.get('amountInStock')}, 가격: {data.get('salePrice')}원")
        else:
            inventory_data.append({
                '조회일시': current_time,
                '옵션ID': option_id,
                '판매자상품ID': 'ERROR',
                '재고수량': 'ERROR',
                '판매가격': 'ERROR',
                '판매상태': 'ERROR',
                '응답코드': result.get('code', 'ERROR') if result else 'ERROR',
                '메시지': result.get('message', 'API 호출 실패') if result else 'API 호출 실패'
            })
            fail_count += 1
            logger.error(f"  ✗ 실패")
        
        # API 호출 제한 방지를 위한 대기
        if idx < len(option_ids):
            time.sleep(API_DELAY)
    
    # 결과 저장
    logger.info("\n" + "=" * 60)
    save_to_csv(inventory_data, OUTPUT_FILE)
    
    # 요약 정보 출력
    logger.info("\n" + "=" * 60)
    logger.info("조회 완료 요약")
    logger.info("=" * 60)
    logger.info(f"총 조회: {len(option_ids)}개")
    logger.info(f"성공: {success_count}개")
    logger.info(f"실패: {fail_count}개")
    logger.info("=" * 60)

if __name__ == "__main__":
    main()