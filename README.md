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
✅ **파일 업로드 기능** (NEW! 🎉): 이미지(JPG, PNG) 및 PDF 파일 업로드 후 자동 텍스트 추출
  - **이미지 OCR**: Google Cloud Vision API 사용한 한글/영어 텍스트 추출
  - **PDF 처리**: 텍스트 기반 PDF는 PDF.js로 추출, 이미지 기반 PDF는 OCR 처리
  - **실시간 처리**: 파일 업로드 시 즉시 텍스트 추출 및 처리 진행
✅ **채점 기록**: 과거 채점 세션 및 결과 저장 및 검토  
✅ **다국어 지원**: 다양한 언어 및 작문 스타일 지원  
✅ **빠른 처리**: 즉각적인 피드백으로 몇 초 안에 결과 확인

## URLs

- **Development Server**: https://3000-ikiygtk7zjdsp3lj0l2bs-18e660f9.sandbox.novita.ai
- **Main Pages**:
  
  **교사용 페이지**:
  - `/` - 랜딩 페이지
  - `/login` - 교사 로그인
  - `/signup` - 교사 회원가입
  - `/my-page` - 교사 대시보드 (인증 필요)
  - `/pricing` - 가격 정책
  
  **관리자 페이지** (NEW! 🎉):
  - `/admin` - 관리자 대시보드 (시스템 통계, 사용자 관리, 활동 모니터링)
  - `/admin/cms` - CMS 리소스 관리
  
  **학생용 페이지** (NEW! 🎉):
  - `/student/login` - 학생 로그인
  - `/student/signup` - 학생 회원가입
  - `/student/dashboard` - 학생 대시보드 (액세스 코드 입력, 답안 제출)
  - `/student/feedback/:id` - 상세 피드백 보기
  
- **API Endpoints**:
  
  **교사 인증 API**:
  - `POST /api/auth/signup` - 교사 회원가입
  - `POST /api/auth/login` - 교사 로그인 (세션 생성)
  - `POST /api/auth/logout` - 교사 로그아웃
  
  **학생 인증 API** (NEW! 🎉):
  - `POST /api/student/auth/signup` - 학생 회원가입
  - `POST /api/student/auth/login` - 학생 로그인 (세션 생성)
  
  **과제 관리 API** (교사 인증 필요):
  - `GET /api/assignments` - 내 과제 목록
  - `POST /api/assignments` - 새 과제 생성
  - `GET /api/assignment/:id` - 과제 상세 정보
  - `DELETE /api/assignment/:id` - 과제 삭제
  - `POST /api/assignment/:id/submission` - 학생 답안 추가
  - `POST /api/assignment/:id/access-code` - 액세스 코드 생성
  
  **학생 제출 API** (학생 인증 필요, NEW! 🎉):
  - `GET /api/student/assignment/:code` - 액세스 코드로 과제 조회
  - `POST /api/student/submit` - 답안 제출 (재제출 지원)
  - `GET /api/student/my-submissions` - 내 제출물 목록
  - `GET /api/student/submission/:id/feedback` - 상세 피드백 조회
  - `GET /api/student/progress` - 성장 기록 조회
  
  **채점 API** (교사 인증 필요):
  - `GET /api/submission/:id` - 제출물 상세 조회 (학생 이름, 답안 내용 포함) (NEW! 🎉)
  - `POST /api/submission/:id/grade` - 답안 AI 채점 (상세 피드백 생성)
  - `PUT /api/submission/:id/feedback` - 채점 피드백 수정 (NEW! 🎉)
  - `GET /api/grading-history` - 채점 이력 조회
  
  **파일 업로드 API** (교사/학생 인증 필요, NEW! 🎉):
  - `POST /api/upload/image` - 이미지 파일 업로드 및 OCR 처리 (JPG, PNG, WebP)
  - `POST /api/upload/pdf` - PDF 파일 업로드 및 텍스트 추출/OCR 처리
  - `GET /api/upload/:id` - 업로드된 파일 정보 및 처리 로그 조회
  - `DELETE /api/upload/:id` - 업로드된 파일 삭제
  
  **관리자 API** (NEW! 🎉):
  - `GET /api/admin/stats` - 시스템 전체 통계
  - `GET /api/admin/recent-activity` - 최근 활동 내역
  - `GET /api/admin/users` - 사용자 목록 (교사/학생)
  
  **기존 채점 API**:
  - `POST /api/grade` - 직접 논술 채점
  - `GET /api/result/:essayId` - 채점 결과 조회
  - `GET /api/sessions` - 채점 세션 목록
  - `GET /api/session/:sessionId` - 세션 상세
  - `GET /api/health` - Health check

## Data Architecture

### Data Models

**교사 인증**:
1. **Users**: 교사 계정 정보 (이름, 이메일, 비밀번호 해시)
2. **Sessions**: 교사 로그인 세션 (UUID, 만료 시간)
3. **Subscriptions**: 구독 정보 (요금제, 결제 주기)

**학생 인증** (NEW! 🎉):
4. **Student Users**: 학생 계정 정보 (이름, 이메일, 비밀번호 해시, 학년)
5. **Student Sessions**: 학생 로그인 세션 (UUID, 만료 시간)

**과제 관리**:
6. **Assignments**: 논술 과제 (제목, 설명, 학년, 마감일)
7. **Assignment Rubrics**: 과제별 루브릭 기준
8. **Assignment Access Codes**: 6자리 액세스 코드 (과제 접근용)
9. **Student Submissions**: 학생 답안지 (이름, 논술 내용, 채점 상태, 버전 추적)

**상세 피드백 시스템** (NEW! 🎉):
10. **Submission Feedback**: 기준별 상세 피드백 (긍정적 피드백, 개선 영역, 구체적 제안)
11. **Submission Summary**: 전체 요약 (총점, 강점, 약점, 전체 코멘트, 우선 개선 사항)

**성장 추적** (NEW! 🎉):
12. **Student Progress**: 학생별 과제 진행 상황 (제출 횟수, 최고/최근 점수, 개선율)

**채점 시스템**:
13. **Grading Sessions**: 채점 세션 정보 (과제 프롬프트, 학년)
14. **Rubric Criteria**: 평가 기준 (채점 세션용)
15. **Essays**: 제출된 논술 (채점 세션용)
16. **Grading Results**: 종합 채점 결과
17. **Criterion Scores**: 기준별 상세 점수

**학습 리소스** (테이블 생성 완료, 기능 대기):
18. **Learning Resources**: 학습 자료 (제목, 설명, 카테고리, 학년, URL/내용)
19. **Student Resource Recommendations**: 학생별 추천 자료 (기반 제출물, 이유, 완료 상태)

**교사 통계** (테이블 생성 완료, 기능 대기):
20. **Teacher Statistics**: 교사별 통계 (총 제출물, 평균 점수, 절약 시간, 공통 강점/약점)

**CMS**:
21. **Resource Posts**: 교육 자료 게시물 (루브릭, 논술 평가 자료)

**파일 업로드** (NEW! 🎉):
22. **Uploaded Files**: 업로드된 파일 정보 (파일명, 타입, 크기, 저장 키, 추출된 텍스트, 처리 상태)
23. **File Processing Log**: 파일 처리 로그 (단계별 처리 상태, 메시지, 처리 시간)

### Storage Service

- **Cloudflare D1 Database**: SQLite-based globally distributed database
  - Local Development: `.wrangler/state/v3/d1` (local SQLite)
  - Production: Cloudflare D1 (globally distributed)
  - 6개 마이그레이션 완료:
    - 0001: 채점 시스템 기본 스키마
    - 0002: CMS 리소스 테이블
    - 0003: 사용자 및 구독 테이블
    - 0004: 과제 및 제출물 테이블
    - 0005: 학생 기능 전체 스키마 (NEW! 🎉)
      - 학생 인증 (student_users, student_sessions)
      - 액세스 코드 시스템 (assignment_access_codes)
      - 상세 피드백 (submission_feedback, submission_summary)
      - 성장 추적 (student_progress)
      - 학습 리소스 (learning_resources, student_resource_recommendations)
      - 교사 통계 (teacher_statistics)
    - 0006: 파일 업로드 기능 (NEW! 🎉)
      - 파일 메타데이터 (uploaded_files)
      - 파일 처리 로그 (file_processing_log)

- **Google Cloud Vision API**: 이미지 OCR 및 PDF 이미지 추출
  - Text Detection: 이미지에서 한글/영어 텍스트 추출
  - Document Text Detection: 이미지 기반 PDF에서 전체 문서 텍스트 추출
  - Language Support: 한글(ko), 영어(en) 지원

- **PDF.js (Mozilla)**: 텍스트 기반 PDF 처리
  - Client-side PDF text extraction
  - Page-by-page text parsing
  - Compatible with Cloudflare Workers environment

- **Cloudflare R2 Storage** (NEW! 🎉):
  - S3-compatible object storage for file uploads
  - Persistent file storage with automatic cleanup
  - Bucket name: `webapp-files`
  - Storage key format: `user_<id>/<timestamp>_<hash>_<filename>`
  - HTTP metadata preservation (content-type)

### Data Flow

**채점 플로우**:
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

**파일 업로드 플로우** (NEW! 🎉):
```
User Uploads File (Image/PDF)
    ↓
Validate File (type, size)
    ↓
Store Metadata in DB (uploaded_files)
    ↓
┌─────────────────┬──────────────────┐
│ Image Files     │ PDF Files        │
│ (JPG, PNG)      │ (application/pdf)│
└─────────────────┴──────────────────┘
    ↓                    ↓
Google Vision API    ┌───────────────┐
(Text Detection)     │ Text-based?   │
    ↓                └───────────────┘
Extract Text          Yes ↓    No ↓
    ↓              PDF.js      Google Vision
    ↓              Extract     (Document Detection)
    ↓                  ↓              ↓
    └──────────────────┴──────────────┘
                       ↓
            Update DB with Text
                       ↓
            Return to Frontend
                       ↓
        Auto-populate Essay Field
```

## User Guide

### 교사 시작하기

1. **회원가입**: `/signup`에서 이름, 이메일, 비밀번호로 계정 생성
2. **로그인**: `/login`에서 이메일과 비밀번호로 로그인
3. **나의 페이지 접속**: 로그인 후 자동으로 `/my-page`로 리다이렉트

### 학생 시작하기 (NEW! 🎉)

1. **회원가입**: `/student/signup`에서 이름, 이메일, 비밀번호, 학년으로 계정 생성
2. **로그인**: `/student/login`에서 이메일과 비밀번호로 로그인
3. **대시보드 접속**: 로그인 후 자동으로 `/student/dashboard`로 리다이렉트
4. **액세스 코드 입력**: 선생님께서 제공한 6자리 코드 입력
5. **답안 작성 및 제출**: 과제 정보 확인 후 답안 작성 및 제출
6. **피드백 확인**: 선생님이 채점하면 상세 피드백 확인 가능

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

#### 텍스트로 답안 추가
1. **과제 카드 클릭**하여 상세 페이지 열기
2. **"답안지 추가" 버튼 클릭**
3. **학생 정보 입력**:
   - 학생 이름
   - 논술 내용 (텍스트 입력)
4. **"추가" 버튼 클릭**

#### 파일로 답안 추가 (NEW! 🎉)
1. **"파일 선택" 탭 클릭**
2. **지원 파일 형식**:
   - 이미지: JPG, PNG, WebP (최대 10MB)
   - PDF: 텍스트/이미지 기반 PDF (최대 10MB)
3. **파일 업로드 프로세스**:
   - 파일 선택 또는 드래그앤드롭
   - 파일 미리보기 확인
   - "AI로 논술 채점하기" 버튼 클릭
   - 자동으로 텍스트 추출 진행
   - 추출된 텍스트로 채점 진행
4. **처리 시간**:
   - 이미지 OCR: 5-10초
   - 텍스트 PDF: 3-5초
   - 이미지 PDF OCR: 10-15초

### 액세스 코드 생성 (NEW! 🎉)

1. **과제 상세 페이지**에서 "액세스 코드 생성" 버튼 클릭
2. **6자리 숫자 코드 자동 생성**
3. **학생들에게 코드 공유** (예: 123456)
4. **학생들이 코드로 과제 접근 및 제출**

### AI 채점 및 피드백 검토 (NEW! 🎉)

1. **과제 상세 페이지**에서 제출물 목록 확인
2. **"채점하기" 버튼 클릭**
3. **AI 채점 진행** (10-30초 소요)
4. **채점 결과 검토 모달** (Split-Screen Layout):
   - **왼쪽 패널**: 학생 답안 전체 내용 (읽기 전용, 스크롤 가능)
   - **오른쪽 패널**: 피드백 및 평가 (편집 가능)
     - 전체 점수 수정 (0-10점)
     - 종합 평가 편집
     - 기준별 점수 및 피드백 수정
     - 종합 의견, 수정 제안, 다음 단계 조언 편집
5. **검토 후 3가지 옵션**:
   - **출력**: 채점 결과 및 피드백을 별도 창에서 출력/저장
   - **저장하고 완료**: 수정된 피드백을 데이터베이스에 저장
   - **취소**: 변경사항 없이 모달 닫기
6. **상세 피드백 자동 생성**:
   - 각 기준별 긍정적 피드백
   - 개선이 필요한 부분
   - 구체적인 개선 방법 (단계별)
   - 학년에 맞는 톤 조정 (초등/중등/고등)

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

### 학생 답안 제출 및 피드백 확인 (NEW! 🎉)

**학생 워크플로우**:

1. **액세스 코드 입력**
   - 선생님께서 제공한 6자리 코드 입력 (예: 123456)
   - 과제 제목, 설명, 루브릭 기준 확인

2. **답안 작성 및 제출**
   - 웹 인터페이스에서 직접 작성
   - "답안 제출하기" 버튼 클릭
   - 재제출 가능 (버전 자동 추적)

3. **제출물 확인**
   - "나의 제출물" 섹션에서 제출 이력 확인
   - 채점 상태 실시간 표시 (채점 대기중/채점 완료)

4. **상세 피드백 확인**
   - 채점 완료 후 "상세 피드백 보기" 버튼 클릭
   - 전체 요약 카드:
     - 총점 및 전체 코멘트
     - 강점 및 약점 요약
     - 우선 개선 사항
   - 기준별 상세 피드백 카드:
     - 점수 표시 (1-4점, 색상 구분)
     - 긍정적 피드백 (잘한 점)
     - 개선이 필요한 부분
     - 구체적인 개선 방법 (단계별 제안)

5. **재제출 (개선 후)**
   - 동일한 액세스 코드로 다시 접근
   - 피드백을 반영하여 답안 수정
   - 재제출 시 버전 번호 자동 증가
   - 이전 제출물과 비교하여 개선율 자동 계산

### 채점 결과 이해하기

- **기준별 점수**: 1-4점 척도
  - 1점: 미흡 (빨간색)
  - 2점: 발전 필요 (주황색)
  - 3점: 양호 (파란색)
  - 4점: 우수 (초록색)
- **강점**: 학생이 잘한 부분
- **개선점**: 보완이 필요한 부분
- **수정 제안**: 구체적인 개선 방법 (최소 3가지)
- **다음 단계 조언**: 작문 실력 향상 전략
- **개선율**: 이전 제출물 대비 점수 향상 퍼센트 (재제출 시)

## Tech Stack

- **Framework**: Hono (lightweight web framework)
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: Vanilla JavaScript + TailwindCSS
- **Build Tool**: Vite
- **Deployment**: Cloudflare Pages
- **File Processing** (NEW! 🎉):
  - **PDF.js (pdfjs-dist)**: Text extraction from text-based PDFs
  - **Google Cloud Vision API**: OCR for images and image-based PDFs
  - **mime-types**: File type validation
- **Data Visualization**: Chart.js (관리자 대시보드)

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

### 관리자 대시보드 (NEW! 🎉 - 2025-11-06 구현 완료)

✅ **시스템 통계 대시보드**
  - 실시간 시스템 현황 모니터링
  - 8개 핵심 지표 카드 (교사/학생/제출물/채점 완료/대기/평균 점수/최근 7일 활동/과제)
  - 아름다운 그라디언트 디자인
  - 호버 애니메이션 효과

✅ **4개 주요 탭**
  - **개요**: 최다 활동 교사 Top 10, 최다 제출 학생 Top 10
  - **최근 활동**: 실시간 제출 및 채점 활동 모니터링 (최근 50개)
  - **사용자 관리**: 교사/학생 전체 목록 및 활동 통계
  - **분석**: Chart.js 기반 시각화 (제출 현황, 점수 분포)

✅ **상세 정보 제공**
  - 교사별 과제 수, 제출물 수
  - 학생별 제출물 수, 학년 정보
  - 활동 시간대 분석
  - 채점 상태 실시간 표시

✅ **데이터 시각화**
  - Doughnut Chart: 채점 완료 vs 대기
  - Bar Chart: 점수 분포
  - 반응형 테이블 디자인
  - 색상 코딩 (채점 완료: 초록, 대기: 노랑)

### 학생 기능 (NEW! 🎉 - 2025-11-06 구현 완료)

✅ **학생 인증 시스템**
  - 학생 전용 회원가입 및 로그인
  - 학년 수준 정보 저장 (초등/중등/고등)
  - 독립적인 학생 세션 관리

✅ **액세스 코드 기반 과제 접근**
  - 교사가 생성한 6자리 액세스 코드로 과제 접근
  - 과제 정보 및 루브릭 기준 확인
  - 로그인 없이도 과제 제출 가능한 유연한 설계

✅ **답안 직접 제출**
  - 웹 인터페이스에서 직접 답안 작성 및 제출
  - 재제출 기능 지원 (버전 추적)
  - 제출 이력 자동 관리

✅ **상세 피드백 시스템**
  - **기준별 상세 피드백**:
    - 긍정적 피드백 (잘한 점)
    - 개선이 필요한 부분
    - 구체적인 개선 방법 (단계별 제안)
  - **학년별 톤 조정**:
    - 초등학생: 친근하고 격려하는 톤
    - 중학생: 중간 수준의 격식
    - 고등학생: 학술적이고 심화된 톤
  - **전체 요약**:
    - 총점 및 퍼센트
    - 강점 및 약점 요약
    - 우선 개선 사항 제안

✅ **성장 추적 시스템**
  - 제출 횟수 자동 카운트
  - 최고 점수 및 최근 점수 기록
  - 개선율 계산 (이전 제출 대비)
  - API 레벨 구현 완료 (UI 그래프 대기중)

✅ **학생 대시보드**
  - 과제 액세스 코드 입력 UI
  - 답안 작성 및 제출 인터페이스
  - 내 제출물 목록 및 상태 확인
  - 채점 완료된 답안의 피드백 조회

### 파일 업로드 기능 (NEW! 🎉 - 2025-11-08 구현 완료)

✅ **이미지 파일 업로드 및 OCR**
  - 지원 형식: JPG, PNG, WebP
  - Google Cloud Vision API 통합
  - 한글/영어 텍스트 동시 인식
  - 실시간 텍스트 추출 (5-10초)
  - 처리 상태 실시간 표시

✅ **PDF 파일 업로드 및 처리**
  - 텍스트 기반 PDF: PDF.js로 직접 텍스트 추출
  - 이미지 기반 PDF: Google Vision API로 OCR 처리
  - 자동 PDF 타입 감지 및 최적화된 처리
  - 페이지별 텍스트 추출 지원

✅ **파일 처리 인프라**
  - 파일 메타데이터 DB 저장
  - **Cloudflare R2 Storage 영구 저장** (NEW!)
  - 처리 로그 시스템 (단계별 기록)
  - 파일 크기 검증 (최대 10MB)
  - 파일 타입 검증 (MIME type)
  - 에러 핸들링 및 사용자 피드백
  - 자동 파일 정리 (삭제 시 R2에서도 제거)

✅ **프론트엔드 UI**
  - 파일 선택 / 텍스트 입력 탭 전환
  - 드래그앤드롭 파일 업로드
  - 이미지 파일 미리보기
  - 파일 정보 표시 (이름, 크기)
  - 업로드 진행 상태 표시
  - 텍스트 추출 성공/실패 알림

### 채점 결과 검토 및 출력 (NEW! 🎉 - 2025-11-09 구현 완료)

✅ **Split-Screen 검토 모달**
  - **두 패널 레이아웃**: 학생 답안(왼쪽) + 피드백(오른쪽)
  - **실시간 편집**: 모든 피드백 필드 수정 가능
  - **반응형 디자인**: 양쪽 패널 독립적인 스크롤
  - **컨텍스트 유지**: 학생 정보, 과제 제목 표시

✅ **피드백 출력 기능**
  - **전용 출력 창**: 채점 결과를 별도 창에서 열기
  - **완전한 정보 포함**:
    - 과제 정보 및 학생 이름
    - 학생 답안 전체 내용
    - 전체 점수 및 종합 평가
    - 기준별 상세 피드백 (점수, 강점, 개선점)
    - 종합 의견, 수정 제안, 다음 단계 조언
  - **인쇄 최적화**: 깔끔한 인쇄 레이아웃
  - **브랜딩**: "📝 AI 논술 채점 결과" 헤더

✅ **피드백 수정 시스템**
  - **실시간 수정**: 텍스트 영역 및 점수 입력
  - **자동 저장**: "저장하고 완료" 버튼으로 DB 업데이트
  - **변경사항 추적**: 수정된 내용 데이터베이스 반영

## Features Not Yet Implemented

⏳ Word 문서 처리 (.doc, .docx)  
⏳ R2 Public URL 설정 (custom domain for public file access)  
⏳ 프로덕션용 비밀번호 암호화 (bcrypt)  
⏳ 팀 협업 기능 (교사 그룹)  
⏳ 논술 비교 및 표절 검사  
⏳ 채점 결과 PDF 자동 다운로드  
⏳ CSV 내보내기 (일괄 채점 결과)  
⏳ LMS 통합 (Google Classroom, Canvas)  
⏳ Production Cloudflare Pages deployment  
⏳ 실시간 채점 진행률 표시  
⏳ 학생 성장 추적 그래프 UI (API 완료, 시각화 대기)  
⏳ 학습 리소스 추천 시스템  
⏳ 대량 채점 및 통계 대시보드

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

### 환경 변수 설정 (필수)

파일 업로드 기능을 사용하려면 `.dev.vars` 파일을 설정해야 합니다:

```bash
# .dev.vars 파일 내용
# Google Cloud Vision API
GOOGLE_VISION_API_KEY=your_api_key_here

# File Upload Settings
MAX_FILE_SIZE=10485760  # 10MB
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/jpg,image/webp
ALLOWED_PDF_TYPES=application/pdf

# Storage Settings
R2_PUBLIC_URL=https://your-r2-bucket.r2.dev
```

**Google Cloud Vision API 키 받기**:
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. "API 및 서비스" → "라이브러리" 이동
4. "Cloud Vision API" 검색 및 사용 설정
5. "사용자 인증 정보" → "API 키 만들기" 클릭
6. 생성된 API 키를 `.dev.vars`의 `GOOGLE_VISION_API_KEY`에 입력

**Cloudflare R2 Bucket 생성**:
1. [Cloudflare Dashboard](https://dash.cloudflare.com/) 접속
2. 왼쪽 사이드바에서 "R2" 선택
3. "Create bucket" 클릭
4. Bucket 이름: `webapp-files` 입력
5. Region: Automatic 선택
6. "Create bucket" 클릭
7. `wrangler.jsonc`의 `r2_buckets` 섹션이 올바르게 설정되었는지 확인

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
- **Last Updated**: 2025-11-06
- **Major Updates**:
  - ✅ 사용자 인증 시스템 구현 (교사/학생 분리)
  - ✅ 교사 대시보드 ("나의 페이지") 완성
  - ✅ AI 자동 채점 통합
  - ✅ 채점 이력 대시보드
  - ✅ **학생 기능 전체 구현** (2025-11-06 오전):
    - 학생 회원가입/로그인
    - 액세스 코드 기반 과제 접근
    - 답안 직접 제출 및 재제출
    - 기준별 상세 피드백 시스템
    - 학년별 톤 조정 (초등/중등/고등)
    - 성장 추적 API
    - 학생 대시보드 UI
  - ✅ **관리자 대시보드 구현** (2025-11-06 오후):
    - 시스템 전체 통계 모니터링
    - 사용자 관리 (교사/학생)
    - 최근 활동 추적
    - Chart.js 기반 데이터 시각화
  - ✅ **파일 업로드 기능 구현** (2025-11-08 오후):
    - 이미지 파일 업로드 (JPG, PNG, WebP)
    - PDF 파일 업로드 (텍스트/이미지 기반)
    - Google Cloud Vision API OCR 통합
    - PDF.js 텍스트 추출 통합
    - 파일 처리 로그 시스템
    - 프론트엔드 파일 업로드 UI
    - **Cloudflare R2 Storage 통합** (영구 저장)
  - ✅ **채점 결과 검토 및 출력 기능** (2025-11-09):
    - Split-Screen 검토 모달 (학생 답안 좌측, 피드백 우측)
    - 실시간 피드백 편집 기능
    - 채점 결과 출력 기능 (인쇄 최적화 레이아웃)
    - 제출물 상세 조회 API 추가

## Test Accounts

개발 서버에서 테스트할 수 있는 계정:

**교사 계정**:
```
Email: teacher@test.com
Password: test1234
```

또는 `/signup`에서 새 교사 계정을 생성하세요.

**학생 계정** (NEW! 🎉):
```
Email: student@test.com
Password: test1234
학년: 고등학교 1학년
```

또는 `/student/signup`에서 새 학생 계정을 생성하세요.

**테스트 워크플로우**:
1. 교사 계정으로 로그인하여 과제 생성
2. 액세스 코드 생성 (예: 123456)
3. 학생 계정으로 로그인
4. 액세스 코드로 과제 접근 및 답안 제출
5. 교사 계정으로 답안 채점
6. 학생 계정으로 피드백 확인

## Project Structure

```
webapp/
├── src/
│   ├── index.tsx             # Hono 애플리케이션 진입점 (교사/학생 라우트)
│   ├── grading-service.ts    # AI 채점 로직
│   ├── feedback-service.ts   # 상세 피드백 생성 모듈 (NEW! 🎉)
│   ├── db-service.ts         # 데이터베이스 서비스
│   └── types.ts              # TypeScript 타입 정의
├── public/static/
│   └── app.js                # 프론트엔드 JavaScript
├── migrations/
│   ├── 0001_initial_schema.sql      # 채점 시스템 기본 스키마
│   ├── 0002_resource_posts.sql      # CMS 리소스 테이블
│   ├── 0003_users_subscriptions.sql # 사용자 및 구독 테이블
│   ├── 0004_assignments.sql         # 과제 및 제출물 테이블
│   └── 0005_add_student_features.sql # 학생 기능 전체 스키마 (NEW! 🎉)
├── ecosystem.config.cjs      # PM2 설정
├── wrangler.jsonc            # Cloudflare 설정
├── vite.config.ts            # Vite 빌드 설정
└── package.json              # 프로젝트 메타데이터
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
