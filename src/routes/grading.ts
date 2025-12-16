import { Hono } from 'hono'
import type { Bindings, GradingRequest } from '../types'
import { gradeEssayHybrid } from '../grading-service'
import {
  createGradingSession,
  createEssay,
  storeGradingResult,
  getGradingResult,
  listGradingSessions,
  getSessionDetails
} from '../db-service'
import { essayContentSchema, validate } from '../utils/validation'

const grading = new Hono<{ Bindings: Bindings }>()

/**
 * POST /api/grade - Grade an essay (SECURITY ENHANCED with Zod validation)
 */
grading.post('/grade', async (c) => {
  try {
    const body = await c.req.json()
    
    // Zod validation for essay content
    const essayValidation = validate(essayContentSchema, body.essay_text)
    if (!essayValidation.success) {
      return c.json({ 
        error: '에세이 내용 검증 실패', 
        details: essayValidation.errors 
      }, 400)
    }

    const request: GradingRequest = body

    // Validate request structure
    if (!request.assignment_prompt || !request.essay_text || !request.rubric_criteria || request.rubric_criteria.length === 0) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const db = c.env.DB

    // Create grading session
    const sessionId = await createGradingSession(db, request)

    // Create essay
    const essayId = await createEssay(db, sessionId, request.essay_text)

    // Grade the essay using Hybrid AI (GPT-4o for scoring + Claude for feedback)
    const gradingResult = await gradeEssayHybrid(request, c.env)

    // Store grading result
    const resultId = await storeGradingResult(db, essayId, sessionId, gradingResult)

    // Return the complete result
    return c.json({
      success: true,
      session_id: sessionId,
      essay_id: essayId,
      result_id: resultId,
      grading_result: gradingResult
    })
  } catch (error) {
    console.error('Error grading essay:', error)
    return c.json({ error: 'Failed to grade essay', details: String(error) }, 500)
  }
})

/**
 * GET /api/result/:essayId - Get grading result for an essay
 */
grading.get('/result/:essayId', async (c) => {
  try {
    const essayId = parseInt(c.req.param('essayId'))
    const db = c.env.DB

    const result = await getGradingResult(db, essayId)

    if (!result) {
      return c.json({ error: 'Grading result not found' }, 404)
    }

    return c.json(result)
  } catch (error) {
    console.error('Error fetching result:', error)
    return c.json({ error: 'Failed to fetch result', details: String(error) }, 500)
  }
})

/**
 * GET /api/sessions - List all grading sessions
 */
grading.get('/sessions', async (c) => {
  try {
    const db = c.env.DB
    const sessions = await listGradingSessions(db)
    return c.json({ sessions })
  } catch (error) {
    console.error('Error listing sessions:', error)
    return c.json({ error: 'Failed to list sessions', details: String(error) }, 500)
  }
})

/**
 * GET /api/session/:sessionId - Get session details
 */
grading.get('/session/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId')
    const db = c.env.DB

    const session = await getSessionDetails(db, sessionId)

    if (!session) {
      return c.json({ error: 'Session not found' }, 404)
    }

    return c.json(session)
  } catch (error) {
    console.error('Error fetching session:', error)
    return c.json({ error: 'Failed to fetch session', details: String(error) }, 500)
  }
})

/**
 * GET /api/grading-history - Get grading history for a user
 */
grading.get('/grading-history', async (c) => {
  try {
    const db = c.env.DB
    const user = c.get('user')
    
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const history = await db.prepare(`
      SELECT 
        gs.id as session_id,
        gs.assignment_prompt,
        gs.grade_level,
        gs.created_at,
        e.id as essay_id,
        e.text as essay_text,
        gr.overall_score,
        gr.overall_feedback
      FROM grading_sessions gs
      LEFT JOIN essays e ON e.session_id = gs.id
      LEFT JOIN grading_results gr ON gr.essay_id = e.id
      WHERE gs.user_id = ?
      ORDER BY gs.created_at DESC
      LIMIT 50
    `).bind(user.id).all()

    return c.json({ history: history.results })
  } catch (error) {
    console.error('Error fetching grading history:', error)
    return c.json({ error: 'Failed to fetch grading history', details: String(error) }, 500)
  }
})

export default grading
