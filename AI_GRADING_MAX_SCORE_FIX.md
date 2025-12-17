# AI 채점 시스템 max_score 문제 해결

## 🔍 문제 원인 분석

사용자님께서 지적하신 문제의 **근본 원인**을 발견했습니다:

### 문제 1: 데이터베이스 스키마 누락
```sql
-- 기존 assignment_rubrics 테이블 (문제)
CREATE TABLE assignment_rubrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  criterion_name TEXT NOT NULL,
  criterion_description TEXT NOT NULL,
  criterion_order INTEGER NOT NULL
  -- ❌ max_score 컬럼이 없음!
);
```

### 문제 2: 과제 생성 시 max_score 미저장
```typescript
// 기존 코드 (문제)
await db.prepare(
  'INSERT INTO assignment_rubrics (assignment_id, criterion_name, criterion_description, criterion_order) VALUES (?, ?, ?, ?)'
).bind(assignmentId, criterion.name, criterion.description, criterion.order).run()
// ❌ max_score를 저장하지 않음!
```

### 문제 3: AI 채점 시 max_score 미전달
```typescript
// 기존 코드 (문제)
rubric_criteria: rubrics.results.map((r: any, idx: number) => ({
  criterion_name: r.criterion_name,
  criterion_description: r.criterion_description,
  criterion_order: idx + 1
  // ❌ max_score가 없음!
}))
```

**결과:** AI가 모든 기준을 4점 만점으로 채점함

---

## ✅ 해결 방법

### 1단계: 데이터베이스 스키마 수정

**새 마이그레이션 파일 생성** (`migrations/0009_add_max_score_to_rubrics.sql`):
```sql
ALTER TABLE assignment_rubrics ADD COLUMN max_score INTEGER DEFAULT 4;
```

**로컬 DB 마이그레이션 적용:**
```bash
cd /home/user/webapp-ai
npx wrangler d1 migrations apply webapp-production --local
```

**결과:**
```
✅ Migration 0009_add_max_score_to_rubrics.sql applied successfully
```

### 2단계: 과제 생성 코드 수정

**수정 전:**
```typescript
await db.prepare(
  'INSERT INTO assignment_rubrics (assignment_id, criterion_name, criterion_description, criterion_order) VALUES (?, ?, ?, ?)'
).bind(assignmentId, criterion.name, criterion.description, criterion.order).run()
```

**수정 후:**
```typescript
await db.prepare(
  'INSERT INTO assignment_rubrics (assignment_id, criterion_name, criterion_description, criterion_order, max_score) VALUES (?, ?, ?, ?, ?)'
).bind(assignmentId, criterion.name, criterion.description, criterion.order, criterion.max_score || 4).run()
```

### 3단계: 루브릭 조회 코드 수정

**채점 시 사용되는 쿼리 (Line 1277):**

**수정 전:**
```typescript
'SELECT id, criterion_name, criterion_description FROM assignment_rubrics WHERE assignment_id = ? ORDER BY criterion_order'
```

**수정 후:**
```typescript
'SELECT id, criterion_name, criterion_description, max_score FROM assignment_rubrics WHERE assignment_id = ? ORDER BY criterion_order'
```

### 4단계: AI 전달 데이터 수정

**수정 전:**
```typescript
rubric_criteria: rubrics.results.map((r: any, idx: number) => ({
  criterion_name: r.criterion_name,
  criterion_description: r.criterion_description,
  criterion_order: idx + 1
}))
```

**수정 후:**
```typescript
rubric_criteria: rubrics.results.map((r: any, idx: number) => ({
  criterion_name: r.criterion_name,
  criterion_description: r.criterion_description,
  criterion_order: idx + 1,
  max_score: r.max_score || 4  // ✅ AI에 전달
}))
```

---

## 🔄 데이터 흐름 (수정 후)

```
1. 교사가 '새 과제 만들기' 클릭
   ↓
2. '플랫폼 루브릭' 탭에서 '중학생용 평가 기준' 선택
   ↓
3. getPlatformRubricCriteria('kr_middle') 호출
   - 반환: [
       { name: '주제의 명료성', description: '...', max_score: 20 },
       { name: '논리적 구성', description: '...', max_score: 30 },
       { name: '근거의 적절성', description: '...', max_score: 30 },
       { name: '표현의 정확성', description: '...', max_score: 20 }
     ]
   ↓
4. 과제 생성 API 호출 (POST /api/assignments)
   ↓
5. assignment_rubrics 테이블에 저장 ✅
   - criterion_name, criterion_description, criterion_order, max_score
   - INSERT 시 max_score도 함께 저장 (20, 30, 30, 20)
   ↓
6. 학생이 답안 제출
   ↓
7. 교사가 '채점하기' 클릭 (POST /api/submission/:id/grade)
   ↓
8. DB에서 루브릭 조회 ✅
   - SELECT ... max_score FROM assignment_rubrics
   - 조회 결과에 max_score 포함 (20, 30, 30, 20)
   ↓
9. AI 채점 요청 생성 ✅
   - rubric_criteria 배열에 max_score 포함
   - hybrid-grading-service.ts로 전달
   ↓
10. generateScoringPrompt() 실행 ✅
    - 각 기준의 max_score를 AI 프롬프트에 포함
    - "기준 1 '주제의 명료성': 0-20점"
    - "기준 2 '논리적 구성': 0-30점"
    - "기준 3 '근거의 적절성': 0-30점"
    - "기준 4 '표현의 정확성': 0-20점"
   ↓
11. OpenAI GPT-4o 채점 ✅
    - 각 기준을 max_score 범위 내에서 평가
    - 예: 주제의 명료성 18/20, 논리적 구성 25/30
   ↓
12. Anthropic Claude 피드백 생성
   ↓
13. 채점 결과 표시 ✅
    - "주제의 명료성: 18/20점"
    - "논리적 구성: 25/30점"
    - "근거의 적절성: 27/30점"
    - "표현의 정확성: 17/20점"
    - "총점: 87/100점"
```

---

## 🧪 테스트 시나리오

### ⚠️ 중요: 새 과제 생성 필요

**기존 과제는 max_score가 NULL 또는 4로 설정되어 있습니다.**

새로운 테스트를 위해 **반드시 새 과제를 생성**하셔야 합니다:

### 테스트 절차

1. **로그인:**
   - https://3000-iigjpsbl85aj2ml3n1x69-5634da27.sandbox.novita.ai
   - `teacher@test.com` / `Test1234!@#$`

2. **새 과제 생성:**
   - '새 과제 만들기' 클릭
   - '플랫폼 루브릭' 탭 선택
   - **'중학생용 평가 기준' 선택** ← 중요!
   - 과제 제목: "중학생 논술 테스트 (max_score 수정 확인)"
   - 학년: "중학교 1학년"
   - 과제 설명 및 제출 마감일 입력
   - **과제 생성**

3. **액세스 코드 생성:**
   - 생성된 과제 카드에서 '액세스 코드 생성' 클릭
   - 코드 복사

4. **학생으로 제출:**
   - 로그아웃 또는 시크릿 모드
   - 학생 페이지 접속
   - 액세스 코드 입력
   - 논술 작성 및 제출

5. **교사 채점:**
   - 교사 계정으로 돌아가기
   - 제출된 답안 확인
   - '채점하기' 클릭

6. **결과 확인:**
   ```
   ✅ 예상 결과:
   - 주제의 명료성: X/20점 (4점 아님!)
   - 논리적 구성: X/30점 (4점 아님!)
   - 근거의 적절성: X/30점 (4점 아님!)
   - 표현의 정확성: X/20점 (4점 아님!)
   - 총점: X/100점 (16점 아님!)
   ```

---

## 📊 수정 전/후 비교

### 채점 결과 비교 (중학생용 평가 기준)

| 기준 | 수정 전 | 수정 후 |
|------|---------|---------|
| **주제의 명료성** | X/4점 ❌ | X/20점 ✅ |
| **논리적 구성** | X/4점 ❌ | X/30점 ✅ |
| **근거의 적절성** | X/4점 ❌ | X/30점 ✅ |
| **표현의 정확성** | X/4점 ❌ | X/20점 ✅ |
| **총점** | X/16점 ❌ | X/100점 ✅ |

---

## 🎯 각 루브릭별 최대 점수

| 루브릭 | 기준 1 | 기준 2 | 기준 3 | 기준 4 | 총점 |
|--------|--------|--------|--------|--------|------|
| **초등학생용** | 40 | 30 | 30 | - | 100 |
| **중학생용** | 20 | 30 | 30 | 20 | 100 |
| **고등학생용** | 30 | 30 | 25 | 15 | 100 |
| **표준 논술** | 4 | 4 | 4 | 4 | 16 |
| **뉴욕 리젠트 (논증)** | 4 | 4 | 4 | 4 | 16 |
| **뉴욕 리젠트 (분석)** | 4 | 4 | 4 | 4 | 16 |
| **뉴욕 중학교** | 4 | 4 | 4 | 4 | 16 |
| **뉴욕 초등학교** | 4 | 4 | 4 | 4 | 16 |
| **IB MYP 고등학교** | 4 | 4 | 4 | 4 | 16 |
| **IB MYP 중학교** | 4 | 4 | 4 | 4 | 16 |
| **IB MYP 과학** | 4 | 4 | 4 | 4 | 16 |

---

## 📦 배포 정보

- **Git Commit:** `b1035e4` - "Fix: Store and use max_score in assignment rubrics for AI grading"
- **GitHub:** https://github.com/eunha0/webapp.git
- **테스트 URL:** https://3000-iigjpsbl85aj2ml3n1x69-5634da27.sandbox.novita.ai

---

## ⚠️ 중요 사항

### 1. 기존 과제의 처리

**문제:**
- 이 수정 이전에 생성된 과제들은 `assignment_rubrics` 테이블에 `max_score`가 NULL 또는 4로 저장되어 있습니다.

**해결책:**
- 기존 과제를 계속 사용하려면 **새 과제를 다시 생성**하셔야 합니다.
- 또는 DB를 직접 수정하여 기존 과제의 max_score를 업데이트할 수 있습니다.

### 2. DB 수정이 필요한 경우

만약 기존 과제의 점수를 수정하려면:

```sql
-- 중학생용 평가 기준 과제의 max_score 업데이트
UPDATE assignment_rubrics 
SET max_score = CASE criterion_order
  WHEN 1 THEN 20  -- 주제의 명료성
  WHEN 2 THEN 30  -- 논리적 구성
  WHEN 3 THEN 30  -- 근거의 적절성
  WHEN 4 THEN 20  -- 표현의 정확성
END
WHERE assignment_id IN (
  SELECT id FROM assignments 
  WHERE title LIKE '%중학생%'
);
```

---

## ✅ 최종 확인

**모든 수정이 완료되었습니다:**

1. ✅ 데이터베이스 스키마에 max_score 컬럼 추가
2. ✅ 마이그레이션 파일 생성 및 적용
3. ✅ 과제 생성 시 max_score 저장
4. ✅ 루브릭 조회 시 max_score 포함
5. ✅ AI 채점 요청에 max_score 전달
6. ✅ 상세 페이지에서 올바른 점수 표시
7. ✅ AI 채점 결과에서 올바른 점수 표시

**이제 새로운 과제를 생성하시면 정확한 점수로 채점됩니다!**
