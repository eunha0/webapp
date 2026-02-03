-- Update max_score for NY Regents Argumentative Writing rubric from 4 to 6
-- This migration sets the default max_score for all rubrics to 6 for future assignments
-- Backend code (src/index.tsx lines 235-238) already defines nyregents rubric with max_score: 6

-- Note: The NY Regents rubric has 4 criteria, each worth 6 points (total: 24 points)
-- Criteria:
-- 1. Content and Analysis (내용과 분석) - 6 points
-- 2. Use of Evidence (증거 활용) - 6 points
-- 3. Coherence, Organization (일관성과 구성) - 6 points
-- 4. Language Use and Conventions (언어 사용과 규칙) - 6 points

-- This migration is intentionally empty as the backend handles max_score correctly
-- when creating new assignments with nyregents rubric
