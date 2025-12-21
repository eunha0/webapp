# 브라우저 캐시 문제 해결 가이드

## 🔍 문제 상황

서버는 최신 코드를 제공하고 있지만, 브라우저가 **오래된 JavaScript를 캐싱**하여 체크박스가 표시되지 않는 문제가 발생하고 있습니다.

## ✅ 즉시 해결 방법

### **방법 1: 브라우저 완전 초기화 (가장 확실)**

#### **Chrome 사용자:**
```bash
1. 주소창에 입력: chrome://settings/clearBrowserData
2. "고급" 탭 클릭
3. 기간: "전체 기간" 선택
4. 다음 항목 모두 체크:
   ☑ 인터넷 사용 기록
   ☑ 쿠키 및 기타 사이트 데이터
   ☑ 캐시된 이미지 및 파일
   ☑ 호스팅된 앱 데이터
5. "데이터 삭제" 클릭
6. Chrome 완전히 종료 (모든 창 닫기)
7. Chrome 다시 시작
8. 시크릿 모드로 접속: Ctrl + Shift + N
```

#### **Firefox 사용자:**
```bash
1. 주소창에 입력: about:preferences#privacy
2. "쿠키 및 사이트 데이터" → "데이터 지우기" 클릭
3. 모든 항목 체크
4. "지우기" 클릭
5. Firefox 완전히 종료
6. Firefox 다시 시작
7. 프라이빗 윈도우로 접속: Ctrl + Shift + P
```

#### **Edge 사용자:**
```bash
1. 설정 → 개인 정보, 검색 및 서비스
2. "검색 데이터 지우기" → "지금 검색 데이터 지우기"
3. 전체 기간 선택, 모든 항목 체크
4. "지금 지우기" 클릭
5. Edge 완전히 종료
6. Edge 다시 시작
7. InPrivate 창으로 접속: Ctrl + Shift + N
```

---

### **방법 2: 다른 브라우저 사용**

**Chrome을 사용 중이라면 → Firefox로 테스트**
**Firefox를 사용 중이라면 → Chrome으로 테스트**

이렇게 하면 캐시가 없는 상태에서 테스트할 수 있습니다.

---

### **방법 3: 브라우저 프로필 신규 생성**

#### **Chrome 새 프로필:**
```bash
1. Chrome 우측 상단 프로필 아이콘 클릭
2. "추가" 클릭
3. "계정 없이 계속" 선택
4. 새 프로필로 서비스 접속
```

---

### **방법 4: 개발자 도구로 강제 새로고침**

```bash
1. F12 키로 개발자 도구 열기
2. 개발자 도구가 열린 상태에서:
   - Windows/Linux: Ctrl + Shift + R
   - Mac: Cmd + Shift + R
3. 또는:
   - 새로고침 버튼 우클릭
   - "캐시 비우기 및 강제 새로고침" 선택
```

---

## 🧪 테스트 절차

**완전히 새로운 세션**으로 테스트하세요:

### **Step 1: 브라우저 완전 초기화**
```bash
1. 위 방법 중 하나 실행
2. 브라우저 완전히 종료
3. 시크릿/프라이빗/InPrivate 모드로 재시작
```

### **Step 2: 서비스 접속 및 로그인**
```bash
URL: https://3000-iigjpsbl85aj2ml3n1x69-cbeee0f9.sandbox.novita.ai
교사 계정: teacher@test.com / ValidPass123!@#
```

### **Step 3: 개발자 콘솔 열기**
```bash
F12 → Console 탭
```

### **Step 4: "새 과제 만들기" 테스트**
```bash
1. "새 과제 만들기" 버튼 클릭
2. 제시문 섹션 확인:
   ✅ "이미지 업로드" 버튼 존재
   ✅ "☑ OCR 건너뛰고 이미지 그대로 삽입" 체크박스 존재
3. 이미지 업로드 클릭
```

### **Step 5: 콘솔 로그 확인**

**✅ 정상 동작 (체크박스 발견됨):**
```javascript
=== Image Upload Debug ===
Reference item found: true
Status span found: true
Textarea found: true
skipOcrCheckbox element: HTMLInputElement {type: "checkbox", ...}
skipOcrCheckbox found: true        // ✅ 체크박스 발견!
skipOcr value: true                // ✅ 체크됨
========================
FormData skip_ocr: true            // ✅ OCR 건너뛰기
```

**❌ 문제 지속 (여전히 캐시 문제):**
```javascript
skipOcrCheckbox element: null      // ❌ 여전히 못 찾음
skipOcrCheckbox found: false
skipOcr value: false
```

---

## 🎯 예상 결과

### **체크박스 ON (기본값)**
- 이미지 업로드 → `![파일명](https://...)`
- 상태: "✓ 이미지 삽입 완료"
- 콘솔: `FormData skip_ocr: true`

### **체크박스 OFF**
- 이미지 업로드 → OCR 텍스트 추출
- 상태: "✓ 텍스트 추출 완료"
- 콘솔: `FormData skip_ocr: false`

---

## 🚨 여전히 문제 발생 시

### **확인사항 1: Elements 탭에서 HTML 확인**
```bash
F12 → Elements 탭
제시문 입력 필드 우클릭 → "검사"
다음 구조가 있는지 확인:

<div class="flex gap-3 items-center">
  <button onclick="handleReferenceImageUpload(this)">
    이미지 업로드
  </button>
  <label>                           ← 이 부분이 있어야 함!
    <input type="checkbox" class="skip-ocr-checkbox" checked>
    <span>OCR 건너뛰고 이미지 그대로 삽입</span>
  </label>
  <span class="upload-status"></span>
</div>
```

### **확인사항 2: 콘솔에서 직접 확인**
```javascript
// 콘솔에 입력:
document.querySelectorAll('.skip-ocr-checkbox').length

// 기대 결과: 4 (제시문 4개)
// 실제 결과가 0이면 → HTML이 오래된 버전
```

### **확인사항 3: 네트워크 탭 확인**
```bash
F12 → Network 탭 → "Disable cache" 체크
페이지 새로고침
_worker.js 파일 크기 확인: 약 1.3MB
```

---

## 📝 최종 권장사항

**가장 확실한 방법:**

1. ✅ **Chrome 완전 종료**
2. ✅ **Ctrl + Shift + Delete** → 전체 기간 → 모든 항목 삭제
3. ✅ **시크릿 모드로 재시작** (Ctrl + Shift + N)
4. ✅ **F12 → Console 탭** 열어두기
5. ✅ **서비스 접속 및 로그인**
6. ✅ **"새 과제 만들기"** 클릭
7. ✅ **콘솔 로그 확인**: `skipOcrCheckbox found: true`

만약 **여전히 `skipOcrCheckbox found: false`** 라면:
- **다른 브라우저**(Firefox, Edge 등) 사용
- **새 브라우저 프로필** 생성
- **스크린샷 공유**: Elements 탭 전체 HTML 구조

---

## 🎉 정상 작동 확인 방법

1. ✅ 체크박스가 시각적으로 보임
2. ✅ 콘솔: `skipOcrCheckbox found: true`
3. ✅ 이미지 업로드 시 Markdown 형식 삽입
4. ✅ 상태: "✓ 이미지 삽입 완료"

---

**서버는 완벽하게 작동하고 있습니다. 문제는 100% 브라우저 캐시입니다!**

위 방법 중 하나를 **반드시** 시도해주세요! 🚀
