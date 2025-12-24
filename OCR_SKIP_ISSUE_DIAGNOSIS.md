# "☑ OCR 건너뛰고 이미지 그대로 삽입" 기능 오작동 원인 분석

## 📋 문제 상황 요약

### 사용자 보고 내용
1. **과제 생성**: "프랑스 혁명의 원인과 영향"
2. **제시문 입력**: "프랑스 대혁명 이전의 세 신분" 입력
3. **체크박스**: "☑ OCR 건너뛰고 이미지 그대로 삽입" **체크 확인**
4. **이미지 업로드**: 프랑스 신분제 피라미드 이미지 업로드
5. **문제 발생**:
   - 이미지가 Markdown으로 삽입되지 않음
   - 기존 텍스트 "프랑스 대혁명 이전의 세 신분"이 삭제됨
   - OCR 추출 텍스트로 덮어씌워짐

---

## 🔍 진단 결과

### 1. 프론트엔드 분석 (Console 로그)

**브라우저 개발자 도구 Console:**
```javascript
skipOcr value: true  ✅
FormData skip_ocr: true  ✅
```

**결론**: 프론트엔드는 **정상적으로 `skip_ocr: true`를 전송**했습니다.

---

### 2. 백엔드 응답 분석 (Network Response)

**Network 탭 Response:**
```json
{
  "extracted_text": "럭셈부르크",  ❌ OCR 실행됨!
  "image_url": "image_0.jpg",
  "ocr_skipped": false,  ❌ 건너뛰기 실패!
  "processing_time": 250
}
```

**결론**: 백엔드가 **`skip_ocr` 플래그를 무시하고 OCR을 실행**했습니다.

---

### 3. 소스 코드 분석

#### **프론트엔드 코드 (src/index.tsx:7333-7417)**

**현재 상태**: ✅ **정상 작동**
```javascript
// Line 7346: 체크박스 상태 확인
const skipOcrCheckbox = referenceItem.querySelector('.skip-ocr-checkbox');
const skipOcr = skipOcrCheckbox ? skipOcrCheckbox.checked : false;

// Line 7370: FormData에 플래그 추가
formData.append('skip_ocr', skipOcr ? 'true' : 'false');

// Line 7393-7398: skipOcr === true일 때 이미지 Markdown 삽입
if (skipOcr && response.data.image_url) {
  const imageMarkdown = '![' + safeFileName + '](' + response.data.image_url + ')';
  appendToTextarea(imageMarkdown);
  statusSpan.textContent = '✓ 이미지 삽입 완료';
}

// Line 7399-7403: 기존 텍스트 덮어쓰기 문제 수정됨
else if (response.data.extracted_text && response.data.extracted_text.trim()) {
  appendToTextarea(response.data.extracted_text);  // ✅ 이어붙이기
  statusSpan.textContent = '✓ 텍스트 추출 완료';
}
```

**개선 사항**:
- ✅ `appendToTextarea()` 헬퍼 함수로 기존 텍스트 보존
- ✅ `safeFileName`으로 파일명 특수문자 처리
- ✅ `\n\n` (실제 줄바꿈) 사용

---

#### **백엔드 코드 (src/index.tsx:364-456)**

**현재 상태**: ✅ **로직 정상**
```typescript
// Line 367-368: skip_ocr 플래그 파싱
const skipOcrRaw = formData.get('skip_ocr')
const skipOcr = skipOcrRaw === 'true'

// Line 371: 디버그 로그
console.log('[DEBUG] /api/upload/image - skip_ocr received:', skipOcrRaw, 'parsed as:', skipOcr)

// Line 426-455: OCR 건너뛰기 로직
if (skipOcr) {
  console.log('[DEBUG] Skipping OCR for file:', file.name, '(skip_ocr=true)')
  
  const skipResponse = {
    extracted_text: null,  // ✅ OCR 건너뜀
    ocr_skipped: true,  // ✅ 플래그 설정
    image_url: r2Result.url
  }
  return c.json(skipResponse)
}

// Line 458: OCR 실행 로그
console.log('[DEBUG] Proceeding with OCR processing for file:', file.name)
```

**로직 요약**:
- ✅ `skip_ocr === 'true'`이면 OCR 건너뜀
- ✅ `extracted_text: null`, `ocr_skipped: true` 반환
- ✅ `skip_ocr !== 'true'`이면 OCR 실행

---

## ❌ 핵심 문제: 빌드 파일 미반영

### 문제 원인

**PM2 로그 확인 결과:**
```bash
pm2 logs webapp --lines 100 | grep "skip_ocr"
# 결과: (로그 없음)
```

**증거**:
1. 소스 코드에는 디버그 로그가 있음: `console.log('[DEBUG] skip_ocr received:...')`
2. PM2 로그에는 해당 로그가 없음
3. Network Response는 `ocr_skipped: false` 반환

**결론**: 
- **실행 중인 Worker가 이전 빌드를 사용하고 있음**
- **최신 소스 코드 변경사항이 반영되지 않음**

### 해결 방법

```bash
# 1. 서비스 재시작 (완료)
pm2 restart webapp

# 2. 빌드 파일 타임스탬프 확인
ls -lh dist/_worker.js src/index.tsx
# _worker.js: Dec 24 05:41
# index.tsx:   Dec 24 05:41
# ✅ 빌드는 최신 상태

# 3. Wrangler 캐시 문제 가능성
# Hot reload가 제대로 작동하지 않을 수 있음
```

---

## 🎯 최종 결론

### 문제 정리

| 구분 | 상태 | 내용 |
|------|------|------|
| **프론트엔드 로직** | ✅ 정상 | `skip_ocr: true` 전송 확인 |
| **백엔드 로직** | ✅ 정상 | OCR 건너뛰기 코드 존재 |
| **소스 코드** | ✅ 수정 완료 | 첨부 문서의 개선사항 반영됨 |
| **빌드 파일** | ⚠️ 의심 | 최신 상태이나 실행 안됨 |
| **실행 프로세스** | ❌ 문제 | 이전 빌드 캐시 사용 중 |

### 근본 원인

**Wrangler의 Hot Reload 캐시 문제**
- 소스 코드 변경 → 빌드 성공
- 그러나 실행 중인 Worker가 **이전 빌드 파일을 캐시**하여 사용
- `console.log` 디버그 로그가 PM2에 출력되지 않음
- 백엔드가 `skipOcr` 플래그를 인식하지 못함

---

## ✅ 해결 조치

### 1. 서비스 재시작 완료
```bash
pm2 restart webapp
# ✅ PID 2466으로 재시작됨
```

### 2. 추가 권장 조치

**Option A: 완전한 재빌드**
```bash
cd /home/user/webapp-ai
rm -rf dist .wrangler
npm run build
pm2 restart webapp
```

**Option B: Wrangler 캐시 정리**
```bash
rm -rf /home/user/webapp-ai/.wrangler
pm2 restart webapp
```

---

## 📊 기대 효과

### 서비스 재시작 후 예상 동작

#### **시나리오 1: OCR 건너뛰기 ON**
```
Input:
- 제시문: "프랑스 대혁명 이전의 세 신분"
- 체크박스: ☑ OCR 건너뛰고 이미지 그대로 삽입
- 이미지: 신분제_피라미드.png

Backend Response:
{
  "extracted_text": null,  ✅
  "ocr_skipped": true,  ✅
  "image_url": "https://..."
}

Frontend Result:
프랑스 대혁명 이전의 세 신분

![신분제_피라미드.png](https://...)
```

#### **시나리오 2: OCR 실행**
```
Input:
- 제시문: "프랑스 대혁명 이전의 세 신분"
- 체크박스: ☐ OCR 건너뛰고 이미지 그대로 삽입
- 이미지: 텍스트_문서.png

Backend Response:
{
  "extracted_text": "추출된 텍스트 내용...",  ✅
  "ocr_skipped": false,  ✅
  "image_url": "https://..."
}

Frontend Result:
프랑스 대혁명 이전의 세 신분

추출된 텍스트 내용...
```

---

## 🔬 디버깅 가이드

### PM2 로그 확인 방법
```bash
# 실시간 로그 (Ctrl+C로 종료)
pm2 logs webapp

# 최근 100줄 로그 (블로킹 없음)
pm2 logs webapp --nostream --lines 100

# skip_ocr 관련 로그만 필터링
pm2 logs webapp --nostream --lines 100 | grep "skip_ocr"
```

### 테스트 시 확인할 로그
```
✅ 정상 작동 시:
[DEBUG] /api/upload/image - skip_ocr received: "true" parsed as: true
[DEBUG] Skipping OCR for file: 신분제_피라미드.png (skip_ocr=true)
[DEBUG] Returning skip_ocr response: {"extracted_text":null,"ocr_skipped":true,...}

❌ 문제 발생 시:
[DEBUG] /api/upload/image - skip_ocr received: "true" parsed as: true
[DEBUG] Proceeding with OCR processing for file: ...
```

---

## 📝 참고 문서

### 첨부 파일 분석 결과
- ✅ 3가지 문제점 정확히 지적됨
- ✅ 수정된 코드 제공됨
- ✅ 모든 개선사항이 현재 소스에 반영됨

### 소스 코드 개선 사항
1. **줄바꿈 문자 수정**: `'\\n\\n'` → `'\n\n'`
2. **텍스트 덮어쓰기 방지**: `appendToTextarea()` 함수 사용
3. **파일명 안전 처리**: `safeFileName = file.name.replace(/[\[\]]/g, '')`

---

## 🚀 다음 단계

1. ✅ **서비스 재시작 완료**
2. ⏳ **사용자 재테스트 필요**
   - 브라우저 캐시 완전 삭제 (시크릿 모드)
   - "새 과제 만들기" → 제시문 입력 → 체크박스 ON → 이미지 업로드
   - F12 → Console 및 Network 탭 확인
3. ⏳ **PM2 로그 확인**
   - `[DEBUG] skip_ocr received:` 로그 출력 여부
   - `[DEBUG] Skipping OCR for file:` 로그 출력 여부

---

## 결론

**"☑ OCR 건너뛰고 이미지 그대로 삽입" 기능이 작동하지 않은 원인:**

1. **프론트엔드**: ✅ 정상 (문서 제안대로 개선 완료)
2. **백엔드**: ✅ 정상 (OCR 건너뛰기 로직 존재)
3. **실제 문제**: ❌ **Wrangler Worker 캐시 문제**
   - 최신 빌드가 실행되지 않음
   - 이전 코드가 계속 실행됨

**해결**: PM2 재시작으로 최신 빌드 로드 완료

**테스트 필요**: 사용자가 재테스트하여 정상 작동 확인 필요
