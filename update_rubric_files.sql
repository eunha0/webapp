-- Add file column to resource_posts table if not exists
-- ALTER TABLE resource_posts ADD COLUMN file TEXT;

-- Update rubric posts with file paths
UPDATE resource_posts SET file = '/rubric-docs/뉴욕 주 리젠트 시험 논증적 글쓰기 루브릭.html'
WHERE title = '뉴욕 주 리젠트 시험 논증적 글쓰기 루브릭';

UPDATE resource_posts SET file = '/rubric-docs/뉴욕 주 리젠트 시험 분석적 글쓰기 루브릭.html'
WHERE title = '뉴욕 주 리젠트 시험 분석적 글쓰기 루브릭';

UPDATE resource_posts SET file = '/rubric-docs/뉴욕 주 중학교 논술 루브릭.html'
WHERE title = '뉴욕 주 중학교 논술 루브릭';

UPDATE resource_posts SET file = '/rubric-docs/뉴욕 주 초등학교 논술 루브릭.html'
WHERE title = '뉴욕 주 초등학교 논술 루브릭';

UPDATE resource_posts SET file = '/rubric-docs/IB 중등 프로그램 고등학교 개인과 사회 논술 루브릭.html'
WHERE title = 'IB 중등 프로그램 고등학교 개인과 사회 논술 루브릭';

UPDATE resource_posts SET file = '/rubric-docs/IB 중등 프로그램 중학교 개인과 사회 논술 루브릭.html'
WHERE title = 'IB 중등 프로그램 중학교 개인과 사회 논술 루브릭';

UPDATE resource_posts SET file = '/rubric-docs/IB 중등 프로그램 과학 논술 루브릭.html'
WHERE title = 'IB 중등 프로그램 과학 논술 루브릭';
