# 쿠팡 상품 조회

## CLI version

### 사용법

1. 폴더를 하나 만들고 압축을 푼다.
2. option_id.csv를 열어보면 옵션id리스트가 들어있는데 여기에 직접 입력을 해도 되고, 구글시트나 엑셀에서 옵션아이디 부분만 csv파일로 내보내기해서 option_id.csv로 이름 바꿔도 됨.
option_id.csv파일 맨윗줄은 option_id여야함.
3. 커맨드창을 열어 ic.exe와 option_id.csv파일이 있는 폴더로 이동.
4. ic라고 치고 엔터
5. 좀 기다리면 쿠팡에서 데이터를 가져오면서 성공, 실패 여부가 화면에 표시됨.
6. 다 끝나면 inventory.csv파일에 데이터가 저장되어있을것임.

* 주의: 윈도우 보안앱이 ic.exe파일을 바이러스라며 자꾸 지워서 없애버리니까 당황하지말고 윈도우 보안 및 위협방지 설정에 가서 예외처리 해주면 그담부턴 괜찮음.

---

## Web version

#### 1. 의존성 설치
cd /Users/yhchae/Desktop/wk/ic/web
npm install

### 2. 서버 시작
npm start

### 3. 브라우저 접속
http://localhost:3000

### 사용법

1. CLI버전과 달리, Client key와 Secret key를 직접 입력.
2. 옵션ID는 복붙도 가능, CSV파일 업로드도 가능.
3. 조회 결과는 화면출력(조회 오류 발생시 오류 메시지 출력) 후, CSV파일로 다운로드 가능.
