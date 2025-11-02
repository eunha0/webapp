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
- **API Endpoints**:
  - `POST /api/grade` - Grade an essay
  - `GET /api/result/:essayId` - Get grading result
  - `GET /api/sessions` - List grading sessions
  - `GET /api/session/:sessionId` - Get session details
  - `GET /api/health` - Health check

## Data Architecture

### Data Models

1. **Grading Sessions**: Session information (assignment prompt, grade level)
2. **Rubric Criteria**: Evaluation criteria
3. **Essays**: Student-submitted essays
4. **Grading Results**: Comprehensive grading results
5. **Criterion Scores**: Detailed scores for each criterion

### Storage Service

- **Cloudflare D1 Database**: SQLite-based globally distributed database
  - Local Development: `.wrangler/state/v3/d1` (local SQLite)
  - Production: Cloudflare D1 (globally distributed)

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

### How to Grade an Essay

1. **Enter Assignment Prompt**: Describe what students need to write about
   - Example: "Analyze the major causes of World War II, support your arguments using specific historical examples..."

2. **Specify Grade Level**: Enter the appropriate grade level
   - Example: "12th Grade AP History"

3. **Set Rubric Criteria**: Add evaluation criteria (4 defaults provided)
   - Criterion 1: Understanding and Analysis of Key Concepts
   - Criterion 2: Use of Evidence and Historical Examples
   - Criterion 3: Accuracy of Source Citation
   - Criterion 4: Grammar, Organization, and Flow

4. **Submit Essay**: Paste the student's essay into the text area

5. **Grade**: Click "Grade Essay with AI" button

### Understanding Results

After grading completes, you'll see:

- **Total Score**: Score out of 10
- **Summary Evaluation**: Overall essay quality summary
- **Detailed Rubric Scores**: 1-4 scale score for each criterion
  - Strengths: What the student did well
  - Areas for Improvement: What needs work
- **Overall Assessment**: How well the essay met requirements
- **Specific Revision Suggestions**: At least 3 concrete examples with fixes
- **Next Steps for Improvement**: Strategies to improve writing skills

## Tech Stack

- **Framework**: Hono (lightweight web framework)
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: Vanilla JavaScript + TailwindCSS
- **Build Tool**: Vite
- **Deployment**: Cloudflare Pages

## 완료된 기능

✅ 프로젝트 구조 설정 및 Git 저장소 초기화  
✅ Cloudflare D1 데이터베이스 설정 및 마이그레이션  
✅ AI 채점 API 엔드포인트 구현  
✅ 히어로 섹션이 있는 현대적인 SaaS 랜딩 페이지  
✅ 3단계 워크플로우 시각화 (루브릭 업로드 → 논술 업로드 → 결과 다운로드)  
✅ 아이콘과 이점이 포함된 기능 섹션  
✅ 프라이버시 및 규정 준수 섹션  
✅ FAQ 섹션  
✅ 루브릭 입력 프론트엔드 UI  
✅ 상세한 피드백 표시 화면  
✅ 채점 기록 및 아카이브 기능  
✅ 로컬 개발 서버 및 테스트  
✅ **NEW: 완전한 한글화 (모든 UI 텍스트)**  
✅ **NEW: Green-to-blue 그라디언트 테마**  
✅ **NEW: 참고 자료 첨부 기능 (4개 기본 + 7개 추가 가능)**  
✅ **NEW: "AI 논술 평가" 브랜딩**  
✅ **NEW: 한글 메시징: "AI로 논술 답안지를 10배 빠르게 채점"**

## Features Not Yet Implemented

⏳ Real LLM API integration (OpenAI, Anthropic, etc.)  
⏳ User authentication and authorization  
⏳ Multi-user support and team collaboration  
⏳ Essay comparison and plagiarism detection  
⏳ PDF/Word document upload support  
⏳ Export grading results (PDF, CSV)  
⏳ LMS integrations (Google Classroom, Canvas)  
⏳ Production Cloudflare Pages deployment

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
- **Last Updated**: 2025-11-02
- **Design Update**: EssayGrader.ai-inspired modern SaaS interface

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
