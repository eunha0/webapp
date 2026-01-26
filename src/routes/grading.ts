import { Hono } from 'hono'
import type { Bindings, GradingRequest } from '../types'
import { gradeEssayHybrid } from '../hybrid-grading-service'
import {
  createGradingSession,
  createEssay,
  storeGradingResult,
  getGradingResult,
  listGradingSessions,
  getSessionDetails
} from '../db-service'
import { essayContentSchema, validate } from '../utils/validation'
import { requireAuth } from '../middleware/auth'

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
    const result = await requireAuth(c)
    if (result instanceof Response) return result // Return error response
    const user = result
    
    const db = c.env.DB
    
    // Get all graded submissions for user's assignments
    const queryResult = await db.prepare(
      `SELECT 
        s.id as submission_id,
        s.assignment_id,
        s.student_name,
        s.submitted_at,
        a.title as assignment_title,
        a.grade_level,
        s.overall_score,
        s.overall_feedback,
        s.graded_at
       FROM student_submissions s
       JOIN assignments a ON s.assignment_id = a.id
       WHERE a.user_id = ? AND s.status = 'graded'
       ORDER BY s.graded_at DESC`
    ).bind(user.id).all()
    
    // Get rubric criteria with their max_score values for each assignment
    const submissionsWithMaxScore = await Promise.all((queryResult.results || []).map(async (submission: any) => {
      const rubrics = await db.prepare(
        'SELECT max_score FROM assignment_rubrics WHERE assignment_id = ?'
      ).bind(submission.assignment_id).all()
      
      // Sum all max_score values from the rubrics
      // If no rubrics found, default to 4 for backward compatibility
      const maxScore = rubrics.results && rubrics.results.length > 0
        ? rubrics.results.reduce((sum: number, rubric: any) => sum + (rubric.max_score || 4), 0)
        : 4
      
      return {
        ...submission,
        max_score: maxScore
      }
    }))

    return c.json(submissionsWithMaxScore)
  } catch (error) {
    console.error('Error fetching grading history:', error)
    return c.json({ error: 'Failed to fetch grading history', details: String(error) }, 500)
  }
})

/**
 * GET /api/grading-execution-history - Get all grading executions (including re-gradings)
 */
grading.get('/grading-execution-history', async (c) => {
  try {
    const result = await requireAuth(c)
    if (result instanceof Response) return result
    const user = result
    
    const db = c.env.DB
    
    // Get all grading executions from grading_history table
    const queryResult = await db.prepare(
      `SELECT 
        gh.id as history_id,
        gh.submission_id,
        gh.assignment_id,
        gh.student_name,
        gh.grade_level,
        gh.overall_score,
        gh.max_score,
        gh.graded_at,
        a.title as assignment_title,
        s.submitted_at
       FROM grading_history gh
       JOIN assignments a ON gh.assignment_id = a.id
       LEFT JOIN student_submissions s ON gh.submission_id = s.id
       WHERE gh.graded_by = ?
       ORDER BY gh.graded_at DESC`
    ).bind(user.id).all()
    
    return c.json(queryResult.results || [])
  } catch (error) {
    console.error('Error fetching grading execution history:', error)
    return c.json({ error: 'Failed to fetch grading execution history', details: String(error) }, 500)
  }
})

export default grading
