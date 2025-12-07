# 하이브리드 AI 채점 시스템 (Hybrid AI Grading System)

## 📋 개요

학생 논술을 채점할 때 **두 가지 AI 모델을 결합한 하이브리드 방식**을 사용합니다:

1. **GPT-4o (OpenAI)**: 루브릭 기반 점수 산출 (Phase 1: Scoring)
2. **Claude 3.5 Sonnet (Anthropic)**: 피드백 및 코멘트 생성 (Phase 2: Feedback Generation)

이 접근 방식은 각 AI 모델의 강점을 최대한 활용합니다.

---

## 🎯 설계 철학

### GPT-4o의 강점 (점수 산출)
- **정확성**: 루브릭 기준에 따른 일관된 점수 부여
- **객관성**: 감정이 배제된 평가 기준 적용
- **구조화**: JSON 형식의 정확한 점수 출력
- **신뢰성**: 대량의 평가 데이터로 학습된 채점 능력

### Claude 3.5 Sonnet의 강점 (피드백 생성)
- **섬세함**: 학생 개개인에 맞는 맞춤형 피드백
- **격려**: 긍정적이고 성장 지향적인 톤
- **구체성**: 에세이에서 구체적인 예시를 인용
- **실행 가능성**: 명확하고 실천 가능한 개선 제안

---

## 🔄 작동 방식 (Two-Phase Process)

### Phase 1: GPT-4o 점수 산출 (Scoring)

**입력**:
- 과제 주제 (Assignment Prompt)
- 학년 수준 (Grade Level)
- 루브릭 기준 (Rubric Criteria)
- 학생 에세이 (Essay Text)

**처리**:
```typescript
const scoringResponse = await openai.chat.completions.create({
  model: 'gpt-4o',
  temperature: 0.3, // 낮은 온도 = 일관성
  response_format: { type: 'json_object' }
});
```

**출력**:
```json
{
  "total_score": 7.5,
  "criterion_scores": [
    {
      "criterion_name": "내용 이해 및 분석",
      "score": 3,
      "brief_rationale": "주제에 대한 기본 이해는 있으나 깊이가 부족함"
    },
    ...
  ]
}
```

### Phase 2: Claude 3.5 Sonnet 피드백 생성 (Feedback)

**입력**:
- Phase 1의 점수 결과
- 원본 에세이 및 과제 정보

**처리**:
```typescript
const feedbackResponse = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.7, // 높은 온도 = 창의성
  max_tokens: 4096
});
```

**출력**:
```json
{
  "summary_evaluation": "이 에세이는 주제에 대한 기본적인 이해를 보여주며...",
  "criterion_feedback": [
    {
      "criterion_name": "내용 이해 및 분석",
      "strengths": "서론에서 '...'라고 언급하며 명확한 입장을 제시했습니다.",
      "areas_for_improvement": "본론에서 구체적인 예시를 추가하면 더욱 설득력 있을 것입니다."
    }
  ],
  "overall_comment": "전반적으로 주제를 잘 이해하고 있습니다...",
  "revision_suggestions": "1. **인용 강화**: '...' 부분에서...",
  "next_steps_advice": "1. 증거 통합 연습\n2. 논제 중심 글쓰기..."
}
```

### 최종 통합

두 AI의 결과를 병합하여 완전한 채점 결과를 생성합니다:

```typescript
const criterion_scores = scoringResult.criterion_scores.map((score) => {
  const feedback = feedbackResult.criterion_feedback.find(
    (f) => f.criterion_name === score.criterion_name
  );
  
  return {
    criterion_name: score.criterion_name,
    score: score.score,  // ← GPT-4o
    strengths: feedback.strengths,  // ← Claude
    areas_for_improvement: feedback.areas_for_improvement  // ← Claude
  };
});
```

---

## 🛠️ 구현 세부사항

### 파일 구조

```
src/
├── hybrid-grading-service.ts   # 새로운 하이브리드 AI 서비스
├── grading-service.ts          # 기존 시뮬레이션 서비스 (fallback)
├── index.tsx                   # 메인 API 라우터
└── types.ts                    # TypeScript 타입 정의
```

### 환경 변수 설정

#### 로컬 개발 (`.dev.vars`)

```bash
# OpenAI API Configuration (for GPT-4o scoring)
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1

# Anthropic API Configuration (for Claude 3.5 Sonnet feedback)
ANTHROPIC_API_KEY=your-anthropic-api-key-here
```

#### 프로덕션 (Cloudflare Wrangler Secrets)

```bash
# OpenAI API Key 설정
npx wrangler pages secret put OPENAI_API_KEY --project-name webapp
# 입력: your-openai-api-key

npx wrangler pages secret put OPENAI_BASE_URL --project-name webapp
# 입력: https://api.openai.com/v1

# Anthropic API Key 설정
npx wrangler pages secret put ANTHROPIC_API_KEY --project-name webapp
# 입력: your-anthropic-api-key
```

### 설치된 패키지

```json
{
  "dependencies": {
    "openai": "^4.x.x",
    "@anthropic-ai/sdk": "^0.x.x"
  }
}
```

---

## 🔀 Fallback 메커니즘

API 키가 설정되지 않았거나 API 호출이 실패하면 **자동으로 시뮬레이션 모드로 전환**됩니다:

```typescript
export async function gradeEssayHybrid(request, env) {
  try {
    // Check if AI API keys are configured
    if (!env.OPENAI_API_KEY || !env.ANTHROPIC_API_KEY) {
      console.log('AI API keys not configured, falling back to simulation mode');
      return simulateGrading(request);
    }

    // Try hybrid AI grading...
  } catch (error) {
    console.error('Hybrid AI error:', error);
    console.log('Falling back to simulation mode');
    return simulateGrading(request);
  }
}
```

**장점**:
- API 키 없이도 시스템 테스트 가능
- API 오류 발생 시에도 서비스 중단 없음
- 개발 및 디버깅 용이

---

## 📊 비교표

| 특징 | GPT-4o (Scoring) | Claude 3.5 Sonnet (Feedback) | 시뮬레이션 모드 |
|------|------------------|------------------------------|----------------|
| **주요 역할** | 점수 산출 | 피드백 생성 | 대체 기능 (fallback) |
| **Temperature** | 0.3 (일관성) | 0.7 (창의성) | N/A |
| **출력 형식** | JSON (구조화) | JSON (서술형) | JSON (기본 템플릿) |
| **강점** | 정확한 채점 | 섬세한 피드백 | 안정성 |
| **비용** | OpenAI 과금 | Anthropic 과금 | 무료 |
| **API 키 필요** | ✅ | ✅ | ❌ |

---

## 🧪 테스트 방법

### 1. 시뮬레이션 모드 테스트 (API 키 없음)

```bash
# .dev.vars에서 API 키를 주석 처리하거나 제거
# OPENAI_API_KEY=...
# ANTHROPIC_API_KEY=...

# 서비스 재시작
pm2 restart webapp

# 채점 API 호출 - 시뮬레이션 모드로 동작
curl -X POST http://localhost:3000/api/grade \
  -H "Content-Type: application/json" \
  -d '{...}'
```

콘솔 로그:
```
[Simulation] Using fallback grading logic
```

### 2. 하이브리드 AI 모드 테스트 (API 키 있음)

```bash
# .dev.vars에 실제 API 키 설정
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# 서비스 재시작
pm2 restart webapp

# 채점 API 호출 - 하이브리드 모드로 동작
curl -X POST http://localhost:3000/api/grade \
  -H "Content-Type: application/json" \
  -d '{...}'
```

콘솔 로그:
```
[Hybrid AI] Phase 1: GPT-4o scoring...
[Hybrid AI] Phase 1 complete. Total score: 7.5
[Hybrid AI] Phase 2: Claude 3.5 Sonnet feedback generation...
[Hybrid AI] Phase 2 complete
[Hybrid AI] Grading complete successfully
```

### 3. PM2 로그 확인

```bash
# 실시간 로그 확인 (blocking)
pm2 logs webapp

# 최근 로그만 확인 (non-blocking)
pm2 logs webapp --nostream --lines 50

# 하이브리드 AI 관련 로그만 필터링
pm2 logs webapp --nostream | grep "Hybrid AI"
```

---

## 💡 사용 시나리오

### 시나리오 1: 개발 및 테스트 단계
- **상황**: API 비용 절감, 빠른 프로토타입
- **설정**: API 키 없이 실행
- **결과**: 시뮬레이션 모드로 기본 채점 기능 제공

### 시나리오 2: 프로덕션 환경
- **상황**: 실제 학생 논술 채점
- **설정**: OpenAI + Anthropic API 키 설정
- **결과**: GPT-4o가 점수 산출, Claude가 상세 피드백 생성

### 시나리오 3: 부분 설정
- **상황**: OpenAI 키만 있고 Anthropic 키 없음
- **설정**: OPENAI_API_KEY만 설정
- **결과**: 자동으로 시뮬레이션 모드로 전환 (양쪽 키 모두 필요)

---

## 🚀 배포 정보

### 서비스 상태
- **URL**: https://3000-iigjpsbl85aj2ml3n1x69-cbeee0f9.sandbox.novita.ai
- **상태**: ✅ 온라인 (하이브리드 AI 시스템 적용)

### GitHub
- **Repository**: https://github.com/eunha0/webapp
- **Branch**: main

### 주요 파일
- `src/hybrid-grading-service.ts` - 하이브리드 AI 로직 (새로 생성)
- `src/index.tsx` - gradeEssayHybrid() 사용
- `src/types.ts` - AI API 환경 변수 타입 추가
- `.dev.vars` - 로컬 개발용 API 키 (Git 제외)

---

## 📝 API 응답 예시

### 하이브리드 AI 모드 응답

```json
{
  "success": true,
  "session_id": 123,
  "essay_id": 456,
  "result_id": 789,
  "grading_result": {
    "total_score": 7.5,
    "summary_evaluation": "이 에세이는 주제에 대한 적절한 이해를 보여주며, 약 320단어로 구성되어 있습니다...",
    "criterion_scores": [
      {
        "criterion_name": "내용 이해 및 분석",
        "score": 3,
        "strengths": "서론에서 '제2차 세계대전의 주요 원인은...'이라고 명확하게 입장을 밝혔습니다. 이는 독자에게 명확한 방향성을 제시합니다.",
        "areas_for_improvement": "본론에서 베르사유 조약의 구체적인 조항(예: 제231조 전쟁 죄책 조항)을 언급하면 더욱 설득력 있을 것입니다."
      },
      ...
    ],
    "overall_comment": "전반적으로 과제 주제를 잘 이해하고 있으며...",
    "revision_suggestions": "1. **인용 강화**: '...' 부분에서 다큐멘터리의 구체적인 장면을 인용하세요.\n2. **역사적 구체성**: 일반적인 표현 대신 구체적인 날짜와 사건을 추가하세요.\n3. **분석 깊이**: 사건 간의 인과 관계를 더 명확하게 설명하세요.",
    "next_steps_advice": "1. 증거 통합 연습: 인용문을 자연스럽게 삽입하는 방법 학습\n2. 논제 중심 글쓰기: 모든 문단이 주장과 연결되도록\n3. 어휘력 향상: 역사 관련 전문 용어 학습\n4. 동료 평가: 루브릭을 활용한 상호 피드백\n5. 수정 전략: 한 번에 하나의 기준에 집중"
  }
}
```

---

## 🔐 보안 고려사항

### API 키 관리
1. **로컬 개발**: `.dev.vars` 파일 사용 (`.gitignore`에 포함)
2. **프로덕션**: Cloudflare Wrangler Secrets 사용
3. **절대 금지**: API 키를 코드나 Git에 직접 입력

### 비용 관리
1. **개발 단계**: 시뮬레이션 모드 사용 (무료)
2. **테스트 단계**: 소량의 API 호출로 검증
3. **프로덕션**: 사용량 모니터링 및 예산 설정

---

## 📈 성능 및 비용

### 처리 시간
- **Phase 1 (GPT-4o)**: 약 2-5초
- **Phase 2 (Claude 3.5 Sonnet)**: 약 3-7초
- **총 처리 시간**: 약 5-12초 (순차 처리)

### API 비용 (예상)
- **OpenAI GPT-4o**: $0.01 - $0.03 per request
- **Anthropic Claude 3.5 Sonnet**: $0.01 - $0.05 per request
- **총 비용**: 약 $0.02 - $0.08 per essay

### 최적화 방안
- Temperature 조정으로 토큰 사용량 최적화
- 프롬프트 길이 최소화
- 병렬 처리 고려 (현재는 순차)

---

## 🔄 향후 개선 방향

### 1. 병렬 처리
현재는 순차적이지만, 일부 작업을 병렬로 처리하면 속도 향상 가능:
```typescript
// 현재: Phase 1 → Phase 2 (순차)
// 개선: Phase 1과 기본 피드백 템플릿을 동시 처리
```

### 2. 캐싱
동일한 과제/루브릭에 대한 반복 요청 시 캐싱:
```typescript
// 루브릭 분석 결과를 캐싱하여 재사용
```

### 3. A/B 테스트
다양한 AI 조합 테스트:
- GPT-4o + GPT-4o (동일 모델)
- Claude + Claude (동일 모델)
- GPT-4o + Claude (현재 방식)

### 4. 사용자 피드백 수집
채점 결과에 대한 교사 피드백을 수집하여 프롬프트 개선

---

## ✅ 결론

**하이브리드 AI 채점 시스템**은 다음과 같은 장점을 제공합니다:

1. **정확성**: GPT-4o의 일관된 점수 산출
2. **섬세함**: Claude의 맞춤형 피드백
3. **유연성**: API 키 없이도 동작하는 fallback
4. **확장성**: 각 단계를 독립적으로 개선 가능

이 시스템은 학생들에게 **정확한 점수**와 **건설적인 피드백**을 동시에 제공하여, 학습 성장을 효과적으로 지원합니다. 🎓

---

**문서 작성일**: 2025-12-06  
**최신 업데이트**: 하이브리드 AI 시스템 구현 완료
