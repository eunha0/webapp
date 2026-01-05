-- 테스트 교사 계정 (이메일: test@example.com, 비밀번호: test123)
-- password_hash for 'test123': $2b$10$vOy8L.V5fQqJL5Y8mP9qW0qKZJ7hU.xGfJQfqH8YXzZ5Y8mP9qW0q
INSERT INTO users (email, password_hash, name, created_at) VALUES 
('test@example.com', '$2b$10$vOy8L.V5fQqJL5Y8mP9qW0qKZJ7hU.xGfJQfqH8YXzZ5Y8mP9qW0q', '테스트 교사', datetime('now'));

-- 학생 계정 (이메일: dygha@gmail.com, 비밀번호: 1234)
-- password_hash for '1234': $2b$10$K8vN.mOYd5YxW8qKZJ7hU.xGfJQfqH8YXzZ5Y8mP9qW0qKZJ7hU.x
INSERT INTO student_users (name, email, password_hash, created_at) VALUES 
('가도운 학생', 'dygha@gmail.com', '$2b$10$K8vN.mOYd5YxW8qKZJ7hU.xGfJQfqH8YXzZ5Y8mP9qW0qKZJ7hU.x', datetime('now'));

-- 테스트 과제
INSERT INTO assignments (user_id, title, description, grade_level, due_date, created_at) VALUES 
(1, '프랑스 혁명의 원인과 국내외적 영향', '프랑스 혁명을 일으킨 정치·경제·사회적 요인을 분석하고, 프랑스 국민에게 미친 영향과 하나의 국외적 영향을 서술하시오.', '고등학교 3학년', '2026-01-15', datetime('now'));

-- 액세스 코드
INSERT INTO assignment_access_codes (assignment_id, access_code, created_at) VALUES 
(1, '926383', datetime('now'));

-- 평가 기준
INSERT INTO assignment_rubrics (assignment_id, criterion_name, criterion_description, max_score, criterion_order) VALUES 
(1, '내용 및 분석', '프랑스 혁명의 원인과 영향에 대한 깊이 있는 분석', 4, 1),
(1, '증거 활용 능력', '제시문의 정보를 효과적으로 활용', 4, 2),
(1, '일관성, 구성 및 스타일', '논리적 흐름과 명확한 구조', 4, 3),
(1, '규칙 숙달도', '맞춤법과 문법의 정확성', 4, 4);
