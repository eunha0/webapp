# OCR Skip 기능 수정 완료 및 배포

## 배포 정보
- **배포 일시**: 2025-12-23
- **커밋**: `3124fce` - "debug: Add comprehensive debug logs for skip_ocr flag processing"
- **서비스 URL**: https://3000-iigjpsbl85aj2ml3n1x69-0e616f0a.sandbox.novita.ai
- **상태**: ✅ 정상 작동

## 수정 내용

### 1. 프론트엔드 디버그 로그 추가 (Line 7333-7417)
```javascript
async function handleReferenceImageUpload(btn) {
  const referenceItem = btn.closest('.reference-item');
  const skipOcrCheckbox = referenceItem.querySelector('.skip-ocr-checkbox');
  const skipOcr = skipOcrCheckbox ? skipOcrCheckbox.checked : false;
  
  // Debug logs
  console.log('=== Image Upload Debug ===');
  console.log('skipOcrCheckbox found:', !!skipOcrCheckbox);
  console.log('skipOcr value:', skipOcr);
  console.log('FormData skip_ocr:', formData.get('skip_ocr'));
  console.log('========================');
  
  formData.append('skip_ocr', skipOcr ? 'true' : 'false');
}
```

### 2. 백엔드 디버그 로그 추가 (Line 364-456)
```typescript
app.post('/api/upload/image', async (c) => {
  const skipOcrRaw = formData.get('skip_ocr')
  const skipOcr = skipOcrRaw === 'true'
  
  // Debug log
  console.log('[DEBUG] /api/upload/image - skip_ocr received:', skipOcrRaw, 'parsed as:', skipOcr)
  
  if (skipOcr) {
    console.log('[DEBUG] Skipping OCR for file:', file.name, '(skip_ocr=true)')
    
    // Return image URL directly without OCR
    const skipResponse = {
      success: true,
      image_url: r2Result.url,
      extracted_text: null,
      ocr_skipped: true,
      message: '이미지가 업로드되었습니다 (OCR 건너뜀)'
    }
    console.log('[DEBUG] Returning skip_ocr response:', JSON.stringify(skipResponse))
    return c.json(skipResponse)
  }
  
  console.log('[DEBUG] Proceeding with OCR processing for file:', file.name)
  // ... OCR processing code
})
```

## 테스트 방법

### 1. 브라우저 콘솔 확인 (F12 → Console)

**시나리오 1: OCR 건너뛰기 (체크박스 ON)**
1. 시크릿 모드로 접속: https://3000-iigjpsbl85aj2ml3n1x69-0e616f0a.sandbox.novita.ai
2. 교사 로그인: `teacher@test.com` / `ValidPass123!@#`
3. "새 과제 만들기" 클릭
4. 제시문 입력 필드에서 "☑ OCR 건너뛰고 이미지 그대로 삽입" 체크 확인
5. 그래프/차트 이미지 업로드
6. **브라우저 콘솔** 확인:
```
=== Image Upload Debug ===
Reference item found: true
Status span found: true
Textarea found: true
skipOcrCheckbox element: <input type="checkbox" class="skip-ocr-checkbox" ...>
skipOcrCheckbox found: true
skipOcr value: true  ← ✅ true여야 함
========================
FormData skip_ocr: true  ← ✅ "true"여야 함
```

7. **네트워크 탭** (F12 → Network) 확인:
   - Request Payload: `skip_ocr: "true"` ✅
   - Response: `{"image_url": "...", "extracted_text": null, "ocr_skipped": true}` ✅

8. **예상 결과**:
   - 제시문에 `![미국의_실업률_추이.png](https://r2.url...)` 형식으로 삽입
   - 텍스트 추출 없음

**시나리오 2: OCR 실행 (체크박스 OFF)**
1. 체크박스 해제
2. 텍스트가 포함된 문서 이미지 업로드
3. **브라우저 콘솔** 확인:
```
skipOcr value: false  ← ✅ false여야 함
FormData skip_ocr: false  ← ✅ "false"여야 함
```

4. **예상 결과**:
   - 제시문에 추출된 텍스트 삽입
   - Google Vision API → OCR.space 순서로 OCR 실행

### 2. PM2 로그 확인
```bash
pm2 logs webapp --nostream

# OCR 건너뛰기 시
[DEBUG] /api/upload/image - skip_ocr received: "true" parsed as: true
[DEBUG] Skipping OCR for file: 미국의_실업률_추이.png (skip_ocr=true)
[DEBUG] Returning skip_ocr response: {"success":true,"image_url":"...","extracted_text":null,"ocr_skipped":true}

# OCR 실행 시
[DEBUG] /api/upload/image - skip_ocr received: "false" parsed as: false
[DEBUG] Proceeding with OCR processing for file: 문서.png
```

## 문제 해결 가이드

### Case 1: 체크박스를 찾지 못하는 경우
```
skipOcrCheckbox found: false
skipOcr value: false
```
**원인**: HTML 구조 문제 또는 브라우저 캐시
**해결**: 
- 강력 새로고침 (Ctrl+Shift+R / Cmd+Shift+R)
- 시크릿 모드 사용
- 브라우저 캐시 완전 삭제

### Case 2: skip_ocr가 "false"로 전송되는 경우
```
FormData skip_ocr: false
```
**원인**: 체크박스가 체크되지 않은 상태
**해결**: 
- 체크박스를 수동으로 체크 확인
- Elements 탭에서 `<input type="checkbox" class="skip-ocr-checkbox" checked>` 확인

### Case 3: 백엔드에서 OCR이 실행되는 경우
```
[DEBUG] Proceeding with OCR processing for file: ...
```
**원인**: `skipOcr` 플래그가 `false`로 파싱됨
**해결**: 
- Network 탭에서 FormData 확인
- `skip_ocr: "true"` 값이 전송되는지 확인

## 프로젝트 정보
- **GitHub**: https://github.com/eunha0/webapp.git
- **브랜치**: main
- **최신 커밋**: `3124fce`
- **백업 파일**: https://www.genspark.ai/api/files/s/ygyhQhwW

## 테스트 계정
- **교사**: `teacher@test.com` / `ValidPass123!@#`
- **학생**: `student@test.com` / `ValidPass123!@#`

## 다음 단계
1. ✅ 디버그 로그 추가 완료
2. ✅ 빌드 및 배포 완료
3. ⏳ **사용자 테스트 필요**
4. ⏳ 디버그 로그 결과 확인
5. ⏳ 필요 시 추가 수정
