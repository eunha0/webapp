-- Test Data for AI Essay Grading System
-- This seed file creates test accounts and a sample assignment with access code

-- Insert test teacher account
-- Password: password123 (base64 hash)
INSERT OR REPLACE INTO users (id, email, password_hash, name, created_at) VALUES 
(1, 'teacher@test.com', 'cGFzc3dvcmQxMjM=', '테스트 교사', datetime('now'));

-- Insert test student account
-- Password: password123 (base64 hash)
INSERT OR REPLACE INTO student_users (id, email, password_hash, name, grade_level, created_at) VALUES
(1, 'student@test.com', 'cGFzc3dvcmQxMjM=', '테스트 학생', '고등학교 1학년', datetime('now'));

-- Insert sample assignment WITH access code
INSERT OR IGNORE INTO assignments (id, user_id, title, description, grade_level, due_date, prompts, access_code, created_at) VALUES
(1, 1, '테스트 과제 - 환경 보호', '환경 보호의 중요성에 대해 논술하세요.', '고등학교', datetime('now', '+7 days'), 
'[{"type":"text","content":"환경 보호가 왜 중요한지 설명하고, 실천 방안을 제시하세요."}]', 
'123456', datetime('now'));

-- Insert rubric criteria for the assignment
INSERT OR IGNORE INTO assignment_rubrics (assignment_id, criterion_name, criterion_description, criterion_order) VALUES
(1, '논리성', '주장과 근거가 논리적으로 연결되어 있는가', 1),
(1, '창의성', '독창적인 관점과 아이디어를 제시했는가', 2),
(1, '표현력', '문장 구성과 어휘 사용이 적절한가', 3);

-- Verify data
SELECT '=== Test Users ===' as info;
SELECT id, email, name FROM users WHERE email = 'teacher@test.com';
SELECT id, email, name, grade_level FROM student_users WHERE email = 'student@test.com';

SELECT '=== Test Assignment ===' as info;
SELECT id, title, access_code, grade_level FROM assignments WHERE id = 1;

SELECT '=== Assignment Rubrics ===' as info;
SELECT assignment_id, criterion_name, criterion_order FROM assignment_rubrics WHERE assignment_id = 1;

-- Insert resource posts (루브릭 and 논술 평가 자료)
INSERT OR IGNORE INTO resource_posts (id, category, title, content, author) VALUES 
(1, 'rubric', '논술 평가를 위한 4점 루브릭 가이드', '논술 평가에서 가장 많이 사용되는 4점 척도 루브릭에 대해 알아보겠습니다.

1. 우수 (4점)
- 논제를 명확하게 이해하고 깊이 있게 분석했습니다.
- 논거가 논리적이고 설득력이 있습니다.
- 구체적이고 적절한 사례를 효과적으로 활용했습니다.
- 문법, 어휘, 문장 구조가 정확하고 적절합니다.

2. 양호 (3점)
- 논제를 대체로 이해하고 분석했습니다.
- 논거가 논리적이나 일부 보완이 필요합니다.
- 사례를 사용했으나 더 구체적일 필요가 있습니다.
- 문법과 어휘에 소소한 오류가 있으나 의사소통에는 지장이 없습니다.

3. 보통 (2점)
- 논제에 대한 이해가 표면적입니다.
- 논거가 약하거나 논리적 연결이 부족합니다.
- 사례 활용이 부족하거나 적절하지 않습니다.
- 문법과 어휘 오류가 있어 의사소통에 다소 지장이 있습니다.

4. 미흡 (1점)
- 논제를 잘못 이해했거나 분석이 없습니다.
- 논거가 없거나 논리적이지 않습니다.
- 사례를 사용하지 않았습니다.
- 심각한 문법과 어휘 오류가 있어 의사소통이 어렵습니다.', 'AI 논술 평가 관리자'),

(2, 'rubric', '중학교 논술 평가 기준', '중학교 학생들의 논술을 평가할 때 고려해야 할 핵심 기준들을 소개합니다.

**1. 내용의 타당성 (30%)**
- 주제에 대한 이해도
- 논거의 적절성
- 창의적 사고

**2. 구성의 체계성 (30%)**
- 서론-본론-결론의 구조
- 문단 간 논리적 흐름
- 단락 구성의 명확성

**3. 표현의 정확성 (20%)**
- 맞춤법과 문법
- 어휘 선택의 적절성
- 문장 구성력

**4. 독창성 (20%)**
- 독특한 관점
- 창의적 접근
- 비판적 사고', 'AI 논술 평가 관리자'),

(3, 'rubric', '고등학교 대학 수시 논술 루브릭', '대학 수시 논술 평가에 활용할 수 있는 상세 루브릭입니다.

**평가 영역 및 배점**

1. 논제 파악 및 이해 (25점)
- 제시문의 핵심 내용 파악
- 논제의 정확한 이해
- 요구사항 충족 여부

2. 논증의 타당성 (30점)
- 논리적 근거 제시
- 주장과 근거의 연결성
- 반론 예상 및 대응

3. 창의성 및 독창성 (20점)
- 참신한 관점 제시
- 비판적 사고력
- 통합적 사고

4. 구성 및 표현 (25점)
- 글의 구조와 체계
- 표현의 정확성
- 어휘 선택 및 문체

**각 영역별 세부 평가 기준**
- 5단계 평가: 매우 우수(90-100%), 우수(80-89%), 보통(70-79%), 미흡(60-69%), 매우 미흡(60% 미만)', 'AI 논술 평가 관리자'),

(4, 'evaluation', '효과적인 논술 피드백 작성 방법', '학생들에게 도움이 되는 논술 피드백을 작성하는 방법을 알아봅시다.

**1. 긍정적 피드백부터 시작하기**
학생이 잘한 부분을 먼저 언급하여 자신감을 심어주세요.
- 예: "논제에 대한 이해가 명확하고, 서론에서 문제의식을 잘 제시했습니다."

**2. 구체적인 개선점 제시**
막연한 지적보다는 구체적인 개선 방향을 제시하세요.
- 나쁜 예: "논거가 약합니다."
- 좋은 예: "2번 문단의 주장을 뒷받침할 구체적인 통계나 사례를 추가하면 더 설득력이 있을 것입니다."

**3. 실행 가능한 조언**
학생이 바로 적용할 수 있는 실천적 조언을 제공하세요.
- "다음 논술에서는 반대 의견도 고려하여 반박하는 문단을 추가해보세요."

**4. 격려와 기대**
마지막에는 격려와 함께 향상에 대한 기대를 표현하세요.
- "이번 논술에서 보여준 노력이 인상적입니다. 다음에는 더 발전된 모습을 기대합니다."', 'AI 논술 평가 관리자'),

(5, 'evaluation', '논술 평가 시 흔한 실수와 해결책', '교사들이 논술을 평가할 때 자주 하는 실수와 그 해결책을 공유합니다.

**실수 1: 너무 엄격하거나 관대한 평가**
해결책: 루브릭을 일관되게 적용하고, 여러 논술을 함께 비교하며 평가하세요.

**실수 2: 내용만 평가하고 형식 무시**
해결책: 내용, 구성, 표현을 균형있게 평가하세요. 각 영역의 배점을 명확히 정하세요.

**실수 3: 피드백이 너무 짧거나 모호함**
해결책: 각 평가 기준별로 구체적인 피드백을 작성하세요. 최소 3-4줄 이상 작성을 권장합니다.

**실수 4: 학생의 수준을 고려하지 않음**
해결책: 학년과 수준에 맞는 기대치를 설정하고 평가하세요.

**실수 5: 일관성 없는 평가**
해결책: 한 번에 여러 논술을 평가할 때는 같은 기준을 일관되게 적용하세요. 평가 전에 루브릭을 다시 확인하세요.', 'AI 논술 평가 관리자'),

(6, 'evaluation', '학년별 논술 평가 포인트', '학년별로 중점적으로 평가해야 할 항목들을 정리했습니다.

**초등학교 (5-6학년)**
- 주제에 맞는 내용 작성 여부
- 기본적인 문단 구성
- 맞춤법과 띄어쓰기
- 자신의 생각 표현

**중학교 (1-3학년)**
- 논제 이해 능력
- 논리적 근거 제시
- 서론-본론-결론 구조
- 문장 간 연결성
- 어휘력

**고등학교 (1-3학년)**
- 비판적 사고력
- 다각적 분석
- 반론 제기 및 재반박
- 제시문 활용 능력
- 논증의 깊이
- 표현의 정교함

각 학년별로 이 포인트들을 중심으로 평가하되, 학생의 성장 가능성도 함께 고려하세요.', 'AI 논술 평가 관리자');

SELECT '=== Resource Posts ===' as info;
SELECT id, category, title FROM resource_posts ORDER BY category, id;
