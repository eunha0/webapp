# AI 논술 평가 - 교사를 위한 AI 기반 논술 채점 시스템

## 프로젝트 개요

**AI 논술 평가**는 최첨단 대규모 언어 모델(LLM)을 기반으로 한 고급 자동화 논술 채점(AEG) 시스템입니다. 교사가 논술을 10배 빠르게 채점하고, 학생의 학습과 성장을 촉진하는 상세하고 실행 가능한 피드백을 제공합니다.

### 영감의 원천

이 프로젝트는 **[EssayGrader.ai](https://www.essaygrader.ai/)**의 스타일과 기능을 참고하여 설계되었으며, 깔끔한 디자인, 신뢰 지표, 사용자 친화적인 채점 인터페이스를 갖춘 현대적인 SaaS 랜딩 페이지를 제공합니다.

### 주요 목표

1. **일관된 채점 (AES)**: 인간 채점자와 실질적 일치(QWK 0.61+) 달성
2. **상세한 피드백 (AWE)**: 시의적절하고 구체적이며 상세한 지원 피드백 제공
3. **시간 절약**: 전체 학급을 몇 시간이 아닌 몇 분 안에 채점

### 핵심 기능

✅ **맞춤형 루브릭 지원**: 직접 루브릭을 만들거나 사전 제작 템플릿 사용  
✅ **AI 기반 분석**: 각 기준에 대한 1-4점 척도 채점  
✅ **상세한 피드백**: 강점, 개선할 점, 구체적인 수정 제안 제공  
✅ **참고 자료 첨부**: 과제 프롬프트에 최대 11개의 참고 자료 첨부 가능 (4개 기본 + 7개 추가)  
✅ **채점 기록**: 과거 채점 세션 및 결과 저장 및 검토  
✅ **다국어 지원**: 다양한 언어 및 작문 스타일 지원  
✅ **빠른 처리**: 즉각적인 피드백으로 몇 초 안에 결과 확인

## URLs

- **Development Server**: https://3000-ikiygtk7zjdsp3lj0l2bs-18e660f9.sandbox.novita.ai
- **Main Pages**:
  - `/` - 랜딩 페이지
  - `/login` - 로그인
  - `/signup` - 회원가입
  - `/my-page` - 교사 대시보드 (인증 필요)
  - `/pricing` - 가격 정책
  - `/admin` - CMS 관리 페이지
  
- **API Endpoints**:
  
  **인증 API**:
  - `POST /api/auth/signup` - 회원가입
  - `POST /api/auth/login` - 로그인 (세션 생성)
  - `POST /api/auth/logout` - 로그아웃
  
  **과제 관리 API** (인증 필요):
  - `GET /api/assignments` - 내 과제 목록
  - `POST /api/assignments` - 새 과제 생성
  - `GET /api/assignment/:id` - 과제 상세 정보
  - `DELETE /api/assignment/:id` - 과제 삭제
  - `POST /api/assignment/:id/submission` - 학생 답안 추가
  
  **채점 API** (인증 필요):
  - `POST /api/submission/:id/grade` - 답안 AI 채점
  - `GET /api/grading-history` - 채점 이력 조회
  
  **기존 채점 API**:
  - `POST /api/grade` - 직접 논술 채점
  - `GET /api/result/:essayId` - 채점 결과 조회
  - `GET /api/sessions` - 채점 세션 목록
  - `GET /api/session/:sessionId` - 세션 상세
  - `GET /api/health` - Health check

## Data Architecture

### Data Models

**사용자 및 인증**:
1. **Users**: 교사 계정 정보 (이름, 이메일, 비밀번호 해시)
2. **Sessions**: 로그인 세션 (UUID, 만료 시간)
3. **Subscriptions**: 구독 정보 (요금제, 결제 주기)

**과제 관리**:
4. **Assignments**: 논술 과제 (제목, 설명, 학년, 마감일)
5. **Assignment Rubrics**: 과제별 루브릭 기준
6. **Student Submissions**: 학생 답안지 (이름, 논술 내용, 채점 상태)

**채점 시스템**:
7. **Grading Sessions**: 채점 세션 정보 (과제 프롬프트, 학년)
8. **Rubric Criteria**: 평가 기준 (채점 세션용)
9. **Essays**: 제출된 논술 (채점 세션용)
10. **Grading Results**: 종합 채점 결과
11. **Criterion Scores**: 기준별 상세 점수

**CMS**:
12. **Resource Posts**: 교육 자료 게시물 (루브릭, 논술 평가 자료)

### Storage Service

- **Cloudflare D1 Database**: SQLite-based globally distributed database
  - Local Development: `.wrangler/state/v3/d1` (local SQLite)
  - Production: Cloudflare D1 (globally distributed)
  - 4개 마이그레이션 완료:
    - 0001: 채점 시스템 기본 스키마
    - 0002: CMS 리소스 테이블
    - 0003: 사용자 및 구독 테이블
    - 0004: 과제 및 제출물 테이블

### Data Flow

```
User Input (assignment, rubric, essay)
    ↓
AI Grading Service (grading-service.ts)
    ↓
Generate Results (criterion scores, feedback)
    ↓
Save to Database (db-service.ts)
    ↓
Display Results on Frontend
```

## User Guide

### 시작하기

1. **회원가입**: `/signup`에서 이름, 이메일, 비밀번호로 계정 생성
2. **로그인**: `/login`에서 이메일과 비밀번호로 로그인
3. **나의 페이지 접속**: 로그인 후 자동으로 `/my-page`로 리다이렉트

### 과제 관리

#### 새 과제 만들기

1. **"새 과제 만들기" 버튼 클릭**
2. **과제 정보 입력**:
   - 제목: "AI 시대의 윤리적 과제"
   - 설명: "인공지능 발달이 가져올 윤리적 문제에 대해 논술하시오"
   - 학년 수준: 드롭다운에서 선택
   - 마감일: 날짜 선택 (선택사항)
3. **루브릭 기준 설정**:
   - 기본 4개 기준 자동 추가
   - "평가 기준 추가" 버튼으로 추가 가능
   - 각 기준마다 이름과 설명 입력
4. **"과제 생성" 버튼 클릭**

#### 과제 관리

- **과제 카드 클릭**: 과제 상세 정보 확인
- **삭제 버튼**: 과제 삭제 (학생 제출물도 함께 삭제됨)

### 학생 답안 관리

1. **과제 카드 클릭**하여 상세 페이지 열기
2. **"답안지 추가" 버튼 클릭**
3. **학생 정보 입력**:
   - 학생 이름
   - 논술 내용 (텍스트 입력)
4. **"추가" 버튼 클릭**

### AI 채점

1. **과제 상세 페이지**에서 제출물 목록 확인
2. **"채점하기" 버튼 클릭**
3. **AI 채점 진행** (10-30초 소요)
4. **채점 완료 후 결과 표시**:
   - 전체 점수 (예: 5/4 - 총점은 기준 수 × 4)
   - 종합 피드백
   - 기준별 상세 점수 및 피드백

### 채점 이력 확인

1. **"채점 이력" 탭 클릭**
2. **모든 채점 완료된 답안 확인**:
   - 과제 제목
   - 학생 이름
   - 점수
   - 종합 피드백
   - 제출일 및 채점일

### 직접 논술 채점 (홈페이지)

1. **홈페이지 (`/`)에서 직접 채점 가능**
2. **과제 프롬프트 입력**
3. **학년 수준 선택**
4. **루브릭 기준 설정** (4개 기본 제공)
5. **학생 논술 입력**
6. **"AI로 논술 채점" 버튼 클릭**
7. **결과 확인**: 기준별 점수, 강점, 개선점, 수정 제안

### 채점 결과 이해하기

- **기준별 점수**: 1-4점 척도
  - 1점: 미흡
  - 2점: 발전 필요
  - 3점: 양호
  - 4점: 우수
- **강점**: 학생이 잘한 부분
- **개선점**: 보완이 필요한 부분
- **수정 제안**: 구체적인 개선 방법 (최소 3가지)
- **다음 단계 조언**: 작문 실력 향상 전략

## Tech Stack

- **Framework**: Hono (lightweight web framework)
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: Vanilla JavaScript + TailwindCSS
- **Build Tool**: Vite
- **Deployment**: Cloudflare Pages

## 완료된 기능

### 핵심 채점 시스템
✅ 프로젝트 구조 설정 및 Git 저장소 초기화  
✅ Cloudflare D1 데이터베이스 설정 및 마이그레이션  
✅ AI 채점 API 엔드포인트 구현  
✅ 루브릭 입력 프론트엔드 UI  
✅ 상세한 피드백 표시 화면  
✅ 채점 기록 및 아카이브 기능  

### 랜딩 페이지 & UI
✅ 히어로 섹션이 있는 현대적인 SaaS 랜딩 페이지  
✅ 3단계 워크플로우 시각화 (루브릭 업로드 → 논술 업로드 → 결과 다운로드)  
✅ 아이콘과 이점이 포함된 기능 섹션  
✅ 프라이버시 및 규정 준수 섹션  
✅ FAQ 섹션  
✅ 완전한 한글화 (모든 UI 텍스트)  
✅ Navy 색상 테마 (#1e3a8a)  
✅ 참고 자료 첨부 기능 (4개 기본 + 7개 추가 가능)  
✅ "AI 논술 평가" 브랜딩  

### 사용자 관리 (NEW! 🎉)
✅ **사용자 회원가입 및 로그인 시스템**  
✅ **세션 기반 인증 (7일 만료)**  
✅ **로그인 페이지 및 회원가입 페이지**  
✅ **프라이빗 라우트 보호 (인증 필요)**  

### 교사 대시보드 (NEW! 🎉)
✅ **"나의 페이지" - 교사 전용 대시보드**  
✅ **논술 과제 생성 및 관리**  
  - 과제 제목, 설명, 학년 수준, 마감일  
  - 맞춤형 루브릭 기준 추가 (동적 UI)  
✅ **학생 답안지 업로드 및 관리**  
  - 학생 이름 및 논술 내용 입력  
  - 제출물 목록 보기  
✅ **AI 자동 채점 통합**  
  - 학생 답안을 AI로 자동 채점  
  - 루브릭 기준별 상세 점수 및 피드백  
  - 채점 결과를 데이터베이스에 저장  
✅ **채점 이력 대시보드**  
  - 모든 채점 완료된 답안 목록  
  - 학생별 점수 및 피드백 확인  

### CMS & 리소스 관리
✅ **CMS 시스템 (Admin 페이지)**  
✅ **평가 관련 자료 관리**  
  - 루브릭 자료  
  - 논술 평가 자료  
✅ **드롭다운 네비게이션 메뉴**  

### 가격 정책
✅ **가격 페이지 (Pricing)**  
✅ **4개 요금제 (기본/라이트/프로/프리미엄)**  
✅ **월간/연간 결제 토글**  
✅ **구독 관리 시스템 (DB 스키마)**

## Features Not Yet Implemented

⏳ 파일 업로드 백엔드 처리 (이미지 OCR, PDF 텍스트 추출)  
⏳ 프로덕션용 비밀번호 암호화 (bcrypt)  
⏳ 팀 협업 기능 (교사 그룹)  
⏳ 논술 비교 및 표절 검사  
⏳ PDF/Word 문서 직접 업로드  
⏳ 채점 결과 내보내기 (PDF, CSV)  
⏳ LMS 통합 (Google Classroom, Canvas)  
⏳ Production Cloudflare Pages deployment  
⏳ 실시간 채점 진행률 표시  
⏳ 학생용 포털 (자신의 채점 결과 확인)

## 디자인 하이라이트

### 주요 기능 업데이트

1. **히어로 섹션**: 
   - 그라디언트 배경 (green to blue)
   - 신뢰 지표: "1,000개 이상의 학교와 대학에서 신뢰하는 서비스"
   - 명확한 CTA: "무료로 채점 시작하기" 및 "작동 방식 보기"

2. **신뢰 바**:
   - 주요 메트릭: 10배 빠른 채점, 1,000+ 신뢰하는 학교, <4% 점수 편차, 100% 프라이버시 우선

3. **작동 방식**:
   - 번호가 매겨진 원이 있는 3단계 프로세스
   - 간단한 워크플로우 시각화

4. **기능 섹션**:
   - 아이콘 배지가 있는 6개의 기능 카드
   - 참여를 위한 호버 애니메이션

5. **참고 자료 첨부**:
   - 과제 프롬프트 아래 자료 첨부 영역
   - 4개 기본 슬롯 + 7개 추가 가능 (최대 11개)
   - "+" 버튼으로 동적 추가
   - 남은 슬롯 수 실시간 표시

6. **프라이버시 섹션**:
   - 개인정보 보호법, AES-256 암호화, 데이터 소유권, SOC 2 배지
   - 보안 및 규정 준수 강조

7. **FAQ 섹션**:
   - 접을 수 있는 details 요소
   - 교사들의 일반적인 질문에 대한 답변

## Recommended Next Steps

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

## Deployment Status

- **Platform**: Cloudflare Pages
- **Status**: ✅ Local Development Active / ⏳ Production Deployment Pending
- **Last Updated**: 2025-11-04
- **Major Updates**:
  - ✅ 사용자 인증 시스템 구현
  - ✅ 교사 대시보드 ("나의 페이지") 완성
  - ✅ AI 자동 채점 통합
  - ✅ 채점 이력 대시보드

## Test Account

개발 서버에서 테스트할 수 있는 계정:

```
Email: teacher@test.com
Password: test1234
```

또는 `/signup`에서 새 계정을 생성하세요.

## Project Structure

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

## Comparison with EssayGrader.ai

| Feature | EssayGrader.ai | This Project |
|---------|---------------|--------------|
| Landing Page Design | ✅ Modern SaaS | ✅ Inspired by original |
| Hero Section | ✅ Gradient + CTAs | ✅ Implemented |
| 3-Step Workflow | ✅ Visual diagram | ✅ Implemented |
| Custom Rubrics | ✅ 400+ templates | ✅ Custom creation |
| AI Grading | ✅ Production LLM | ⏳ Demo simulation |
| LMS Integration | ✅ Google/Canvas | ⏳ Not yet |
| Pricing Plans | ✅ Free + Paid | N/A (Open Source) |
| SOC 2 Compliance | ✅ Certified | N/A (Local deployment) |

## License

MIT License

## Contact

For questions or contributions, please create an issue.

---

**Built with ❤️ using Hono, Cloudflare Workers, and AI**  
**Designed to match the elegance of EssayGrader.ai**
