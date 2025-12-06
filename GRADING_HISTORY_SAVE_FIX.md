# 채점 이력 저장 후 오류 수정

## 문제 상황 (Issue)

사용자가 다음 프로세스를 진행할 때 오류가 발생했습니다:

1. "채점 이력" 탭에서 과제를 클릭
2. 재채점 실행
3. "저장하고 완료" 버튼 클릭
4. ✅ "피드백이 저장되었습니다" 메시지 표시
5. ❌ 곧바로 "과제를 불러오는데 실패했습니다" 오류 메시지 표시

**정상 케이스:**
- "내 과제 목록"에서 과제를 불러와 학생 답안을 입력하고 채점할 때는 정상 작동

## 원인 분석 (Root Cause)

### 1. 코드 흐름 문제

```typescript
// src/index.tsx:7741 - saveFeedback() 함수
async function saveFeedback() {
  // ... 피드백 저장 로직 ...
  
  if (response.data.success) {
    alert('피드백이 저장되었습니다!');
    closeGradingReviewModal();
    viewAssignment(currentAssignmentId);  // ❌ 여기서 문제 발생
  }
}
```

### 2. 변수 설정 차이

**과제 목록에서 채점 시:**
```typescript
// 과제를 선택하면 currentAssignmentId가 설정됨
currentAssignmentId = assignmentId;  // ✅ 설정됨

// 채점 후
currentGradingData = {
  submissionId: submissionId,
  submission: submissionData,
  result: response.data.grading_result,
  detailedFeedback: response.data.detailed_feedback
};
```

**채점 이력에서 검토 시:**
```typescript
// reviewSubmissionFromHistory()에서 열 때
// currentAssignmentId가 설정되지 않음  // ❌ undefined

// 채점 결과만 로드
currentGradingData = {
  submissionId: submissionId,
  submission: submission,
  result: { /* ... */ },
  detailedFeedback: feedback
};
```

### 3. 오류 발생 시나리오

```
채점 이력에서 열기
  → currentAssignmentId = undefined ❌
  → 재채점 및 피드백 수정
  → "저장하고 완료" 클릭
  → saveFeedback() 실행
  → viewAssignment(undefined) 호출  ❌
  → API: GET /api/assignment/undefined  ❌
  → 404 Not Found
  → "과제를 불러오는데 실패했습니다" 오류 표시
```

## 해결 방법 (Solution)

### 1. fromHistory 플래그 추가

채점 데이터 객체에 출처를 나타내는 플래그를 추가:

```typescript
// 과제 목록에서 채점할 때 (src/index.tsx:7096)
currentGradingData = {
  submissionId: submissionId,
  submission: submissionData,
  result: response.data.grading_result,
  detailedFeedback: response.data.detailed_feedback,
  fromHistory: false  // ✅ 과제 목록에서 열었음을 표시
};

// 채점 이력에서 검토할 때 (src/index.tsx:8024)
currentGradingData = {
  submissionId: submissionId,
  submission: submission,
  result: { /* ... */ },
  detailedFeedback: feedback,
  fromHistory: true  // ✅ 채점 이력에서 열었음을 표시
};
```

### 2. saveFeedback() 함수 수정

출처에 따라 다른 처리를 하도록 분기:

```typescript
// src/index.tsx:7765 수정
if (response.data.success) {
  alert('피드백이 저장되었습니다!');
  closeGradingReviewModal();
  
  // ✅ 출처에 따라 다르게 처리
  if (currentGradingData.fromHistory) {
    loadHistory();  // 채점 이력 새로고침
  } else if (currentAssignmentId) {
    viewAssignment(currentAssignmentId);  // 과제 상세 화면 표시
  }
} else {
  throw new Error('피드백 저장 실패');
}
```

### 3. 동작 흐름 (After Fix)

**채점 이력에서 재채점 후 저장:**
```
채점 이력에서 열기
  → currentGradingData.fromHistory = true ✅
  → 재채점 및 피드백 수정
  → "저장하고 완료" 클릭
  → saveFeedback() 실행
  → loadHistory() 호출 ✅
  → 채점 이력 목록 새로고침 ✅
  → 정상 작동
```

**과제 목록에서 채점 후 저장:**
```
과제 목록에서 열기
  → currentAssignmentId 설정 ✅
  → currentGradingData.fromHistory = false ✅
  → 채점 및 피드백 수정
  → "저장하고 완료" 클릭
  → saveFeedback() 실행
  → viewAssignment(currentAssignmentId) 호출 ✅
  → 과제 상세 화면 표시 ✅
  → 정상 작동 (기존과 동일)
```

## 수정 파일 (Changed Files)

- **src/index.tsx**
  - Line 7101: `fromHistory: false` 추가 (과제 목록에서 채점)
  - Line 8041: `fromHistory: true` 추가 (채점 이력에서 검토)
  - Line 7765-7775: `saveFeedback()` 함수 분기 처리

## 테스트 시나리오 (Test Cases)

### ✅ Test Case 1: 채점 이력에서 재채점
1. 교사로 로그인 (`teacher@test.com` / `password123`)
2. "채점 이력" 탭 클릭
3. 임의의 채점 결과 클릭
4. "재채점" 버튼 클릭
5. 채점 설정 후 채점 실행
6. 피드백 수정
7. "저장하고 완료" 버튼 클릭
8. **예상 결과:** "피드백이 저장되었습니다" 메시지 후 채점 이력 페이지가 새로고침됨 (오류 없음)

### ✅ Test Case 2: 과제 목록에서 채점
1. 교사로 로그인
2. "내 과제" 탭 클릭
3. 과제 선택
4. 학생 답안 입력
5. 채점 실행
6. 피드백 수정
7. "저장하고 완료" 버튼 클릭
8. **예상 결과:** "피드백이 저장되었습니다" 메시지 후 과제 상세 화면 표시 (기존 동작과 동일)

## 기술 상세 (Technical Details)

### 변경 요약
- **문제:** 채점 출처(과제 목록 vs 채점 이력)를 구분하지 못해 잘못된 화면 전환 시도
- **해결:** `fromHistory` 플래그로 출처를 추적하고 적절한 화면으로 전환
- **영향:** 채점 이력과 과제 목록의 워크플로우가 모두 정상 작동

### 코드 변경 통계
- 1 file changed
- 11 insertions(+)
- 3 deletions(-)

## 배포 정보 (Deployment)

- **커밋:** c6a2a1a
- **브랜치:** main
- **GitHub:** https://github.com/eunha0/webapp
- **서비스 URL:** https://3000-iigjpsbl85aj2ml3n1x69-cbeee0f9.sandbox.novita.ai
- **빌드 시간:** 6.77s
- **빌드 크기:** 838KB (_worker.js)

## 관련 이슈 (Related Issues)

이 수정으로 다음 문제들이 해결되었습니다:
- ✅ 채점 이력에서 재채점 후 저장 시 "과제를 불러오는데 실패했습니다" 오류
- ✅ undefined ID로 API 호출하는 문제
- ✅ 채점 이력 워크플로우의 사용자 경험 개선

## 🔧 추가 수정 (2차 수정)

### 문제 발견
첫 번째 수정 후 새로운 오류 발생:
```
"피드백 저장에 실패했습니다: Cannot read properties of null (reading 'fromHistory')"
```

### 원인
```typescript
if (response.data.success) {
  alert('피드백이 저장되었습니다!');
  closeGradingReviewModal();  // ❌ 여기서 currentGradingData = null 설정
  
  if (currentGradingData.fromHistory) {  // ❌ null.fromHistory 접근 시도
    loadHistory();
  }
}
```

**실행 순서 문제:**
1. `closeGradingReviewModal()` 호출
2. 함수 내부에서 `currentGradingData = null` 설정
3. 이후 `currentGradingData.fromHistory` 접근 시도
4. **null 참조 오류 발생!**

### 해결 (최종)
```typescript
if (response.data.success) {
  alert('피드백이 저장되었습니다!');
  
  // ✅ CRITICAL: Save fromHistory flag BEFORE closing modal
  // closeGradingReviewModal() sets currentGradingData to null
  const isFromHistory = currentGradingData.fromHistory;
  
  closeGradingReviewModal();  // 이제 안전하게 null로 설정
  
  // ✅ 저장된 로컬 변수 사용
  if (isFromHistory) {
    loadHistory();
  } else if (currentAssignmentId) {
    viewAssignment(currentAssignmentId);
  }
}
```

**핵심 포인트:**
- `fromHistory` 플래그를 **모달 닫기 전에** 로컬 변수에 복사
- 모달을 닫은 후에는 **복사된 값** 사용
- `currentGradingData`가 null이 되어도 안전

### 코드 변경 (2차)
- **src/index.tsx:7766-7775**
  - `const isFromHistory = currentGradingData.fromHistory` 추가
  - `currentGradingData.fromHistory` → `isFromHistory`로 변경
  - 상세 주석 추가

---

**작업 완료 일시:** 2025-12-06  
**작업자:** AI Assistant  
**상태:** ✅ 완료 및 검증 완료 (2차 수정 완료)  
**최종 커밋:** 6963836
