// Database service for essay grading system
import type { 
  Bindings, 
  GradingRequest, 
  GradingResult, 
  GradingSession,
  Essay,
  StoredGradingResult,
  RubricCriterion
} from './types';

/**
 * Creates a new grading session with rubric criteria
 */
export async function createGradingSession(
  db: D1Database,
  request: GradingRequest
): Promise<number> {
  // Insert grading session
  const sessionResult = await db
    .prepare(
      'INSERT INTO grading_sessions (assignment_prompt, grade_level) VALUES (?, ?)'
    )
    .bind(request.assignment_prompt, request.grade_level)
    .run();

  const sessionId = sessionResult.meta.last_row_id as number;

  // Insert rubric criteria
  for (const criterion of request.rubric_criteria) {
    await db
      .prepare(
        'INSERT INTO rubric_criteria (session_id, criterion_name, criterion_description, criterion_order) VALUES (?, ?, ?, ?)'
      )
      .bind(
        sessionId,
        criterion.criterion_name,
        criterion.criterion_description,
        criterion.criterion_order
      )
      .run();
  }

  return sessionId;
}

/**
 * Creates a new essay submission
 */
export async function createEssay(
  db: D1Database,
  sessionId: number,
  essayText: string
): Promise<number> {
  const result = await db
    .prepare('INSERT INTO essays (session_id, essay_text) VALUES (?, ?)')
    .bind(sessionId, essayText)
    .run();

  return result.meta.last_row_id as number;
}

/**
 * Stores grading results for an essay
 */
export async function storeGradingResult(
  db: D1Database,
  essayId: number,
  sessionId: number,
  result: GradingResult
): Promise<number> {
  // Insert grading result
  const resultInsert = await db
    .prepare(
      `INSERT INTO grading_results 
       (essay_id, total_score, summary_evaluation, overall_comment, revision_suggestions, next_steps_advice) 
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      essayId,
      result.total_score,
      result.summary_evaluation,
      result.overall_comment,
      result.revision_suggestions,
      result.next_steps_advice
    )
    .run();

  const resultId = resultInsert.meta.last_row_id as number;

  // Get criterion IDs
  const criteria = await db
    .prepare('SELECT id, criterion_name FROM rubric_criteria WHERE session_id = ? ORDER BY criterion_order')
    .bind(sessionId)
    .all();

  // Insert criterion scores
  for (const criterionScore of result.criterion_scores) {
    const criterion = criteria.results.find(
      (c: any) => c.criterion_name === criterionScore.criterion_name
    ) as any;

    if (criterion) {
      await db
        .prepare(
          `INSERT INTO criterion_scores 
           (result_id, criterion_id, score, strengths, areas_for_improvement) 
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(
          resultId,
          criterion.id,
          criterionScore.score,
          criterionScore.strengths,
          criterionScore.areas_for_improvement
        )
        .run();
    }
  }

  return resultId;
}

/**
 * Retrieves a complete grading result by essay ID
 */
export async function getGradingResult(
  db: D1Database,
  essayId: number
): Promise<StoredGradingResult | null> {
  // Get grading result
  const result = await db
    .prepare(
      `SELECT * FROM grading_results WHERE essay_id = ?`
    )
    .bind(essayId)
    .first();

  if (!result) {
    return null;
  }

  // Get essay to find session_id
  const essay = await db
    .prepare('SELECT session_id FROM essays WHERE id = ?')
    .bind(essayId)
    .first();

  if (!essay) {
    return null;
  }

  // Get criterion scores with criterion names and max scores
  const scores = await db
    .prepare(
      `SELECT 
        cs.score,
        cs.strengths,
        cs.areas_for_improvement,
        rc.criterion_name,
        rc.max_score
       FROM criterion_scores cs
       JOIN rubric_criteria rc ON cs.criterion_id = rc.id
       WHERE cs.result_id = ?
       ORDER BY rc.criterion_order`
    )
    .bind(result.id)
    .all();

  return {
    id: result.id as number,
    essay_id: result.essay_id as number,
    total_score: result.total_score as number,
    summary_evaluation: result.summary_evaluation as string,
    overall_comment: result.overall_comment as string,
    revision_suggestions: result.revision_suggestions as string,
    next_steps_advice: result.next_steps_advice as string,
    graded_at: result.graded_at as string,
    criterion_scores: scores.results.map((s: any) => ({
      criterion_name: s.criterion_name,
      score: s.score,
      max_score: s.max_score || 4,
      strengths: s.strengths,
      areas_for_improvement: s.areas_for_improvement
    }))
  };
}

/**
 * Lists all grading sessions with their essays
 */
export async function listGradingSessions(
  db: D1Database,
  limit: number = 50
): Promise<any[]> {
  const sessions = await db
    .prepare(
      `SELECT 
        gs.id,
        gs.assignment_prompt,
        gs.grade_level,
        gs.created_at,
        COUNT(e.id) as essay_count
       FROM grading_sessions gs
       LEFT JOIN essays e ON gs.id = e.session_id
       GROUP BY gs.id
       ORDER BY gs.created_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all();

  return sessions.results;
}

/**
 * Gets session details with rubric criteria
 */
export async function getSessionDetails(
  db: D1Database,
  sessionId: number
): Promise<any> {
  const session = await db
    .prepare('SELECT * FROM grading_sessions WHERE id = ?')
    .bind(sessionId)
    .first();

  if (!session) {
    return null;
  }

  const criteria = await db
    .prepare(
      'SELECT * FROM rubric_criteria WHERE session_id = ? ORDER BY criterion_order'
    )
    .bind(sessionId)
    .all();

  const essays = await db
    .prepare(
      `SELECT 
        e.*,
        gr.total_score,
        gr.graded_at
       FROM essays e
       LEFT JOIN grading_results gr ON e.id = gr.essay_id
       WHERE e.session_id = ?
       ORDER BY e.submitted_at DESC`
    )
    .bind(sessionId)
    .all();

  return {
    ...session,
    rubric_criteria: criteria.results,
    essays: essays.results
  };
}
