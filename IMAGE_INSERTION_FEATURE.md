# 이미지 삽입 기능 개선

## 📋 개요

그래프, 차트, 지도 등의 시각적 자료를 제시문에 업로드할 때, **텍스트 추출(OCR) 대신 이미지를 그대로 삽입**하도록 개선했습니다.

## 🎯 문제점

**변경 전:**
- 그래프 이미지 업로드 시 OCR로 텍스트만 추출 (예: "25.0%-, 미국의 실업률 추이, 20.0%-...")
- 텍스트만으로는 그래프의 시각적 정보를 파악하기 어려움
- 차트, 지도 등의 시각적 자료의 의미 손실

**변경 후:**
- 이미지를 Markdown 형식으로 제시문에 직접 삽입
- 이미지가 R2 스토리지에 저장되고 URL로 참조
- AI 채점 시 멀티모달 분석 가능

## ✨ 주요 변경사항

### 1. **프론트엔드 개선** (`src/index.tsx`)

**`handleReferenceImageUpload` 함수 수정:**
```javascript
// skip_ocr 플래그를 FormData에 추가
formData.append('skip_ocr', 'true');

// 이미지 URL을 Markdown 형식으로 삽입
if (response.data.image_url) {
  const imageMarkdown = '![' + file.name + '](' + response.data.image_url + ')';
  textarea.value = imageMarkdown;
}
```

### 2. **백엔드 API 개선** (`/api/upload/image`)

**OCR 건너뛰기 로직 추가:**
```typescript
const skipOcr = formData.get('skip_ocr') === 'true'

if (skipOcr) {
  // OCR 처리 건너뛰고 이미지 URL 즉시 반환
  return c.json({
    success: true,
    image_url: r2Result.url,
    ocr_skipped: true
  })
}
```

**OCR 실패 시에도 이미지 URL 반환:**
```typescript
// 기존: success: false로 에러 반환
// 개선: success: true + image_url 반환
return c.json({
  success: true,
  image_url: r2Result.url,
  message: '이미지가 업로드되었습니다. OCR로 텍스트를 추출할 수 없었습니다.'
})
```

## 📝 사용 방법

### **교사 - 과제 만들기**

1. "새 과제 만들기" 클릭
2. "제시문" 섹션에서 "이미지 업로드" 버튼 클릭
3. 그래프, 차트, 지도 등의 이미지 선택
4. 이미지가 Markdown 형식으로 제시문에 삽입됨:
   ```markdown
   ![미국의_실업률_추이.png](https://r2.storage.url/images/...)
   ```
5. 과제 생성 완료

### **이미지 형식**

제시문에 삽입된 이미지는 Markdown 형식입니다:
```markdown
![이미지_파일명](이미지_URL)
```

## 🔄 동작 흐름

```
1. 교사가 "이미지 업로드" 클릭
   ↓
2. 프론트엔드: skip_ocr=true 플래그와 함께 이미지 업로드
   ↓
3. 백엔드: R2 스토리지에 이미지 저장
   ↓
4. 백엔드: OCR 건너뛰고 이미지 URL 반환
   ↓
5. 프론트엔드: Markdown 형식으로 제시문에 삽입
   ↓
6. 과제 생성 시: 제시문에 Markdown 이미지 포함
   ↓
7. AI 채점 시: 이미지 URL을 통해 멀티모달 분석 가능
```

## 💡 장점

1. ✅ **시각적 정보 보존**: 그래프, 차트의 시각적 의미가 그대로 전달
2. ✅ **빠른 처리**: OCR 생략으로 업로드 속도 향상
3. ✅ **멀티모달 AI 지원**: 이미지와 텍스트를 함께 AI에 전달 가능
4. ✅ **데이터 효율성**: R2 스토리지 활용으로 DB 크기 최소화
5. ✅ **재사용 가능**: 동일 이미지를 여러 과제에서 참조 가능

## 📊 지원되는 시각적 자료

- 📈 그래프 (막대, 선, 원 그래프 등)
- 📉 차트 (통계 차트, 데이터 시각화)
- 🗺️ 지도 (지리 정보, 분포도)
- 📊 인포그래픽
- 🖼️ 기타 시각적 교육 자료

## 🔍 Fallback 동작

만약 이미지 URL을 받지 못하거나, 텍스트가 많은 문서 이미지의 경우:
- OCR로 텍스트 추출 시도
- 추출된 텍스트를 제시문에 삽입
- 상태 메시지: "✓ 텍스트 추출 완료"

## 🚀 테스트

**테스트 계정:**
- 교사: `teacher@test.com` / `ValidPass123!@#`

**테스트 URL:**
- https://3000-iigjpsbl85aj2ml3n1x69-cbeee0f9.sandbox.novita.ai

**테스트 절차:**
1. 교사 로그인
2. "새 과제 만들기" 클릭
3. 제시문에 그래프 이미지 업로드
4. Markdown 형식으로 삽입되는지 확인
5. 과제 생성 후 미리보기에서 이미지 표시 확인

## 📦 배포 정보

- **커밋**: `d2673e9`
- **브랜치**: `main`
- **GitHub**: https://github.com/eunha0/webapp.git
- **날짜**: 2025-12-20

## 🛠️ 기술 스택

- **이미지 스토리지**: Cloudflare R2
- **데이터베이스**: Cloudflare D1
- **프레임워크**: Hono
- **이미지 형식**: Markdown
- **OCR 엔진**: Google Vision API / OCR.space (fallback)

---

## 📌 참고사항

- 이미지는 R2 스토리지에 영구 저장됩니다
- Markdown 형식이므로 다양한 도구에서 호환됩니다
- AI 채점 시 멀티모달 모델(GPT-4 Vision 등)을 활용하여 이미지 분석 가능
- 기존 텍스트 추출 기능도 여전히 사용 가능합니다 (텍스트 문서 이미지의 경우)
