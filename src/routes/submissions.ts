import { Hono } from 'hono'
import type { Bindings } from '../types'
import { requireAuth, requireStudentAuth } from '../middleware/auth'
import { gradeEssayHybrid } from '../hybrid-grading-service'

const submissions = new Hono<{ Bindings: Bindings }>()

/**
 * POST /api/assignment/:id/submission - Create submission for assignment
 */
submissions.post('/assignment/:id/submission', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user
    
    const assignmentId = parseInt(c.req.param('id'))
    const { student_name, essay_text, files } = await c.req.json()
    const db = c.env.DB
    
    // Verify assignment exists and belongs to user
    const assignment = await db.prepare(
      'SELECT * FROM assignments WHERE id = ? AND user_id = ?'
    ).bind(assignmentId, user.id).first()
    
    if (!assignment) {
      return c.json({ error: 'Assignment not found' }, 404)
    }
    
    // Create submission
    const filesJSON = files ? JSON.stringify(files) : null
    const result = await db.prepare(
      'INSERT INTO student_submissions (assignment_id, student_name, essay_text, files, status) VALUES (?, ?, ?, ?, ?)'
    ).bind(assignmentId, student_name, essay_text, filesJSON, 'pending').run()
    
    return c.json({ 
      success: true, 
      submission_id: result.meta.last_row_id 
    })
  } catch (error) {
    console.error('Error creating submission:', error)
    return c.json({ error: 'Failed to create submission' }, 500)
  }
})

/**
 * POST /api/submission/:id/grade - Grade a submission
 */
submissions.post('/:id/grade', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user
    
    const submissionId = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    // Get submission with assignment details
    const submission = await db.prepare(`
      SELECT s.*, a.title as assignment_title, a.prompts, a.grade_level, a.user_id as assignment_owner_id
      FROM student_submissions s
      JOIN assignments a ON s.assignment_id = a.id
      WHERE s.id = ?
    `).bind(submissionId).first()
    
    if (!submission) {
      return c.json({ error: 'Submission not found' }, 404)
    }
    
    // Verify ownership
    if (submission.assignment_owner_id !== user.id) {
      return c.json({ error: 'Access denied' }, 403)
    }
    
    // Get rubric criteria
    const rubrics = await db.prepare(
      'SELECT * FROM assignment_rubrics WHERE assignment_id = ? ORDER BY criterion_order'
    ).bind(submission.assignment_id).all()
    
    // Prepare grading request
    const prompts = submission.prompts ? JSON.parse(submission.prompts as string) : []
    const gradingRequest = {
      essay_text: submission.essay_text as string,
      assignment_prompt: prompts.join('\n\n'),
      rubric_criteria: (rubrics.results || []).map((r: any) => ({
        criterion_name: r.criterion_name,
        criterion_description: r.criterion_description,
        max_score: r.max_score || 4
      })),
      grade_level: submission.grade_level as string
    }
    
    // Grade the essay
    const gradingResult = await gradeEssayHybrid(gradingRequest, c.env)
    
    // Store grading result
    // Map GradingResult fields to database columns
    const overall_score = gradingResult.total_score ?? 0;
    const overall_feedback = gradingResult.overall_comment || gradingResult.summary_evaluation || '';
    
    // Build UPDATE query dynamically to avoid undefined values
    const updates: string[] = ['status = ?', 'graded_at = CURRENT_TIMESTAMP'];
    const params: any[] = ['graded'];
    
    if (overall_score !== undefined) {
      updates.push('overall_score = ?');
      params.push(overall_score);
    }
    
    if (overall_feedback !== undefined && overall_feedback !== '') {
      updates.push('overall_feedback = ?');
      params.push(overall_feedback);
    }
    
    if (gradingResult !== undefined) {
      updates.push('grading_result = ?');
      params.push(JSON.stringify(gradingResult));
    }
    
    params.push(submissionId);
    
    await db.prepare(`
      UPDATE student_submissions 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...params).run()
    
    // Try to insert into grading_history (optional - for tracking re-gradings)
    try {
      // Get max_score from rubrics for grading history
      const rubricScores = await db.prepare(
        'SELECT max_score FROM assignment_rubrics WHERE assignment_id = ?'
      ).bind(submission.assignment_id).all()
      
      const maxScore = rubricScores.results && rubricScores.results.length > 0
        ? rubricScores.results.reduce((sum: number, rubric: any) => sum + (rubric.max_score || 4), 0)
        : 100
      
      // Insert into grading_history to track all grading executions (including re-gradings)
      await db.prepare(`
        INSERT INTO grading_history (
          submission_id, 
          assignment_id, 
          student_name, 
          grade_level, 
          overall_score, 
          max_score,
          graded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        submissionId,
        submission.assignment_id,
        submission.student_name,
        submission.grade_level,
        overall_score,
        maxScore,
        user.id
      ).run()
    } catch (historyError) {
      // If grading_history table doesn't exist, just log and continue
      console.warn('[Grading] Could not insert into grading_history (table may not exist):', historyError)
    }
    
    // Increment teacher's monthly grading count
    await db.prepare(`
      UPDATE users 
      SET monthly_graded_count = COALESCE(monthly_graded_count, 0) + 1
      WHERE id = ?
    `).bind(user.id).run()
    
    console.log('[Grading] Successfully graded submission:', submissionId, 'for user:', user.id)
    
    return c.json({
      success: true,
      grading_result: gradingResult
    })
  } catch (error) {
    console.error('Error grading submission:', error)
    
    // Check if error message is about AI connectivity
    if (error instanceof Error && error.message.includes('AI 연결에 장애')) {
      return c.json({ 
        error: error.message,
        details: 'AI 서비스 연결 오류'
      }, 503) // Service Unavailable
    }
    
    return c.json({ 
      error: 'Failed to grade submission', 
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

/**
 * GET /api/submission/:id - Get submission details
 */
submissions.get('/:id', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user
    
    const submissionId = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    // Get submission with assignment ownership check
    const submission = await db.prepare(`
      SELECT s.*, a.user_id as assignment_owner_id, a.title as assignment_title
      FROM student_submissions s
      JOIN assignments a ON s.assignment_id = a.id
      WHERE s.id = ?
    `).bind(submissionId).first()
    
    if (!submission) {
      return c.json({ error: 'Submission not found' }, 404)
    }
    
    // Verify ownership
    if (submission.assignment_owner_id !== user.id) {
      return c.json({ error: 'Access denied' }, 403)
    }
    
    // Parse JSON fields
    if (submission.files) {
      submission.files = JSON.parse(submission.files as string)
    }
    if (submission.grading_result) {
      submission.grading_result = JSON.parse(submission.grading_result as string)
    }
    
    return c.json(submission)
  } catch (error) {
    console.error('Error fetching submission:', error)
    return c.json({ error: 'Failed to fetch submission' }, 500)
  }
})

/**
 * GET /api/submission/:id/feedback - Get submission feedback
 */
submissions.get('/:id/feedback', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user
    
    const submissionId = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    const submission = await db.prepare(`
      SELECT s.overall_score, s.overall_feedback, s.grading_result, a.user_id as assignment_owner_id
      FROM student_submissions s
      JOIN assignments a ON s.assignment_id = a.id
      WHERE s.id = ?
    `).bind(submissionId).first()
    
    if (!submission) {
      return c.json({ error: 'Submission not found' }, 404)
    }
    
    if (submission.assignment_owner_id !== user.id) {
      return c.json({ error: 'Access denied' }, 403)
    }
    
    let gradingResult = null
    if (submission.grading_result) {
      gradingResult = JSON.parse(submission.grading_result as string)
    }
    
    return c.json({
      overall_score: submission.overall_score,
      overall_feedback: submission.overall_feedback,
      grading_result: gradingResult
    })
  } catch (error) {
    console.error('Error fetching feedback:', error)
    return c.json({ error: 'Failed to fetch feedback' }, 500)
  }
})

/**
 * PUT /api/submission/:id/feedback - Update submission feedback
 */
submissions.put('/:id/feedback', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user
    
    const submissionId = parseInt(c.req.param('id'))
    const { overall_score, overall_feedback, grading_result } = await c.req.json()
    const db = c.env.DB
    
    // Verify ownership
    const submission = await db.prepare(`
      SELECT a.user_id as assignment_owner_id
      FROM student_submissions s
      JOIN assignments a ON s.assignment_id = a.id
      WHERE s.id = ?
    `).bind(submissionId).first()
    
    if (!submission) {
      return c.json({ error: 'Submission not found' }, 404)
    }
    
    if (submission.assignment_owner_id !== user.id) {
      return c.json({ error: 'Access denied' }, 403)
    }
    
    // Build dynamic UPDATE query based on provided fields
    const updates: string[] = []
    const values: any[] = []
    
    if (overall_score !== undefined) {
      updates.push('overall_score = ?')
      values.push(overall_score)
    }
    
    if (overall_feedback !== undefined) {
      updates.push('overall_feedback = ?')
      values.push(overall_feedback)
    }
    
    if (grading_result !== undefined) {
      updates.push('grading_result = ?')
      values.push(grading_result ? JSON.stringify(grading_result) : null)
    }
    
    // Always update status and graded_at when feedback is saved
    updates.push('status = ?')
    values.push('graded')
    
    updates.push('graded_at = ?')
    values.push(new Date().toISOString())
    
    // Add submissionId for WHERE clause
    values.push(submissionId)
    
    if (updates.length === 2) { // Only status and graded_at were added
      return c.json({ error: 'No fields to update' }, 400)
    }
    
    // Execute update
    await db.prepare(`
      UPDATE student_submissions 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...values).run()
    
    return c.json({ success: true, message: 'Feedback updated successfully' })
  } catch (error) {
    console.error('Error updating feedback:', error)
    return c.json({ error: 'Failed to update feedback' }, 500)
  }
})

export default submissions
