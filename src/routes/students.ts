import { Hono } from 'hono'
import type { Bindings } from '../types'
import { requireStudentAuth, getStudentFromSession } from '../middleware/auth'
import { gradeEssayHybrid } from '../hybrid-grading-service'

const students = new Hono<{ Bindings: Bindings }>()

/**
 * GET /api/student/assignment/:code - Get assignment by access code
 */
students.get('/assignment/:code', async (c) => {
  try {
    const accessCode = c.req.param('code')
    const db = c.env.DB
    
    // Find assignment
    const assignment = await db.prepare(
      'SELECT * FROM assignments WHERE access_code = ?'
    ).bind(accessCode).first()
    
    if (!assignment) {
      return c.json({ error: '유효하지 않은 액세스 코드입니다.' }, 404)
    }
    
    // Parse prompts
    if (assignment.prompts) {
      try {
        assignment.prompts = JSON.parse(assignment.prompts as string)
      } catch (e) {
        assignment.prompts = []
      }
    }
    
    // Get rubrics
    const rubrics = await db.prepare(
      'SELECT * FROM assignment_rubrics WHERE assignment_id = ? ORDER BY criterion_order'
    ).bind(assignment.id).all()
    
    assignment.rubrics = rubrics.results || []
    
    return c.json(assignment)
  } catch (error) {
    console.error('Error fetching assignment:', error)
    return c.json({ error: '과제를 불러오는데 실패했습니다.' }, 500)
  }
})

/**
 * POST /api/student/submit - Submit essay for assignment
 */
students.post('/submit', async (c) => {
  try {
    const student = await getStudentFromSession(c)
    
    const { assignment_id, essay_text, files } = await c.req.json()
    const db = c.env.DB
    
    // Verify assignment exists
    const assignment = await db.prepare(
      'SELECT * FROM assignments WHERE id = ?'
    ).bind(assignment_id).first()
    
    if (!assignment) {
      return c.json({ error: 'Assignment not found' }, 404)
    }
    
    // Create submission
    const filesJSON = files ? JSON.stringify(files) : null
    const studentName = student?.name || 'Anonymous'
    
    const result = await db.prepare(
      'INSERT INTO assignment_submissions (assignment_id, student_user_id, student_name, essay_text, files, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      assignment_id, 
      student?.id || null,
      studentName,
      essay_text,
      filesJSON,
      'pending'
    ).run()
    
    // Get rubric criteria for grading
    const rubrics = await db.prepare(
      'SELECT * FROM assignment_rubrics WHERE assignment_id = ? ORDER BY criterion_order'
    ).bind(assignment_id).all()
    
    // Prepare grading request
    const prompts = assignment.prompts ? JSON.parse(assignment.prompts as string) : []
    const gradingRequest = {
      essay_text: essay_text,
      assignment_prompt: prompts.join('\n\n'),
      rubric_criteria: (rubrics.results || []).map((r: any) => ({
        name: r.criterion_name,
        description: r.criterion_description
      })),
      grade_level: assignment.grade_level as string
    }
    
    // Auto-grade the submission
    try {
      const gradingResult = await gradeEssayHybrid(gradingRequest, c.env)
      
      // Update submission with grading result
      await db.prepare(`
        UPDATE assignment_submissions 
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
        result.meta.last_row_id
      ).run()
      
      return c.json({
        success: true,
        submission_id: result.meta.last_row_id,
        grading_result: gradingResult
      })
    } catch (gradingError) {
      console.error('Auto-grading failed:', gradingError)
      // Return success even if grading fails
      return c.json({
        success: true,
        submission_id: result.meta.last_row_id,
        message: '제출이 완료되었습니다. 채점은 나중에 진행됩니다.'
      })
    }
  } catch (error) {
    console.error('Error submitting essay:', error)
    return c.json({ error: '에세이 제출에 실패했습니다.' }, 500)
  }
})

/**
 * GET /api/student/my-submissions - Get student's submissions
 */
students.get('/my-submissions', async (c) => {
  try {
    const student = await requireStudentAuth(c)
    if (!student.id) return student
    
    const db = c.env.DB
    
    const submissions = await db.prepare(`
      SELECT 
        s.*,
        a.title as assignment_title,
        a.due_date
      FROM assignment_submissions s
      JOIN assignments a ON s.assignment_id = a.id
      WHERE s.student_user_id = ?
      ORDER BY s.submitted_at DESC
    `).bind(student.id).all()
    
    // Parse JSON fields
    const results = (submissions.results || []).map((sub: any) => {
      if (sub.files) {
        try {
          sub.files = JSON.parse(sub.files)
        } catch (e) {
          sub.files = []
        }
      }
      if (sub.grading_result) {
        try {
          sub.grading_result = JSON.parse(sub.grading_result)
        } catch (e) {
          sub.grading_result = null
        }
      }
      return sub
    })
    
    return c.json({ submissions: results })
  } catch (error) {
    console.error('Error fetching student submissions:', error)
    return c.json({ error: 'Failed to fetch submissions' }, 500)
  }
})

/**
 * GET /api/student/submission/:id/feedback - Get submission feedback (student view)
 */
students.get('/submission/:id/feedback', async (c) => {
  try {
    const student = await requireStudentAuth(c)
    if (!student.id) return student
    
    const submissionId = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    const submission = await db.prepare(
      'SELECT overall_score, overall_feedback, grading_result FROM assignment_submissions WHERE id = ? AND student_user_id = ?'
    ).bind(submissionId, student.id).first()
    
    if (!submission) {
      return c.json({ error: 'Submission not found' }, 404)
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
 * GET /api/student/progress - Get student progress/statistics
 */
students.get('/progress', async (c) => {
  try {
    const student = await requireStudentAuth(c)
    if (!student.id) return student
    
    const db = c.env.DB
    
    // Get submission statistics
    const [totalSubmissions, completedSubmissions, avgScore] = await Promise.all([
      db.prepare(
        'SELECT COUNT(*) as count FROM assignment_submissions WHERE student_user_id = ?'
      ).bind(student.id).first(),
      
      db.prepare(
        'SELECT COUNT(*) as count FROM assignment_submissions WHERE student_user_id = ? AND status = ?'
      ).bind(student.id, 'graded').first(),
      
      db.prepare(
        'SELECT AVG(overall_score) as avg_score FROM assignment_submissions WHERE student_user_id = ? AND status = ?'
      ).bind(student.id, 'graded').first()
    ])
    
    return c.json({
      total_submissions: totalSubmissions?.count || 0,
      completed_submissions: completedSubmissions?.count || 0,
      average_score: avgScore?.avg_score || 0
    })
  } catch (error) {
    console.error('Error fetching student progress:', error)
    return c.json({ error: 'Failed to fetch progress' }, 500)
  }
})

export default students
