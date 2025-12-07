// Type definitions for the essay grading system

export type Bindings = {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  GOOGLE_APPLICATION_CREDENTIALS: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  ANTHROPIC_API_KEY?: string;
  MAX_FILE_SIZE: string;
  ALLOWED_IMAGE_TYPES: string;
  ALLOWED_PDF_TYPES: string;
  R2_PUBLIC_URL: string;
}

export interface RubricCriterion {
  id?: number;
  criterion_name: string;
  criterion_description: string;
  criterion_order: number;
}

export interface GradingRequest {
  assignment_prompt: string;
  grade_level: string;
  rubric_criteria: Omit<RubricCriterion, 'id'>[];
  essay_text: string;
}

export interface CriterionScore {
  criterion_name: string;
  score: number;
  strengths: string;
  areas_for_improvement: string;
}

export interface GradingResult {
  total_score: number;
  summary_evaluation: string;
  criterion_scores: CriterionScore[];
  overall_comment: string;
  revision_suggestions: string;
  next_steps_advice: string;
}

export interface GradingSession {
  id: number;
  assignment_prompt: string;
  grade_level: string;
  created_at: string;
}

export interface Essay {
  id: number;
  session_id: number;
  essay_text: string;
  submitted_at: string;
}

export interface StoredGradingResult extends GradingResult {
  id: number;
  essay_id: number;
  graded_at: string;
}
