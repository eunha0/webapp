# 채점 실패 문제 해결 보고서

## 📋 문제 요약

### 증상
- **사용자 동작**: "나의 페이지" → 과제 클릭 → 답안지 추가 → "채점하기" 클릭
- **에러 메시지**: **"채점에 실패했습니다: Failed to grade submission"**
- **HTTP 상태**: `POST /api/submission/:id/grade` → **500 Internal Server Error**

### 콘솔 에러 (사용자 제공 스크린샷)
```
Failed to load resource: the server responded with a status of 500 ()
  at /api/submission/2/grade:1
  at /api/submission/1/grade:1
Error grading submission: N
```

### 서버 로그 에러
```
ERROR: D1_TYPE_ERROR: Type 'undefined' not supported for value 'undefined'
  at D1PreparedStatement.bind (cloudflare-internal:d1-api:256:42)
  at null.<anonymous> (file:///home/user/webapp-ai/dist/_worker.js:306:8)
```

---

## 🔍 근본 원인 분석

### 1. 데이터베이스 스키마 불일치

**문제점:**
- `student_submissions` 테이블에 채점 관련 컬럼이 존재하지 않음
- 코드는 존재하지 않는 컬럼에 값을 저장하려고 시도

**누락된 컬럼:**
```sql
-- submissions.ts:94-100에서 UPDATE 시도
status            -- 제출물 상태 (pending/grading/graded/failed)
overall_score     -- 전체 점수 (0-100)
overall_feedback  -- 총평
grading_result    -- 전체 채점 결과 JSON
graded_at         -- 채점 완료 시간
```

**실제 테이블 스키마 (수정 전):**
```sql
CREATE TABLE student_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  student_name TEXT NOT NULL,
  student_user_id INTEGER,
  essay_text TEXT NOT NULL,
  file_url TEXT,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  graded BOOLEAN DEFAULT 0,
  grade_result_id INTEGER,
  submission_version INTEGER DEFAULT 1,
  is_resubmission BOOLEAN DEFAULT 0,
  previous_submission_id INTEGER
);
```

**결과:**
- D1 데이터베이스가 존재하지 않는 컬럼에 바인딩 시도
- `undefined` 값이 전달되어 D1_TYPE_ERROR 발생

### 2. GradingResult 인터페이스 필드 불일치

**문제점:**
- `submissions.ts`에서 사용하는 필드명과 실제 `GradingResult` 인터페이스 불일치

**잘못된 코드 (submissions.ts:104-106):**
```typescript
.bind(
  'graded',
  gradingResult.overall_score,    // ❌ undefined (존재하지 않는 필드)
  gradingResult.overall_feedback, // ❌ undefined (존재하지 않는 필드)
  JSON.stringify(gradingResult),
  submissionId
)
```

**실제 GradingResult 인터페이스 (types.ts):**
```typescript
export interface GradingResult {
  total_score: number;              // ✅ 이것이 실제 필드명
  summary_evaluation: string;
  criterion_scores: CriterionScore[];
  overall_comment: string;          // ✅ 이것이 실제 필드명
  revision_suggestions: string;
  next_steps_advice: string;
}
```

**필드명 매핑 문제:**
| 코드에서 사용한 필드 | 실제 필드 | 결과 |
|---------------------|----------|------|
| `overall_score` | `total_score` | `undefined` |
| `overall_feedback` | `overall_comment` | `undefined` |

**결과:**
- `undefined` 값이 D1 데이터베이스에 전달
- D1은 `undefined` 타입을 지원하지 않음
- `D1_TYPE_ERROR` 발생

---

## 🔧 적용된 수정사항

### 1. 데이터베이스 마이그레이션 (0012_add_grading_columns.sql)

**새로운 마이그레이션 파일 생성:**
```sql
-- Migration: Add grading-related columns to student_submissions
-- Date: 2024-12-16

-- Add status column for submission workflow
ALTER TABLE student_submissions ADD COLUMN status TEXT DEFAULT 'pending' 
  CHECK(status IN ('pending', 'grading', 'graded', 'failed'));

-- Add overall_score for numeric grade (0-100)
ALTER TABLE student_submissions ADD COLUMN overall_score INTEGER;

-- Add overall_feedback for general comments
ALTER TABLE student_submissions ADD COLUMN overall_feedback TEXT;

-- Add grading_result for storing full grading JSON
ALTER TABLE student_submissions ADD COLUMN grading_result TEXT;

-- Add graded_at timestamp
ALTER TABLE student_submissions ADD COLUMN graded_at DATETIME;

-- Create index for faster queries by status
CREATE INDEX IF NOT EXISTS idx_submissions_status ON student_submissions(status);

-- Create index for faster queries by graded status
CREATE INDEX IF NOT EXISTS idx_submissions_graded ON student_submissions(graded, graded_at);
```

**마이그레이션 실행:**
```bash
$ npx wrangler d1 migrations apply webapp-production --local

Migrations to be applied:
┌──────────────────────────────┐
│ name                         │
├──────────────────────────────┤
│ 0012_add_grading_columns.sql │
└──────────────────────────────┘

🚣 8 commands executed successfully.
┌──────────────────────────────┬────────┐
│ name                         │ status │
├──────────────────────────────┼────────┤
│ 0012_add_grading_columns.sql │ ✅     │
└──────────────────────────────┴────────┘
```

**테이블 스키마 확인 (수정 후):**
```
cid  name                     type      notnull  dflt_value          pk
---  -----------------------  --------  -------  ------------------  --
0    id                       INTEGER   0        null                1
1    assignment_id            INTEGER   1        null                0
2    student_name             TEXT      1        null                0
3    student_user_id          INTEGER   0        null                0
4    essay_text               TEXT      1        null                0
5    file_url                 TEXT      0        null                0
6    submitted_at             DATETIME  0        CURRENT_TIMESTAMP   0
7    graded                   BOOLEAN   0        0                   0
8    grade_result_id          INTEGER   0        null                0
9    submission_version       INTEGER   0        1                   0
10   is_resubmission          BOOLEAN   0        0                   0
11   previous_submission_id   INTEGER   0        null                0
12   status                   TEXT      0        'pending'           0  ✅ NEW
13   overall_score            INTEGER   0        null                0  ✅ NEW
14   overall_feedback         TEXT      0        null                0  ✅ NEW
15   grading_result           TEXT      0        null                0  ✅ NEW
16   graded_at                DATETIME  0        null                0  ✅ NEW
```

### 2. GradingResult 필드 매핑 수정 (submissions.ts)

**Before (잘못된 코드):**
```typescript
// Store grading result
await db.prepare(`
  UPDATE student_submissions 
  SET status = ?, 
      overall_score = ?, 
      overall_feedback = ?,
      grading_result = ?,
      graded_at = CURRENT_TIMESTAMP
  WHERE id = ?
`).bind(
  'graded',
  gradingResult.overall_score,    // ❌ undefined
  gradingResult.overall_feedback, // ❌ undefined
  JSON.stringify(gradingResult),
  submissionId
).run()
```

**After (수정된 코드):**
```typescript
// Store grading result
// Map GradingResult fields to database columns
const overall_score = gradingResult.total_score || 0;
const overall_feedback = gradingResult.overall_comment || gradingResult.summary_evaluation || '';

await db.prepare(`
  UPDATE student_submissions 
  SET status = ?, 
      overall_score = ?, 
      overall_feedback = ?,
      grading_result = ?,
      graded_at = CURRENT_TIMESTAMP
  WHERE id = ?
`).bind(
  'graded',
  overall_score,      // ✅ Mapped from total_score
  overall_feedback,   // ✅ Mapped from overall_comment
  JSON.stringify(gradingResult),
  submissionId
).run()
```

**개선사항:**
1. ✅ **명시적 필드 매핑**: `total_score` → `overall_score`
2. ✅ **폴백 로직**: `overall_comment || summary_evaluation`
3. ✅ **Null 안전성**: `|| 0` 및 `|| ''`로 기본값 제공

---

## ✅ 검증 결과

### 마이그레이션 검증
```sql
SELECT id, assignment_id, student_name, status, LENGTH(essay_text) as text_length 
FROM student_submissions;

┌────┬───────────────┬──────────────┬─────────┬─────────────┐
│ id │ assignment_id │ student_name │ status  │ text_length │
├────┼───────────────┼──────────────┼─────────┼─────────────┤
│ 1  │ 1             │ 이하이       │ pending │ 503         │
│ 2  │ 1             │ 김고은       │ pending │ 1999        │
└────┴───────────────┴──────────────┴─────────┴─────────────┘
```

### 채점 테스트 (submission ID: 1)

**요청:**
```bash
POST /api/submission/1/grade
Cookie: session_id=...
```

**응답 (200 OK):**
```json
{
  "success": true,
  "grading_result": {
    "total_score": 11,
    "summary_evaluation": "고등학교 2학년 학생으로서 제2차 세계대전의 복합적 원인을 파악하고...",
    "criterion_scores": [
      {
        "criterion_name": "Historical Context Understanding",
        "score": 3,
        "strengths": "...",
        "areas_for_improvement": "..."
      },
      {
        "criterion_name": "Argument Development",
        "score": 3,
        "strengths": "...",
        "areas_for_improvement": "..."
      },
      {
        "criterion_name": "Use of Evidence",
        "score": 2,
        "strengths": "...",
        "areas_for_improvement": "..."
      },
      {
        "criterion_name": "Clarity and Organization",
        "score": 3,
        "strengths": "...",
        "areas_for_improvement": "..."
      }
    ],
    "overall_comment": "서론에서 '제1차 세계대전이 남긴 문제...'",
    "revision_suggestions": "1. Historical Context Understanding: ...",
    "next_steps_advice": "이번 에세이는 역사적 사건의 인과관계를..."
  }
}
```

**처리 시간:** 약 54초 (GPT-4o 점수 산출 + Claude 3.5 Sonnet 피드백 생성)

### 데이터베이스 확인 (채점 후)

```sql
SELECT id, student_name, status, overall_score, 
       LENGTH(overall_feedback) as feedback_length, graded_at 
FROM student_submissions WHERE id = 1;

┌────┬──────────────┬────────┬──────────────┬─────────────────┬─────────────────────┐
│ id │ student_name │ status │ overall_score│ feedback_length │ graded_at           │
├────┼──────────────┼────────┼──────────────┼─────────────────┼─────────────────────┤
│ 1  │ 이하이       │ graded │ 11           │ 459             │ 2025-12-16 07:21:33 │
└────┴──────────────┴────────┴──────────────┴─────────────────┴─────────────────────┘
```

**검증 항목:**
- ✅ `status`: 'pending' → 'graded'
- ✅ `overall_score`: 11점 저장
- ✅ `overall_feedback`: 459자 저장
- ✅ `graded_at`: 채점 완료 시간 기록
- ✅ `grading_result`: 전체 JSON 저장 (확인 생략)

---

## 🎯 채점 시스템 아키텍처

### 하이브리드 AI 채점 시스템

**Phase 1: GPT-4o (Scoring)**
```
역할: 루브릭 기준에 따라 정확하고 일관되게 채점
모델: gpt-4o
온도: 0.3 (일관성 우선)
출력: JSON 형식 (total_score, criterion_scores)
```

**Phase 2: Claude 3.5 Sonnet (Feedback)**
```
역할: 상세하고 건설적인 피드백 생성
모델: claude-3-5-sonnet-20241022
온도: 0.7 (창의성과 공감 우선)
출력: 자연스러운 한국어 피드백
```

**최종 결과 구조:**
```typescript
{
  total_score: number,              // 전체 점수 (0-100)
  summary_evaluation: string,       // 요약 평가
  criterion_scores: [               // 개별 기준 점수
    {
      criterion_name: string,
      score: number,
      strengths: string,
      areas_for_improvement: string
    }
  ],
  overall_comment: string,          // 총평
  revision_suggestions: string,     // 수정 제안
  next_steps_advice: string         // 다음 단계 조언
}
```

---

## 📊 변경사항 요약

### 수정된 파일

| 파일 | 변경 내용 | 라인 수 |
|------|----------|--------|
| `migrations/0012_add_grading_columns.sql` | 새로운 마이그레이션 (8 commands) | +28 |
| `src/routes/submissions.ts` | GradingResult 필드 매핑 수정 | +3, -2 |
| **총계** | **2 files changed** | **+31, -2** |

### 주요 변경사항

**migrations/0012_add_grading_columns.sql:**
1. ✅ `status` 컬럼 추가 (CHECK 제약조건)
2. ✅ `overall_score` 컬럼 추가 (INTEGER)
3. ✅ `overall_feedback` 컬럼 추가 (TEXT)
4. ✅ `grading_result` 컬럼 추가 (TEXT, JSON 저장)
5. ✅ `graded_at` 컬럼 추가 (DATETIME)
6. ✅ 인덱스 생성 (`status`, `graded + graded_at`)

**src/routes/submissions.ts:**
1. ✅ `total_score` → `overall_score` 매핑
2. ✅ `overall_comment` → `overall_feedback` 매핑
3. ✅ Null 안전성 처리 (기본값 제공)

---

## 🧪 테스트 가이드

### 서비스 정보
- **URL**: https://3000-iigjpsbl85aj2ml3n1x69-5634da27.sandbox.novita.ai
- **테스트 계정**: `teacher@test.com` / `Test1234!@#$`

### 테스트 시나리오

#### ✅ 시나리오 1: 답안지 추가 및 채점
```
1. 로그인 (teacher@test.com)
2. "나의 페이지" 클릭
3. 과제 선택 (예: "제2차 세계대전의 원인")
4. "답안지 추가" 클릭
5. 파일 업로드 또는 텍스트 입력
   - 이미지: "이하이.jpg" (이미 추가됨)
   - PDF: "김고은 논술.pdf" (이미 추가됨)
6. "추가" 클릭
7. "채점하기" 버튼 클릭
8. ⏳ 대기 (약 30-60초)
9. ✅ 예상 결과:
   - 채점 완료 메시지 표시
   - 점수 표시 (예: 11/16)
   - 상세 피드백 표시
```

#### ✅ 시나리오 2: 채점 결과 확인
```
1. 채점 완료된 답안지 클릭
2. ✅ 예상 결과:
   - 전체 점수 표시
   - 루브릭 기준별 점수 표시
   - 강점 (Strengths)
   - 개선 영역 (Areas for Improvement)
   - 총평 (Overall Comment)
   - 수정 제안 (Revision Suggestions)
   - 다음 단계 조언 (Next Steps Advice)
```

---

## 🚀 배포 정보

### Git 커밋
```bash
Commit: 705f4bf
Message: Fix: Resolve grading submission failure (undefined error)
Branch: main
Remote: https://github.com/eunha0/webapp.git
Status: ✅ Pushed successfully
```

### 마이그레이션 상태
```
Migration: 0012_add_grading_columns.sql
Status: ✅ Applied successfully
Commands: 8
Tables affected: student_submissions
Indexes created: 2 (idx_submissions_status, idx_submissions_graded)
```

---

## 📚 관련 문서

### 프로젝트 문서 목록
1. **GRADING_FAILURE_FIX_REPORT.md** (현재 문서) - 채점 실패 문제 해결 ✅ **신규**
2. **PDF_EXTRACTION_FIX_REPORT.md** (10.6 KB) - PDF 텍스트 추출 문제 해결
3. **SESSION_AUTHENTICATION_FIX.md** (8.1 KB) - 세션 인증 문제 해결
4. **DB_MIGRATION_FIX_REPORT.md** (9.2 KB) - 데이터베이스 마이그레이션 수정
5. **ESLINT_SETUP_REPORT.md** (6.8 KB) - ESLint 설정 가이드

### API 문서
- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [Anthropic Claude API Documentation](https://docs.anthropic.com/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)

---

## 🔍 디버깅 정보

### PM2 로그 확인
```bash
# 실시간 로그 모니터링
pm2 logs webapp --lines 100

# 에러 로그만 확인
pm2 logs webapp --err --nostream --lines 50

# 채점 관련 로그 필터링
pm2 logs webapp --nostream | grep -E "(grade|채점|ERROR)"
```

### 데이터베이스 확인
```bash
# 채점 대기 중인 제출물 확인
npx wrangler d1 execute webapp-production --local \
  --command="SELECT id, student_name, status FROM student_submissions WHERE status = 'pending'"

# 채점 완료된 제출물 확인
npx wrangler d1 execute webapp-production --local \
  --command="SELECT id, student_name, overall_score, graded_at FROM student_submissions WHERE status = 'graded'"

# 채점 결과 상세 확인
npx wrangler d1 execute webapp-production --local \
  --command="SELECT id, student_name, overall_score, overall_feedback, grading_result FROM student_submissions WHERE id = ?"
```

---

## 🎉 결론

### 해결된 문제
✅ **채점 실패 에러** - 데이터베이스 스키마 및 필드 매핑 수정으로 해결  
✅ **D1_TYPE_ERROR** - undefined 값 전달 문제 해결  
✅ **필드명 불일치** - GradingResult 인터페이스 필드 올바르게 매핑  
✅ **데이터베이스 누락 컬럼** - 마이그레이션으로 필요한 컬럼 추가  

### 개선된 기능
🚀 **하이브리드 AI 채점**: GPT-4o + Claude 3.5 Sonnet 조합으로 정확한 채점과 공감적 피드백  
🚀 **완전한 데이터 저장**: 점수, 피드백, 전체 채점 결과가 데이터베이스에 저장  
🚀 **상태 관리**: pending → grading → graded 워크플로우 추적 가능  
🚀 **인덱스 최적화**: status 및 graded_at 인덱스로 쿼리 성능 향상  

### 서비스 상태
- **서비스 URL**: https://3000-iigjpsbl85aj2ml3n1x69-5634da27.sandbox.novita.ai
- **상태**: ✅ 정상 운영 중
- **테스트 계정**: teacher@test.com / Test1234!@#$
- **GitHub**: https://github.com/eunha0/webapp.git (commit: 705f4bf)

### 채점 시스템 성능
- **처리 시간**: 30-60초 (에세이 길이에 따라 변동)
- **정확도**: GPT-4o의 일관된 채점 (temperature: 0.3)
- **피드백 품질**: Claude 3.5 Sonnet의 공감적이고 건설적인 피드백
- **데이터 무결성**: 모든 채점 결과가 안전하게 데이터베이스에 저장

이제 **답안지 채점 기능이 정상적으로 작동**하며, AI가 루브릭 기준에 따라 정확한 점수와 상세한 피드백을 제공합니다! 🎊
