# 보안 취약점 대응 실행 계획

**프로젝트**: AI 논술 평가 시스템  
**작성일**: 2024-12-15  
**대응 기간**: 2024-12-15 ~ 2025-01-15

---

## 🎯 대응 우선순위 매트릭스

| 우선순위 | 심각도 | 영향도 | 대응 기한 | 항목 수 |
|---------|--------|--------|----------|---------|
| **P0** | Critical/High | 높음 | 즉시-1주 | 2개 |
| **P1** | Medium | 중간 | 2주 | 3개 |
| **P2** | Low | 낮음 | 1개월 | 3개 |

---

## 🚨 P0: 즉시 대응 필요 (Critical)

### #1. pdfjs-dist 취약점 해결 (GHSA-wgrm-67xf-hhpq)

**심각도**: 🔴 **High**  
**영향 범위**: PDF 업로드 및 처리 기능 전체  
**대응 기한**: **즉시**

#### 작업 계획

**Step 1: 의존성 업그레이드 (1시간)**
```bash
# 현재 버전 확인
npm list pdfjs-dist

# 최신 버전으로 업그레이드
npm install pdfjs-dist@latest

# 또는 특정 안전 버전
npm install pdfjs-dist@5.4.449

# package-lock.json 업데이트
npm install
```

**Step 2: API 호환성 확인 (2시간)**
- `src/upload-service.ts` 코드 리뷰
- PDF.js v5.x API 변경사항 확인
- Worker 설정 재검토

**Step 3: 기능 테스트 (2시간)**
```bash
# 로컬 환경 테스트
npm run build
pm2 restart webapp

# 테스트 시나리오
1. 루브릭 PDF 업로드
2. 제출물 PDF 업로드  
3. PDF 텍스트 추출
4. OCR.space 연동
```

**Step 4: 배포 (1시간)**
```bash
# Git 커밋
git add package.json package-lock.json src/upload-service.ts
git commit -m "Security: Upgrade pdfjs-dist to fix GHSA-wgrm-67xf-hhpq"

# GitHub 푸시
git push origin main

# Cloudflare Pages 배포
npm run deploy
```

**체크리스트**:
- [ ] npm install pdfjs-dist@latest 실행
- [ ] src/upload-service.ts API 변경 확인
- [ ] 루브릭 PDF 업로드 테스트
- [ ] 제출물 PDF 업로드 테스트
- [ ] PDF 텍스트 추출 테스트
- [ ] OCR 기능 테스트
- [ ] 빌드 및 배포 완료
- [ ] 프로덕션 검증

**담당자**: 백엔드 개발팀  
**검증자**: QA 팀

---

### #2. 비밀번호 해싱 알고리즘 개선

**심각도**: 🟡 **Medium (보안 모범 사례)**  
**영향 범위**: 사용자 인증 시스템  
**대응 기한**: **1주일 이내**

#### 작업 계획

**Step 1: 새로운 해싱 함수 구현 (2시간)**

`src/utils/helpers.ts`에 이미 구현됨:
```typescript
// SHA-256 해싱 (현재 구현)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
```

**Step 2: 마이그레이션 로직 추가 (4시간)**

`src/middleware/auth.ts` 또는 `src/routes/auth.ts`에 추가:
```typescript
// 로그인 시 비밀번호 자동 업그레이드
async function loginWithAutoUpgrade(email: string, password: string, db: D1Database) {
  const user = await db.prepare(
    'SELECT id, password_hash FROM users WHERE email = ?'
  ).bind(email).first()

  if (!user) {
    return { error: 'Invalid credentials' }
  }

  // 구 방식(btoa) 확인
  if (user.password_hash.length < 64) {
    // Old btoa hash
    const oldHash = btoa(password)
    if (oldHash === user.password_hash) {
      // 비밀번호 맞음 - 새 해시로 업그레이드
      const newHash = await hashPassword(password)
      await db.prepare(
        'UPDATE users SET password_hash = ? WHERE id = ?'
      ).bind(newHash, user.id).run()
      
      return { success: true, user_id: user.id }
    }
  } else {
    // New SHA-256 hash
    const isValid = await verifyPassword(password, user.password_hash)
    if (isValid) {
      return { success: true, user_id: user.id }
    }
  }

  return { error: 'Invalid credentials' }
}
```

**Step 3: 신규 회원가입 업데이트 (1시간)**

`src/routes/auth.ts`의 signup 함수 수정:
```typescript
// ❌ 기존
const passwordHash = btoa(password)

// ✅ 개선
const passwordHash = await hashPassword(password)
```

**Step 4: 테스트 (2시간)**
```bash
# 테스트 시나리오
1. 신규 회원가입 (새 해시 적용)
2. 기존 사용자 로그인 (자동 업그레이드)
3. 업그레이드된 사용자 재로그인
4. 비밀번호 변경
```

**체크리스트**:
- [ ] hashPassword() 함수 검증
- [ ] 마이그레이션 로직 구현
- [ ] 신규 회원가입 업데이트
- [ ] 기존 사용자 로그인 테스트
- [ ] 업그레이드 후 재로그인 테스트
- [ ] 데이터베이스 백업
- [ ] 프로덕션 배포

**담당자**: 백엔드 개발팀  
**검증자**: 보안 담당자

---

## 📋 P1: 단기 대응 (2주 이내)

### #3. CORS 설정 강화

**대응 기한**: 2주 이내  
**작업 시간**: 3시간

#### 작업 내용
```typescript
// src/index.tsx
import { cors } from 'hono/cors'

// ❌ 기존 (모든 오리진 허용)
app.use('/api/*', cors())

// ✅ 개선 (특정 오리진만 허용)
app.use('/api/*', cors({
  origin: (origin) => {
    const allowedOrigins = [
      'https://webapp-ai.pages.dev',
      'https://your-custom-domain.com'
    ]
    
    // 개발 환경에서만 localhost 허용
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:3000')
    }
    
    return allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-Session-ID'],
  maxAge: 86400
}))
```

**체크리스트**:
- [ ] 허용 오리진 목록 정의
- [ ] 개발/프로덕션 환경 분리
- [ ] Credentials 설정 검토
- [ ] Preflight 요청 테스트
- [ ] 브라우저 CORS 에러 확인

---

### #4. 파일 업로드 검증 강화

**대응 기한**: 2주 이내  
**작업 시간**: 4시간

#### Magic Bytes 검증 추가
```typescript
// src/utils/file-validator.ts (신규 파일)
const FILE_SIGNATURES = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46],  // %PDF
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47]
}

export function verifyFileSignature(
  buffer: ArrayBuffer,
  mimeType: string
): boolean {
  const signature = FILE_SIGNATURES[mimeType]
  if (!signature) return true  // Unknown type, skip check
  
  const bytes = new Uint8Array(buffer)
  return signature.every((byte, i) => bytes[i] === byte)
}

export function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts
  filename = filename.replace(/\.\./g, '')
  
  // Allow only alphanumeric, dash, underscore, and dot
  filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  
  // Limit length
  if (filename.length > 255) {
    const ext = filename.split('.').pop()
    filename = filename.substring(0, 250) + '.' + ext
  }
  
  return filename
}
```

**src/index.tsx 업데이트**:
```typescript
import { verifyFileSignature, sanitizeFilename } from './utils/file-validator'

app.post('/api/upload/pdf', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File
  
  // 1. 기본 검증
  const validation = validateFile(file, ['application/pdf'], 10 * 1024 * 1024)
  if (!validation.valid) {
    return c.json({ error: validation.error }, 400)
  }
  
  // 2. Magic bytes 검증
  const buffer = await file.arrayBuffer()
  if (!verifyFileSignature(buffer, file.type)) {
    return c.json({ error: 'File content does not match declared type' }, 400)
  }
  
  // 3. 파일명 살균
  const safeFilename = sanitizeFilename(file.name)
  
  // ... 나머지 처리
})
```

**체크리스트**:
- [ ] Magic bytes 검증 함수 구현
- [ ] 파일명 살균 함수 구현
- [ ] 모든 업로드 엔드포인트에 적용
- [ ] Path traversal 공격 테스트
- [ ] MIME type spoofing 테스트

---

### #5. 에러 메시지 보안 개선

**대응 기한**: 2주 이내  
**작업 시간**: 2시간

#### 작업 내용
```typescript
// src/middleware/error.ts
export function productionSafeError(error: Error, c: Context) {
  // 개발 환경: 상세 에러
  if (process.env.NODE_ENV === 'development') {
    return c.json({
      error: 'Internal Server Error',
      message: error.message,
      stack: error.stack
    }, 500)
  }
  
  // 프로덕션: 일반적인 에러만
  return c.json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred. Please try again later.'
  }, 500)
}
```

**체크리스트**:
- [ ] 에러 핸들러 개선
- [ ] 민감 정보 노출 확인
- [ ] 에러 로깅 구현
- [ ] 프로덕션 환경 테스트

---

## 🔧 P2: 장기 개선 (1개월 이내)

### #6. 보안 헤더 추가

**대응 기한**: 1개월 이내  
**작업 시간**: 3시간

```typescript
// src/middleware/security-headers.ts
export function securityHeaders() {
  return async (c: Context, next: () => Promise<void>) => {
    await next()
    
    // Content Security Policy
    c.header('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' cdn.tailwindcss.com cdn.jsdelivr.net; " +
      "style-src 'self' 'unsafe-inline' cdn.jsdelivr.net; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' cdn.jsdelivr.net; " +
      "connect-src 'self' https://*.novita.ai"
    )
    
    // Other security headers
    c.header('X-Frame-Options', 'DENY')
    c.header('X-Content-Type-Options', 'nosniff')
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  }
}

// src/index.tsx
import { securityHeaders } from './middleware/security-headers'
app.use('*', securityHeaders())
```

---

### #7. Rate Limiting 구현

**대응 기한**: 1개월 이내  
**작업 시간**: 6시간

```typescript
// src/middleware/rate-limit.ts
import { Context } from 'hono'

const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(options: {
  windowMs: number,
  max: number,
  keyGenerator?: (c: Context) => string
}) {
  return async (c: Context, next: () => Promise<void>) => {
    const key = options.keyGenerator?.(c) || 
                c.req.header('X-Real-IP') || 
                c.req.header('CF-Connecting-IP') || 
                'unknown'
    
    const now = Date.now()
    const record = rateLimitStore.get(key)
    
    if (!record || record.resetAt < now) {
      // New window
      rateLimitStore.set(key, {
        count: 1,
        resetAt: now + options.windowMs
      })
      return await next()
    }
    
    if (record.count >= options.max) {
      return c.json({
        error: 'Too many requests',
        retryAfter: Math.ceil((record.resetAt - now) / 1000)
      }, 429)
    }
    
    record.count++
    return await next()
  }
}

// 사용 예
app.post('/api/auth/login', 
  rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }),  // 15분에 5회
  async (c) => { /* ... */ }
)
```

---

### #8. 보안 모니터링 구축

**대응 기한**: 1개월 이내  
**작업 시간**: 8시간

#### Cloudflare Analytics 활용
1. Web Analytics 활성화
2. Security Events 모니터링
3. Rate Limiting Rules 설정
4. Bot Management 검토

#### 로깅 시스템
```typescript
// src/utils/security-logger.ts
export function logSecurityEvent(event: {
  type: 'login_failed' | 'suspicious_upload' | 'rate_limit_exceeded'
  userId?: number
  ip: string
  details: any
}) {
  console.log('[SECURITY]', JSON.stringify({
    timestamp: new Date().toISOString(),
    ...event
  }))
  
  // 향후: Cloudflare Durable Objects 또는 외부 로깅 서비스 연동
}
```

---

## 📊 진행 상황 추적

### 주간 체크인 (매주 금요일)
- [ ] Week 1 (2024-12-15): P0 완료 목표
- [ ] Week 2 (2024-12-22): P1 #3, #4 완료
- [ ] Week 3 (2024-12-29): P1 #5, P2 #6 완료  
- [ ] Week 4 (2025-01-05): P2 #7, #8 완료

### 마일스톤
- **M1** (2024-12-18): pdfjs-dist 업그레이드 완료
- **M2** (2024-12-22): 비밀번호 해싱 개선 완료
- **M3** (2025-01-05): 모든 P1 항목 완료
- **M4** (2025-01-15): 모든 P2 항목 완료

---

## ✅ 완료 기준

각 항목은 다음 조건을 모두 충족해야 완료로 간주:
1. ✅ 코드 구현 완료
2. ✅ 단위/통합 테스트 통과
3. ✅ 코드 리뷰 승인
4. ✅ 프로덕션 배포 완료
5. ✅ 검증 테스트 통과
6. ✅ 문서 업데이트

---

## 📞 연락처 및 에스컬레이션

### 담당자
- **보안 담당자**: [Name]
- **백엔드 팀장**: [Name]
- **DevOps 담당자**: [Name]

### 에스컬레이션 프로세스
1. **일반 이슈**: Slack #security 채널
2. **긴급 이슈**: 보안 담당자 직접 연락
3. **Critical**: 전체 개발팀 긴급 회의

---

**다음 리뷰 날짜**: 2024-12-29 (2주 후)
