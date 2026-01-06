-- Clean seed data with access code 537225
-- Simple version - only essential data

-- 1. Create teacher user (email: teacher@test.com, password will be set via signup)
INSERT INTO users (email, password_hash, name) 
VALUES ('teacher@test.com', '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOP', '김선생 교사');

-- 2. Create student user (email: student@test.com, password will be set via signup)
INSERT INTO student_users (email, password_hash, name, grade_level)
VALUES ('student@test.com', '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOP', '박학생', '고등학교 3학년');

-- 3. Create assignment
INSERT INTO assignments (
  user_id, 
  title, 
  description,
  prompts,
  grade_level
) VALUES (
  1,
  '프랑스 대혁명의 원인과 영향',
  '프랑스 대혁명의 주요 원인과 그것이 유럽과 세계에 미친 영향에 대해 논술하시오.',
  '["프랑스 혁명은 1789년 바스티유 감옥 습격으로 시작되었습니다.", "혁명의 주요 원인은 재정 위기, 사회적 불평등, 계몽사상의 확산이었습니다.", "혁명은 프랑스뿐만 아니라 유럽 전역에 큰 영향을 미쳤습니다."]',
  '고등학교 3학년'
);

-- 4. Create access code 537225
INSERT INTO assignment_access_codes (assignment_id, access_code)
VALUES (1, '537225');

-- 5. Create rubric criteria
INSERT INTO assignment_rubrics (assignment_id, criterion_name, criterion_description, max_score, criterion_order)
VALUES 
  (1, '내용의 정확성', '역사적 사실과 개념을 정확하게 이해하고 설명했는가', 4, 1),
  (1, '논리적 구성', '주장과 근거가 논리적으로 연결되어 있는가', 4, 2),
  (1, '분석의 깊이', '표면적 서술을 넘어 심층적인 분석을 제시했는가', 4, 3),
  (1, '표현력', '문장이 명확하고 어휘 사용이 적절한가', 4, 4);

