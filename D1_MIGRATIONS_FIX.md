# D1 Database Migrations Fix - Login Error Resolution

## 문제 설명 (Problem Description)

교사 계정으로 관리자 대시보드(`/admin`) 로그인 시 **"로그인 실패: Internal Server Error"** 메시지가 표시되며 로그인이 실패했습니다.

### 증상 (Symptoms)
- 브라우저 콘솔: `POST /api/auth/login 500 (Internal Server Error)`
- PM2 로그: `D1_ERROR: no such table: security_logs: SQLITE_ERROR`
- 로그인 폼은 정상 작동하지만 인증 처리 중 서버 오류 발생

### 개발자 콘솔 에러 메시지
```
POST https://3000-iigjpsbl85aj2ml3n1x69-5634da27.sandbox.novita.ai/api/auth/login 500 (Internal Server Error)
```

## 원인 분석 (Root Cause Analysis)

### 주요 원인
**로컬 D1 데이터베이스에 `security_logs` 테이블이 존재하지 않음**

### 기술적 상세
1. **미적용 마이그레이션**: `0011_security_enhancements.sql`부터 `0012_add_grading_columns.sql`까지 총 3개의 마이그레이션이 로컬 DB에 적용되지 않음
2. **의존성 문제**: 로그인 API (`src/routes/auth.ts`)가 보안 로깅을 위해 `security_logs` 테이블에 INSERT 시도
3. **테이블 부재**: 해당 테이블이 없어 SQL 오류 발생 → 500 Internal Server Error 반환

### 확인된 마이그레이션 상태 (Before Fix)
```bash
# Applied migrations (before fix)
npx wrangler d1 migrations list webapp-production --local

Applied:
- 0001_initial_schema.sql
- 0002_add_resources.sql
- 0003_add_users_and_subscriptions.sql
- 0004_add_assignments.sql
- 0005_add_student_features.sql
- 0006_file_uploads.sql
- 0007_add_prompts_column.sql
- 0008_add_access_code.sql
- 0009_add_feedback_fields.sql
- 0010_add_summary_evaluation.sql

❌ NOT Applied:
- 0011_security_enhancements.sql (security_logs 테이블 포함)
- 0009_add_max_score_to_rubrics.sql
- 0012_add_grading_columns.sql
```

## 해결 방법 (Solution)

### 1. D1 마이그레이션 전체 적용
```bash
cd /home/user/webapp-ai
npx wrangler d1 migrations apply webapp-production --local
```

### 2. 마이그레이션 결과
```
✅ 13개 마이그레이션 모두 성공적으로 적용됨

Applied migrations:
- 0001_initial_schema.sql              ✅
- 0002_add_resources.sql               ✅
- 0003_add_users_and_subscriptions.sql ✅
- 0004_add_assignments.sql             ✅
- 0005_add_student_features.sql        ✅
- 0006_file_uploads.sql                ✅
- 0007_add_prompts_column.sql          ✅
- 0008_add_access_code.sql             ✅
- 0009_add_feedback_fields.sql         ✅
- 0009_add_max_score_to_rubrics.sql    ✅
- 0010_add_summary_evaluation.sql      ✅
- 0011_security_enhancements.sql       ✅ (security_logs 테이블 생성)
- 0012_add_grading_columns.sql         ✅
```

### 3. 서비스 재시작
```bash
pm2 restart webapp
```

## 핵심 마이그레이션: 0011_security_enhancements.sql

### security_logs 테이블 구조
```sql
CREATE TABLE IF NOT EXISTS security_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    event_type TEXT NOT NULL, -- 'login_success', 'login_failure', 'logout', 'signup_success'
    ip_address TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX idx_security_logs_event_type ON security_logs(event_type);
CREATE INDEX idx_security_logs_created_at ON security_logs(created_at);
```

### 용도
- 로그인/로그아웃 이벤트 추적
- 보안 이벤트 로깅 (실패한 로그인 시도 등)
- 사용자 활동 감사 (audit trail)
- 보안 위협 분석

## 검증 (Verification)

### 1. 로그인 API 테스트
```bash
# 잘못된 비밀번호로 테스트
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@teacher.com","password":"wrongpass"}'

# Before Fix:
# {"error":"Internal Server Error"}

# ✅ After Fix:
# {"error":"이메일 또는 비밀번호가 올바르지 않습니다"}
```

### 2. PM2 로그 확인
```bash
pm2 logs webapp --nostream

# Before Fix:
# Error: D1_ERROR: no such table: security_logs: SQLITE_ERROR
# POST /api/auth/login 500 Internal Server Error

# ✅ After Fix:
# POST /api/auth/login 200 OK (정상 로그인)
# POST /api/auth/login 401 Unauthorized (잘못된 비밀번호)
```

### 3. 브라우저 테스트
1. **강제 캐시 새로고침**: `Ctrl + Shift + R` (Windows) 또는 `Cmd + Shift + R` (Mac)
2. 교사 계정으로 로그인 시도
3. ✅ **정상 로그인 성공** 또는 적절한 에러 메시지 표시

## 영향받는 기능 (Affected Features)

### ✅ 수정된 기능
- **교사 로그인**: 관리자 대시보드 접근 가능
- **학생 로그인**: 학생 계정 로그인 정상화
- **회원가입**: 신규 사용자 등록 정상 작동
- **보안 로깅**: 모든 인증 이벤트 정상 기록

## 배포 정보 (Deployment Info)

### GitHub Repository
- **Repository**: https://github.com/eunha0/webapp.git
- **Branch**: main
- **Migration Files**: `/migrations/0011_security_enhancements.sql`

### Test URL
- **Service URL**: https://3000-iigjpsbl85aj2ml3n1x69-5634da27.sandbox.novita.ai
- **Admin Dashboard**: https://3000-iigjpsbl85aj2ml3n1x69-5634da27.sandbox.novita.ai/admin
- **Login Page**: https://3000-iigjpsbl85aj2ml3n1x69-5634da27.sandbox.novita.ai/login

## 테스트 시나리오 (Test Scenarios)

### ✅ 시나리오 1: 정상 로그인
1. `/login` 페이지 접속
2. 올바른 교사 계정 정보 입력
3. **기대 결과**: 대시보드로 리디렉션

### ✅ 시나리오 2: 잘못된 비밀번호
1. `/login` 페이지 접속
2. 잘못된 비밀번호 입력
3. **기대 결과**: "이메일 또는 비밀번호가 올바르지 않습니다" 메시지

### ✅ 시나리오 3: 관리자 대시보드
1. 교사 계정으로 로그인
2. `/admin` 페이지 접속
3. **기대 결과**: 
   - 통계 정보 정상 표시
   - 사용자 목록 로드 완료
   - 최근 활동 내역 표시

## 관련 문서 (Related Documentation)

- **Admin Dashboard Auth Fix**: `/ADMIN_DASHBOARD_AUTH_FIX.md`
- **Admin Dashboard SQL Fix**: `/ADMIN_DASHBOARD_SQL_FIX.md`
- **Grading History Fix**: `/GRADING_HISTORY_AND_PRINT_FIX.md`

## 기술 스택 (Technical Stack)

- **Database**: Cloudflare D1 (SQLite)
- **Migration Tool**: Wrangler CLI
- **Backend**: Hono Framework
- **Auth Route**: `src/routes/auth.ts`

## 중요 사항 (Important Notes)

### ⚠️ 프로덕션 배포 시 주의사항
로컬 D1 데이터베이스는 `--local` 플래그로 관리되며, **프로덕션 배포 시 별도로 마이그레이션을 적용해야 합니다**:

```bash
# Production migration (when deploying to Cloudflare Pages)
npx wrangler d1 migrations apply webapp-production

# Without --local flag for production database
```

### 🔍 디버깅 팁
```bash
# Check local D1 database status
npx wrangler d1 migrations list webapp-production --local

# Verify table exists
npx wrangler d1 execute webapp-production --local \
  --command="SELECT name FROM sqlite_master WHERE type='table' AND name='security_logs';"

# Check security logs entries
npx wrangler d1 execute webapp-production --local \
  --command="SELECT * FROM security_logs ORDER BY created_at DESC LIMIT 10;"
```

## 결론 (Conclusion)

**모든 D1 마이그레이션을 적용**하여 `security_logs` 테이블이 정상 생성되었고, 로그인 API의 500 Internal Server Error가 해결되었습니다. 교사 계정으로 관리자 대시보드에 정상적으로 접근할 수 있으며, 모든 인증 이벤트가 보안 로그에 기록됩니다.

---

**Fixed on**: 2025-12-20  
**Issue**: Teacher login failure with Internal Server Error  
**Solution**: Applied pending D1 migrations including security_logs table  
**Status**: ✅ **Resolved**
