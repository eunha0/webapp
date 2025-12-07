# Google Cloud Vision API 통합 완료

## 📋 개요
과제 제시문과 학생 답안 이미지에서 **Google Cloud Vision API를 우선적으로 사용**하여 텍스트를 추출하도록 시스템을 수정했습니다.

## 🎯 문제점
- 기존: OCR.space API를 먼저 시도하고, 실패 시에만 Google Vision API를 fallback으로 사용
- 사용자 요구사항: Google Cloud Vision API를 우선 사용하여 더 높은 정확도의 OCR 수행

## ✅ 해결 방법

### 1. OCR 처리 순서 변경

**이전 순서:**
```
OCR.space (무료) → 실패 시 → Google Vision API (fallback)
```

**변경된 순서:**
```
Google Vision API (우선) → 실패 시 → OCR.space (fallback)
```

### 2. 구현 로직

#### **환경 변수 설정 시 (credentials 있을 때)**
```javascript
try {
  // 1. Google Vision API 시도 (우선)
  const ocrResult = await processImageOCR(file, credentialsJson)
  
  if (ocrResult.success && ocrResult.extractedText) {
    // 성공 → DB 업데이트 및 로그 기록 (Google Vision)
    return extractedText
  }
} catch (googleError) {
  // 2. Google Vision 실패 시 → OCR.space fallback 시도
  try {
    const ocrSpaceResult = await callOCRSpaceAPI(file)
    // 성공 → DB 업데이트 및 로그 기록 (OCR.space fallback)
    return extractedText
  } catch (fallbackError) {
    // 3. 모든 방법 실패
    logProcessingStep('failed', '모든 OCR 방법 실패')
  }
}
```

#### **환경 변수 미설정 시 (credentials 없을 때)**
```javascript
// OCR.space만 사용 (Google Vision API 없음)
try {
  const ocrSpaceResult = await callOCRSpaceAPI(file)
  return extractedText
} catch (error) {
  logProcessingStep('failed', 'OCR 실패')
}
```

## 🔧 적용 범위

### 이미지 파일 업로드 (`POST /api/upload/image`)
- 학생 답안 사진 업로드 시
- 과제 제시문 이미지 업로드 시
- **모든 이미지 업로드에 Google Vision API 우선 적용**

### PDF 파일 업로드 (`POST /api/upload/pdf`)
- PDF 텍스트 추출 실패 시
- 이미지 기반 PDF OCR 필요 시
- **Google Vision API 사용 (`processImagePDFOCR`)**

## 📦 환경 설정

### 로컬 개발 환경
```bash
# .dev.vars 파일 (자동으로 .gitignore에 포함됨)
GOOGLE_APPLICATION_CREDENTIALS={"type":"service_account","project_id":"ai-essay-grading",...}
```

### 프로덕션 환경 (Cloudflare Wrangler Secrets)
```bash
# 비밀키를 안전하게 설정
npx wrangler pages secret put GOOGLE_APPLICATION_CREDENTIALS --project-name webapp

# 입력 프롬프트에서 전체 JSON 키 붙여넣기
```

## 🔐 보안 고려사항

### ✅ 적용된 보안 조치
1. **`.dev.vars` 파일은 `.gitignore`에 포함** (로컬만 사용)
2. **wrangler.jsonc에는 환경변수 포함하지 않음** (GitHub 보호)
3. **프로덕션은 Wrangler Secrets 사용** (암호화된 저장소)
4. **Git 커밋 히스토리에서 비밀키 제거 완료** (force push)

### ⚠️ 주의사항
- Google Cloud Service Account 키는 절대 public repository에 커밋하지 말 것
- `.dev.vars`는 로컬 개발용으로만 사용
- 프로덕션 배포 시 반드시 Wrangler Secrets로 설정

## 📊 성능 비교

### Google Cloud Vision API
- **정확도**: 매우 높음 (특히 한국어 손글씨)
- **처리 속도**: 2-4초
- **비용**: 사용량 기반 과금
- **언어 지원**: 한국어, 영어 등 다국어 최적화

### OCR.space API (Fallback)
- **정확도**: 중간 (타이핑된 텍스트에 적합)
- **처리 속도**: 2-3초
- **비용**: 무료 (월 25,000 요청)
- **언어 지원**: 한국어 Engine 2 사용

## 🔍 로그 확인

### OCR 처리 성공 확인
```javascript
// 데이터베이스 로그 확인
SELECT * FROM file_processing_log 
WHERE step = 'ocr' 
AND status = 'completed'
ORDER BY created_at DESC
LIMIT 10;

// 로그 메시지 예시
"추출된 텍스트: 1234 characters (Google Vision)"
"추출된 텍스트: 567 characters (OCR.space fallback)"
```

### PM2 로그 모니터링
```bash
# 실시간 로그 (blocking)
pm2 logs webapp

# 최근 로그만 확인 (non-blocking)
pm2 logs webapp --nostream --lines 50
```

## 🚀 서비스 정보

### 배포 상태
- **서비스 URL**: https://3000-iigjpsbl85aj2ml3n1x69-cbeee0f9.sandbox.novita.ai
- **GitHub Repository**: https://github.com/eunha0/webapp
- **최신 커밋**: `fff1311` (feat: Google Cloud Vision API를 우선 OCR 방법으로 변경)

### 서비스 계정
- **Email**: vision-api-service@ai-essay-grading.iam.gserviceaccount.com
- **Project ID**: ai-essay-grading
- **API**: Cloud Vision API (TEXT_DETECTION)

## 🧪 테스트 방법

### 1. 이미지 업로드 테스트
1. "내 과제 목록"에서 과제 선택
2. 학생 답안 사진 업로드
3. 콘솔에서 "Google Vision" 로그 확인
4. 추출된 텍스트가 자동으로 입력되는지 확인

### 2. DB 로그 확인
```sql
-- 최근 OCR 처리 로그 확인
SELECT 
  uploaded_file_id,
  step,
  status,
  details,
  created_at
FROM file_processing_log
WHERE step = 'ocr'
ORDER BY created_at DESC
LIMIT 20;
```

### 3. PM2 로그 확인
```bash
# Google Vision API 호출 확인
pm2 logs webapp --nostream | grep -i "vision"

# OCR 처리 확인
pm2 logs webapp --nostream | grep -i "ocr"
```

## 📝 변경 이력

### 2025-12-06 (커밋: fff1311)
- **변경**: Google Cloud Vision API를 우선 OCR 방법으로 변경
- **영향**: 이미지 업로드 시 더 높은 정확도의 텍스트 추출
- **파일**: `src/index.tsx` (114 insertions, 82 deletions)

### 이전 커밋
- `54cb6fa`: 이미지 OCR 기능 구현 문서화
- `0886b6f`: 이미지 파일에서 텍스트 추출 OCR 기능 추가

## ✨ 기대 효과

1. **더 높은 정확도**: 손글씨 및 복잡한 레이아웃에서도 정확한 텍스트 추출
2. **안정적인 fallback**: Google Vision 실패 시 OCR.space로 자동 전환
3. **유연한 구성**: 환경 변수로 간단하게 API 전환 가능
4. **비용 최적화**: fallback 구조로 무료 API도 활용 가능

## 🔗 관련 문서
- [IMAGE_OCR_IMPLEMENTATION.md](./IMAGE_OCR_IMPLEMENTATION.md) - OCR 기능 구현 상세
- [GOOGLE_VISION_API_SETUP.md](./GOOGLE_VISION_API_SETUP.md) - API 설정 가이드
- [GRADING_HISTORY_SAVE_FIX.md](./GRADING_HISTORY_SAVE_FIX.md) - 채점 이력 저장 오류 수정

---
**문서 작성일**: 2025-12-06  
**마지막 업데이트**: fff1311 커밋 적용 완료
