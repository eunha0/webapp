# 보안 테스트 가이드

**프로젝트**: AI 논술 평가 시스템 (webapp-ai)  
**작성일**: 2025-12-15  
**목적**: 인증 및 권한 관리 보안 개선 사항 검증

---

## 📋 테스트 환경 준비

### 1. 로컬 환경 설정

```bash
# 1. 데이터베이스 초기화
cd /home/user/webapp-ai
npm run db:reset

# 2. 보안 마이그레이션 적용
npm run db:migrate:local

# 3. 빌드
npm run build

# 4. 서비스 시작
pm2 start ecosystem.config.cjs

# 5. 서비스 상태 확인
pm2 logs webapp --nostream
curl http://localhost:3000
```

### 2. 테스트 도구 설치 (선택 사항)

```bash
# OWASP ZAP (침투 테스트 도구)
# https://www.zaproxy.org/download/

# Burp Suite Community Edition
# https://portswigger.net/burp/communitydownload

# curl (이미 설치됨)
curl --version
```

---

## 🧪 테스트 시나리오

### Scenario 1: 회원가입 보안 검증

#### 1.1 비밀번호 정책 테스트

**목적**: 약한 비밀번호 차단 확인

```bash
# 테스트 1: 짧은 비밀번호 (< 8자)
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "테스트사용자",
    "email": "test1@example.com",
    "password": "1234567"
  }'

# 예상 결과: 400 Bad Request
# {"error":"비밀번호가 보안 정책을 만족하지 않습니다","details":["비밀번호는 최소 8자 이상이어야 합니다",...]}
```

```bash
# 테스트 2: 대문자 없는 비밀번호
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "테스트사용자",
    "email": "test2@example.com",
    "password": "password123!"
  }'

# 예상 결과: 400 Bad Request
# {"error":"비밀번호가 보안 정책을 만족하지 않습니다","details":["대문자를 1개 이상 포함해야 합니다"]}
```

```bash
# 테스트 3: 흔한 비밀번호
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "테스트사용자",
    "email": "test3@example.com",
    "password": "Password123!"
  }'

# 예상 결과: 200 OK (정책 만족)
# {"success":true,"user_id":1,"message":"회원가입이 완료되었습니다"}
```

#### 1.2 이메일 검증 테스트

```bash
# 테스트 1: 잘못된 이메일 형식
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "테스트사용자",
    "email": "invalid-email",
    "password": "SecurePass123!"
  }'

# 예상 결과: 400 Bad Request
# {"error":"유효한 이메일 주소를 입력해주세요"}
```

#### 1.3 중복 가입 방지 테스트

```bash
# 테스트 1: 첫 번째 가입 (성공)
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "이중가입",
    "email": "duplicate@example.com",
    "password": "SecurePass123!"
  }'

# 테스트 2: 동일 이메일 재가입 (실패)
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "이중가입2",
    "email": "duplicate@example.com",
    "password": "AnotherPass123!"
  }'

# 예상 결과: 400 Bad Request
# {"error":"이메일이 이미 등록되었거나 비밀번호가 올바르지 않습니다"}
# (보안: 사용자 열거 공격 방지를 위해 모호한 메시지)
```

---

### Scenario 2: 로그인 보안 검증

#### 2.1 Rate Limiting 테스트

**목적**: 브루트포스 공격 방어 확인

```bash
# 자동화된 테스트 스크립트
for i in {1..6}; do
  echo "로그인 시도 #$i"
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test@example.com",
      "password": "WrongPassword'$i'!"
    }'
  echo ""
done

# 예상 결과:
# 시도 1-5: 401 Unauthorized (로그인 실패)
# 시도 6: 429 Too Many Requests (Rate limit 발동)
# {"error":"로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요"}
```

#### 2.2 Timing Attack 방어 테스트

**목적**: 사용자 열거 공격 방지 확인

```bash
# 존재하는 사용자
time curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "duplicate@example.com",
    "password": "WrongPassword!"
  }'

# 존재하지 않는 사용자
time curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nonexistent@example.com",
    "password": "WrongPassword!"
  }'

# 예상 결과: 두 요청의 응답 시간이 유사 (100ms 이내 차이)
# 만약 시간 차이가 크다면 타이밍 공격에 취약
```

#### 2.3 쿠키 보안 설정 확인

```bash
# 정상 로그인
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "duplicate@example.com",
    "password": "SecurePass123!"
  }'

# 예상 결과: Set-Cookie 헤더 확인
# Set-Cookie: session_id=<UUID>; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400
# 
# 검증 항목:
# ✅ HttpOnly 플래그 존재 (JavaScript 접근 차단)
# ✅ Secure 플래그 존재 (HTTPS만 전송)
# ✅ SameSite=Strict (CSRF 방어)
# ✅ Max-Age=86400 (24시간)
```

---

### Scenario 3: 세션 관리 테스트

#### 3.1 세션 만료 테스트

```bash
# 1. 로그인하여 세션 생성
RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "duplicate@example.com",
    "password": "SecurePass123!"
  }')

echo "Login Response: $RESPONSE"

# 2. 쿠키 추출 (실제 환경에서는 브라우저가 자동 처리)
# SESSION_ID=$(echo $RESPONSE | jq -r '.session_id')

# 3. 세션으로 API 호출 (예: 프로필 조회)
curl -X GET http://localhost:3000/api/user/profile \
  -H "X-Session-ID: <SESSION_ID_HERE>" \
  -b "session_id=<SESSION_ID_HERE>"

# 4. 24시간 후 세션 만료 확인 (테스트를 위해 DB에서 expires_at 조작)
# sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/[db-id].sqlite \
#   "UPDATE sessions SET expires_at = datetime('now', '-1 hour') WHERE id = '<SESSION_ID>'"

# 5. 만료된 세션으로 API 호출
curl -X GET http://localhost:3000/api/user/profile \
  -H "X-Session-ID: <SESSION_ID_HERE>"

# 예상 결과: 401 Unauthorized
# {"error":"Unauthorized - Please login"}
```

#### 3.2 로그아웃 테스트

```bash
# 1. 로그인
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "duplicate@example.com",
    "password": "SecurePass123!"
  }'

# 2. 로그아웃
curl -b cookies.txt -X POST http://localhost:3000/api/auth/logout

# 3. 로그아웃 후 세션 사용 시도
curl -b cookies.txt -X GET http://localhost:3000/api/user/profile

# 예상 결과: 401 Unauthorized
```

---

### Scenario 4: CSRF 방어 테스트

**목적**: SameSite 쿠키로 CSRF 공격 차단 확인

#### 4.1 CSRF 공격 시뮬레이션

```html
<!-- attacker.html (공격자 사이트) -->
<!DOCTYPE html>
<html>
<head>
    <title>Free Gift!</title>
</head>
<body>
    <h1>Congratulations! Click to claim your gift!</h1>
    <form id="csrf-attack" action="http://localhost:3000/api/auth/logout" method="POST">
        <input type="hidden" name="session_id" value="victim-session-id">
    </form>
    <script>
        // 자동 제출
        document.getElementById('csrf-attack').submit();
    </script>
</body>
</html>
```

**테스트 방법**:
1. 로그인 상태로 `attacker.html` 열기
2. CSRF 공격 자동 실행
3. 로그아웃 요청이 **차단되어야 함** (SameSite=Strict)

**예상 결과**: 
- 브라우저가 쿠키를 전송하지 않음 (SameSite 정책)
- 로그아웃 실패
- 사용자 세션 유지

---

### Scenario 5: XSS 방어 테스트

#### 5.1 Stored XSS 테스트

```bash
# XSS 페이로드를 포함한 이름으로 회원가입 시도
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "<script>alert(\"XSS\")</script>",
    "email": "xss-test@example.com",
    "password": "SecurePass123!"
  }'

# 프론트엔드에서 이름 렌더링 시 확인:
# ❌ 나쁜 예: <div>{user.name}</div> → XSS 실행
# ✅ 좋은 예: <div>{escapeHtml(user.name)}</div> → 안전한 렌더링
```

#### 5.2 HttpOnly 쿠키 보호 확인

```javascript
// 브라우저 개발자 도구 콘솔에서 실행
console.log(document.cookie);

// 예상 결과: "session_id" 쿠키가 보이지 않아야 함
// (HttpOnly 플래그로 JavaScript 접근 차단)
```

---

### Scenario 6: 보안 로깅 검증

#### 6.1 로그인 이벤트 기록 확인

```bash
# 로그인 성공 후 security_logs 테이블 확인
sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/[db-id].sqlite \
  "SELECT * FROM security_logs WHERE event_type = 'login_success' ORDER BY created_at DESC LIMIT 5;"

# 예상 출력:
# id|event_type|user_id|ip_address|details|created_at
# 1|login_success|1|192.168.1.100|{"email":"test@example.com"}|2025-12-15 10:30:45
```

#### 6.2 실패한 로그인 시도 추적

```bash
# 잘못된 비밀번호로 로그인 시도
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "WrongPassword!"
  }'

# security_logs 확인
sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/[db-id].sqlite \
  "SELECT * FROM security_logs WHERE event_type = 'login_failure' ORDER BY created_at DESC LIMIT 5;"

# 예상 출력:
# id|event_type|user_id|ip_address|details|created_at
# 2|login_failure||192.168.1.100|{"email":"test@example.com"}|2025-12-15 10:31:12
# (user_id가 NULL인 것에 주목 - 실패한 로그인)
```

---

## 🔍 OWASP ZAP 자동화 테스트

### 1. ZAP 설정

```bash
# ZAP 데몬 모드 실행
./zap.sh -daemon -port 8090 -config api.disablekey=true

# 타겟 설정
curl "http://localhost:8090/JSON/core/action/setHomeDirectory/?dir=/path/to/zap-home"
```

### 2. 스파이더 크롤링

```bash
# 전체 사이트 크롤링
curl "http://localhost:8090/JSON/spider/action/scan/?url=http://localhost:3000&maxChildren=10&recurse=true"

# 스파이더 진행 상황 확인
curl "http://localhost:8090/JSON/spider/view/status"
```

### 3. Active Scan (취약점 스캔)

```bash
# 활성 스캔 시작
curl "http://localhost:8090/JSON/ascan/action/scan/?url=http://localhost:3000&recurse=true"

# 스캔 진행 상황
curl "http://localhost:8090/JSON/ascan/view/status"

# 스캔 완료 후 알림 리포트 생성
curl "http://localhost:8090/JSON/core/view/alerts/?baseurl=http://localhost:3000" > zap-alerts.json
```

### 4. 결과 분석

```bash
# High/Medium 심각도 취약점 필터링
jq '.alerts[] | select(.risk == "High" or .risk == "Medium")' zap-alerts.json

# 예상 발견 항목 (개선 전):
# - Missing Anti-CSRF Tokens (개선 후 해결)
# - Cookie Without SameSite Attribute (개선 후 해결)
# - Password Autocomplete in Browser (검토 필요)
# - Cookie Without HttpOnly Flag (개선 후 해결)
```

---

## 📊 테스트 체크리스트

### 회원가입 (Signup)

- [ ] 비밀번호 최소 8자 검증
- [ ] 대문자, 소문자, 숫자, 특수문자 필수 검증
- [ ] 흔한 비밀번호 차단
- [ ] 이메일 형식 검증
- [ ] 중복 이메일 차단
- [ ] 이름 길이 검증 (2-100자)
- [ ] SQL Injection 방어 (Prepared Statement)
- [ ] XSS 방어 (입력 검증)
- [ ] bcrypt 해싱 적용 (12 라운드)
- [ ] 보안 로깅 (signup_success)

### 로그인 (Login)

- [ ] Rate Limiting (5회 실패 시 15분 차단)
- [ ] Timing Attack 방어 (일정한 응답 시간)
- [ ] bcrypt 비밀번호 검증
- [ ] 쿠키 보안 설정 (HttpOnly, Secure, SameSite)
- [ ] 세션 만료 시간 (24시간)
- [ ] IP 주소 기록
- [ ] User-Agent 기록
- [ ] 보안 로깅 (login_success, login_failure)

### 로그아웃 (Logout)

- [ ] 세션 무효화
- [ ] 쿠키 삭제
- [ ] 보안 로깅 (logout)

### 세션 관리

- [ ] UUID 세션 ID 생성
- [ ] 세션 만료 시간 검증
- [ ] 세션 갱신 메커니즘 (향후 구현)
- [ ] 동시 세션 제한 (향후 구현)

### CSRF 방어

- [ ] SameSite 쿠키 속성
- [ ] CSRF 토큰 (향후 구현)

### XSS 방어

- [ ] HttpOnly 쿠키
- [ ] 입력 검증 및 이스케이프
- [ ] Content-Security-Policy 헤더 (향후 구현)

---

## 🚨 발견된 취약점 리포트 템플릿

```markdown
## 취약점 리포트

**ID**: VULN-2025-001  
**심각도**: 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low  
**발견일**: 2025-12-15  
**상태**: Open / In Progress / Resolved

### 설명
[취약점에 대한 상세 설명]

### 재현 방법
[단계별 재현 방법]

### 영향
[잠재적 피해 범위 및 영향]

### 권장 조치
[해결 방법]

### 참고 자료
- OWASP Top 10: [링크]
- CVE-[번호]: [링크]
```

---

## 📞 보안 사고 대응

### 긴급 상황 시 절차

1. **즉시 조치**
   - 의심스러운 활동 발견 시 security_logs 확인
   - 필요 시 계정 임시 차단
   - 모든 세션 무효화

2. **조사**
   - 로그 분석
   - 영향 범위 파악
   - 근본 원인 분석

3. **복구**
   - 취약점 패치
   - 사용자 통보
   - 비밀번호 재설정 안내

4. **사후 조치**
   - 보안 정책 업데이트
   - 재발 방지 대책 수립
   - 정기 보안 점검 강화

---

**다음 단계**: Git 커밋 및 배포
