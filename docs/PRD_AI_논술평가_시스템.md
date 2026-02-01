# PRD (Product Requirements Document)
# AI 논술 평가 시스템

**문서 버전**: 1.0  
**작성일**: 2026-02-01  
**프로젝트명**: AI 논술 평가 (AI Essay Grader)  
**제품 URL**: https://ai-nonsool.kr

---

## 1. 제품 개요

### 1.1 제품 비전
AI 논술 평가는 대규모 언어 모델(LLM) 기반의 지능형 논술 자동 채점 시스템으로, 교사의 채점 시간을 90% 단축하고 학생에게 즉각적이고 상세한 맞춤형 피드백을 제공하여 교육의 질을 혁신적으로 향상시킵니다.

### 1.2 핵심 가치 제안
- **10배 빠른 채점**: 전체 학급 논술을 몇 분 안에 채점 완료
- **일관성 있는 평가**: 인간 채점자 수준의 신뢰도(QWK 0.61+) 달성
- **상세한 피드백**: 학생 개개인에게 맞춤형 개선 방향 제시
- **데이터 기반 교육**: 학생 성장 추적 및 학습 분석

### 1.3 목표 사용자
- **주요 타겟**: 초중고 교사 (국어, 사회, 과학 등 논술 채점 필요 과목)
- **부차 타겟**: 학생 (자기 주도 학습, 피드백 확인)
- **확장 타겟**: 교육 기관, 학원, 입시 컨설팅

---

## 2. 시장 분석

### 2.1 문제 정의
1. **시간 부담**: 교사 1명이 30명 학생의 논술을 채점하는 데 평균 5-8시간 소요
2. **일관성 부족**: 채점 기준의 주관성, 피로도에 따른 평가 편차
3. **피드백 한계**: 시간 부족으로 인한 피상적 피드백, 개별 맞춤 불가
4. **성장 추적 어려움**: 학생별 진전도 파악 및 기록 관리 어려움

### 2.2 경쟁사 분석

| 항목 | EssayGrader.ai | Grammarly | 본 제품 |
|------|----------------|-----------|---------|
| AI 논술 채점 | ✅ | ❌ (문법만) | ✅ |
| 맞춤형 루브릭 | ✅ (400+ 템플릿) | ❌ | ✅ (무제한) |
| 한글 지원 | ❌ | ❌ | ✅ |
| 학생 직접 제출 | ✅ | ❌ | ✅ |
| 상세 피드백 | ✅ | 제한적 | ✅ |
| 파일 업로드 | ✅ | ✅ | ✅ (OCR 포함) |
| 성장 추적 | ✅ | ❌ | ✅ |
| 가격 | $49.99/월 | $12/월 | TBD |

### 2.3 시장 기회
- 한국 교육 시장: 초중고 교사 약 50만명
- 글로벌 에듀테크 시장: 2025년 $4040억 규모 예상
- AI 채점 시장 연평균 성장률(CAGR): 22.3%

---

## 3. 제품 기능 명세

### 3.1 사용자 관리

#### 3.1.1 교사 인증 시스템
- **회원가입**: 이름, 이메일, 비밀번호
- **로그인**: 세션 기반 인증 (7일 만료)
- **비밀번호 재설정**: 이메일 기반 토큰 인증
- **계정 관리**: 개인정보 수정, 계정 익명화 삭제

#### 3.1.2 학생 인증 시스템
- **회원가입**: 이름, 이메일, 비밀번호, 학년
- **로그인**: 독립적 학생 세션
- **이메일 인증**: 회원가입 시 인증 링크 발송
- **계정 관리**: 제출물 보존, 개인정보만 삭제

#### 3.1.3 관리자 시스템
- **시스템 통계**: 교사/학생/과제/제출물 현황
- **사용자 관리**: 교사/학생 목록 및 활동 추적
- **활동 모니터링**: 최근 50개 제출/채점 활동
- **데이터 시각화**: Chart.js 기반 통계 그래프

### 3.2 과제 관리 시스템

#### 3.2.1 과제 생성
**필수 입력 항목**:
- 과제 제목 (예: "AI 시대의 윤리적 과제")
- 과제 설명/프롬프트
- 학년 수준 (초등/중등/고등)
- 마감일 (선택)

**제시문 시스템** (NEW):
- 최대 11개 제시문 첨부 (4개 기본 + 7개 추가)
- 텍스트 직접 입력 또는 이미지 업로드
- **이미지 OCR**: Google Cloud Vision API
  - 한글/영어 자동 인식
  - 5-10초 처리 시간
  - 추출 텍스트 자동 삽입
- Cloudflare R2 영구 저장

**루브릭 설정**:
- 10개 플랫폼 루브릭 템플릿:
  - 기본 루브릭 (3개): 표준/상세/간단
  - 뉴욕 주 루브릭 (4개): 리젠트 논증/분석, 중학교, 초등학교
  - IB 중등 프로그램 (3개): 고등 개인사회, 중등 개인사회, 과학
- 맞춤형 루브릭 생성 (기준명, 설명, 점수 범위)
- 기준 동적 추가/삭제

#### 3.2.2 액세스 코드 시스템
- **코드 생성**: 6자리 숫자 자동 생성
- **코드 공유**: 화면 표시, 출력물, 디지털 전송
- **보안**: 과제당 고유 코드, 중복 방지
- **학생 접근**: 코드 입력 → 과제 정보 확인 → 답안 제출

#### 3.2.3 과제 출력 기능
- **출력 항목**: 제목, 설명, 제시문, 루브릭, 액세스 코드
- **인쇄 최적화**: 깔끔한 레이아웃, 페이지 구분
- **미리보기**: 새 창에서 전체 내용 확인

### 3.3 답안 제출 시스템

#### 3.3.1 교사 측 답안 추가
- **텍스트 입력**: 학생 이름 + 논술 내용 직접 입력
- **파일 업로드**:
  - **이미지**: JPG, PNG, WebP (최대 10MB)
  - **PDF**: 텍스트/이미지 기반 (최대 10MB)
  - **OCR 처리**: Google Vision API (이미지, 이미지 PDF)
  - **텍스트 추출**: PDF.js (텍스트 PDF)
  - 처리 시간: 이미지 5-10초, PDF 3-15초

#### 3.3.2 학생 측 직접 제출
- **과제 접근**: 액세스 코드 입력
- **답안 작성**: 웹 인터페이스에서 직접 작성
- **재제출**: 동일 과제 여러 번 제출 가능 (버전 자동 추적)
- **제출 이력**: 나의 제출물 섹션에서 확인

### 3.4 AI 채점 시스템

#### 3.4.1 채점 프로세스
```
답안 제출 → 루브릭 기준 분석 → AI 평가 → 점수 및 피드백 생성 → DB 저장
```

#### 3.4.2 채점 기준
- **점수 척도**: 1-4점 (미흡/발전필요/양호/우수)
- **기준별 평가**: 각 루브릭 기준마다 독립적 채점
- **총점 계산**: 기준별 점수 합산 후 0-10점 환산
- **일관성**: 동일 기준에 대한 일관된 평가

#### 3.4.3 피드백 생성 (핵심 혁신)

**기준별 상세 피드백**:
1. **긍정적 피드백**: 학생이 잘한 부분 구체적 언급
   - 예: "주장이 명확하고 논리적 흐름이 자연스럽습니다."
2. **개선 영역**: 보완이 필요한 부분 명확히 지적
   - 예: "반론에 대한 재반박이 부족합니다."
3. **구체적 제안**: 단계별 개선 방법 제시 (최소 3가지)
   - 예: "1단계: 반론 예상하기, 2단계: 근거 보강하기..."

**학년별 톤 조정**:
- **초등학생**: 친근하고 격려하는 톤 ("잘했어요!", "조금만 더!")
- **중학생**: 중간 수준의 격식 ("좋은 시도입니다", "더 발전할 수 있어요")
- **고등학생**: 학술적이고 심화된 톤 ("논증이 탄탄합니다", "비판적 사고를 더하면")

**전체 요약**:
- 총점 및 퍼센트
- 강점 요약 (3-5개)
- 약점 요약 (3-5개)
- 우선 개선 사항
- 종합 의견
- 다음 단계 조언

### 3.5 채점 검토 및 수정

#### 3.5.1 Split-Screen 검토 모달
- **왼쪽 패널**: 학생 답안 전체 (읽기 전용, 스크롤 가능)
- **오른쪽 패널**: 피드백 편집 (모든 필드 수정 가능)
  - 총점 수정
  - 종합 평가 편집
  - 기준별 점수 및 피드백 수정
  - 종합 의견, 제안, 다음 단계 편집

#### 3.5.2 피드백 출력
- **전용 출력 창**: 채점 결과 별도 창 열기
- **인쇄 최적화**: 학생용 피드백지 형태
- **포함 항목**: 과제 정보, 학생 답안, 점수, 모든 피드백

### 3.6 채점 이력 관리

#### 3.6.1 이력 조회
- **필터링**: 과제별, 학생별, 날짜별
- **정렬**: 점수순, 제출일순, 학생명순
- **검색**: 학생 이름, 과제 제목

#### 3.6.2 재검토 기능
- **클릭 가능한 카드**: 채점 완료 답안 카드 클릭
- **자동 로드**: 제출물 및 피드백 자동 조회
- **모달 재사용**: Split-Screen 검토 모달 동일하게 사용
- **수정 및 저장**: 피드백 수정 후 DB 업데이트

#### 3.6.3 일괄 출력
- **체크박스 선택**: 개별 또는 전체 선택
- **선택 카운터**: 현재 선택 개수 표시
- **출력 옵션**:
  - **PDF (개별)**: 각 답안 별도 창으로 열기
  - **단일 PDF**: 모든 선택 답안 하나의 문서로 통합

### 3.7 학생 성장 추적

#### 3.7.1 제출 추적
- **제출 횟수**: 과제별 제출 회수 자동 카운트
- **버전 관리**: 각 제출의 버전 번호 자동 부여
- **최고 점수**: 여러 제출 중 최고 점수 기록
- **최근 점수**: 가장 최근 제출 점수

#### 3.7.2 개선율 계산
```
개선율 = ((최근 점수 - 이전 점수) / 이전 점수) × 100%
```
- 재제출 시 자동 계산
- 성장 지표로 활용

#### 3.7.3 학습 분석 (향후 구현)
- 과목별/기준별 강점 약점 분석
- 시간 경과에 따른 성장 그래프
- 맞춤형 학습 리소스 추천

---

## 4. 기술 아키텍처

### 4.1 기술 스택

#### 4.1.1 프론트엔드
- **프레임워크**: Vanilla JavaScript (경량화)
- **스타일링**: TailwindCSS (CDN)
- **아이콘**: Font Awesome
- **차트**: Chart.js
- **PDF 처리**: PDF.js (pdfjs-dist)

#### 4.1.2 백엔드
- **프레임워크**: Hono (경량 웹 프레임워크)
- **런타임**: Cloudflare Workers (Edge Computing)
- **빌드 도구**: Vite
- **언어**: TypeScript

#### 4.1.3 데이터베이스
- **메인 DB**: Cloudflare D1 (SQLite)
  - 글로벌 분산 데이터베이스
  - 로컬 개발: `.wrangler/state/v3/d1`
  - 프로덕션: Cloudflare 엣지 네트워크
- **마이그레이션**: 6개 스키마 버전 관리

#### 4.1.4 스토리지
- **파일 저장**: Cloudflare R2 (S3 호환)
  - 이미지 파일 영구 저장
  - PDF 파일 저장
  - 버킷: `webapp-files`

#### 4.1.5 외부 API
- **OCR**: Google Cloud Vision API
  - Text Detection (이미지)
  - Document Text Detection (PDF 이미지)
  - 언어: 한글(ko), 영어(en)
- **이메일**: Resend API
  - 비밀번호 재설정
  - 이메일 인증
  - 알림 발송
- **AI 채점**: OpenAI GPT-4 또는 Claude API (향후 통합)

### 4.2 데이터베이스 스키마

#### 4.2.1 사용자 테이블
```sql
-- 교사 계정
users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK(role IN ('teacher', 'admin')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)

-- 학생 계정
student_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  grade_level TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)

-- 교사 세션
sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
)

-- 학생 세션
student_sessions (
  id TEXT PRIMARY KEY,
  student_user_id TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (student_user_id) REFERENCES student_users(id)
)
```

#### 4.2.2 과제 관리 테이블
```sql
-- 과제
assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  grade_level TEXT,
  due_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
)

-- 루브릭 기준
assignment_rubrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id TEXT NOT NULL,
  criterion_name TEXT NOT NULL,
  criterion_description TEXT,
  max_score INTEGER DEFAULT 4,
  criterion_order INTEGER,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
)

-- 액세스 코드
assignment_access_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id TEXT UNIQUE NOT NULL,
  access_code TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
)
```

#### 4.2.3 제출 및 채점 테이블
```sql
-- 학생 제출물
student_submissions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  essay_text TEXT NOT NULL,
  file_url TEXT,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  graded BOOLEAN DEFAULT 0,
  graded_at DATETIME,
  version INTEGER DEFAULT 1,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
)

-- 제출물 피드백
submission_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT NOT NULL,
  criterion_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  positive_feedback TEXT,
  improvement_areas TEXT,
  specific_suggestions TEXT,
  FOREIGN KEY (submission_id) REFERENCES student_submissions(id)
)

-- 제출물 요약
submission_summary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT UNIQUE NOT NULL,
  total_score REAL NOT NULL,
  total_percentage REAL,
  strengths TEXT,
  weaknesses TEXT,
  overall_comment TEXT,
  improvement_priority TEXT,
  next_steps TEXT,
  FOREIGN KEY (submission_id) REFERENCES student_submissions(id)
)
```

#### 4.2.4 파일 업로드 테이블
```sql
-- 업로드 파일
uploaded_files (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  student_user_id TEXT,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  extracted_text TEXT,
  processing_status TEXT DEFAULT 'pending',
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
)

-- 파일 처리 로그
file_processing_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id TEXT NOT NULL,
  step TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES uploaded_files(id)
)
```

#### 4.2.5 성장 추적 테이블
```sql
-- 학생 진척도
student_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_user_id TEXT NOT NULL,
  assignment_id TEXT NOT NULL,
  submission_count INTEGER DEFAULT 0,
  highest_score REAL,
  latest_score REAL,
  improvement_rate REAL,
  last_submitted_at DATETIME,
  FOREIGN KEY (student_user_id) REFERENCES student_users(id),
  FOREIGN KEY (assignment_id) REFERENCES assignments(id)
)
```

### 4.3 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        클라이언트                            │
│  (브라우저: Chrome, Safari, Edge, Firefox)                  │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                  Cloudflare Pages                            │
│              (Static Asset Hosting)                          │
│    - HTML, CSS, JavaScript                                   │
│    - TailwindCSS, Chart.js, Font Awesome                     │
└───────────────────────┬─────────────────────────────────────┘
                        │ API Calls
                        ↓
┌─────────────────────────────────────────────────────────────┐
│               Cloudflare Workers                             │
│                 (Hono Framework)                             │
│    - 인증 API (/api/auth/*, /api/student/auth/*)           │
│    - 과제 API (/api/assignments/*)                          │
│    - 채점 API (/api/submission/*/grade)                     │
│    - 파일 API (/api/upload/*)                               │
│    - 관리자 API (/api/admin/*)                              │
└──────┬───────────┬──────────────┬────────────┬──────────────┘
       │           │              │            │
       ↓           ↓              ↓            ↓
┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌─────────────┐
│   D1     │ │    R2    │ │ Google Vision│ │   Resend    │
│ Database │ │ Storage  │ │     API      │ │   Email     │
│ (SQLite) │ │ (Files)  │ │    (OCR)     │ │   Service   │
└──────────┘ └──────────┘ └──────────────┘ └─────────────┘
```

### 4.4 API 엔드포인트

#### 4.4.1 인증 API
```
POST   /api/auth/signup          # 교사 회원가입
POST   /api/auth/login           # 교사 로그인
POST   /api/auth/logout          # 교사 로그아웃
DELETE /api/auth/account         # 교사 계정 삭제 (익명화)
POST   /api/student/auth/signup  # 학생 회원가입
POST   /api/student/auth/login   # 학생 로그인
DELETE /api/student/account      # 학생 계정 삭제
```

#### 4.4.2 과제 API
```
GET    /api/assignments                  # 내 과제 목록
POST   /api/assignments                  # 새 과제 생성
GET    /api/assignment/:id               # 과제 상세
DELETE /api/assignment/:id               # 과제 삭제
POST   /api/assignment/:id/submission    # 답안 추가 (교사)
POST   /api/assignment/:id/access-code   # 액세스 코드 생성
```

#### 4.4.3 학생 제출 API
```
GET    /api/student/assignment/:code              # 액세스 코드로 과제 조회
POST   /api/student/submit                        # 답안 제출
GET    /api/student/my-submissions                # 내 제출물 목록
GET    /api/student/submission/:id/feedback       # 피드백 조회
GET    /api/student/progress                      # 성장 기록
```

#### 4.4.4 채점 API
```
GET    /api/submission/:id                # 제출물 상세 조회
GET    /api/submission/:id/feedback       # 피드백 조회 (교사)
POST   /api/submission/:id/grade          # AI 채점
PUT    /api/submission/:id/feedback       # 피드백 수정
GET    /api/grading-history               # 채점 이력
```

#### 4.4.5 파일 API
```
POST   /api/upload/image       # 이미지 업로드 + OCR
POST   /api/upload/pdf         # PDF 업로드 + 텍스트 추출
GET    /api/upload/:id         # 파일 정보 조회
DELETE /api/upload/:id         # 파일 삭제
```

#### 4.4.6 관리자 API
```
GET    /api/admin/stats             # 시스템 통계
GET    /api/admin/recent-activity   # 최근 활동
GET    /api/admin/users             # 사용자 목록
```

---

## 5. 비기능적 요구사항

### 5.1 성능
- **응답 시간**: API 응답 < 200ms (채점 제외)
- **채점 시간**: 논술 1편당 10-30초
- **동시 사용자**: 1,000명 이상 지원
- **파일 처리**: 이미지 OCR 5-10초, PDF 3-15초

### 5.2 보안
- **인증**: 세션 기반 인증, 7일 만료
- **비밀번호**: bcrypt 해싱 (10 rounds)
- **HTTPS**: 모든 통신 암호화
- **SQL Injection**: Prepared Statement 사용
- **XSS 방어**: 입력 검증 및 이스케이핑
- **데이터 익명화**: 계정 삭제 시 개인정보만 제거

### 5.3 확장성
- **Edge Computing**: Cloudflare Workers (전 세계 310+ 도시)
- **글로벌 DB**: D1 데이터베이스 자동 복제
- **CDN**: 정적 자산 글로벌 캐싱
- **수평 확장**: Workers 자동 스케일링

### 5.4 가용성
- **SLA**: 99.9% 가동률 목표
- **장애 복구**: Cloudflare 자동 페일오버
- **백업**: D1 자동 백업 (매일)

### 5.5 사용성
- **반응형 디자인**: 모바일/태블릿/데스크톱
- **브라우저 지원**: Chrome, Safari, Firefox, Edge 최신 버전
- **접근성**: WCAG 2.1 AA 수준 준수 (목표)
- **다국어**: 한글 우선, 영어 지원 (확장 가능)

---

## 6. 사용자 플로우

### 6.1 교사 워크플로우

```
1. 회원가입/로그인
   ↓
2. 나의 페이지 (대시보드)
   ↓
3. 새 과제 만들기
   - 제목, 설명 입력
   - 제시문 추가 (텍스트 또는 이미지)
   - 루브릭 기준 설정 (템플릿 또는 맞춤)
   ↓
4. 액세스 코드 생성
   ↓
5. 학생들에게 코드 공유
   ↓
6. 학생 답안 수집
   - 학생 직접 제출 또는
   - 교사가 직접 입력 또는
   - 파일 업로드 (이미지/PDF)
   ↓
7. AI 자동 채점 실행
   ↓
8. 채점 결과 검토 (Split-Screen)
   - 학생 답안 확인 (좌측)
   - 피드백 편집 (우측)
   ↓
9. 피드백 저장 및 출력
   ↓
10. 채점 이력 관리
    - 재검토 및 수정
    - 일괄 출력 (개별/통합 PDF)
```

### 6.2 학생 워크플로우

```
1. 회원가입/로그인
   ↓
2. 학생 대시보드
   ↓
3. 액세스 코드 입력
   ↓
4. 과제 정보 확인
   - 제목, 설명
   - 제시문
   - 루브릭 기준
   ↓
5. 답안 작성 및 제출
   ↓
6. 나의 제출물 확인
   - 제출 상태 (대기중/완료)
   ↓
7. 상세 피드백 확인
   - 전체 요약 (점수, 강점, 약점)
   - 기준별 피드백 (긍정/개선/제안)
   ↓
8. 피드백 반영하여 재제출 (선택)
   ↓
9. 성장 추적 확인
   - 개선율
   - 제출 이력
```

### 6.3 관리자 워크플로우

```
1. 관리자 로그인
   ↓
2. 관리자 대시보드
   ↓
3. 시스템 통계 모니터링
   - 교사/학생/과제/제출물 수
   - 채점 완료/대기 현황
   - 평균 점수
   ↓
4. 사용자 관리
   - 교사 목록 및 활동
   - 학생 목록 및 제출 현황
   ↓
5. 활동 모니터링
   - 최근 제출 내역
   - 최근 채점 내역
   ↓
6. 데이터 분석
   - Chart.js 기반 시각화
   - 점수 분포
   - 제출 현황
```

---

## 7. 로드맵

### Phase 1: MVP (완료) ✅
- ✅ 교사/학생 인증 시스템
- ✅ 과제 생성 및 관리
- ✅ 액세스 코드 시스템
- ✅ 학생 직접 제출
- ✅ AI 자동 채점 (시뮬레이션)
- ✅ 상세 피드백 시스템
- ✅ 파일 업로드 (이미지/PDF OCR)
- ✅ 채점 검토 및 수정
- ✅ 일괄 출력 기능
- ✅ 관리자 대시보드

### Phase 2: 프로덕션 준비 (진행 중) 🚧
- ⏳ OpenAI GPT-4/Claude API 통합
- ⏳ 실시간 채점 진행률 표시
- ⏳ 학생 성장 그래프 UI
- ⏳ 학습 리소스 추천 시스템
- ⏳ 교사 통계 대시보드
- ⏳ 이메일 알림 시스템 완성
- ⏳ 결제 시스템 통합

### Phase 3: 고도화 (2026 Q2)
- 팀 협업 기능 (교사 그룹)
- 논술 비교 및 표절 검사
- CSV 내보내기
- LMS 통합 (Google Classroom, Canvas)
- Word 문서 처리 (.docx)
- 모바일 앱 (iOS/Android)

### Phase 4: AI 강화 (2026 Q3)
- 맞춤형 AI 모델 파인튜닝
- 실시간 작문 도우미 (학생용)
- 자동 루브릭 생성
- AI 학습 컨설팅
- 음성 피드백 (TTS)

---

## 8. 성공 지표 (KPI)

### 8.1 사용자 지표
- **가입자 수**: 월 100명 증가 (교사 기준)
- **활성 사용자 수**: 주간 활성 사용자 (WAU) 500명
- **리텐션율**: 30일 리텐션 60% 이상
- **NPS**: Net Promoter Score 50+ 목표

### 8.2 사용량 지표
- **과제 생성**: 월 1,000개 이상
- **답안 제출**: 월 10,000개 이상
- **채점 완료**: 월 8,000개 이상
- **파일 업로드**: 월 2,000개 이상

### 8.3 품질 지표
- **채점 일치도**: 인간 채점자와 QWK 0.65 이상
- **사용자 만족도**: 피드백 품질 평점 4.5/5.0 이상
- **시간 절감**: 평균 채점 시간 90% 단축
- **에러율**: API 에러율 0.1% 미만

### 8.4 비즈니스 지표
- **전환율**: 무료 → 유료 전환율 10% (Phase 2 이후)
- **MRR**: 월 반복 수익 성장률 20%
- **CAC**: 고객 획득 비용 < $50
- **LTV**: 고객 생애 가치 > $500

---

## 9. 리스크 및 대응

### 9.1 기술 리스크
| 리스크 | 영향도 | 확률 | 대응 방안 |
|--------|--------|------|-----------|
| AI API 비용 급증 | 높음 | 중 | 캐싱, 배치 처리, 비용 상한 설정 |
| OCR 정확도 부족 | 중 | 중 | 다중 OCR 엔진 병행, 수동 보정 기능 |
| DB 성능 저하 | 중 | 낮음 | 인덱스 최적화, 쿼리 캐싱 |
| Cloudflare 장애 | 높음 | 낮음 | 자동 페일오버, 백업 플랜 |

### 9.2 비즈니스 리스크
| 리스크 | 영향도 | 확률 | 대응 방안 |
|--------|--------|------|-----------|
| 경쟁사 진입 | 높음 | 중 | 한글 특화, 빠른 혁신, 커뮤니티 |
| 사용자 확보 실패 | 높음 | 중 | 무료 체험, 교사 커뮤니티, 추천 |
| 법적 이슈 (저작권) | 중 | 낮음 | 이용약관 명시, 법률 자문 |
| 데이터 유출 | 높음 | 낮음 | 암호화, 접근 통제, 정기 감사 |

### 9.3 교육적 리스크
| 리스크 | 영향도 | 확률 | 대응 방안 |
|--------|--------|------|-----------|
| AI 의존도 증가 | 중 | 높음 | 교사 검토 필수화, 교육 가이드 |
| 부정확한 피드백 | 높음 | 중 | 인간 검토 기능, 피드백 신고 |
| 학생 데이터 윤리 | 높음 | 낮음 | 익명화, 부모 동의, 투명성 |

---

## 10. 예산 및 자원

### 10.1 개발 비용 (Phase 1 완료 기준)
- 개발 인력: 1명 × 3개월
- 외주 비용: $0 (자체 개발)
- API 비용: 
  - Google Vision API: ~$50/월 (개발)
  - Resend Email: $0 (무료 플랜)
  - Cloudflare: $5/월 (D1 + R2)

### 10.2 운영 비용 (Phase 2 예상)
- **인프라** (월):
  - Cloudflare Workers: $5 (유료 플랜)
  - Cloudflare D1: ~$20 (100GB 스토리지)
  - Cloudflare R2: ~$15 (스토리지 + 요청)
  - Google Vision API: ~$200 (OCR 사용량)
  - OpenAI API: ~$500 (GPT-4 채점)
  - Resend Email: ~$20 (이메일 발송)
  - **총 인프라 비용**: ~$760/월

- **마케팅** (월):
  - SEO/블로그: $0 (자체)
  - 광고 (Google Ads): $500
  - 커뮤니티 운영: $0 (자체)
  - **총 마케팅 비용**: ~$500/월

- **인력** (월):
  - 개발자 1명: 협상
  - 운영/지원 1명: 협상
  - 마케터 1명 (파트타임): 협상

### 10.3 손익분기점 분석 (Phase 2 유료화 기준)
- 월 운영 비용: ~$1,260
- 평균 구독료: $29.99/월 (예상)
- 손익분기점: 42명 유료 사용자
- 예상 달성 시기: 유료화 후 3-6개월

---

## 11. 부록

### 11.1 용어 정리
- **AES (Automated Essay Scoring)**: 자동 논술 채점
- **AWE (Automated Writing Evaluation)**: 자동 작문 평가
- **QWK (Quadratic Weighted Kappa)**: 채점자 간 일치도 지표
- **루브릭 (Rubric)**: 채점 기준표
- **OCR (Optical Character Recognition)**: 광학 문자 인식
- **LLM (Large Language Model)**: 대규모 언어 모델

### 11.2 참고 문헌
- EssayGrader.ai: https://www.essaygrader.ai/
- Cloudflare Workers Docs: https://developers.cloudflare.com/workers/
- Google Cloud Vision API: https://cloud.google.com/vision
- Hono Framework: https://hono.dev/

### 11.3 변경 이력
| 버전 | 날짜 | 변경 사항 | 작성자 |
|------|------|-----------|--------|
| 1.0 | 2026-02-01 | 초안 작성 | AI 논술 평가 팀 |

---

**문서 끝**
