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
        name: r.criterion_name,
        description: r.criterion_description
      })),
      grade_level: submission.grade_level as string
    }
    
    // Grade the essay
    const gradingResult = await gradeEssayHybrid(gradingRequest, c.env)
    
    // Store grading result
    await db.prepare(`
      UPDATE student_submissions 
      SET status = ?, 
          overall_score = ?, 
          overall_feedback = ?,
          grading_result = ?,
          graded_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      'graded',
      gradingResult.overall_score,
      gradingResult.overall_feedback,
      JSON.stringify(gradingResult),
      submissionId
    ).run()
    
    return c.json({
      success: true,
      grading_result: gradingResult
    })
  } catch (error) {
    console.error('Error grading submission:', error)
    return c.json({ error: 'Failed to grade submission', details: String(error) }, 500)
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
    
    // Update feedback
    const gradingResultJSON = grading_result ? JSON.stringify(grading_result) : null
    await db.prepare(`
      UPDATE student_submissions 
      SET overall_score = ?, overall_feedback = ?, grading_result = ?
      WHERE id = ?
    `).bind(overall_score, overall_feedback, gradingResultJSON, submissionId).run()
    
    return c.json({ success: true, message: 'Feedback updated successfully' })
  } catch (error) {
    console.error('Error updating feedback:', error)
    return c.json({ error: 'Failed to update feedback' }, 500)
  }
})

export default submissions
