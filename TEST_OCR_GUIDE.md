# OCR 테스트 가이드

## 1. 현재 상태
- ✅ Google Vision API Key가 Cloudflare Pages에 설정됨
- ✅ Base64 폴백 로직 구현 완료 (R2 없이도 작동)
- ✅ 최신 배포 활성화: https://ai-nonsool.kr

## 2. 테스트 시나리오

### 시나리오 A: 학생 답안 파일 업로드 (JPG/PNG)
1. 과제 상세 페이지로 이동
2. 학생 답안 파일 업로드 (JPG 또는 PNG)
3. 예상 결과:
   - ✅ "업로드 성공" 메시지
   - ✅ 추출된 텍스트가 표시됨
   - ❌ "텍스트 추출에 실패했습니다" 에러 발생 안 함

### 시나리오 B: 학생 답안 파일 업로드 (PDF)
1. 과제 상세 페이지로 이동
2. 학생 답안 PDF 파일 업로드
3. 예상 결과:
   - ✅ "업로드 성공" 메시지
   - ✅ PDF에서 텍스트 추출됨
   - ❌ "텍스트 추출에 실패했습니다" 에러 발생 안 함

## 3. OCR 처리 흐름
```
파일 업로드
    ↓
이미지인가? ──예→ Google Vision API 시도
    │              ↓
    │         성공? ──예→ 텍스트 반환
    │           │
    │          아니오
    │           ↓
    │      OCR.space API 시도 (폴백)
    │           ↓
    │      텍스트 반환 또는 에러
    │
   아니오 (PDF)
    ↓
PDF.js로 텍스트 추출 시도
    ↓
성공? ──예→ 텍스트 반환
    │
   아니오
    ↓
Google Vision API 시도 (이미지 기반 PDF)
    ↓
텍스트 반환 또는 에러
```

## 4. 문제 해결

### 여전히 "텍스트 추출에 실패" 에러 발생 시:
1. Cloudflare Pages 대시보드로 이동
2. Settings → Environment variables 확인
3. `GOOGLE_APPLICATION_CREDENTIALS` 값이 설정되어 있는지 확인
4. 재배포 실행:
   ```bash
   npx wrangler pages deploy dist --project-name ai-nonsool-kr
   ```

### API 키 로그 확인:
- Cloudflare Dashboard → Pages → ai-nonsool-kr → Logs
- Google Vision API 호출 에러가 있는지 확인

## 5. 설정된 API 키
- ✅ OPENAI_API_KEY (GPT-4o 채점)
- ✅ ANTHROPIC_API_KEY (Claude 3.5 Sonnet 피드백)
- ✅ GOOGLE_APPLICATION_CREDENTIALS (Vision API OCR)
- ✅ GOOGLE_CLIENT_ID (OAuth 로그인)
- ✅ GOOGLE_CLIENT_SECRET (OAuth 로그인)

## 6. 배포 URL
- Production: https://ai-nonsool.kr
- 최신 배포: https://28c0d20d.ai-nonsool-kr.pages.dev (1시간 전)

## 7. 테스트 후 확인 사항
- [ ] JPG 파일 업로드 및 텍스트 추출 성공
- [ ] PNG 파일 업로드 및 텍스트 추출 성공
- [ ] PDF 파일 업로드 및 텍스트 추출 성공
- [ ] "텍스트 추출에 실패했습니다" 에러 미발생
- [ ] 추출된 텍스트가 올바르게 표시됨
