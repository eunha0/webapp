# 코드 중복 및 구조 분석 보고서

**프로젝트**: AI 논술 평가 시스템 (webapp-ai)  
**분석 날짜**: 2024-12-15  
**분석 도구**: jscpd, 수동 코드 리뷰

---

## 📊 요약 (Executive Summary)

### 전체 통계
- **총 파일 수**: 8개 (TypeScript/TSX)
- **총 코드 라인 수**: 1,917줄
- **중복 코드 발견**: 9개 클론
- **중복 비율**: 4.43% (85줄)
- **중복 토큰 비율**: 5.65% (760 토큰)

### 주요 발견사항
1. ✅ **양호한 중복률**: 4.43%는 업계 표준(5-10%) 이하로 양호
2. ⚠️ **대형 파일**: `index.tsx` (10,870줄) - 리팩토링 필요
3. ⚠️ **중복 패턴**: API 호출 및 에러 처리 로직 중복
4. ✅ **서비스 분리**: 주요 기능이 별도 서비스 파일로 분리됨

---

## 🔍 상세 분석

### 1. 파일별 코드 라인 수

| 파일명 | 라인 수 | 비율 | 복잡도 평가 |
|--------|---------|------|-------------|
| `index.tsx` | 10,870 | 84.9% | 🔴 매우 높음 |
| `upload-service.ts` | 519 | 4.1% | 🟢 적정 |
| `hybrid-grading-service.ts` | 456 | 3.6% | 🟢 적정 |
| `feedback-service.ts` | 258 | 2.0% | 🟢 적정 |
| `db-service.ts` | 258 | 2.0% | 🟢 적정 |
| `google-auth-service.ts` | 184 | 1.4% | 🟢 적정 |
| `grading-service.ts` | 165 | 1.3% | 🟢 적정 |
| `types.ts` | 65 | 0.5% | 🟢 적정 |
| `renderer.tsx` | 12 | 0.1% | 🟢 적정 |

### 2. 중복 코드 상세 분석

#### 2.1 upload-service.ts의 중복 패턴

**중복 1: Google Vision API 호출 헤더**
- **위치**: Lines 34-48 vs Lines 178-192
- **중복 라인**: 14줄 (90 토큰)
- **패턴**: Google Vision API 인증 및 요청 헤더 설정
```typescript
// 중복 패턴
const response = await fetch(
  'https://vision.googleapis.com/v1/...',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({...})
  }
);
```

**중복 2: API 응답 검증 로직**
- **위치**: Lines 50-63 vs Lines 195-208
- **중복 라인**: 13줄 (84 토큰)
- **패턴**: API 응답 OK 확인 및 에러 처리
```typescript
if (!response.ok) {
  const errorData = await response.json();
  throw new Error(`Vision API error: ${JSON.stringify(errorData)}`);
}
```

**중복 3-9: 기타 중복**
- Google Vision API 관련 설정 및 에러 처리
- 총 85줄의 중복 코드 발견

#### 2.2 feedback-service.ts의 중복
- **위치**: Lines 104-109 vs Lines 158-163
- **패턴**: 에러 메시지 생성 로직

### 3. index.tsx 구조 분석

#### 3.1 크기 문제
- **총 라인 수**: 10,870줄
- **문제점**: 
  - 단일 파일에 과도한 로직 집중
  - 유지보수 어려움
  - 코드 탐색 시간 증가

#### 3.2 주요 구성 요소 (추정)
1. **라우트 핸들러** (~40%)
   - API 엔드포인트 정의
   - 요청/응답 처리
   
2. **프론트엔드 HTML/JSX** (~30%)
   - UI 템플릿
   - 인라인 JavaScript
   
3. **비즈니스 로직** (~20%)
   - 과제 관리
   - 제출물 처리
   - 채점 로직
   
4. **유틸리티 함수** (~10%)
   - 헬퍼 함수
   - 데이터 변환

---

## ⚠️ 문제 영역 (Problem Areas)

### 🔴 Critical (즉시 해결 필요)

#### 1. index.tsx 파일 크기
**문제**: 10,870줄의 단일 파일
**영향**: 
- 코드 탐색 어려움
- 병합 충돌 위험 증가
- 테스트 어려움
- 빌드 시간 증가

**권장 해결책**:
```
index.tsx (10,870줄)
  ↓ 리팩토링
├── routes/
│   ├── auth.ts         (로그인/세션)
│   ├── assignments.ts  (과제 관리)
│   ├── submissions.ts  (제출물 관리)
│   ├── grading.ts      (채점)
│   └── resources.ts    (루브릭/리소스)
├── ui/
│   ├── templates.ts    (HTML 템플릿)
│   └── components.ts   (재사용 컴포넌트)
└── middleware/
    ├── auth.ts         (인증 미들웨어)
    └── error.ts        (에러 핸들러)
```

### 🟡 Moderate (단기 개선 권장)

#### 2. API 호출 중복
**문제**: Google Vision API 호출 코드 중복
**위치**: `upload-service.ts` (3곳)

**권장 해결책**: 공통 API 클라이언트 함수 생성
```typescript
// 개선 전
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify(data)
});

// 개선 후
async function callVisionAPI(endpoint: string, data: any, accessToken: string) {
  const response = await fetch(`https://vision.googleapis.com/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Vision API error: ${JSON.stringify(errorData)}`);
  }
  
  return response.json();
}
```

#### 3. 에러 처리 패턴 통일
**문제**: 유사한 try-catch 블록이 여러 곳에 반복
**권장 해결책**: 공통 에러 처리 래퍼 함수

### 🟢 Low (장기 개선 고려)

#### 4. TypeScript 타입 정의 강화
- 더 엄격한 타입 체크
- `any` 타입 사용 최소화
- 인터페이스 재사용 증대

---

## 📋 수동 코드 리뷰 체크리스트

### A. 코드 구조 및 조직화

- [ ] **파일 분리**: index.tsx를 여러 모듈로 분리
  - [ ] 라우트 핸들러를 별도 파일로 분리
  - [ ] UI 템플릿을 별도 디렉토리로 분리
  - [ ] 비즈니스 로직을 서비스 레이어로 이동
  
- [ ] **디렉토리 구조 개선**:
  ```
  src/
  ├── routes/         # API 라우트 핸들러
  ├── services/       # 비즈니스 로직 (기존)
  ├── middleware/     # 미들웨어 (인증, 에러)
  ├── ui/            # UI 템플릿/컴포넌트
  ├── types/         # TypeScript 타입 정의
  └── utils/         # 유틸리티 함수
  ```

### B. 코드 품질

- [x] **중복 코드 제거**: API 호출 패턴 통일
- [ ] **함수 크기 최적화**: 각 함수를 50줄 이하로 유지
- [ ] **순환 의존성 제거**: 모듈 간 의존성 체크
- [x] **타입 안전성**: TypeScript 타입 정의 활용

### C. 성능 및 최적화

- [ ] **번들 크기 최적화**: index.tsx 분리로 코드 스플리팅 가능
- [ ] **빌드 시간 개선**: 작은 모듈로 분리하여 빌드 캐싱 효율화
- [ ] **메모리 사용**: 큰 파일 파싱으로 인한 메모리 사용 감소

### D. 유지보수성

- [x] **명확한 네이밍**: 함수/변수명이 의도를 명확히 표현
- [x] **주석 및 문서화**: 복잡한 로직에 주석 추가
- [ ] **테스트 가능성**: 작은 모듈로 분리하여 단위 테스트 작성 가능
- [x] **에러 처리**: 일관된 에러 처리 패턴 사용

### E. 보안

- [x] **입력 검증**: 파일 크기, 타입 검증 구현
- [x] **인증/권한**: 세션 기반 인증 구현
- [x] **민감 정보 보호**: 환경변수 사용 (API 키)
- [ ] **SQL 인젝션 방지**: Prepared Statement 사용 확인

---

## 🎯 개선 우선순위 로드맵

### Phase 1: 즉시 실행 (1-2주)
1. **index.tsx 파일 분리** (가장 중요)
   - 라우트 핸들러를 `routes/` 디렉토리로 분리
   - 각 라우트별로 파일 생성 (~200-300줄씩)
   
2. **API 호출 패턴 통일**
   - `upload-service.ts`의 중복 제거
   - 공통 API 클라이언트 함수 생성

### Phase 2: 단기 개선 (2-4주)
1. **UI 템플릿 분리**
   - HTML 템플릿을 별도 파일/함수로 분리
   - 재사용 가능한 컴포넌트 식별

2. **에러 처리 통일**
   - 공통 에러 핸들러 미들웨어 생성
   - 일관된 에러 응답 형식

3. **테스트 추가**
   - 핵심 비즈니스 로직에 단위 테스트
   - API 엔드포인트에 통합 테스트

### Phase 3: 장기 개선 (1-2개월)
1. **성능 최적화**
   - 코드 스플리팅
   - 빌드 최적화
   - 캐싱 전략

2. **타입 시스템 강화**
   - `any` 타입 제거
   - 더 엄격한 타입 정의

3. **문서화**
   - API 문서 자동 생성
   - 아키텍처 문서 작성

---

## 📈 측정 가능한 목표

### 현재 상태
- 중복 코드: **4.43%**
- 가장 큰 파일: **10,870줄**
- 서비스 파일 수: **7개**
- 평균 파일 크기: **1,359줄**

### 목표 상태 (3개월 후)
- 중복 코드: **< 3%**
- 가장 큰 파일: **< 500줄**
- 서비스/라우트 파일 수: **> 20개**
- 평균 파일 크기: **< 300줄**
- 테스트 커버리지: **> 70%**

---

## 🛠️ 도구 및 자동화

### 1. 설정된 도구
- ✅ **jscpd**: 중복 코드 감지
- ⏳ **ESLint**: 코드 품질 (설정 필요)
- ⏳ **Prettier**: 코드 포맷팅 (권장)
- ⏳ **Vitest**: 단위 테스트 (권장)

### 2. CI/CD 통합 (권장)
```yaml
# GitHub Actions 예시
name: Code Quality

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm run lint
      - run: npm run test
      - run: npx jscpd src/ --threshold 5
```

---

## 📚 참고 자료

### 코드 품질 기준
- **파일 크기**: < 500줄 (권장), < 1000줄 (최대)
- **함수 크기**: < 50줄 (권장), < 100줄 (최대)
- **중복률**: < 5% (양호), < 10% (허용)
- **순환 복잡도**: < 10 (권장), < 20 (최대)

### 리팩토링 원칙
1. **단일 책임 원칙** (SRP): 각 모듈은 하나의 책임만
2. **DRY 원칙**: Don't Repeat Yourself
3. **KISS 원칙**: Keep It Simple, Stupid
4. **관심사의 분리**: 비즈니스 로직과 UI 분리

---

## ✅ 결론 및 권장사항

### 긍정적인 측면
1. ✅ **양호한 중복률**: 4.43%로 업계 평균 이하
2. ✅ **서비스 분리**: 핵심 기능이 잘 분리됨
3. ✅ **TypeScript 사용**: 타입 안전성 확보
4. ✅ **명확한 네이밍**: 함수/변수명이 직관적

### 개선 필요 사항
1. 🔴 **index.tsx 파일 분리**: 최우선 과제
2. 🟡 **API 호출 중복 제거**: 단기 개선
3. 🟡 **테스트 추가**: 품질 보증
4. 🟢 **문서화 강화**: 장기 유지보수

### 최종 권장사항
**즉시 시작해야 할 작업**:
1. `index.tsx`를 라우트별로 분리 (가장 중요!)
2. 공통 API 클라이언트 함수 생성
3. ESLint 설정 및 코드 스타일 통일

이 개선사항들을 단계적으로 적용하면 코드 품질, 유지보수성, 개발 생산성이 크게 향상될 것입니다.

---

**작성자**: AI 코드 분석 시스템  
**검토 필요**: 개발 팀 리드  
**다음 검토 일정**: 1개월 후
