# CoGrader - AI 에세이 채점 시스템

## 프로젝트 개요

**CoGrader**는 최첨단 대규모 언어 모델(LLM)을 활용한 자동화된 에세이 채점(AEG) 시스템입니다. 교사들이 루브릭 기반으로 학생 에세이를 일관성 있게 채점하고, 상세하고 건설적인 피드백을 제공하여 학습 성장을 촉진합니다.

### 주요 목표

1. **일관된 채점 (AES)**: 인간 평가자와 0.61 이상의 실질적 일치도(QWK) 달성
2. **심층 피드백 (AWE)**: 시의적절하고 구체적이며 상세한 지원적 피드백 제공

### 핵심 기능

✅ **루브릭 기반 채점**: 사용자 정의 가능한 평가 기준 설정  
✅ **AI 자동 분석**: 각 기준별 1-4점 척도 평가  
✅ **상세한 피드백**: 강점, 개선점, 구체적 수정 제안 제공  
✅ **채점 기록 관리**: 과거 채점 세션 및 결과 저장/조회  
✅ **다국어 인터페이스**: 한국어 UI 지원  
✅ **실시간 처리**: 빠른 응답 시간으로 즉각적인 피드백

## URLs

- **개발 서버**: https://3000-ikiygtk7zjdsp3lj0l2bs-18e660f9.sandbox.novita.ai
- **API 엔드포인트**:
  - `POST /api/grade` - 에세이 채점 요청
  - `GET /api/result/:essayId` - 채점 결과 조회
  - `GET /api/sessions` - 채점 세션 목록
  - `GET /api/session/:sessionId` - 세션 상세 정보
  - `GET /api/health` - 서비스 상태 확인

## 데이터 아키텍처

### 데이터 모델

1. **Grading Sessions**: 채점 세션 정보 (과제 프롬프트, 학년 수준)
2. **Rubric Criteria**: 루브릭 평가 기준
3. **Essays**: 학생이 제출한 에세이
4. **Grading Results**: 종합 채점 결과
5. **Criterion Scores**: 각 기준별 상세 점수

### 스토리지 서비스

- **Cloudflare D1 Database**: SQLite 기반 글로벌 분산 데이터베이스
  - 로컬 개발: `.wrangler/state/v3/d1` (로컬 SQLite)
  - 프로덕션: Cloudflare D1 (글로벌 분산)

### 데이터 흐름

```
사용자 입력 (과제, 루브릭, 에세이)
    ↓
AI 채점 서비스 (grading-service.ts)
    ↓
채점 결과 생성 (기준별 점수, 피드백)
    ↓
데이터베이스 저장 (db-service.ts)
    ↓
프론트엔드 결과 표시
```

## 사용자 가이드

### 1. 에세이 채점하기

1. **과제 프롬프트 입력**: 학생들이 응답해야 할 과제 내용을 입력합니다.
   - 예: "Analyze the major causes of World War II, support your arguments using specific historical examples..."

2. **학년 수준 지정**: 과제의 학년 수준을 입력합니다.
   - 예: "12th-grade social studies"

3. **루브릭 기준 설정**: 평가 기준을 추가합니다 (기본 4개 제공).
   - 기준 1: 핵심 개념의 이해와 분석
   - 기준 2: 증거와 역사적 사례 활용
   - 기준 3: 출처 인용의 정확성
   - 기준 4: 문법, 구조, 흐름

4. **에세이 제출**: 학생이 작성한 에세이를 입력 영역에 붙여넣습니다.

5. **채점 실행**: "에세이 채점하기" 버튼을 클릭합니다.

### 2. 채점 결과 확인

채점이 완료되면 다음 정보가 표시됩니다:

- **총점**: 10점 만점 기준 점수
- **종합 평가**: 전체적인 에세이 품질 요약
- **기준별 평가**: 각 루브릭 기준에 대한 4점 척도 점수
  - 강점: 잘한 부분 구체적 설명
  - 개선점: 보완이 필요한 부분
- **전체 평가**: 과제 요구사항 충족도 평가
- **구체적 수정 제안**: 최소 3개의 구체적 오류 예시 및 수정 방법
- **다음 단계 조언**: 전반적인 작문 실력 향상을 위한 전략

### 3. 채점 기록 조회

"채점 기록" 탭에서:
- 과거 채점 세션 목록 확인
- 각 세션의 과제 정보 및 채점된 에세이 수 확인
- 세션 상세 정보 및 개별 에세이 결과 재조회

## 기술 스택

- **프레임워크**: Hono (경량 웹 프레임워크)
- **런타임**: Cloudflare Workers
- **데이터베이스**: Cloudflare D1 (SQLite)
- **프론트엔드**: Vanilla JavaScript + TailwindCSS
- **빌드 도구**: Vite
- **배포**: Cloudflare Pages

## 현재 완료된 기능

✅ 프로젝트 구조 설정 및 Git 저장소 초기화  
✅ Cloudflare D1 데이터베이스 설정 및 마이그레이션  
✅ AI 채점 API 엔드포인트 구현  
✅ 루브릭 입력 프론트엔드 UI  
✅ 상세 피드백 표시 화면  
✅ 채점 기록 조회 및 아카이브 기능  
✅ 로컬 개발 서버 실행 및 테스트

## 구현되지 않은 기능

⏳ 실제 LLM API 통합 (OpenAI, Anthropic 등)  
⏳ 사용자 인증 및 권한 관리  
⏳ 다중 사용자 지원 및 팀 협업 기능  
⏳ 에세이 비교 및 표절 검사  
⏳ PDF/Word 문서 업로드 지원  
⏳ 채점 결과 내보내기 (PDF, CSV)  
⏳ 프로덕션 Cloudflare Pages 배포

## 다음 개발 단계 권장사항

### 1. LLM API 통합 (최우선)

**현재 상태**: 데모용 시뮬레이션 채점 로직 사용  
**필요 작업**:
- OpenAI GPT-4 또는 Anthropic Claude API 통합
- API 키 환경 변수 설정 (`.dev.vars` 파일)
- `src/grading-service.ts`의 `gradeEssay` 함수 수정

```typescript
// src/grading-service.ts 수정 예시
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  }),
});
```

### 2. 사용자 인증 추가

- Cloudflare Access 또는 Auth0 통합
- 교사별 채점 세션 분리
- 학생 계정 및 에세이 제출 기능

### 3. 프로덕션 배포

```bash
# Cloudflare API 키 설정
npm run db:migrate:prod  # 프로덕션 D1 마이그레이션
npm run deploy:prod      # Cloudflare Pages 배포
```

### 4. 성능 최적화

- 채점 결과 캐싱
- 대량 에세이 배치 처리
- 비동기 작업 큐 구현

### 5. 고급 기능

- AI 채점 신뢰도 점수 표시
- 교사 피드백 오버라이드 기능
- 학습 분석 대시보드
- 학생 진척도 추적

## 로컬 개발

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 데이터베이스 마이그레이션
npm run db:migrate:local

# 프로젝트 빌드
npm run build

# PM2로 개발 서버 시작
pm2 start ecosystem.config.cjs

# 서비스 상태 확인
pm2 list

# 로그 확인
pm2 logs webapp --nostream
```

### 데이터베이스 관리

```bash
# 로컬 데이터베이스 리셋
npm run db:reset

# 로컬 데이터베이스 콘솔
npm run db:console:local
```

## 배포 상태

- **플랫폼**: Cloudflare Pages
- **상태**: ✅ 로컬 개발 활성화 / ⏳ 프로덕션 배포 대기
- **마지막 업데이트**: 2025-10-31

## 프로젝트 구조

```
webapp/
├── src/
│   ├── index.tsx           # Hono 애플리케이션 진입점
│   ├── grading-service.ts  # AI 채점 로직
│   ├── db-service.ts       # 데이터베이스 서비스
│   └── types.ts            # TypeScript 타입 정의
├── public/static/
│   └── app.js              # 프론트엔드 JavaScript
├── migrations/
│   └── 0001_initial_schema.sql  # 데이터베이스 스키마
├── ecosystem.config.cjs    # PM2 설정
├── wrangler.jsonc          # Cloudflare 설정
├── vite.config.ts          # Vite 빌드 설정
└── package.json            # 프로젝트 메타데이터
```

## 라이선스

MIT License

## 문의

이 프로젝트에 대한 문의사항이나 기여를 원하시면 이슈를 생성해주세요.

---

**Built with ❤️ using Hono, Cloudflare Workers, and AI**
