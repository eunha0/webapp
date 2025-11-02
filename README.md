# EssayGrader AI - AI-Powered Essay Grading for Teachers

## Project Overview

**EssayGrader AI** is an advanced automated essay grading (AEG) system powered by state-of-the-art Large Language Models (LLMs). It helps teachers grade essays 10x faster while providing detailed, actionable feedback that promotes student learning and growth.

### Inspired By

This project is designed to match the style and functionality of **[EssayGrader.ai](https://www.essaygrader.ai/)**, featuring a modern SaaS landing page with clean design, trust indicators, and a user-friendly grading interface.

### Key Objectives

1. **Consistent Grading (AES)**: Achieve substantial agreement (QWK 0.61+) with human graders
2. **Detailed Feedback (AWE)**: Provide timely, specific, detailed, and supportive feedback
3. **Time Savings**: Grade entire classes in minutes, not hours

### Core Features

✅ **Custom Rubric Support**: Create your own rubrics or use pre-built templates  
✅ **AI-Powered Analysis**: 1-4 scale scoring for each criterion  
✅ **Detailed Feedback**: Strengths, areas for improvement, and specific revision suggestions  
✅ **Grading History**: Save and review past grading sessions and results  
✅ **Multiple Languages**: Support for various languages and writing styles  
✅ **Fast Processing**: Get results in seconds with immediate feedback

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

## Completed Features

✅ Project structure setup and Git repository initialization  
✅ Cloudflare D1 database setup and migrations  
✅ AI grading API endpoints implementation  
✅ Modern SaaS landing page with hero section  
✅ 3-step workflow visualization (Upload rubric → Upload essays → Download results)  
✅ Features section with icons and benefits  
✅ Privacy and compliance section  
✅ FAQ section  
✅ Rubric input frontend UI  
✅ Detailed feedback display screen  
✅ Grading history and archive functionality  
✅ Local development server and testing  
✅ **NEW: EssayGrader.ai-inspired design**  
✅ **NEW: Trust indicators and social proof elements**  
✅ **NEW: Modern gradient styling and animations**

## Features Not Yet Implemented

⏳ Real LLM API integration (OpenAI, Anthropic, etc.)  
⏳ User authentication and authorization  
⏳ Multi-user support and team collaboration  
⏳ Essay comparison and plagiarism detection  
⏳ PDF/Word document upload support  
⏳ Export grading results (PDF, CSV)  
⏳ LMS integrations (Google Classroom, Canvas)  
⏳ Production Cloudflare Pages deployment

## Design Highlights

### EssayGrader.ai-Inspired Features

1. **Hero Section**: 
   - Gradient background (purple to blue)
   - Trust indicator: "Trusted by teachers at 1,000+ schools & colleges"
   - Clear CTAs: "Start Grading Free" and "See How It Works"

2. **Trust Bar**:
   - Key metrics: 10x Faster Grading, 1,000+ Schools, <4% Variance, 100% Privacy

3. **How It Works**:
   - 3-step process with numbered circles
   - Simple workflow visualization

4. **Features Section**:
   - 6 feature cards with icon badges
   - Hover animations for engagement

5. **Privacy Section**:
   - FERPA, AES-256 Encryption, Data Ownership, SOC 2 badges
   - Emphasizes security and compliance

6. **FAQ Section**:
   - Collapsible details elements
   - Common teacher questions answered

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
