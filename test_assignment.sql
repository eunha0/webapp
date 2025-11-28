-- Insert test assignment with access code, prompts, and rubrics
INSERT OR IGNORE INTO assignments (id, user_id, title, description, grade_level, due_date, prompts, access_code, created_at)
VALUES (1, 1, '테스트 과제: 환경 보호', '환경 보호의 중요성에 대해 논술하시오.', '고등학교 1학년', '2025-12-31', 
'["지구 온난화로 인한 기후 변화가 심각해지고 있습니다. 평균 기온이 상승하면서 극지방의 빙하가 녹고 있으며, 이로 인해 해수면이 상승하고 있습니다.", "플라스틱 쓰레기가 해양 생태계를 위협하고 있습니다. 매년 수백만 톤의 플라스틱이 바다로 유입되어 해양 생물들의 서식지를 파괴하고 있습니다."]',
'123456', datetime('now'));

-- Insert rubrics for the test assignment
INSERT OR IGNORE INTO assignment_rubrics (assignment_id, criterion_name, criterion_description, criterion_order)
VALUES 
(1, '논리적 구성', '주장과 근거가 논리적으로 연결되어 있으며, 체계적으로 구성되어 있는가?', 1),
(1, '내용의 충실성', '환경 보호의 중요성에 대한 이해가 깊이 있게 서술되어 있는가?', 2),
(1, '표현력', '문장이 명확하고 어휘 사용이 적절한가?', 3);
