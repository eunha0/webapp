# 세션 인증 문제 해결 리포트

## 📅 수정 일자
**2024-12-16**

---

## 🐛 발견된 문제

### 사용자 증상
로그인 후 즉시 세션이 만료되어 서비스 사용 불가:

1. **로그인 성공** → "환영합니다, 테스트 선생님님" 메시지 표시
2. **"확인" 버튼 클릭** → "세션이 만료되었습니다. 다시 로그인해주세요" 에러
3. **반복 로그인** → 동일한 문제 지속

### 기술적 증상
```bash
# 로그인 성공
POST /api/auth/login 200 OK

# 과제 목록 조회 실패
GET /api/assignments 401 Unauthorized

# 에러 로그
Error: n.req.cookie is not a function
TypeError: n.req.cookie is not a function
```

---

## 🔍 근본 원인 분석

### 1. Hono 쿠키 API 사용 오류
**문제 코드** (`src/middleware/auth.ts`):
```typescript
// ❌ 잘못된 방법 (Hono v4에서 작동하지 않음)
export async function getUserFromSession(c: Context) {
  const sessionId = c.req.cookie('session_id')  // ← c.req.cookie는 존재하지 않음
  // ...
}
```

**올바른 코드**:
```typescript
// ✅ Hono v4 올바른 방법
import { getCookie } from 'hono/cookie'

export async function getUserFromSession(c: Context) {
  const sessionId = getCookie(c, 'session_id')  // ← getCookie 헬퍼 사용
  // ...
}
```

### 2. 중복 함수 정의 문제
**문제**: `src/index.tsx`에 `getUserFromSession`과 `requireAuth` 함수가 중복 정의됨

```typescript
// ❌ index.tsx에 중복 정의 (헤더만 확인, 쿠키 미지원)
async function getUserFromSession(c: any) {
  const sessionId = c.req.header('X-Session-ID')  // 헤더만 확인
  if (!sessionId) return null
  // ...
}
```

**해결**:
```typescript
// ✅ middleware/auth.ts에서 import
import { getUserFromSession, requireAuth } from './middleware/auth'
```

### 3. 라우트 충돌 문제
**문제**: submissions 라우트가 `/api`로 마운트되어 `/api/assignments`를 가로챔

```typescript
// ❌ 라우트 충돌
app.route('/api', submissions)  // /api/* 모두 가로챔
app.get('/api/assignments', ...)  // 도달 불가능
```

**해결**:
```typescript
// ✅ 구체적인 경로로 변경
app.route('/api/submission', submissions)  // /api/submission/* 만 처리
app.get('/api/assignments', ...)  // 정상 작동
```

---

## ✅ 해결 방법

### 1단계: middleware/auth.ts 수정

```typescript
// 파일: src/middleware/auth.ts

import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'  // ← getCookie import 추가
import type { Bindings } from '../types'

export async function getUserFromSession(c: Context<{ Bindings: Bindings }>): Promise<User | null> {
  // 쿠키를 먼저 확인, 없으면 헤더 확인 (API 호환성)
  let sessionId = getCookie(c, 'session_id')  // ← getCookie 사용
  if (!sessionId) {
    sessionId = c.req.header('X-Session-ID')
  }
  if (!sessionId) return null
  
  const db = c.env.DB
  const session = await db.prepare(
    'SELECT s.*, u.id as user_id, u.name, u.email FROM sessions s 
     JOIN users u ON s.user_id = u.id 
     WHERE s.id = ? AND s.expires_at > datetime("now")'
  ).bind(sessionId).first()
  
  if (!session) return null
  
  return {
    id: session.user_id as number,
    name: session.name as string,
    email: session.email as string,
    type: 'teacher'
  }
}

export async function getStudentFromSession(c: Context<{ Bindings: Bindings }>): Promise<Student | null> {
  let sessionId = getCookie(c, 'student_session_id')  // ← 학생 쿠키도 수정
  if (!sessionId) {
    sessionId = c.req.header('X-Session-ID')
  }
  // ... 동일한 로직
}
```

### 2단계: index.tsx 리팩토링

```typescript
// 파일: src/index.tsx

// ❌ 제거: 중복 함수 정의
// async function getUserFromSession(c: any) { ... }
// async function requireAuth(c: any) { ... }

// ✅ 추가: middleware에서 import
import { getUserFromSession, requireAuth } from './middleware/auth'

// ✅ 수정: 라우트 마운팅
app.route('/api/auth', auth)
app.route('/api', grading)
app.route('/api/upload', upload)
app.route('/api/assignment', assignments)
app.route('/api/submission', submissions)  // ← '/api'에서 '/api/submission'으로 변경
app.route('/api/admin', admin)
app.route('/api/student', students)
```

### 3단계: 빌드 및 재시작

```bash
# 빌드
npm run build

# 서비스 재시작
fuser -k 3000/tcp
pm2 restart webapp
```

---

## 📊 테스트 결과

### 1. 로그인 테스트 ✅

**요청**:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@test.com","password":"Test1234!@#$"}' \
  -c /tmp/cookies.txt
```

**응답** (HTTP 200 OK):
```json
{
  "success": true,
  "user": {
    "id": 1,
    "name": "테스트 선생님",
    "email": "teacher@test.com"
  }
}
```

**쿠키 설정 확인**:
```
Set-Cookie: session_id=667be435-0ad6-4d58-be4e-80fd5f054aa3; 
  Max-Age=86400; 
  Path=/; 
  HttpOnly; 
  Secure; 
  SameSite=Strict
```

### 2. 세션 유지 테스트 ✅

**요청**:
```bash
curl -s http://localhost:3000/api/assignments \
  -b /tmp/cookies.txt
```

**응답** (HTTP 200 OK):
```json
[]
```
> 빈 배열은 정상입니다 (아직 과제가 없음)

### 3. 인증 확인 테스트 ✅

**Without Cookie** (401 Unauthorized):
```bash
$ curl http://localhost:3000/api/assignments
{"error":"Unauthorized - Please login"}
```

**With Cookie** (200 OK):
```bash
$ curl http://localhost:3000/api/assignments -b "session_id=..."
[]
```

---

## 🔧 기술 세부사항

### Hono Cookie API (v4)

#### Before (작동하지 않음)
```typescript
// ❌ c.req.cookie()는 Hono v4에 존재하지 않음
const cookie = c.req.cookie('session_id')
```

#### After (올바른 방법)
```typescript
// ✅ getCookie 헬퍼 함수 사용
import { getCookie } from 'hono/cookie'
const cookie = getCookie(c, 'session_id')
```

### 쿠키 vs 헤더 인증

#### 브라우저 (쿠키)
```http
GET /api/assignments HTTP/1.1
Cookie: session_id=667be435-0ad6-4d58-be4e-80fd5f054aa3
```

#### API 클라이언트 (헤더)
```http
GET /api/assignments HTTP/1.1
X-Session-ID: 667be435-0ad6-4d58-be4e-80fd5f054aa3
```

**middleware/auth.ts는 둘 다 지원**:
1. 먼저 쿠키 확인 (`getCookie`)
2. 없으면 헤더 확인 (`c.req.header`)
3. 둘 다 없으면 `null` 반환

### 세션 보안 설정

```typescript
// 로그인 시 쿠키 설정 (src/routes/auth.ts)
c.header(
  'Set-Cookie',
  `session_id=${sessionId}; Max-Age=86400; Path=/; HttpOnly; Secure; SameSite=Strict`
)
```

**보안 속성 설명**:
- `HttpOnly`: JavaScript에서 접근 불가 (XSS 방어)
- `Secure`: HTTPS에서만 전송 (중간자 공격 방어)
- `SameSite=Strict`: CSRF 공격 방어
- `Max-Age=86400`: 24시간 후 자동 만료

---

## 🎯 Before vs After

### Before (문제 상황)
```
1. 로그인 ✅
   POST /api/auth/login → 200 OK
   Set-Cookie: session_id=...

2. 대시보드 접근 ❌
   GET /api/assignments 
   → 401 Unauthorized
   → Error: n.req.cookie is not a function

3. 사용자 경험 ❌
   "세션이 만료되었습니다" (즉시 만료)
```

### After (해결 완료)
```
1. 로그인 ✅
   POST /api/auth/login → 200 OK
   Set-Cookie: session_id=... (HttpOnly, Secure, SameSite=Strict)

2. 대시보드 접근 ✅
   GET /api/assignments 
   → 200 OK
   → [] (빈 배열, 정상)

3. 사용자 경험 ✅
   "환영합니다, 테스트 선생님님" → 대시보드로 이동
   세션 유지 (24시간)
```

---

## 📝 Git 커밋 정보

**커밋 해시**: `24f8063`  
**브랜치**: `main`  
**메시지**: "Fix: Resolve session cookie authentication issue"

**변경 파일**:
- `src/middleware/auth.ts` (+3, -2)
  - `import { getCookie } from 'hono/cookie'` 추가
  - `c.req.cookie()` → `getCookie(c, ...)` 변경
  
- `src/index.tsx` (+3, -27)
  - 중복 함수 제거 (getUserFromSession, requireAuth)
  - middleware/auth에서 import 추가
  - 라우트 마운팅 수정 ('/api' → '/api/submission')

**푸시 완료**: `https://github.com/eunha0/webapp` (main)

---

## 🌐 브라우저 테스트 가이드

### 1. 로그인
1. URL 접속: https://3000-iigjpsbl85aj2ml3n1x69-5634da27.sandbox.novita.ai/login
2. 로그인 정보 입력:
   - 이메일: `teacher@test.com`
   - 비밀번호: `Test1234!@#$`
3. "로그인" 버튼 클릭
4. ✅ **"환영합니다, 테스트 선생님님" 메시지 확인**

### 2. 대시보드 접근
1. "확인" 버튼 클릭
2. ✅ **대시보드로 정상 이동**
3. ✅ **세션이 유지됨 (더 이상 만료 메시지 없음)**

### 3. 세션 지속성 확인
1. 페이지 새로고침 (F5)
2. ✅ **로그인 상태 유지**
3. 다른 페이지 이동 (마이페이지, 과제 관리 등)
4. ✅ **모든 페이지에서 세션 유지**

### 4. 개발자 도구 확인 (선택)
1. F12 → Application → Cookies
2. ✅ **session_id 쿠키 확인**:
   - Value: UUID 형식
   - HttpOnly: ✓
   - Secure: ✓
   - SameSite: Strict
   - Expires: 24시간 후

---

## 🚀 추가 개선 사항

### 현재 상태
- ✅ 세션 인증 완전 작동
- ✅ 쿠키 기반 브라우저 인증
- ✅ 헤더 기반 API 인증
- ✅ 24시간 세션 유지
- ✅ 보안 쿠키 설정 (HttpOnly, Secure, SameSite)

### 향후 개선 (선택)
- [ ] 세션 자동 갱신 (last_activity 기반)
- [ ] "로그인 상태 유지" 체크박스 (30일 쿠키)
- [ ] 다중 디바이스 세션 관리
- [ ] 세션 목록 UI (내 디바이스 관리)
- [ ] 세션 강제 종료 기능

---

## 📋 요약

### 문제
- 로그인 성공 후 세션 즉시 만료
- `c.req.cookie is not a function` 에러

### 원인
1. Hono v4 쿠키 API 잘못 사용
2. 중복 함수로 middleware 수정 미적용
3. 라우트 충돌로 엔드포인트 미도달

### 해결
1. `getCookie()` 헬퍼 사용
2. middleware/auth 통합
3. 라우트 마운팅 수정

### 결과
- ✅ 세션 인증 완전 복구
- ✅ 브라우저 로그인 정상 작동
- ✅ 24시간 세션 유지
- ✅ 보안 쿠키 설정 유지

---

**작성자**: AI Assistant  
**작성일**: 2024-12-16  
**버전**: v1.0  
**문서 상태**: ✅ 최신  
**서비스 상태**: 🟢 정상 운영 중

**테스트 계정**:
- 이메일: `teacher@test.com`
- 비밀번호: `Test1234!@#$`
- 상태: ✅ 활성화

**서비스 URL**: https://3000-iigjpsbl85aj2ml3n1x69-5634da27.sandbox.novita.ai
