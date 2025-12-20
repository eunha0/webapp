# 채점 이력 및 인쇄 미리보기 수정 보고서

## 📋 문제 개요

사용자가 "고등학생용 평가 기준" (100점 만점)을 사용하여 과제를 생성하고 채점한 후 다음 세 가지 문제가 발견되었습니다:

### 🐛 발견된 문제들

1. **채점 이력 페이지 최대 점수 오류**
   - **현상**: 나의 페이지 → 채점 이력에서 평점이 "85/16"으로 표시됨
   - **예상 결과**: "85/100"으로 표시되어야 함

2. **인쇄 미리보기 "강점" 필드 누락**
   - **현상**: 인쇄 미리보기 페이지에서 각 세부 기준별 "강점" 필드 내용이 완전히 삭제됨
   - **예상 결과**: 채점 결과 검토 모달에서 보이는 것처럼 "강점" 내용이 정상적으로 표시되어야 함

3. **채점 결과 검토 모달**
   - **현상**: 최대 점수 "100"으로 정상 표시됨 ✅
   - **상태**: 정상 작동 (문제 없음)

---

## 🔍 원인 분석

### 1️⃣ 채점 이력 최대 점수 계산 오류

**파일**: `src/routes/grading.ts` (Line 154-166)

**문제 코드**:
```typescript
// Get rubric criteria count for each assignment to calculate max score
const submissionsWithMaxScore = await Promise.all((queryResult.results || []).map(async (submission: any) => {
  const criteriaCount = await db.prepare(
    'SELECT COUNT(*) as count FROM assignment_rubrics WHERE assignment_id = ?'
  ).bind(submission.assignment_id).first()
  
  // Each criterion is worth 4 points, so max score = criteria count × 4
  const count = (criteriaCount?.count as number) || 1
  const maxScore = count * 4  // ❌ 하드코딩된 계산식
  return {
    ...submission,
    max_score: maxScore
  }
}))
```

**문제점**:
- 모든 기준이 4점 만점이라고 가정하고 `count * 4`로 계산
- "고등학생용 평가 기준"은 4개 기준 × 4점 = 16점으로 계산됨
- 실제로는 각 기준의 `max_score` 값이 다를 수 있음 (예: 20, 30점 등)

**예시**:
- 4개 기준, 각각 20점, 30점, 25점, 25점 만점
- 실제 총점: 100점
- 잘못 계산된 총점: 4 × 4 = 16점 ❌

---

### 2️⃣ 인쇄 미리보기 "강점" 필드 누락

**파일**: `src/index.tsx` (Line 8124-8138)

**문제 코드**:
```typescript
<div class="space-y-3">
  <div>
    <label class="block text-sm font-semibold text-green-700 mb-1">
      <i class="fas fa-check-circle mr-1"></i     class="w-full px-3 py-2 border border-gray-300 rounded text-sm"
    >\${criterionStrengths}</textarea>  <!-- ❌ textarea 시작 태그 손상 -->
  </div>
  <div>
    <label class="block text-sm font-semibold text-orange-700 mb-1">
      <i class="fas fa-exclamation-circle mr-1"></i>개선점
    </label>
    <textarea id="editImprovements_\${index}" rows="2" 
      class="w-full px-3 py-2 border border-gray-300 rounded text-sm"
    >\${criterionImprovements}</textarea>
  </div>
</div>
```

**문제점**:
1. `editStrengths_${index}` textarea의 시작 태그가 완전히 손상됨
2. `<textarea id="editStrengths_${index}" rows="2">` 대신 `</i     class=...`로 잘못 작성됨
3. `printFeedback()` 함수가 `document.getElementById('editStrengths_${index}')`로 요소를 찾으려 할 때 `null` 반환
4. 결과적으로 `strengths` 변수가 빈 문자열 `''`이 되어 인쇄 미리보기에서 내용이 표시되지 않음

**코드 흐름**:
```javascript
// printFeedback() 함수 (Line 8535-8537)
const strengthsEl = document.getElementById(`editStrengths_${index}`);  // null 반환
const improvements El = document.getElementById(`editImprovements_${index}`);

const strengths = strengthsEl?.value || '';  // '' (빈 문자열)
const improvements = improvementsEl?.value || '';  // 정상 값
```

---

## ✅ 해결 방법

### 1️⃣ 채점 이력 최대 점수 계산 수정

**수정 코드** (`src/routes/grading.ts`):
```typescript
// Get rubric criteria with their max_score values for each assignment
const submissionsWithMaxScore = await Promise.all((queryResult.results || []).map(async (submission: any) => {
  const rubrics = await db.prepare(
    'SELECT max_score FROM assignment_rubrics WHERE assignment_id = ?'
  ).bind(submission.assignment_id).all()
  
  // Sum all max_score values from the rubrics
  // If no rubrics found, default to 4 for backward compatibility
  const maxScore = rubrics.results && rubrics.results.length > 0
    ? rubrics.results.reduce((sum: number, rubric: any) => sum + (rubric.max_score || 4), 0)
    : 4
  
  return {
    ...submission,
    max_score: maxScore
  }
}))
```

**변경 사항**:
- ✅ `COUNT(*)`로 개수만 세는 대신 실제 `max_score` 값을 가져옴
- ✅ `reduce()`를 사용하여 모든 `max_score` 값을 합산
- ✅ 기본값 4점 유지 (하위 호환성)

**효과**:
- 고등학생용 평가 기준 (20+30+25+25): 100점 ✅
- 기본 4점 기준 4개: 16점 ✅
- 모든 루브릭 유형에 대해 정확한 최대 점수 계산

---

### 2️⃣ 인쇄 미리보기 "강점" textarea 수정

**수정 코드** (`src/index.tsx`):
```typescript
<div class="space-y-3">
  <div>
    <label class="block text-sm font-semibold text-green-700 mb-1">
      <i class="fas fa-check-circle mr-1"></i>강점
    </label>
    <textarea id="editStrengths_\${index}" rows="2" 
      class="w-full px-3 py-2 border border-gray-300 rounded text-sm"
    >\${criterionStrengths}</textarea>
  </div>
  <div>
    <label class="block text-sm font-semibold text-orange-700 mb-1">
      <i class="fas fa-exclamation-circle mr-1"></i>개선점
    </label>
    <textarea id="editImprovements_\${index}" rows="2" 
      class="w-full px-3 py-2 border border-gray-300 rounded text-sm"
    >\${criterionImprovements}</textarea>
  </div>
</div>
```

**변경 사항**:
- ✅ `<textarea id="editStrengths_${index}" rows="2">` 시작 태그 복원
- ✅ 올바른 class 속성 적용
- ✅ `</label>` 태그 닫기 추가
- ✅ "강점" 레이블 텍스트 추가

**효과**:
- `document.getElementById('editStrengths_${index}')` 정상 작동
- 인쇄 미리보기에서 "강점" 내용 정상 표시
- 저장 기능에서도 "강점" 데이터 정상 수집

---

## 🧪 테스트 시나리오

### 테스트 1: 채점 이력 최대 점수 확인

1. 새 과제 만들기 → "플랫폼 루브릭" 탭 → "고등학생용 평가 기준" 선택
2. 학생 답안 추가 및 채점 실행
3. 나의 페이지 → 채점 이력 탭 이동
4. **확인**: 평점이 "85/100" 형식으로 정상 표시 ✅

### 테스트 2: 인쇄 미리보기 "강점" 필드 확인

1. 채점 결과 검토 모달 열기
2. "출력" 버튼 클릭
3. **확인**: 인쇄 미리보기 페이지에서 각 세부 기준의 "강점" 내용이 정상 표시 ✅

### 테스트 3: 채점 결과 검토 모달 확인

1. 채점 결과 검토 모달 열기
2. **확인**: 전체 점수 "85/100" 정상 표시 ✅
3. **확인**: 각 세부 기준별 점수 정상 표시 ✅

---

## 📊 영향 범위

### 수정된 파일
- `src/routes/grading.ts` (Line 154-166)
- `src/index.tsx` (Line 8124-8138)

### 영향받는 기능
- ✅ 채점 이력 페이지 점수 표시
- ✅ 인쇄 미리보기 "강점" 필드 렌더링
- ✅ 저장 기능 "강점" 데이터 수집

### 하위 호환성
- ✅ 기존 4점 만점 기준 과제: 정상 작동
- ✅ 새로운 커스텀 점수 기준: 정상 작동
- ✅ 기존 채점 데이터: 영향 없음

---

## 🚀 배포 정보

- **Git Commit**: `3c17969`
- **Commit Message**: `fix: Correct max_score calculation in grading history and repair broken strengths textarea in modal`
- **GitHub**: https://github.com/eunha0/webapp.git
- **Test URL**: https://3000-iigjpsbl85aj2ml3n1x69-5634da27.sandbox.novita.ai
- **배포 시간**: 2025-12-20

---

## ✅ 결론

세 가지 문제 모두 완전히 해결되었습니다:

1. ✅ **채점 이력 최대 점수**: 16 → 100 (정상)
2. ✅ **인쇄 미리보기 강점 필드**: 빈 값 → 정상 표시
3. ✅ **채점 결과 검토 모달**: 이미 정상 작동

**핵심 개선 사항**:
- 동적 max_score 계산으로 모든 루브릭 유형 지원
- HTML 구조 복원으로 DOM 요소 접근 정상화
- 인쇄 및 저장 기능 완전 복구

**테스트 권장 사항**:
- 브라우저 캐시 강제 새로고침 (`Ctrl + Shift + R` / `Cmd + Shift + R`)
- 새 과제 생성 후 채점하여 모든 기능 검증
- 인쇄 미리보기에서 "강점", "개선점" 내용 모두 확인
