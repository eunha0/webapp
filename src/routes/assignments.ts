import { Hono } from 'hono'
import type { Bindings } from '../types'
import { requireAuth } from '../middleware/auth'

const assignments = new Hono<{ Bindings: Bindings }>()

/**
 * GET /api/assignments - Get user's assignments
 */
assignments.get('/', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user // Return error response
    
    const db = c.env.DB
    
    const result = await db.prepare(
      'SELECT * FROM assignments WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(user.id).all()
    
    return c.json(result.results || [])
  } catch (error) {
    console.error('Error fetching assignments:', error)
    return c.json({ error: 'Failed to fetch assignments' }, 500)
  }
})

/**
 * POST /api/assignments - Create new assignment
 */
assignments.post('/', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user // Return error response
    
    const { title, description, grade_level, due_date, rubric_criteria, prompts } = await c.req.json()
    const db = c.env.DB
    
    // Create assignment without access code (will be generated later if needed)
    const promptsJSON = prompts ? JSON.stringify(prompts) : null
    const result = await db.prepare(
      'INSERT INTO assignments (user_id, title, description, grade_level, due_date, prompts, access_code) VALUES (?, ?, ?, ?, ?, ?, NULL)'
    ).bind(user.id, title, description, grade_level, due_date, promptsJSON).run()
    
    const assignmentId = result.meta.last_row_id
    
    // Add rubric criteria
    if (rubric_criteria && rubric_criteria.length > 0) {
      for (const criterion of rubric_criteria) {
        await db.prepare(
          'INSERT INTO assignment_rubrics (assignment_id, criterion_name, criterion_description, criterion_order) VALUES (?, ?, ?, ?)'
        ).bind(assignmentId, criterion.name, criterion.description, criterion.order).run()
      }
    }
    
    return c.json({ success: true, assignment_id: assignmentId })
  } catch (error) {
    console.error('Error creating assignment:', error)
    return c.json({ error: 'Failed to create assignment' }, 500)
  }
})

/**
 * GET /api/assignment/code/:accessCode - Get assignment by access code (for students)
 */
assignments.get('/code/:accessCode', async (c) => {
  try {
    const accessCode = c.req.param('accessCode')
    const db = c.env.DB
    
    // Find assignment by access code
    const assignment = await db.prepare(
      'SELECT * FROM assignments WHERE access_code = ?'
    ).bind(accessCode).first()
    
    if (!assignment) {
      return c.json({ error: '유효하지 않은 액세스 코드입니다.' }, 404)
    }
    
    // Parse prompts if exists
    if (assignment.prompts) {
      try {
        assignment.prompts = JSON.parse(assignment.prompts as string)
      } catch (e) {
        assignment.prompts = []
      }
    } else {
      assignment.prompts = []
    }
    
    // Get rubrics
    const rubrics = await db.prepare(
      'SELECT * FROM assignment_rubrics WHERE assignment_id = ? ORDER BY criterion_order'
    ).bind(assignment.id).all()
    
    assignment.rubrics = rubrics.results || []
    
    return c.json(assignment)
  } catch (error) {
    console.error('Error fetching assignment by access code:', error)
    return c.json({ error: '과제를 불러오는데 실패했습니다.' }, 500)
  }
})

/**
 * POST /api/assignment/:id/generate-access-code - Generate access code for assignment
 */
assignments.post('/:id/generate-access-code', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user // Return error response
    
    const assignmentId = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    // Verify assignment ownership
    const assignment = await db.prepare(
      'SELECT * FROM assignments WHERE id = ? AND user_id = ?'
    ).bind(assignmentId, user.id).first()
    
    if (!assignment) {
      return c.json({ error: 'Assignment not found or access denied' }, 404)
    }
    
    // Check if access code already exists
    if (assignment.access_code) {
      return c.json({ access_code: assignment.access_code })
    }
    
    // Generate unique 6-digit access code
    let accessCode = ''
    let isUnique = false
    while (!isUnique) {
      accessCode = Math.floor(100000 + Math.random() * 900000).toString()
      const existing = await db.prepare(
        'SELECT id FROM assignments WHERE access_code = ?'
      ).bind(accessCode).first()
      if (!existing) isUnique = true
    }
    
    // Update assignment with access code
    await db.prepare(
      'UPDATE assignments SET access_code = ? WHERE id = ?'
    ).bind(accessCode, assignmentId).run()
    
    return c.json({ success: true, access_code: accessCode })
  } catch (error) {
    console.error('Error generating access code:', error)
    return c.json({ error: 'Failed to generate access code' }, 500)
  }
})

/**
 * GET /api/assignment/:id - Get assignment details with submissions
 */
assignments.get('/:id', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user
    
    const assignmentId = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    // Get assignment
    const assignment = await db.prepare(
      'SELECT * FROM assignments WHERE id = ? AND user_id = ?'
    ).bind(assignmentId, user.id).first()
    
    if (!assignment) {
      return c.json({ error: 'Assignment not found' }, 404)
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
    ).bind(assignmentId).all()
    
    // Get submissions
    const submissions = await db.prepare(
      'SELECT * FROM student_submissions WHERE assignment_id = ? ORDER BY submitted_at DESC'
    ).bind(assignmentId).all()
    
    return c.json({
      ...assignment,
      rubrics: rubrics.results || [],
      submissions: submissions.results || []
    })
  } catch (error) {
    console.error('Error fetching assignment:', error)
    return c.json({ error: 'Failed to fetch assignment' }, 500)
  }
})

/**
 * DELETE /api/assignment/:id - Delete assignment
 */
assignments.delete('/:id', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user
    
    const assignmentId = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    // Verify ownership
    const assignment = await db.prepare(
      'SELECT * FROM assignments WHERE id = ? AND user_id = ?'
    ).bind(assignmentId, user.id).first()
    
    if (!assignment) {
      return c.json({ error: 'Assignment not found' }, 404)
    }
    
    // Delete rubrics and submissions first (cascade)
    await db.prepare('DELETE FROM assignment_rubrics WHERE assignment_id = ?').bind(assignmentId).run()
    await db.prepare('DELETE FROM student_submissions WHERE assignment_id = ?').bind(assignmentId).run()
    
    // Delete assignment
    await db.prepare('DELETE FROM assignments WHERE id = ?').bind(assignmentId).run()
    
    return c.json({ success: true, message: 'Assignment deleted successfully' })
  } catch (error) {
    console.error('Error deleting assignment:', error)
    return c.json({ error: 'Failed to delete assignment' }, 500)
  }
})

/**
 * POST /api/assignment/:id/access-code - Regenerate or set access code
 */
assignments.post('/:id/access-code', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user
    
    const assignmentId = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    // Verify ownership
    const assignment = await db.prepare(
      'SELECT * FROM assignments WHERE id = ? AND user_id = ?'
    ).bind(assignmentId, user.id).first()
    
    if (!assignment) {
      return c.json({ error: 'Assignment not found' }, 404)
    }
    
    // Generate new unique access code
    let accessCode = ''
    let isUnique = false
    while (!isUnique) {
      accessCode = Math.floor(100000 + Math.random() * 900000).toString()
      const existing = await db.prepare(
        'SELECT id FROM assignments WHERE access_code = ?'
      ).bind(accessCode).first()
      if (!existing) isUnique = true
    }
    
    // Update assignment
    await db.prepare(
      'UPDATE assignments SET access_code = ? WHERE id = ?'
    ).bind(accessCode, assignmentId).run()
    
    return c.json({ success: true, access_code: accessCode })
  } catch (error) {
    console.error('Error setting access code:', error)
    return c.json({ error: 'Failed to set access code' }, 500)
  }
})

export default assignments
