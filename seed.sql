-- Test Data for AI Essay Grading System
-- This seed file creates test accounts and a sample assignment with access code

-- Insert test teacher account
-- Password: test1234 (bcrypt hash)
INSERT OR IGNORE INTO users (id, email, password_hash, name, created_at) VALUES 
(1, 'teacher@test.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '테스트 교사', datetime('now'));

-- Insert test student account
INSERT OR IGNORE INTO student_users (id, email, password_hash, name, grade_level, created_at) VALUES
(1, 'student@test.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '테스트 학생', '고등학교 1학년', datetime('now'));

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
