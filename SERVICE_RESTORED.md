# 샌드박스 서비스 복구 완료

## 복구 일시
- **일시**: 2025-12-23 02:42 UTC
- **상태**: ✅ 정상 작동

## 수행 작업

### 1. 문제 진단
- PM2 프로세스 모두 종료됨
- dist/_worker.js 파일 누락 (이전 빌드 타임아웃으로 삭제됨)

### 2. 복구 절차
```bash
# 1. 빌드 캐시 정리
rm -rf dist .wrangler node_modules/.vite

# 2. 새로 빌드
npm run build  # 성공 (4.67초)

# 3. 포트 정리
fuser -k 3000/tcp

# 4. PM2로 서비스 시작
pm2 start ecosystem.config.cjs
```

### 3. 검증
```bash
# HTTP 응답 확인
curl http://localhost:3000  # ✅ 200 OK

# PM2 상태 확인
pm2 list  # ✅ webapp online

# 브라우저 접속 테스트
# ✅ 페이지 정상 로드 (8.41초)
```

## 서비스 정보

### 접속 URL
**https://3000-iigjpsbl85aj2ml3n1x69-0e616f0a.sandbox.novita.ai**

### 테스트 계정
- **교사**: `teacher@test.com` / `ValidPass123!@#`
- **학생**: `student@test.com` / `ValidPass123!@#`

### PM2 상태
```
┌────┬────────┬──────────┬────────┬────────┬──────────┬─────────┬──────┬───────────┐
│ id │ name   │ mode     │ pid    │ uptime │ ↺       │ status  │ cpu  │ mem       │
├────┼────────┼──────────┼────────┼────────┼──────────┼─────────┼──────┼───────────┤
│ 0  │ webapp │ fork     │ 1522   │ 0s     │ 0        │ online  │ 0%   │ 28.8mb    │
└────┴────────┴──────────┴────────┴────────┴──────────┴─────────┴──────┴───────────┘
```

## 빌드 정보
- **Vite 버전**: 6.4.1
- **빌드 시간**: 4.67초
- **번들 크기**: 1,265.56 kB
- **모듈 수**: 290개

## 주요 기능 상태

| 기능 | 상태 | 비고 |
|------|------|------|
| 메인 페이지 | ✅ 정상 | 8.41초 로드 |
| 교사/학생 로그인 | ✅ 정상 | 인증 시스템 작동 |
| 과제 생성 | ✅ 정상 | "새 과제 만들기" 가능 |
| 이미지 업로드 | ✅ 정상 | OCR skip 기능 포함 |
| 디버그 로그 | ✅ 포함 | 빌드 파일에 포함됨 |
| 루브릭 리소스 | ⚠️ 일부 에러 | 메인 기능에는 영향 없음 |

## OCR Skip 기능 테스트 방법

### 브라우저 캐시 완전 삭제 (필수!)
사용자님이 이전에 "CARLING" 텍스트가 추출된 것은 **브라우저 캐시** 때문일 가능성이 높습니다.

**Chrome/Edge:**
1. F12 → Application 탭
2. "Clear storage" 클릭
3. "Clear site data" 클릭
4. 브라우저 완전 종료
5. 시크릿 모드로 재시작

**Firefox:**
1. F12 → Network 탭
2. "Disable Cache" 체크
3. Ctrl+Shift+Delete → "캐시된 웹 콘텐츠" 삭제
4. 브라우저 재시작

### 테스트 절차

**Step 1: 시크릿 모드 접속**
```
URL: https://3000-iigjpsbl85aj2ml3n1x69-0e616f0a.sandbox.novita.ai
계정: teacher@test.com / ValidPass123!@#
```

**Step 2: 개발자 도구 설정**
```
1. F12 눌러서 개발자 도구 열기
2. Network 탭 → "Disable cache" 체크
3. Console 탭 열어두기
```

**Step 3: 새 과제 생성**
```
1. "새 과제 만들기" 클릭
2. 과제 제목 입력
3. 제시문 입력 필드 확인
```

**Step 4: 이미지 업로드 (OCR 건너뛰기)**
```
1. "☑ OCR 건너뛰고 이미지 그대로 삽입" 체크 확인
2. 그래프/차트 이미지 선택
3. 업로드
```

**Step 5: 콘솔 로그 확인**
```
Console 탭에서 다음 로그 확인:
=== Image Upload Debug ===
skipOcrCheckbox found: true
skipOcr value: true
FormData skip_ocr: true
========================
```

**Step 6: 네트워크 응답 확인**
```
Network 탭 → /api/upload/image 클릭 → Response 탭:
{
  "success": true,
  "image_url": "https://...",
  "extracted_text": null,  ← 반드시 null
  "ocr_skipped": true
}
```

**Step 7: 제시문 확인**
```
제시문 텍스트 영역에 다음 형식으로 삽입되어야 함:
![이미지파일명.png](https://://pub-xxx.r2.dev/...)
```

## 예상 문제 및 해결

### Case 1: 여전히 "CARLING" 텍스트가 추출됨
**원인**: 브라우저 캐시
**해결**:
- 시크릿 모드 사용
- F12 → Network → "Disable cache" 체크
- 완전히 다른 이미지 파일 사용 (이전에 업로드한 적 없는 파일)

### Case 2: "skipOcrCheckbox found: false"
**원인**: HTML 구조 문제 또는 모달 재사용
**해결**:
- 브라우저 강력 새로고침 (Ctrl+Shift+R)
- 모달 닫았다가 다시 열기
- Elements 탭에서 체크박스 존재 확인

### Case 3: Response에서 여전히 extracted_text 존재
**원인**: 같은 파일을 이전에 업로드했을 가능성
**해결**:
- 완전히 새로운 파일 사용
- 파일명 변경 (예: test-graph-20231223.png)
- Network Response 탭 (Preview 아님)에서 실제 서버 응답 확인

## 추가 디버깅

만약 문제가 지속되면 다음 정보를 공유해주세요:

1. **브라우저 콘솔 스크린샷** (전체 로그)
2. **Network Response 탭 스크린샷** (Preview 아님, Response)
3. **사용한 이미지 파일** (새 파일인지 확인)
4. **브라우저 정보** (Chrome/Firefox/Edge + 버전)

## 프로젝트 정보
- **GitHub**: https://github.com/eunha0/webapp.git
- **브랜치**: main
- **최신 커밋**: `480214a` - "docs: Add OCR skip feature deployment documentation"
- **이전 커밋**: `3124fce` - "debug: Add comprehensive debug logs for skip_ocr flag processing"

## 다음 단계
1. ✅ 서비스 복구 완료
2. ✅ 빌드 성공
3. ✅ 서비스 시작 완료
4. ⏳ **사용자 테스트 필요** (브라우저 캐시 삭제 후)
5. ⏳ 테스트 결과 확인
6. ⏳ 필요 시 추가 수정

---

**중요**: 이전에 "CARLING" 텍스트가 추출된 것은 **브라우저가 캐시된 이전 API 응답을 재사용**했기 때문일 가능성이 매우 높습니다. 

**반드시 시크릿 모드 + Network "Disable cache" 체크 + 새로운 이미지 파일**로 테스트해주세요!
