# 로그인 문제 해결 완료

## 문제
- 로그인 시 "Internal Server Error" 발생
- 에러: `no such table: security_logs: SQLITE_ERROR`

## 원인
`.wrangler` 폴더 삭제로 인해 로컬 D1 데이터베이스가 초기화됨

## 해결 절차

### 1. D1 마이그레이션 적용
```bash
npx wrangler d1 migrations apply webapp-production --local
# ✅ 13개 마이그레이션 성공 적용
```

### 2. 테스트 데이터 삽입
```bash
npx wrangler d1 execute webapp-production --local --file=./seed.sql
# ✅ 14개 명령 성공 실행
```

### 3. 서비스 재시작
```bash
pm2 restart webapp
# ✅ 서비스 정상 재시작
```

## ✅ 해결 완료

### 로그인 테스트 결과
```bash
# 교사 로그인 성공
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@test.com","password":"password123"}'

# Response:
{
  "success": true,
  "session_id": "276595cb-3bea-444e-b738-c293cea592df",
  "user": {
    "id": 1,
    "name": "테스트 교사",
    "email": "teacher@test.com"
  }
}
```

## 테스트 계정 정보

### ⚠️ 중요: 비밀번호 변경됨!

**이전 (잘못된 정보):**
- 교사: `teacher@test.com` / `ValidPass123!@#` ❌
- 학생: `student@test.com` / `ValidPass123!@#` ❌

**현재 (올바른 정보):**
- **교사**: `teacher@test.com` / `password123` ✅
- **학생**: `student@test.com` / `password123` ✅

## 데이터베이스 상태

### 테이블 생성 완료
- ✅ users (교사 계정)
- ✅ student_users (학생 계정)
- ✅ security_logs (보안 로그)
- ✅ sessions (세션 관리)
- ✅ assignments (과제)
- ✅ assignment_rubrics (루브릭)
- ✅ submissions (제출물)
- ✅ uploaded_files (파일 업로드)
- ✅ 기타 13개 테이블

### 테스트 데이터
- ✅ 교사 계정: 1개
- ✅ 학생 계정: 1개
- ✅ 테스트 과제: 1개 (액세스 코드: 123456)
- ✅ 루브릭 기준: 3개
- ✅ 리소스 게시물: 6개

## 서비스 URL
https://3000-iigjpsbl85aj2ml3n1x69-0e616f0a.sandbox.novita.ai

## 로그인 방법

### 웹 브라우저에서:
1. 위 URL 접속
2. 교사: `teacher@test.com` / `password123` 입력
3. 학생: `student@test.com` / `password123` 입력

### API 테스트:
```bash
# 교사 로그인
curl -X POST https://3000-iigjpsbl85aj2ml3n1x69-0e616f0a.sandbox.novita.ai/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@test.com","password":"password123"}'

# 학생 로그인 (교사 로그인과 동일한 엔드포인트 사용)
curl -X POST https://3000-iigjpsbl85aj2ml3n1x69-0e616f0a.sandbox.novita.ai/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@test.com","password":"password123"}'
```

## 다음 단계

### OCR Skip 기능 테스트
이제 로그인이 정상 작동하므로 OCR Skip 기능을 테스트할 수 있습니다:

1. **교사 로그인**: `teacher@test.com` / `password123`
2. **"새 과제 만들기"** 클릭
3. **"☑ OCR 건너뛰고 이미지 그대로 삽입"** 체크 확인
4. **그래프/차트 이미지** 업로드
5. **F12 → Console 및 Network 탭**에서 디버그 로그 확인

## PM2 상태
```
┌────┬────────┬──────────┬────────┬────────┬──────────┬─────────┬──────┬───────────┐
│ id │ name   │ mode     │ pid    │ uptime │ ↺       │ status  │ cpu  │ mem       │
├────┼────────┼──────────┼────────┼────────┼──────────┼─────────┼──────┼───────────┤
│ 0  │ webapp │ fork     │ 1879   │ 0s     │ 1        │ online  │ 0%   │ 18.4mb    │
└────┴────────┴──────────┴────────┴────────┴──────────┴─────────┴──────┴───────────┘
```

## 참고 사항

### 비밀번호 해시
seed.sql에 저장된 bcrypt 해시:
```
$2b$10$TIcy52EY1N1fCQttg1N4N.cCB/83j3h3uqs/CIBGw32sB.VHRgJ.C
→ 평문: password123
```

### 마이그레이션 파일
```
0001_initial_schema.sql              ✅
0002_add_resources.sql               ✅
0003_add_users_and_subscriptions.sql ✅
0004_add_assignments.sql             ✅
0005_add_student_features.sql        ✅
0006_file_uploads.sql                ✅
0007_add_prompts_column.sql          ✅
0008_add_access_code.sql             ✅
0009_add_feedback_fields.sql         ✅
0009_add_max_score_to_rubrics.sql    ✅
0010_add_summary_evaluation.sql      ✅
0011_security_enhancements.sql       ✅ (security_logs 테이블 생성)
0012_add_grading_columns.sql         ✅
```

## 문제 해결 완료 ✅
- 로그인 오류 해결됨
- 데이터베이스 정상 작동
- 테스트 계정 준비 완료
- OCR Skip 기능 테스트 가능
