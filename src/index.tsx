import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import type { Bindings, GradingRequest } from './types'
import { gradeEssay } from './grading-service'
import {
  createGradingSession,
  createEssay,
  storeGradingResult,
  getGradingResult,
  listGradingSessions,
  getSessionDetails
} from './db-service'

const app = new Hono<{ Bindings: Bindings }>()

// Helper function to get user from session
async function getUserFromSession(c: any): Promise<{ id: number; name: string; email: string } | null> {
  const sessionId = c.req.header('X-Session-ID')
  if (!sessionId) return null
  
  const db = c.env.DB
  const session = await db.prepare(
    'SELECT s.*, u.id as user_id, u.name, u.email FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.expires_at > datetime("now")'
  ).bind(sessionId).first()
  
  if (!session) return null
  
  return {
    id: session.user_id as number,
    name: session.name as string,
    email: session.email as string
  }
}

// Helper function to require authentication
async function requireAuth(c: any) {
  const user = await getUserFromSession(c)
  if (!user) {
    return c.json({ error: 'Unauthorized - Please login' }, 401)
  }
  return user
}

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// API Routes

/**
 * POST /api/grade - Grade an essay
 */
app.post('/api/grade', async (c) => {
  try {
    const request: GradingRequest = await c.req.json()

    // Validate request
    if (!request.assignment_prompt || !request.essay_text || !request.rubric_criteria || request.rubric_criteria.length === 0) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const db = c.env.DB

    // Create grading session
    const sessionId = await createGradingSession(db, request)

    // Create essay
    const essayId = await createEssay(db, sessionId, request.essay_text)

    // Grade the essay using AI
    const gradingResult = await gradeEssay(request)

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
app.get('/api/result/:essayId', async (c) => {
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
app.get('/api/sessions', async (c) => {
  try {
    const db = c.env.DB
    const sessions = await listGradingSessions(db)

    return c.json(sessions)
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return c.json({ error: 'Failed to fetch sessions', details: String(error) }, 500)
  }
})

/**
 * GET /api/session/:sessionId - Get session details
 */
app.get('/api/session/:sessionId', async (c) => {
  try {
    const sessionId = parseInt(c.req.param('sessionId'))
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
 * GET /api/health - Health check
 */
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

/**
 * POST /api/auth/signup - User signup
 */
app.post('/api/auth/signup', async (c) => {
  try {
    const { name, email, password } = await c.req.json()
    const db = c.env.DB
    
    // Check if user already exists
    const existingUser = await db.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first()
    
    if (existingUser) {
      return c.json({ error: 'Email already registered' }, 400)
    }
    
    // In production, use proper password hashing (bcrypt)
    // For now, we'll use a simple hash (NOT SECURE - replace in production)
    const passwordHash = btoa(password) // Simple base64 encoding - INSECURE!
    
    // Insert new user
    const result = await db.prepare(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
    ).bind(name, email, passwordHash).run()
    
    // Create free subscription
    await db.prepare(
      'INSERT INTO subscriptions (user_id, plan_type, billing_cycle) VALUES (?, ?, ?)'
    ).bind(result.meta.last_row_id, 'free', 'monthly').run()
    
    return c.json({ success: true, user_id: result.meta.last_row_id })
  } catch (error) {
    console.error('Signup error:', error)
    return c.json({ error: 'Failed to create account' }, 500)
  }
})

/**
 * POST /api/auth/login - User login
 */
app.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json()
    const db = c.env.DB
    
    // Find user
    const user = await db.prepare(
      'SELECT id, name, email, password_hash FROM users WHERE email = ?'
    ).bind(email).first()
    
    if (!user) {
      return c.json({ error: 'Invalid email or password' }, 401)
    }
    
    // Verify password (in production, use bcrypt.compare)
    const passwordHash = btoa(password)
    if (passwordHash !== user.password_hash) {
      return c.json({ error: 'Invalid email or password' }, 401)
    }
    
    // Create session
    const sessionId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    
    await db.prepare(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(sessionId, user.id, expiresAt.toISOString()).run()
    
    return c.json({
      success: true,
      session_id: sessionId,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    return c.json({ error: 'Failed to login' }, 500)
  }
})

/**
 * POST /api/auth/logout - User logout
 */
app.post('/api/auth/logout', async (c) => {
  try {
    const { session_id } = await c.req.json()
    const db = c.env.DB
    
    await db.prepare(
      'DELETE FROM sessions WHERE id = ?'
    ).bind(session_id).run()
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return c.json({ error: 'Failed to logout' }, 500)
  }
})

/**
 * GET /api/assignments - Get user's assignments
 */
app.get('/api/assignments', async (c) => {
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
app.post('/api/assignments', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user // Return error response
    
    const { title, description, grade_level, due_date, rubric_criteria } = await c.req.json()
    const db = c.env.DB
    
    // Create assignment
    const result = await db.prepare(
      'INSERT INTO assignments (user_id, title, description, grade_level, due_date) VALUES (?, ?, ?, ?, ?)'
    ).bind(user.id, title, description, grade_level, due_date).run()
    
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
 * GET /api/assignment/:id - Get assignment details with submissions
 */
app.get('/api/assignment/:id', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user // Return error response
    
    const assignmentId = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    // Get assignment and verify ownership
    const assignment = await db.prepare(
      'SELECT * FROM assignments WHERE id = ? AND user_id = ?'
    ).bind(assignmentId, user.id).first()
    
    if (!assignment) {
      return c.json({ error: 'Assignment not found or access denied' }, 404)
    }
    
    // Get rubrics
    const rubrics = await db.prepare(
      'SELECT * FROM assignment_rubrics WHERE assignment_id = ? ORDER BY criterion_order'
    ).bind(assignmentId).all()
    
    // Get submissions with grading results
    const submissions = await db.prepare(
      `SELECT s.*, gr.total_score as overall_score, gr.overall_comment as overall_feedback 
       FROM student_submissions s 
       LEFT JOIN grading_results gr ON s.grade_result_id = gr.id 
       WHERE s.assignment_id = ? 
       ORDER BY s.submitted_at DESC`
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
 * POST /api/assignment/:id/submission - Add student submission
 */
app.post('/api/assignment/:id/submission', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user // Return error response
    
    const assignmentId = parseInt(c.req.param('id'))
    const { student_name, essay_text } = await c.req.json()
    const db = c.env.DB
    
    // Verify assignment ownership
    const assignment = await db.prepare(
      'SELECT id FROM assignments WHERE id = ? AND user_id = ?'
    ).bind(assignmentId, user.id).first()
    
    if (!assignment) {
      return c.json({ error: 'Assignment not found or access denied' }, 404)
    }
    
    const result = await db.prepare(
      'INSERT INTO student_submissions (assignment_id, student_name, essay_text) VALUES (?, ?, ?)'
    ).bind(assignmentId, student_name, essay_text).run()
    
    return c.json({ success: true, submission_id: result.meta.last_row_id })
  } catch (error) {
    console.error('Error creating submission:', error)
    return c.json({ error: 'Failed to create submission' }, 500)
  }
})

/**
 * DELETE /api/assignment/:id - Delete assignment
 */
app.delete('/api/assignment/:id', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user // Return error response
    
    const assignmentId = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    // Verify ownership before deleting
    await db.prepare('DELETE FROM assignments WHERE id = ? AND user_id = ?').bind(assignmentId, user.id).run()
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Error deleting assignment:', error)
    return c.json({ error: 'Failed to delete assignment' }, 500)
  }
})

/**
 * POST /api/submission/:id/grade - Grade a student submission
 */
app.post('/api/submission/:id/grade', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user // Return error response
    
    const submissionId = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    // Get submission and verify assignment ownership
    const submission = await db.prepare(
      `SELECT s.*, a.title as assignment_title, a.description as assignment_prompt, a.grade_level, a.user_id
       FROM student_submissions s
       JOIN assignments a ON s.assignment_id = a.id
       WHERE s.id = ?`
    ).bind(submissionId).first()
    
    if (!submission) {
      return c.json({ error: 'Submission not found' }, 404)
    }
    
    if (submission.user_id !== user.id) {
      return c.json({ error: 'Access denied' }, 403)
    }
    
    // Get rubric criteria for this assignment
    const rubrics = await db.prepare(
      'SELECT criterion_name, criterion_description FROM assignment_rubrics WHERE assignment_id = ? ORDER BY criterion_order'
    ).bind(submission.assignment_id).all()
    
    if (!rubrics.results || rubrics.results.length === 0) {
      return c.json({ error: 'No rubric criteria found for this assignment' }, 400)
    }
    
    // Build grading request
    const gradingRequest: GradingRequest = {
      assignment_prompt: submission.assignment_prompt as string,
      essay_text: submission.essay_text as string,
      grade_level: submission.grade_level as string,
      rubric_criteria: rubrics.results.map((r: any, idx: number) => ({
        criterion_name: r.criterion_name,
        criterion_description: r.criterion_description,
        criterion_order: idx + 1
      }))
    }
    
    // Create grading session
    const sessionId = await createGradingSession(db, gradingRequest)
    
    // Create essay
    const essayId = await createEssay(db, sessionId, submission.essay_text as string)
    
    // Grade the essay using AI
    const gradingResult = await gradeEssay(gradingRequest)
    
    // Store grading result
    const resultId = await storeGradingResult(db, essayId, sessionId, gradingResult)
    
    // Update submission with grading result
    await db.prepare(
      'UPDATE student_submissions SET graded = 1, grade_result_id = ? WHERE id = ?'
    ).bind(resultId, submissionId).run()
    
    return c.json({
      success: true,
      submission_id: submissionId,
      result_id: resultId,
      grading_result: gradingResult
    })
  } catch (error) {
    console.error('Error grading submission:', error)
    return c.json({ error: 'Failed to grade submission', details: String(error) }, 500)
  }
})

/**
 * GET /api/grading-history - Get user's grading history
 */
app.get('/api/grading-history', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user // Return error response
    
    const db = c.env.DB
    
    // Get all graded submissions for user's assignments
    const result = await db.prepare(
      `SELECT 
        s.id as submission_id,
        s.student_name,
        s.submitted_at,
        a.title as assignment_title,
        a.grade_level,
        gr.total_score as overall_score,
        gr.overall_comment as overall_feedback,
        gr.graded_at
       FROM student_submissions s
       JOIN assignments a ON s.assignment_id = a.id
       LEFT JOIN grading_results gr ON s.grade_result_id = gr.id
       WHERE a.user_id = ? AND s.graded = 1
       ORDER BY s.submitted_at DESC`
    ).bind(user.id).all()
    
    return c.json(result.results || [])
  } catch (error) {
    console.error('Error fetching grading history:', error)
    return c.json({ error: 'Failed to fetch grading history' }, 500)
  }
})

/**
 * GET /api/resources/:category - Get resource posts by category
 */
app.get('/api/resources/:category', async (c) => {
  try {
    const category = c.req.param('category')
    const db = c.env.DB
    
    const result = await db.prepare(
      'SELECT * FROM resource_posts WHERE category = ? ORDER BY created_at DESC'
    ).bind(category).all()
    
    return c.json(result.results || [])
  } catch (error) {
    console.error('Error fetching resources:', error)
    return c.json({ error: 'Failed to fetch resources' }, 500)
  }
})

/**
 * GET /api/resource/:id - Get single resource post
 */
app.get('/api/resource/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    const result = await db.prepare(
      'SELECT * FROM resource_posts WHERE id = ?'
    ).bind(id).first()
    
    if (!result) {
      return c.json({ error: 'Resource not found' }, 404)
    }
    
    return c.json(result)
  } catch (error) {
    console.error('Error fetching resource:', error)
    return c.json({ error: 'Failed to fetch resource' }, 500)
  }
})

/**
 * POST /api/admin/resource - Create new resource post (admin only)
 */
app.post('/api/admin/resource', async (c) => {
  try {
    const { category, title, content, author } = await c.req.json()
    const db = c.env.DB
    
    const result = await db.prepare(
      'INSERT INTO resource_posts (category, title, content, author) VALUES (?, ?, ?, ?)'
    ).bind(category, title, content, author || 'Admin').run()
    
    return c.json({ success: true, id: result.meta.last_row_id })
  } catch (error) {
    console.error('Error creating resource:', error)
    return c.json({ error: 'Failed to create resource' }, 500)
  }
})

/**
 * PUT /api/admin/resource/:id - Update resource post (admin only)
 */
app.put('/api/admin/resource/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const { title, content, author } = await c.req.json()
    const db = c.env.DB
    
    await db.prepare(
      'UPDATE resource_posts SET title = ?, content = ?, author = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(title, content, author, id).run()
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Error updating resource:', error)
    return c.json({ error: 'Failed to update resource' }, 500)
  }
})

/**
 * DELETE /api/admin/resource/:id - Delete resource post (admin only)
 */
app.delete('/api/admin/resource/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    await db.prepare('DELETE FROM resource_posts WHERE id = ?').bind(id).run()
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Error deleting resource:', error)
    return c.json({ error: 'Failed to delete resource' }, 500)
  }
})

// Frontend Route
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AI 논술 평가 | 교사를 위한 AI 논술 채점 시스템</title>
        <meta name="description" content="AI로 논술 답안지를 10배 빠르게 채점하세요. 상세하고 실행 가능한 피드백을 받으세요. 1,000개 이상의 학교에서 신뢰합니다.">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  primary: '#1e3a8a',
                  secondary: '#3b82f6',
                  accent: '#f59e0b',
                  navy: {
                    50: '#f0f4ff',
                    100: '#e0e9ff',
                    200: '#c7d7ff',
                    300: '#a4b8ff',
                    400: '#8195ff',
                    500: '#6366f1',
                    600: '#4f46e5',
                    700: '#4338ca',
                    800: '#3730a3',
                    900: '#1e3a8a',
                  }
                }
              }
            }
          }
        </script>
        <style>
          .hero-gradient {
            background: linear-gradient(135deg, #1e3a8a 0%, #3730a3 100%);
          }
          .feature-card {
            transition: transform 0.3s ease, box-shadow 0.3s ease;
          }
          .feature-card:hover {
            transform: translateY(-8px);
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
          }
          .criterion-card {
            transition: all 0.3s ease;
          }
          .criterion-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          .score-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 2.5rem;
            height: 2.5rem;
            border-radius: 9999px;
            font-weight: bold;
            font-size: 1.125rem;
          }
          .loading-spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #1e3a8a;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
          }
          .material-item {
            transition: all 0.3s ease;
          }
          .material-item:hover {
            background-color: #f9fafb;
          }
          .rubric-tab {
            transition: all 0.3s ease;
          }
          .rubric-tab.active {
            background-color: #1e3a8a;
            color: white;
          }
          .essay-input-tab {
            transition: all 0.3s ease;
          }
          .essay-input-tab.active {
            background-color: #1e3a8a;
            color: white;
            border-color: #1e3a8a;
          }
          .dropdown {
            position: relative;
            display: inline-block;
          }
          .dropdown-content {
            display: none;
            position: absolute;
            background-color: white;
            min-width: 200px;
            box-shadow: 0 8px 16px 0 rgba(0,0,0,0.2);
            z-index: 100;
            border-radius: 8px;
            overflow: hidden;
            margin-top: 8px;
          }
          .dropdown:hover .dropdown-content {
            display: block;
          }
          .dropdown-content a {
            color: #374151;
            padding: 12px 16px;
            text-decoration: none;
            display: block;
            transition: background-color 0.2s;
          }
          .dropdown-content a:hover {
            background-color: #f3f4f6;
            color: #1e3a8a;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .result-section {
            animation: fadeIn 0.5s ease-in;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .step-number {
            width: 60px;
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: bold;
            background: linear-gradient(135deg, #1e3a8a 0%, #3730a3 100%);
            color: white;
            border-radius: 50%;
            margin: 0 auto 1rem;
          }
        </style>
    </head>
    <body class="bg-white">
        <!-- Navigation -->
        <nav class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16 items-center">
                    <div class="flex items-center">
                        <span class="text-2xl font-bold text-navy-900">
                            <i class="fas fa-graduation-cap mr-2"></i>AI 논술 평가
                        </span>
                    </div>
                    <div class="hidden md:flex items-center space-x-8">
                        <a href="#how-it-works" class="text-gray-700 hover:text-navy-700 font-medium">작동 방식</a>
                        <a href="#features" class="text-gray-700 hover:text-navy-700 font-medium">기능</a>
                        <div class="dropdown">
                            <a href="#resources" class="text-gray-700 hover:text-navy-700 font-medium cursor-pointer">
                                평가 관련 자료 <i class="fas fa-chevron-down text-xs ml-1"></i>
                            </a>
                            <div class="dropdown-content">
                                <a href="/resources/rubric"><i class="fas fa-clipboard-list mr-2 text-navy-700"></i>루브릭</a>
                                <a href="/resources/evaluation"><i class="fas fa-book mr-2 text-navy-700"></i>논술 평가 자료</a>
                            </div>
                        </div>
                        <a href="#faq" class="text-gray-700 hover:text-navy-700 font-medium">자주 묻는 질문</a>
                        <a href="/pricing" class="text-gray-700 hover:text-navy-700 font-medium">가격</a>
                        <a href="/my-page" class="text-gray-700 hover:text-navy-700 font-medium">나의 페이지</a>
                        <a href="/login" class="text-gray-700 hover:text-navy-700 font-medium">로그인</a>
                        <a href="/signup" class="bg-navy-900 text-white px-6 py-2 rounded-lg font-semibold hover:bg-navy-800 hover:shadow-lg transition">
                            무료로 시작하기
                        </a>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Hero Section -->
        <section class="hero-gradient text-white py-20">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <div class="mb-6">
                    <span class="inline-block bg-white/20 backdrop-blur px-4 py-2 rounded-full text-sm font-semibold">
                        1,000개 이상의 학교와 대학에서 신뢰하는 서비스
                    </span>
                </div>
                <h1 class="text-5xl md:text-6xl font-bold mb-6 leading-tight">
                    AI로 논술 답안지를<br/>10배 빠르게 채점
                </h1>
                <p class="text-xl md:text-2xl mb-8 text-white/90 max-w-3xl mx-auto">
                    학생 논술에 대한 상세하고 실행 가능한 피드백을 몇 분 안에 받으세요. 
                    일관되고 고품질의 피드백을 제공하면서 시간을 절약하세요.
                </p>
                <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <button onclick="scrollToGrader()" class="bg-white text-navy-900 px-8 py-4 rounded-lg font-bold text-lg hover:shadow-2xl transition transform hover:scale-105">
                        <i class="fas fa-rocket mr-2"></i>무료로 채점 시작하기
                    </button>
                    <button onclick="scrollToDemo()" class="bg-navy-800/50 backdrop-blur text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-navy-800/70 transition">
                        <i class="fas fa-play-circle mr-2"></i>작동 방식 보기
                    </button>
                </div>
                <p class="mt-6 text-white/80 text-sm">
                    <i class="fas fa-check-circle mr-2"></i>신용카드 불필요 • 무료 플랜 이용 가능
                </p>
            </div>
        </section>

        <!-- Trust Bar -->
        <section class="bg-gray-50 py-8 border-b">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                    <div>
                        <div class="text-3xl font-bold text-navy-700">10배</div>
                        <div class="text-sm text-gray-600">빠른 채점</div>
                    </div>
                    <div>
                        <div class="text-3xl font-bold text-navy-700">1,000+</div>
                        <div class="text-sm text-gray-600">신뢰하는 학교</div>
                    </div>
                    <div>
                        <div class="text-3xl font-bold text-navy-700">&lt;4%</div>
                        <div class="text-sm text-gray-600">점수 편차</div>
                    </div>
                    <div>
                        <div class="text-3xl font-bold text-navy-700">100%</div>
                        <div class="text-sm text-gray-600">프라이버시 우선</div>
                    </div>
                </div>
            </div>
        </section>

        <!-- How It Works -->
        <section id="how-it-works" class="py-20 bg-white">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="text-center mb-16">
                    <h2 class="text-4xl font-bold text-gray-900 mb-4">작동 방식</h2>
                    <p class="text-xl text-gray-600">더 나은, 더 빠른 채점을 위한 세 가지 간단한 단계</p>
                </div>
                <div class="grid md:grid-cols-3 gap-12">
                    <div class="text-center">
                        <div class="step-number">1</div>
                        <div class="mb-4">
                            <i class="fas fa-file-upload text-5xl text-navy-700"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">루브릭 업로드</h3>
                        <p class="text-gray-600">채점 루브릭을 생성하거나 가져오세요. 400개 이상의 사전 제작 루브릭 중에서 선택하거나 직접 맞춤 설정하세요.</p>
                    </div>
                    <div class="text-center">
                        <div class="step-number">2</div>
                        <div class="mb-4">
                            <i class="fas fa-upload text-5xl text-navy-700"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">논술 업로드</h3>
                        <p class="text-gray-600">학생 논술을 개별적으로 또는 대량으로 업로드하세요. 다양한 형식과 언어를 지원합니다.</p>
                    </div>
                    <div class="text-center">
                        <div class="step-number">3</div>
                        <div class="mb-4">
                            <i class="fas fa-download text-5xl text-navy-700"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">결과 다운로드</h3>
                        <p class="text-gray-600">점수, 코멘트 및 제안이 포함된 상세한 피드백을 받으세요. LMS로 내보내거나 PDF로 다운로드하세요.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- Features Section -->
        <section id="features" class="py-20 bg-gray-50">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="text-center mb-16">
                    <h2 class="text-4xl font-bold text-gray-900 mb-4">강력한 기능</h2>
                    <p class="text-xl text-gray-600">논술을 효과적으로 채점하는 데 필요한 모든 것</p>
                </div>
                <div class="grid md:grid-cols-3 gap-8">
                    <div class="feature-card bg-white p-6 rounded-xl shadow-md">
                        <div class="w-12 h-12 bg-navy-100 rounded-lg flex items-center justify-center mb-4">
                            <i class="fas fa-bolt text-2xl text-navy-700"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">초고속 채점</h3>
                        <p class="text-gray-600">전체 학급을 몇 분 안에 채점하세요. 매주 몇 시간의 채점 시간을 절약하세요.</p>
                    </div>
                    <div class="feature-card bg-white p-6 rounded-xl shadow-md">
                        <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                            <i class="fas fa-chart-line text-2xl text-blue-600"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">상세한 피드백</h3>
                        <p class="text-gray-600">문법, 구조, 증거 및 분석에 대한 실행 가능한 코멘트를 제공합니다.</p>
                    </div>
                    <div class="feature-card bg-white p-6 rounded-xl shadow-md">
                        <div class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                            <i class="fas fa-balance-scale text-2xl text-indigo-600"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">일관된 채점</h3>
                        <p class="text-gray-600">편향을 제거하고 모든 학생에게 공정하고 표준에 부합하는 평가를 보장합니다.</p>
                    </div>
                    <div class="feature-card bg-white p-6 rounded-xl shadow-md">
                        <div class="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                            <i class="fas fa-clipboard-check text-2xl text-yellow-600"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">맞춤형 루브릭</h3>
                        <p class="text-gray-600">400개 이상의 사전 제작 루브릭 또는 직접 만들기. 국가 교육과정 표준 지원.</p>
                    </div>
                    <div class="feature-card bg-white p-6 rounded-xl shadow-md">
                        <div class="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                            <i class="fas fa-shield-alt text-2xl text-red-600"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">AI 탐지</h3>
                        <p class="text-gray-600">AI 생성 텍스트 및 표절을 탐지하여 학문적 무결성을 보장합니다.</p>
                    </div>
                    <div class="feature-card bg-white p-6 rounded-xl shadow-md">
                        <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                            <i class="fas fa-globe text-2xl text-purple-600"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">다국어 지원</h3>
                        <p class="text-gray-600">한국어, 영어, 스페인어, 프랑스어, 독일어 등 다양한 언어로 논술을 채점하세요.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- Grading Interface -->
        <section id="grader" class="py-20 bg-white">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="text-center mb-12">
                    <h2 class="text-4xl font-bold text-gray-900 mb-4">지금 사용해보기</h2>
                    <p class="text-xl text-gray-600">몇 초 만에 첫 논술 채점하기</p>
                </div>

                <!-- Main Grading Interface -->
                <div id="mainInterface">
                    <div class="bg-white rounded-xl shadow-2xl p-8 border border-gray-200">
                        <form id="gradingForm" class="space-y-6">
                            <div class="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-file-alt mr-2 text-navy-700"></i>과제 지시문
                                    </label>
                                    <textarea 
                                        id="assignmentPrompt" 
                                        rows="4" 
                                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent"
                                        placeholder="과제 내용을 입력하세요..."
                                        required
                                    ></textarea>
                                    
                                    <!-- Reference Materials Section -->
                                    <div class="mt-4">
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                                            <i class="fas fa-paperclip mr-2 text-navy-700"></i>참고 자료 첨부 (선택사항)
                                        </label>
                                        <div id="materialsContainer" class="space-y-2">
                                            <!-- Materials will be added dynamically -->
                                        </div>
                                        <button 
                                            type="button" 
                                            onclick="addMaterial()" 
                                            class="mt-2 px-4 py-2 bg-navy-50 text-navy-700 rounded-lg hover:bg-navy-100 transition text-sm border border-navy-200"
                                        >
                                            <i class="fas fa-plus mr-2"></i>자료 추가 (최대 11개)
                                        </button>
                                        <p class="text-xs text-gray-500 mt-1">문서, 이미지, 링크 등을 첨부할 수 있습니다</p>
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-user-graduate mr-2 text-navy-700"></i>학년 수준
                                    </label>
                                    <select 
                                        id="gradeLevel" 
                                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent mb-4"
                                        required
                                    >
                                        <option value="">학년을 선택하세요</option>
                                        <option value="초등학교">초등학교</option>
                                        <option value="중학교 1학년">중학교 1학년</option>
                                        <option value="중학교 2학년">중학교 2학년</option>
                                        <option value="중학교 3학년">중학교 3학년</option>
                                        <option value="고등학교 1학년">고등학교 1학년</option>
                                        <option value="고등학교 2학년">고등학교 2학년</option>
                                        <option value="고등학교 3학년">고등학교 3학년</option>
                                    </select>
                                    
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-clipboard-list mr-2 text-navy-700"></i>루브릭 기준
                                    </label>
                                    
                                    <!-- Rubric Type Selection -->
                                    <div class="flex gap-2 mb-4">
                                        <button 
                                            type="button" 
                                            id="platformRubricBtn"
                                            onclick="switchRubricType('platform')" 
                                            class="rubric-tab flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold transition active"
                                        >
                                            플랫폼 루브릭
                                        </button>
                                        <button 
                                            type="button" 
                                            id="customRubricBtn"
                                            onclick="switchRubricType('custom')" 
                                            class="rubric-tab flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold transition"
                                        >
                                            나의 루브릭
                                        </button>
                                    </div>
                                    
                                    <!-- Platform Rubric -->
                                    <div id="platformRubricContainer">
                                        <select 
                                            id="platformRubric" 
                                            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent"
                                        >
                                            <option value="standard">표준 논술 루브릭 (4개 기준)</option>
                                            <option value="detailed">상세 논술 루브릭 (6개 기준)</option>
                                            <option value="simple">간단 논술 루브릭 (3개 기준)</option>
                                        </select>
                                    </div>
                                    
                                    <!-- Custom Rubric -->
                                    <div id="customRubricContainer" class="hidden">
                                        <div id="rubricContainer" class="space-y-2 max-h-64 overflow-y-auto mb-2">
                                            <!-- Criteria will be added dynamically -->
                                        </div>
                                        <button 
                                            type="button" 
                                            onclick="addCriterion()" 
                                            class="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm"
                                        >
                                            <i class="fas fa-plus mr-2"></i>기준 추가
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-pen-fancy mr-2 text-navy-700"></i>학생 논술
                                </label>
                                
                                <!-- Essay Input Type Tabs -->
                                <div class="flex gap-2 mb-4">
                                    <button 
                                        type="button" 
                                        id="textInputBtn"
                                        onclick="switchEssayInputType('text')" 
                                        class="essay-input-tab flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold transition active"
                                    >
                                        <i class="fas fa-keyboard mr-2"></i>텍스트 입력
                                    </button>
                                    <button 
                                        type="button" 
                                        id="fileInputBtn"
                                        onclick="switchEssayInputType('file')" 
                                        class="essay-input-tab flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold transition"
                                    >
                                        <i class="fas fa-file-upload mr-2"></i>파일 선택
                                    </button>
                                </div>
                                
                                <!-- Text Input Container -->
                                <div id="textInputContainer">
                                    <textarea 
                                        id="essayText" 
                                        rows="10" 
                                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent font-mono text-sm"
                                        placeholder="학생이 작성한 논술을 여기에 붙여넣으세요..."
                                    ></textarea>
                                </div>
                                
                                <!-- File Input Container -->
                                <div id="fileInputContainer" class="hidden">
                                    <div class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-navy-500 transition">
                                        <input 
                                            type="file" 
                                            id="essayFile" 
                                            accept="image/*,.pdf,.doc,.docx,.txt"
                                            class="hidden"
                                            onchange="handleFileSelect(event)"
                                        />
                                        <label for="essayFile" class="cursor-pointer">
                                            <div class="mb-4">
                                                <i class="fas fa-cloud-upload-alt text-6xl text-navy-700"></i>
                                            </div>
                                            <p class="text-lg font-semibold text-gray-700 mb-2">파일을 선택하거나 드래그하세요</p>
                                            <p class="text-sm text-gray-500 mb-4">
                                                지원 형식: 이미지 (JPG, PNG), PDF, Word 문서, 텍스트 파일
                                            </p>
                                            <span class="inline-block bg-navy-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-navy-800 transition">
                                                <i class="fas fa-folder-open mr-2"></i>파일 찾기
                                            </span>
                                        </label>
                                    </div>
                                    
                                    <!-- File Preview -->
                                    <div id="filePreview" class="hidden mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                        <div class="flex items-center justify-between">
                                            <div class="flex items-center">
                                                <i class="fas fa-file-alt text-3xl text-navy-700 mr-3"></i>
                                                <div>
                                                    <p id="fileName" class="font-semibold text-gray-800"></p>
                                                    <p id="fileSize" class="text-sm text-gray-500"></p>
                                                </div>
                                            </div>
                                            <button 
                                                type="button" 
                                                onclick="clearFile()" 
                                                class="text-red-500 hover:text-red-700"
                                            >
                                                <i class="fas fa-times-circle text-2xl"></i>
                                            </button>
                                        </div>
                                        <!-- Image preview (for image files) -->
                                        <div id="imagePreview" class="hidden mt-4">
                                            <img id="previewImg" src="" alt="Preview" class="max-w-full h-auto rounded-lg border border-gray-300" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="flex justify-center">
                                <button 
                                    type="submit" 
                                    class="bg-navy-900 text-white px-12 py-4 rounded-lg font-bold text-lg hover:bg-navy-800 hover:shadow-2xl transition transform hover:scale-105"
                                >
                                    <i class="fas fa-magic mr-2"></i>AI로 논술 채점하기
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- Loading Indicator -->
                <div id="loadingIndicator" class="hidden text-center py-20">
                    <div class="loading-spinner mx-auto mb-6"></div>
                    <p class="text-2xl font-semibold text-gray-700">논술을 분석하는 중...</p>
                    <p class="text-gray-500 mt-2">일반적으로 5-10초 소요됩니다</p>
                </div>

                <!-- Results Display -->
                <div id="resultsContainer" class="hidden"></div>
            </div>
        </section>

        <!-- Privacy Section -->
        <section class="py-16 bg-gray-50">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="text-center mb-12">
                    <h2 class="text-3xl font-bold text-gray-900 mb-4">프라이버시를 최우선으로</h2>
                    <p class="text-xl text-gray-600">여러분의 데이터는 안전하게 보호됩니다</p>
                </div>
                <div class="grid md:grid-cols-4 gap-8">
                    <div class="text-center">
                        <i class="fas fa-lock text-4xl text-navy-700 mb-4"></i>
                        <h3 class="font-bold mb-2">개인정보 보호법 준수</h3>
                        <p class="text-sm text-gray-600">학생 개인정보 보호법 완전 준수</p>
                    </div>
                    <div class="text-center">
                        <i class="fas fa-shield-alt text-4xl text-navy-600 mb-4"></i>
                        <h3 class="font-bold mb-2">AES-256 암호화</h3>
                        <p class="text-sm text-gray-600">모든 데이터에 은행급 보안 적용</p>
                    </div>
                    <div class="text-center">
                        <i class="fas fa-user-shield text-4xl text-navy-600 mb-4"></i>
                        <h3 class="font-bold mb-2">데이터 소유권</h3>
                        <p class="text-sm text-gray-600">여러분의 데이터, 언제든지 삭제 가능</p>
                    </div>
                    <div class="text-center">
                        <i class="fas fa-certificate text-4xl text-navy-700 mb-4"></i>
                        <h3 class="font-bold mb-2">SOC 2 Type I</h3>
                        <p class="text-sm text-gray-600">인증된 보안 표준</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- FAQ Section -->
        <section id="faq" class="py-20 bg-white">
            <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="text-center mb-12">
                    <h2 class="text-4xl font-bold text-gray-900 mb-4">자주 묻는 질문</h2>
                </div>
                <div class="space-y-4">
                    <details class="bg-gray-50 p-6 rounded-lg">
                        <summary class="font-bold cursor-pointer">AI 채점은 얼마나 정확한가요?</summary>
                        <p class="mt-4 text-gray-600">우리 AI는 인간 채점자와 비교하여 4% 미만의 편차를 달성하며, 학문적 사용에 필요한 실질적 일치 임계값(QWK 0.61+)을 충족합니다.</p>
                    </details>
                    <details class="bg-gray-50 p-6 rounded-lg">
                        <summary class="font-bold cursor-pointer">루브릭을 맞춤 설정할 수 있나요?</summary>
                        <p class="mt-4 text-gray-600">네! 맞춤형 루브릭을 만들거나 국가 교육과정 표준에 맞춘 400개 이상의 사전 제작 루브릭 중에서 선택할 수 있습니다.</p>
                    </details>
                    <details class="bg-gray-50 p-6 rounded-lg">
                        <summary class="font-bold cursor-pointer">무료 플랜이 있나요?</summary>
                        <p class="mt-4 text-gray-600">네! 무료 플랜에는 월 25개의 논술이 포함됩니다. 유료 플랜은 무제한 채점을 위해 월 19,900원부터 시작합니다.</p>
                    </details>
                    <details class="bg-gray-50 p-6 rounded-lg">
                        <summary class="font-bold cursor-pointer">내 학습 관리 시스템(LMS)과 연동되나요?</summary>
                        <p class="mt-4 text-gray-600">네! Google Classroom, Canvas 및 Schoology와 통합됩니다. 성적과 피드백을 LMS에 직접 동기화할 수 있습니다.</p>
                    </details>
                </div>
            </div>
        </section>

        <!-- CTA Section -->
        <section class="hero-gradient text-white py-20">
            <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <h2 class="text-4xl font-bold mb-6">매주 몇 시간을 절약할 준비가 되셨나요?</h2>
                <p class="text-xl mb-8">AI 논술 평가를 사용하는 1,000개 이상의 학교에 합류하세요</p>
                <button onclick="scrollToGrader()" class="bg-white text-navy-900 px-12 py-4 rounded-lg font-bold text-lg hover:shadow-2xl transition transform hover:scale-105">
                    <i class="fas fa-rocket mr-2"></i>무료로 채점 시작하기
                </button>
                <p class="mt-6 text-white/80 text-sm">신용카드 불필요 • 무료 플랜 이용 가능 • 언제든지 취소 가능</p>
            </div>
        </section>

        <!-- Footer -->
        <footer class="bg-gray-900 text-white py-12">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="grid md:grid-cols-4 gap-8">
                    <div>
                        <h3 class="font-bold text-xl mb-4">AI 논술 평가</h3>
                        <p class="text-gray-400 text-sm">교사를 위한 AI 기반 논술 채점 시스템</p>
                    </div>
                    <div>
                        <h4 class="font-bold mb-4">제품</h4>
                        <ul class="space-y-2 text-gray-400 text-sm">
                            <li><a href="#" class="hover:text-white">기능</a></li>
                            <li><a href="#" class="hover:text-white">가격</a></li>
                            <li><a href="#" class="hover:text-white">학교 계정</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 class="font-bold mb-4">지원</h4>
                        <ul class="space-y-2 text-gray-400 text-sm">
                            <li><a href="#" class="hover:text-white">도움말 센터</a></li>
                            <li><a href="#" class="hover:text-white">문의하기</a></li>
                            <li><a href="#" class="hover:text-white">데모 예약</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 class="font-bold mb-4">법적 고지</h4>
                        <ul class="space-y-2 text-gray-400 text-sm">
                            <li><a href="#" class="hover:text-white">개인정보 처리방침</a></li>
                            <li><a href="#" class="hover:text-white">이용 약관</a></li>
                            <li><a href="#" class="hover:text-white">개인정보 보호 규정</a></li>
                        </ul>
                    </div>
                </div>
                <div class="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 text-sm">
                    <p>© 2025 AI 논술 평가. All rights reserved.</p>
                </div>
            </div>
        </footer>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

// Resource List Page
app.get('/resources/:category', async (c) => {
  const category = c.req.param('category')
  const categoryName = category === 'rubric' ? '루브릭' : '논술 평가 자료'
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${categoryName} | AI 논술 평가</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  navy: {
                    50: '#f0f4ff',
                    100: '#e0e9ff',
                    200: '#c7d7ff',
                    300: '#a4b8ff',
                    400: '#8195ff',
                    500: '#6366f1',
                    600: '#4f46e5',
                    700: '#4338ca',
                    800: '#3730a3',
                    900: '#1e3a8a',
                  }
                }
              }
            }
          }
        </script>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16 items-center">
                    <a href="/" class="flex items-center">
                        <span class="text-2xl font-bold text-navy-900">
                            <i class="fas fa-graduation-cap mr-2"></i>AI 논술 평가
                        </span>
                    </a>
                    <div class="flex items-center space-x-4">
                        <a href="/" class="text-gray-700 hover:text-navy-700 font-medium">홈</a>
                        <a href="/admin" class="text-gray-700 hover:text-navy-700 font-medium">관리자</a>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div class="mb-8">
                <h1 class="text-4xl font-bold text-gray-900 mb-4">${categoryName}</h1>
                <p class="text-xl text-gray-600">교육 현장에 도움이 되는 자료를 확인하세요</p>
            </div>

            <div id="postsList" class="space-y-6">
                <p class="text-gray-500 text-center py-8">자료를 불러오는 중...</p>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
          async function loadPosts() {
            try {
              const response = await axios.get('/api/resources/${category}');
              const posts = response.data;
              
              const container = document.getElementById('postsList');
              
              if (posts.length === 0) {
                container.innerHTML = \`
                  <div class="text-center py-12">
                    <i class="fas fa-inbox text-6xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500 text-lg">아직 등록된 자료가 없습니다.</p>
                  </div>
                \`;
                return;
              }
              
              container.innerHTML = posts.map(post => \`
                <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-xl transition">
                  <a href="/resource/\${post.id}">
                    <h2 class="text-2xl font-bold text-gray-900 mb-3 hover:text-navy-700 transition">\${post.title}</h2>
                    <div class="flex items-center text-sm text-gray-500 mb-4">
                      <i class="fas fa-user mr-2"></i>
                      <span>\${post.author || 'Admin'}</span>
                      <span class="mx-2">•</span>
                      <i class="fas fa-calendar mr-2"></i>
                      <span>\${new Date(post.created_at).toLocaleDateString('ko-KR')}</span>
                    </div>
                    <p class="text-gray-700 line-clamp-3">\${post.content.substring(0, 200)}...</p>
                    <div class="mt-4">
                      <span class="inline-block bg-navy-100 text-navy-800 px-3 py-1 rounded-full text-sm font-semibold">
                        자세히 보기 →
                      </span>
                    </div>
                  </a>
                </div>
              \`).join('');
            } catch (error) {
              console.error('Error loading posts:', error);
              document.getElementById('postsList').innerHTML = \`
                <div class="text-center py-8 text-red-600">
                  <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                  <p>자료를 불러오는데 실패했습니다.</p>
                </div>
              \`;
            }
          }
          
          loadPosts();
        </script>
    </body>
    </html>
  `)
})

// Resource Detail Page
app.get('/resource/:id', async (c) => {
  const id = c.req.param('id')
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>자료 상세 | AI 논술 평가</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  navy: {
                    50: '#f0f4ff',
                    100: '#e0e9ff',
                    200: '#c7d7ff',
                    300: '#a4b8ff',
                    400: '#8195ff',
                    500: '#6366f1',
                    600: '#4f46e5',
                    700: '#4338ca',
                    800: '#3730a3',
                    900: '#1e3a8a',
                  }
                }
              }
            }
          }
        </script>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16 items-center">
                    <a href="/" class="flex items-center">
                        <span class="text-2xl font-bold text-navy-900">
                            <i class="fas fa-graduation-cap mr-2"></i>AI 논술 평가
                        </span>
                    </a>
                    <div class="flex items-center space-x-4">
                        <a href="/" class="text-gray-700 hover:text-navy-700 font-medium">홈</a>
                        <button onclick="history.back()" class="text-gray-700 hover:text-navy-700 font-medium">
                          <i class="fas fa-arrow-left mr-2"></i>목록으로
                        </button>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div id="postDetail">
                <p class="text-gray-500 text-center py-8">자료를 불러오는 중...</p>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
          async function loadPost() {
            try {
              const response = await axios.get('/api/resource/${id}');
              const post = response.data;
              
              const categoryName = post.category === 'rubric' ? '루브릭' : '논술 평가 자료';
              
              document.getElementById('postDetail').innerHTML = \`
                <div class="bg-white rounded-xl shadow-lg p-8">
                  <div class="mb-6">
                    <span class="inline-block bg-navy-100 text-navy-800 px-3 py-1 rounded-full text-sm font-semibold mb-4">
                      \${categoryName}
                    </span>
                    <h1 class="text-4xl font-bold text-gray-900 mb-4">\${post.title}</h1>
                    <div class="flex items-center text-sm text-gray-500">
                      <i class="fas fa-user mr-2"></i>
                      <span>\${post.author || 'Admin'}</span>
                      <span class="mx-2">•</span>
                      <i class="fas fa-calendar mr-2"></i>
                      <span>\${new Date(post.created_at).toLocaleDateString('ko-KR')}</span>
                      <span class="mx-2">•</span>
                      <i class="fas fa-clock mr-2"></i>
                      <span>\${new Date(post.updated_at).toLocaleDateString('ko-KR')} 수정</span>
                    </div>
                  </div>
                  
                  <div class="border-t border-gray-200 pt-8">
                    <div class="prose prose-lg max-w-none">
                      \${post.content.split('\\n').map(p => \`<p class="mb-4 text-gray-700 leading-relaxed">\${p}</p>\`).join('')}
                    </div>
                  </div>
                  
                  <div class="mt-8 pt-6 border-t border-gray-200 flex justify-between">
                    <button onclick="history.back()" class="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition">
                      <i class="fas fa-arrow-left mr-2"></i>목록으로
                    </button>
                    <a href="/admin/edit/\${post.id}" class="px-6 py-3 bg-navy-900 text-white rounded-lg font-semibold hover:bg-navy-800 transition">
                      <i class="fas fa-edit mr-2"></i>수정하기
                    </a>
                  </div>
                </div>
              \`;
            } catch (error) {
              console.error('Error loading post:', error);
              document.getElementById('postDetail').innerHTML = \`
                <div class="text-center py-8 text-red-600">
                  <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                  <p>자료를 불러오는데 실패했습니다.</p>
                </div>
              \`;
            }
          }
          
          loadPost();
        </script>
    </body>
    </html>
  `)
})

// Login Page
app.get('/login', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>로그인 | AI 논술 평가</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  navy: {
                    50: '#f0f4ff',
                    700: '#4338ca',
                    800: '#3730a3',
                    900: '#1e3a8a',
                  }
                }
              }
            }
          }
        </script>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-white border-b border-gray-200">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16 items-center">
                    <a href="/" class="flex items-center">
                        <span class="text-2xl font-bold text-navy-900">
                            <i class="fas fa-graduation-cap mr-2"></i>AI 논술 평가
                        </span>
                    </a>
                </div>
            </div>
        </nav>

        <!-- Login Form -->
        <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div class="max-w-md w-full space-y-8">
                <div>
                    <h2 class="mt-6 text-center text-3xl font-bold text-gray-900">
                        로그인
                    </h2>
                    <p class="mt-2 text-center text-sm text-gray-600">
                        또는
                        <a href="/signup" class="font-medium text-navy-700 hover:text-navy-800">
                            새 계정 만들기
                        </a>
                    </p>
                </div>
                <form class="mt-8 space-y-6" onsubmit="handleLogin(event)">
                    <div class="rounded-md shadow-sm -space-y-px">
                        <div>
                            <label for="email" class="sr-only">이메일</label>
                            <input id="email" name="email" type="email" required 
                                   class="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-navy-700 focus:border-navy-700 focus:z-10 sm:text-sm" 
                                   placeholder="이메일 주소">
                        </div>
                        <div>
                            <label for="password" class="sr-only">비밀번호</label>
                            <input id="password" name="password" type="password" required 
                                   class="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-navy-700 focus:border-navy-700 focus:z-10 sm:text-sm" 
                                   placeholder="비밀번호">
                        </div>
                    </div>

                    <div class="flex items-center justify-between">
                        <div class="flex items-center">
                            <input id="remember-me" name="remember-me" type="checkbox" 
                                   class="h-4 w-4 text-navy-700 focus:ring-navy-700 border-gray-300 rounded">
                            <label for="remember-me" class="ml-2 block text-sm text-gray-900">
                                로그인 상태 유지
                            </label>
                        </div>

                        <div class="text-sm">
                            <a href="/forgot-password" class="font-medium text-navy-700 hover:text-navy-800">
                                비밀번호 찾기
                            </a>
                        </div>
                    </div>

                    <div>
                        <button type="submit" 
                                class="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-navy-900 hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-navy-700">
                            <span class="absolute left-0 inset-y-0 flex items-center pl-3">
                                <i class="fas fa-lock text-navy-700 group-hover:text-navy-800"></i>
                            </span>
                            로그인
                        </button>
                    </div>
                </form>

                <div class="mt-6">
                    <div class="relative">
                        <div class="absolute inset-0 flex items-center">
                            <div class="w-full border-t border-gray-300"></div>
                        </div>
                        <div class="relative flex justify-center text-sm">
                            <span class="px-2 bg-gray-50 text-gray-500">또는 다음으로 계속하기</span>
                        </div>
                    </div>

                    <div class="mt-6 grid grid-cols-2 gap-3">
                        <button class="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                            <i class="fab fa-google text-red-500 mr-2"></i>
                            Google
                        </button>
                        <button class="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                            <i class="fas fa-comment text-yellow-400 mr-2"></i>
                            Kakao
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
          async function handleLogin(event) {
            event.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            try {
              const response = await axios.post('/api/auth/login', {
                email,
                password
              });
              
              if (response.data.success) {
                // Store session ID in localStorage
                localStorage.setItem('session_id', response.data.session_id);
                localStorage.setItem('user_name', response.data.user.name);
                localStorage.setItem('user_email', response.data.user.email);
                
                alert(\`환영합니다, \${response.data.user.name}님!\`);
                window.location.href = '/my-page';
              }
            } catch (error) {
              alert('로그인 실패: ' + (error.response?.data?.error || error.message));
            }
          }
        </script>
    </body>
    </html>
  `)
})

// Signup Page
app.get('/signup', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>회원가입 | AI 논술 평가</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  navy: {
                    50: '#f0f4ff',
                    700: '#4338ca',
                    800: '#3730a3',
                    900: '#1e3a8a',
                  }
                }
              }
            }
          }
        </script>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-white border-b border-gray-200">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16 items-center">
                    <a href="/" class="flex items-center">
                        <span class="text-2xl font-bold text-navy-900">
                            <i class="fas fa-graduation-cap mr-2"></i>AI 논술 평가
                        </span>
                    </a>
                </div>
            </div>
        </nav>

        <!-- Signup Form -->
        <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div class="max-w-md w-full space-y-8">
                <div>
                    <h2 class="mt-6 text-center text-3xl font-bold text-gray-900">
                        회원가입
                    </h2>
                    <p class="mt-2 text-center text-sm text-gray-600">
                        이미 계정이 있으신가요?
                        <a href="/login" class="font-medium text-navy-700 hover:text-navy-800">
                            로그인하기
                        </a>
                    </p>
                </div>
                <form class="mt-8 space-y-6" onsubmit="handleSignup(event)">
                    <div class="rounded-md shadow-sm space-y-3">
                        <div>
                            <label for="name" class="sr-only">이름</label>
                            <input id="name" name="name" type="text" required 
                                   class="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-navy-700 focus:border-navy-700 sm:text-sm" 
                                   placeholder="이름">
                        </div>
                        <div>
                            <label for="email" class="sr-only">이메일</label>
                            <input id="email" name="email" type="email" required 
                                   class="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-navy-700 focus:border-navy-700 sm:text-sm" 
                                   placeholder="이메일 주소">
                        </div>
                        <div>
                            <label for="password" class="sr-only">비밀번호</label>
                            <input id="password" name="password" type="password" required 
                                   class="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-navy-700 focus:border-navy-700 sm:text-sm" 
                                   placeholder="비밀번호 (8자 이상)">
                        </div>
                        <div>
                            <label for="password-confirm" class="sr-only">비밀번호 확인</label>
                            <input id="password-confirm" name="password-confirm" type="password" required 
                                   class="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-navy-700 focus:border-navy-700 sm:text-sm" 
                                   placeholder="비밀번호 확인">
                        </div>
                    </div>

                    <div class="flex items-center">
                        <input id="terms" name="terms" type="checkbox" required
                               class="h-4 w-4 text-navy-700 focus:ring-navy-700 border-gray-300 rounded">
                        <label for="terms" class="ml-2 block text-sm text-gray-900">
                            <a href="/terms" class="text-navy-700 hover:text-navy-800">이용약관</a>과 
                            <a href="/privacy" class="text-navy-700 hover:text-navy-800">개인정보처리방침</a>에 동의합니다
                        </label>
                    </div>

                    <div>
                        <button type="submit" 
                                class="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-navy-900 hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-navy-700">
                            <span class="absolute left-0 inset-y-0 flex items-center pl-3">
                                <i class="fas fa-user-plus text-navy-700 group-hover:text-navy-800"></i>
                            </span>
                            회원가입
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
          async function handleSignup(event) {
            event.preventDefault();
            
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const passwordConfirm = document.getElementById('password-confirm').value;
            
            if (password !== passwordConfirm) {
              alert('비밀번호가 일치하지 않습니다.');
              return;
            }
            
            if (password.length < 8) {
              alert('비밀번호는 8자 이상이어야 합니다.');
              return;
            }
            
            try {
              const response = await axios.post('/api/auth/signup', {
                name,
                email,
                password
              });
              
              if (response.data.success) {
                alert('회원가입 성공! 로그인 페이지로 이동합니다.');
                window.location.href = '/login';
              }
            } catch (error) {
              alert('회원가입 실패: ' + (error.response?.data?.error || error.message));
            }
          }
        </script>
    </body>
    </html>
  `)
})

// Pricing Page
app.get('/pricing', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>가격 | AI 논술 평가</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  navy: {
                    50: '#f0f4ff',
                    100: '#e0e9ff',
                    700: '#4338ca',
                    800: '#3730a3',
                    900: '#1e3a8a',
                  }
                }
              }
            }
          }
        </script>
        <style>
          .pricing-card {
            transition: transform 0.3s ease, box-shadow 0.3s ease;
          }
          .pricing-card:hover {
            transform: translateY(-8px);
          }
          .billing-toggle {
            position: relative;
            display: inline-block;
            width: 60px;
            height: 34px;
          }
          .billing-toggle input {
            opacity: 0;
            width: 0;
            height: 0;
          }
          .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .4s;
            border-radius: 34px;
          }
          .slider:before {
            position: absolute;
            content: "";
            height: 26px;
            width: 26px;
            left: 4px;
            bottom: 4px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
          }
          input:checked + .slider {
            background-color: #6366f1;
          }
          input:checked + .slider:before {
            transform: translateX(26px);
          }
        </style>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16 items-center">
                    <a href="/" class="flex items-center">
                        <span class="text-2xl font-bold text-navy-900">
                            <i class="fas fa-graduation-cap mr-2"></i>AI 논술 평가
                        </span>
                    </a>
                    <div class="flex items-center space-x-4">
                        <a href="/" class="text-gray-700 hover:text-navy-700 font-medium">홈</a>
                        <a href="/login" class="text-gray-700 hover:text-navy-700 font-medium">로그인</a>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Pricing Section -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <!-- Header -->
            <div class="text-center mb-12">
                <span class="inline-block bg-navy-100 text-navy-800 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                    가격
                </span>
                <h1 class="text-4xl font-bold text-gray-900 mb-4">모든 교사를 위한 저렴한 플랜</h1>
                <p class="text-xl text-gray-600 mb-8">
                    채점 생산성을 10배로 늘이고 매일 수 시간을 절약하고자 있는 10만 명의 교육자에 합류하세요.
                </p>
                
                <!-- Billing Toggle -->
                <div class="flex items-center justify-center space-x-4 mb-4">
                    <span id="monthlyLabel" class="text-lg font-semibold text-navy-900">월간 간편결제</span>
                    <label class="billing-toggle">
                        <input type="checkbox" id="billingToggle" onchange="toggleBilling()">
                        <span class="slider"></span>
                    </label>
                    <span id="yearlyLabel" class="text-lg font-semibold text-gray-500">매년</span>
                </div>
                <p class="text-purple-600 font-semibold">
                    <i class="fas fa-tag mr-2"></i>최대 30% 할인
                </p>
            </div>

            <!-- Pricing Cards -->
            <div class="grid md:grid-cols-4 gap-6">
                <!-- Free Plan -->
                <div class="pricing-card bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                    <div class="mb-6">
                        <h3 class="text-xl font-bold text-gray-900 mb-2">기본</h3>
                        <p class="text-sm text-gray-600 mb-4">
                            AI 논술 평가 도구를 테스트해 보고자 하는 분들을 위하여.
                        </p>
                        <div class="text-4xl font-bold text-gray-900 mb-2">무료</div>
                    </div>
                    
                    <ul class="space-y-3 mb-6 text-sm">
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>한달에 25개 논술 답안지 채점</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>한달에 25개 논술문 내용 요약</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>논술 1개당 최대 글자 수는 5,000자</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>논술 평가 피드백 및 평가 결과 보고서 제공</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>간편하게 루브릭 작성</span>
                        </li>
                    </ul>
                    
                    <button onclick="selectPlan('free', 'monthly')" class="w-full bg-navy-900 text-white py-3 rounded-lg font-semibold hover:bg-navy-800 transition">
                        무료로 시작하세요
                    </button>
                </div>

                <!-- Lite Plan -->
                <div class="pricing-card bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                    <div class="mb-6">
                        <h3 class="text-xl font-bold text-gray-900 mb-2">라이트</h3>
                        <p class="text-sm text-gray-600 mb-4">
                            아주 많은 분량의 논술문을 채점하지 않는 분들을 위하여.
                        </p>
                        <div class="monthly-price">
                            <div class="text-4xl font-bold text-gray-900">6,000원<span class="text-lg text-gray-500">/월</span></div>
                        </div>
                        <div class="yearly-price hidden">
                            <div class="text-4xl font-bold text-gray-900">4,500원<span class="text-lg text-gray-500">/월</span></div>
                            <div class="text-sm text-gray-500">(연간 54,000원)</div>
                        </div>
                    </div>
                    
                    <ul class="space-y-3 mb-6 text-sm">
                        <li class="flex items-start">
                            <i class="fas fa-arrow-left text-navy-700 mr-2 mt-1"></i>
                            <span>기본 요금제에서 제공하는 것에 더하여 아래와 같은 서비스가 제공됩니다.</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>한달에 120개 논술 답안지 채점</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>한달에 120개 논술문 내용 요약</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>논술 1개당 최대 글자 수는 10,000자</span>
                        </li>
                    </ul>
                    
                    <button onclick="selectPlan('lite', 'monthly')" class="w-full bg-navy-900 text-white py-3 rounded-lg font-semibold hover:bg-navy-800 transition">
                        무료로 시작하세요
                    </button>
                </div>

                <!-- Pro Plan (Featured) -->
                <div class="pricing-card bg-white rounded-xl shadow-2xl p-6 border-2 border-navy-700 relative">
                    <div class="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <span class="bg-gradient-to-r from-purple-500 to-navy-700 text-white px-6 py-1 rounded-full text-sm font-semibold flex items-center">
                            <i class="fas fa-star mr-2"></i>적극 추천
                        </span>
                    </div>
                    
                    <div class="mb-6 mt-4">
                        <h3 class="text-xl font-bold text-gray-900 mb-2">프로</h3>
                        <p class="text-sm text-gray-600 mb-4">
                            한달에 아주 많은 분량의 논술문을 채점하는 교사들을 위하여.
                        </p>
                        <div class="monthly-price">
                            <div class="text-4xl font-bold text-gray-900">15,000원<span class="text-lg text-gray-500">/월</span></div>
                        </div>
                        <div class="yearly-price hidden">
                            <div class="text-4xl font-bold text-gray-900">12,000원<span class="text-lg text-gray-500">/월</span></div>
                            <div class="text-sm text-gray-500">(연간 144,000원)</div>
                        </div>
                    </div>
                    
                    <ul class="space-y-3 mb-6 text-sm">
                        <li class="flex items-start">
                            <i class="fas fa-arrow-left text-navy-700 mr-2 mt-1"></i>
                            <span>라이트 요금제에서 제공하는 것에 더하여 아래와 같은 서비스가 제공됩니다.</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>한달에 360개 논술 답안지 채점</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>한달에 360개 논술문 내용 요약</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>논술 1개당 최대 글자 수는 30,000자</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>한 번에 여러 개 논술 답안지 업로드 가능</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>학급별 성과를 표시해 주는 대시보드 제공</span>
                        </li>
                    </ul>
                    
                    <button onclick="selectPlan('pro', 'monthly')" class="w-full bg-gradient-to-r from-navy-700 to-navy-900 text-white py-3 rounded-lg font-semibold hover:shadow-xl transition">
                        무료로 시작하세요
                    </button>
                </div>

                <!-- Premium Plan -->
                <div class="pricing-card bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                    <div class="mb-6">
                        <h3 class="text-xl font-bold text-gray-900 mb-2">프리미엄</h3>
                        <p class="text-sm text-gray-600 mb-4">
                            AI 논술 평가의 모든 기능을 활용해야 할 정도로 업무량이 많은 교사들을 위하여.
                        </p>
                        <div class="monthly-price">
                            <div class="text-4xl font-bold text-gray-900">30,000원<span class="text-lg text-gray-500">/월</span></div>
                        </div>
                        <div class="yearly-price hidden">
                            <div class="text-4xl font-bold text-gray-900">24,000원<span class="text-lg text-gray-500">/월</span></div>
                            <div class="text-sm text-gray-500">(연간 288,000원)</div>
                        </div>
                    </div>
                    
                    <ul class="space-y-3 mb-6 text-sm">
                        <li class="flex items-start">
                            <i class="fas fa-arrow-left text-navy-700 mr-2 mt-1"></i>
                            <span>프로 요금제에서 제공하는 것에 더하여 아래와 같은 서비스가 제공됩니다.</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>한달에 750개 논술 답안지 채점</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>한달에 750개 논술문 내용 요약</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>논술 1개당 글자 수 최대 글자 수는 70,000자</span>
                        </li>
                    </ul>
                    
                    <button onclick="selectPlan('premium', 'monthly')" class="w-full bg-navy-900 text-white py-3 rounded-lg font-semibold hover:bg-navy-800 transition">
                        무료로 시작하세요
                    </button>
                </div>
            </div>

            <!-- Additional Info -->
            <div class="mt-16 text-center">
                <p class="text-gray-600 mb-4">모든 플랜에는 다음이 포함됩니다:</p>
                <div class="flex justify-center space-x-8 text-sm text-gray-700">
                    <div><i class="fas fa-check text-green-500 mr-2"></i>무료 평가판</div>
                    <div><i class="fas fa-check text-green-500 mr-2"></i>신용카드 불필요</div>
                    <div><i class="fas fa-check text-green-500 mr-2"></i>언제든지 취소</div>
                </div>
            </div>
        </div>

        <script>
          let currentBilling = 'monthly';
          
          function toggleBilling() {
            const toggle = document.getElementById('billingToggle');
            const monthlyLabel = document.getElementById('monthlyLabel');
            const yearlyLabel = document.getElementById('yearlyLabel');
            const monthlyPrices = document.querySelectorAll('.monthly-price');
            const yearlyPrices = document.querySelectorAll('.yearly-price');
            
            if (toggle.checked) {
              currentBilling = 'yearly';
              monthlyLabel.classList.remove('text-navy-900');
              monthlyLabel.classList.add('text-gray-500');
              yearlyLabel.classList.remove('text-gray-500');
              yearlyLabel.classList.add('text-navy-900');
              
              monthlyPrices.forEach(el => el.classList.add('hidden'));
              yearlyPrices.forEach(el => el.classList.remove('hidden'));
            } else {
              currentBilling = 'monthly';
              yearlyLabel.classList.remove('text-navy-900');
              yearlyLabel.classList.add('text-gray-500');
              monthlyLabel.classList.remove('text-gray-500');
              monthlyLabel.classList.add('text-navy-900');
              
              yearlyPrices.forEach(el => el.classList.add('hidden'));
              monthlyPrices.forEach(el => el.classList.remove('hidden'));
            }
          }
          
          function selectPlan(plan, billing) {
            window.location.href = \`/signup?plan=\${plan}&billing=\${currentBilling}\`;
          }
        </script>
    </body>
    </html>
  `)
})

// My Page - Teacher's Assignment Management
app.get('/my-page', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>나의 페이지 | AI 논술 평가</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  navy: {
                    50: '#f0f4ff',
                    100: '#e0e9ff',
                    700: '#4338ca',
                    800: '#3730a3',
                    900: '#1e3a8a',
                  }
                }
              }
            }
          }
        </script>
        <style>
          .tab-button.active {
            background-color: #1e3a8a;
            color: white;
          }
          .assignment-rubric-tab.active {
            background-color: #1e3a8a;
            color: white;
          }
        </style>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16 items-center">
                    <a href="/" class="flex items-center">
                        <span class="text-2xl font-bold text-navy-900">
                            <i class="fas fa-graduation-cap mr-2"></i>AI 논술 평가
                        </span>
                    </a>
                    <div class="flex items-center space-x-4">
                        <a href="/" class="text-gray-700 hover:text-navy-700 font-medium">홈</a>
                        <span class="text-navy-700 font-semibold">나의 페이지</span>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <!-- Header -->
            <div class="mb-8 flex justify-between items-center">
                <div>
                    <h1 class="text-4xl font-bold text-gray-900 mb-2">나의 페이지</h1>
                    <p class="text-xl text-gray-600">논술 과제를 관리하고 학생 답안지를 채점하세요</p>
                </div>
                <button onclick="showCreateAssignmentModal()" class="bg-navy-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-navy-800 transition">
                    <i class="fas fa-plus mr-2"></i>새 과제 만들기
                </button>
            </div>

            <!-- Tabs -->
            <div class="flex gap-2 mb-6 border-b border-gray-200">
                <button id="assignmentsTab" onclick="switchTab('assignments')" class="tab-button px-6 py-3 font-semibold rounded-t-lg transition active">
                    <i class="fas fa-clipboard-list mr-2"></i>내 과제
                </button>
                <button id="historyTab" onclick="switchTab('history')" class="tab-button px-6 py-3 font-semibold rounded-t-lg transition text-gray-700 hover:bg-gray-100">
                    <i class="fas fa-history mr-2"></i>채점 이력
                </button>
            </div>

            <!-- Assignments Tab Content -->
            <div id="assignmentsContent">
                <div id="assignmentsList" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <p class="text-gray-500 text-center py-8 col-span-full">과제를 불러오는 중...</p>
                </div>
            </div>

            <!-- History Tab Content -->
            <div id="historyContent" class="hidden">
                <div id="historyList">
                    <p class="text-gray-500 text-center py-8">채점 이력을 불러오는 중...</p>
                </div>
            </div>
        </div>

        <!-- Create Assignment Modal -->
        <div id="createAssignmentModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-xl shadow-2xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto mx-4">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-900">새 과제 만들기</h2>
                    <button onclick="closeCreateAssignmentModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-2xl"></i>
                    </button>
                </div>

                <form id="createAssignmentForm" onsubmit="handleCreateAssignment(event)">
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">과제 제목</label>
                            <input type="text" id="assignmentTitle" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700" placeholder="예: 제2차 세계대전의 원인 분석" required>
                        </div>

                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">과제 설명</label>
                            <textarea id="assignmentDescription" rows="4" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700" placeholder="학생들에게 요구하는 논술 주제와 요구사항을 입력하세요" required></textarea>
                        </div>

                        <!-- Reference Materials -->
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">참고 자료 첨부</label>
                            <div id="assignmentReferenceMaterials" class="space-y-2 mb-2">
                                <!-- Initial 4 reference slots -->
                                <div class="reference-item flex gap-2">
                                    <input type="text" class="reference-input flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="참고 자료 URL 또는 설명 (선택사항)">
                                    <button type="button" onclick="removeReferenceMaterial(this)" class="px-3 py-2 text-red-600 hover:text-red-800 text-sm">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                                <div class="reference-item flex gap-2">
                                    <input type="text" class="reference-input flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="참고 자료 URL 또는 설명 (선택사항)">
                                    <button type="button" onclick="removeReferenceMaterial(this)" class="px-3 py-2 text-red-600 hover:text-red-800 text-sm">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                                <div class="reference-item flex gap-2">
                                    <input type="text" class="reference-input flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="참고 자료 URL 또는 설명 (선택사항)">
                                    <button type="button" onclick="removeReferenceMaterial(this)" class="px-3 py-2 text-red-600 hover:text-red-800 text-sm">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                                <div class="reference-item flex gap-2">
                                    <input type="text" class="reference-input flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="참고 자료 URL 또는 설명 (선택사항)">
                                    <button type="button" onclick="removeReferenceMaterial(this)" class="px-3 py-2 text-red-600 hover:text-red-800 text-sm">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="flex items-center justify-between">
                                <button type="button" onclick="addReferenceMaterial()" id="addReferenceBtn" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm">
                                    <i class="fas fa-plus mr-2"></i>참고 자료 추가
                                </button>
                                <span id="referenceCount" class="text-sm text-gray-600">4 / 11</span>
                            </div>
                        </div>

                        <div class="grid md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">학년 수준</label>
                                <select id="assignmentGradeLevel" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700" required>
                                    <option value="">학년을 선택하세요</option>
                                    <option value="초등학교">초등학교</option>
                                    <option value="중학교 1학년">중학교 1학년</option>
                                    <option value="중학교 2학년">중학교 2학년</option>
                                    <option value="중학교 3학년">중학교 3학년</option>
                                    <option value="고등학교 1학년">고등학교 1학년</option>
                                    <option value="고등학교 2학년">고등학교 2학년</option>
                                    <option value="고등학교 3학년">고등학교 3학년</option>
                                </select>
                            </div>

                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">제출 마감일</label>
                                <input type="date" id="assignmentDueDate" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700">
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">평가 루브릭</label>
                            
                            <!-- Rubric Type Selection -->
                            <div class="flex gap-2 mb-4">
                                <button 
                                    type="button" 
                                    id="assignmentPlatformRubricBtn"
                                    onclick="switchAssignmentRubricType('platform')" 
                                    class="assignment-rubric-tab flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold transition active"
                                >
                                    플랫폼 루브릭
                                </button>
                                <button 
                                    type="button" 
                                    id="assignmentCustomRubricBtn"
                                    onclick="switchAssignmentRubricType('custom')" 
                                    class="assignment-rubric-tab flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold transition"
                                >
                                    나의 루브릭
                                </button>
                            </div>
                            
                            <!-- Platform Rubric Container -->
                            <div id="assignmentPlatformRubricContainer">
                                <select 
                                    id="assignmentPlatformRubric" 
                                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700 focus:border-transparent"
                                >
                                    <option value="standard">표준 논술 루브릭 (4개 기준)</option>
                                    <option value="detailed">상세 논술 루브릭 (6개 기준)</option>
                                    <option value="simple">간단 논술 루브릭 (3개 기준)</option>
                                </select>
                            </div>
                            
                            <!-- Custom Rubric Container -->
                            <div id="assignmentCustomRubricContainer" class="hidden">
                                <div id="rubricCriteriaList" class="space-y-2 mb-2">
                                    <!-- Criteria will be added here -->
                                </div>
                                <button type="button" onclick="addRubricCriterion()" class="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm">
                                    <i class="fas fa-plus mr-2"></i>평가 기준 추가
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="flex gap-4 mt-6">
                        <button type="submit" class="flex-1 bg-navy-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-navy-800 transition">
                            <i class="fas fa-save mr-2"></i>과제 생성
                        </button>
                        <button type="button" onclick="closeCreateAssignmentModal()" class="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition">
                            취소
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Assignment Detail Modal -->
        <div id="assignmentDetailModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-xl shadow-2xl p-8 max-w-6xl w-full max-h-[90vh] overflow-y-auto mx-4">
                <div class="flex justify-between items-center mb-6">
                    <h2 id="detailTitle" class="text-2xl font-bold text-gray-900"></h2>
                    <button onclick="closeAssignmentDetailModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-2xl"></i>
                    </button>
                </div>

                <div id="assignmentDetailContent">
                    <!-- Detail content will be loaded here -->
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
          let currentAssignmentId = null;
          let criterionCounter = 0;

          // Session management
          const sessionId = localStorage.getItem('session_id');
          if (!sessionId) {
            alert('로그인이 필요합니다.');
            window.location.href = '/login';
          }

          // Configure axios to include session ID in all requests
          axios.defaults.headers.common['X-Session-ID'] = sessionId;

          // Handle authentication errors
          axios.interceptors.response.use(
            response => response,
            error => {
              if (error.response && error.response.status === 401) {
                alert('세션이 만료되었습니다. 다시 로그인해주세요.');
                localStorage.removeItem('session_id');
                window.location.href = '/login';
              }
              return Promise.reject(error);
            }
          );

          // Switch between tabs
          function switchTab(tab) {
            const assignmentsTab = document.getElementById('assignmentsTab');
            const historyTab = document.getElementById('historyTab');
            const assignmentsContent = document.getElementById('assignmentsContent');
            const historyContent = document.getElementById('historyContent');

            if (tab === 'assignments') {
              assignmentsTab.classList.add('active');
              historyTab.classList.remove('active');
              assignmentsContent.classList.remove('hidden');
              historyContent.classList.add('hidden');
              loadAssignments();
            } else {
              historyTab.classList.add('active');
              assignmentsTab.classList.remove('active');
              historyContent.classList.remove('hidden');
              assignmentsContent.classList.add('hidden');
              loadHistory();
            }
          }

          // Load assignments
          async function loadAssignments() {
            try {
              const response = await axios.get('/api/assignments');
              const assignments = response.data;

              const container = document.getElementById('assignmentsList');

              if (assignments.length === 0) {
                container.innerHTML = \`
                  <div class="col-span-full text-center py-12">
                    <i class="fas fa-clipboard-list text-6xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500 text-lg mb-4">아직 만든 과제가 없습니다.</p>
                    <button onclick="showCreateAssignmentModal()" class="px-6 py-3 bg-navy-900 text-white rounded-lg font-semibold hover:bg-navy-800 transition">
                      <i class="fas fa-plus mr-2"></i>첫 과제 만들기
                    </button>
                  </div>
                \`;
                return;
              }

              container.innerHTML = assignments.map(assignment => \`
                <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-xl transition cursor-pointer" onclick="viewAssignment(\${assignment.id})">
                  <div class="flex justify-between items-start mb-4">
                    <h3 class="text-xl font-bold text-gray-900">\${assignment.title}</h3>
                    <span class="text-xs bg-navy-100 text-navy-800 px-3 py-1 rounded-full font-semibold">\${assignment.grade_level}</span>
                  </div>
                  <p class="text-gray-600 text-sm mb-4 line-clamp-2">\${assignment.description}</p>
                  <div class="flex items-center justify-between text-sm text-gray-500">
                    <div>
                      <i class="fas fa-calendar mr-2"></i>
                      \${new Date(assignment.created_at).toLocaleDateString('ko-KR')}
                    </div>
                    \${assignment.due_date ? \`
                      <div class="text-orange-600">
                        <i class="fas fa-clock mr-2"></i>
                        마감: \${new Date(assignment.due_date).toLocaleDateString('ko-KR')}
                      </div>
                    \` : ''}
                  </div>
                  <div class="mt-4 pt-4 border-t border-gray-200">
                    <button onclick="event.stopPropagation(); deleteAssignment(\${assignment.id})" class="text-red-600 hover:text-red-800 text-sm font-semibold">
                      <i class="fas fa-trash mr-1"></i>삭제
                    </button>
                  </div>
                </div>
              \`).join('');
            } catch (error) {
              console.error('Error loading assignments:', error);
              document.getElementById('assignmentsList').innerHTML = \`
                <div class="col-span-full text-center py-8 text-red-600">
                  <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                  <p>과제를 불러오는데 실패했습니다.</p>
                </div>
              \`;
            }
          }

          // View assignment detail
          async function viewAssignment(assignmentId) {
            try {
              const response = await axios.get(\`/api/assignment/\${assignmentId}\`);
              const assignment = response.data;
              currentAssignmentId = assignmentId;

              document.getElementById('detailTitle').textContent = assignment.title;

              document.getElementById('assignmentDetailContent').innerHTML = \`
                <div class="space-y-6">
                  <div class="bg-gray-50 rounded-lg p-6">
                    <h3 class="font-bold text-gray-900 mb-2">과제 설명</h3>
                    <p class="text-gray-700">\${assignment.description}</p>
                    <div class="mt-4 flex gap-4 text-sm text-gray-600">
                      <div><i class="fas fa-graduation-cap mr-2"></i>\${assignment.grade_level}</div>
                      \${assignment.due_date ? \`<div><i class="fas fa-clock mr-2 text-orange-600"></i>마감: \${new Date(assignment.due_date).toLocaleDateString('ko-KR')}</div>\` : ''}
                    </div>
                  </div>

                  <div>
                    <h3 class="font-bold text-gray-900 mb-3">평가 루브릭 (\${assignment.rubrics.length}개 기준)</h3>
                    <div class="space-y-2">
                      \${assignment.rubrics.map((rubric, idx) => \`
                        <div class="border border-gray-200 rounded-lg p-4 bg-white">
                          <div class="font-semibold text-gray-900">\${idx + 1}. \${rubric.criterion_name}</div>
                          <div class="text-sm text-gray-600 mt-1">\${rubric.criterion_description}</div>
                        </div>
                      \`).join('')}
                    </div>
                  </div>

                  <div>
                    <div class="flex justify-between items-center mb-3">
                      <h3 class="font-bold text-gray-900">학생 제출물 (\${assignment.submissions.length}개)</h3>
                      <button onclick="showAddSubmissionForm()" class="px-4 py-2 bg-navy-900 text-white rounded-lg font-semibold hover:bg-navy-800 transition text-sm">
                        <i class="fas fa-upload mr-2"></i>답안지 추가
                      </button>
                    </div>

                    <div id="submissionsList">
                      \${assignment.submissions.length === 0 ? 
                        '<p class="text-gray-500 text-center py-8">아직 제출된 답안지가 없습니다.</p>' :
                        \`<div class="space-y-3">
                          \${assignment.submissions.map(submission => \`
                            <div class="border border-gray-200 rounded-lg p-4 bg-white hover:bg-gray-50 transition">
                              <div class="flex justify-between items-start">
                                <div class="flex-1">
                                  <div class="font-semibold text-gray-900">\${submission.student_name}</div>
                                  <div class="text-sm text-gray-600 mt-1">\${submission.essay_text.substring(0, 100)}...</div>
                                  <div class="text-xs text-gray-500 mt-2">
                                    <i class="fas fa-clock mr-1"></i>
                                    \${new Date(submission.submitted_at).toLocaleString('ko-KR')}
                                  </div>
                                </div>
                                <div class="ml-4">
                                  \${submission.graded ? 
                                    '<span class="text-green-600 font-semibold text-sm"><i class="fas fa-check-circle mr-1"></i>채점완료</span>' :
                                    '<button onclick="gradeSubmission(\${submission.id})" class="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-semibold hover:bg-navy-800 transition">채점하기</button>'
                                  }
                                </div>
                              </div>
                            </div>
                          \`).join('')}
                        </div>\`
                      }
                    </div>

                    <div id="addSubmissionForm" class="hidden mt-4 border-2 border-dashed border-gray-300 rounded-lg p-6">
                      <h4 class="font-semibold text-gray-900 mb-4">새 답안지 추가</h4>
                      <form onsubmit="handleAddSubmission(event)">
                        <div class="space-y-3">
                          <input type="text" id="studentName" placeholder="학생 이름" class="w-full px-4 py-2 border border-gray-300 rounded-lg" required>
                          <textarea id="studentEssay" rows="6" placeholder="학생 논술 내용을 입력하세요" class="w-full px-4 py-2 border border-gray-300 rounded-lg" required></textarea>
                          <div class="flex gap-2">
                            <button type="submit" class="flex-1 px-4 py-2 bg-navy-900 text-white rounded-lg font-semibold hover:bg-navy-800 transition">추가</button>
                            <button type="button" onclick="hideAddSubmissionForm()" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition">취소</button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              \`;

              document.getElementById('assignmentDetailModal').classList.remove('hidden');
            } catch (error) {
              console.error('Error loading assignment:', error);
              alert('과제를 불러오는데 실패했습니다.');
            }
          }

          // Platform rubric definitions
          function getPlatformRubricCriteria(type) {
            const rubrics = {
              standard: [
                { name: '핵심 개념의 이해와 분석', description: '주요 주제를 정확하게 파악하고 깊이 있게 분석했습니다.', order: 1 },
                { name: '증거와 사례 활용', description: '논거를 뒷받침하기 위해 구체적이고 적절한 사례를 사용했습니다.', order: 2 },
                { name: '출처 인용의 정확성', description: '참고 자료에서 정보를 정확하게 인용했습니다.', order: 3 },
                { name: '문법 정확성, 구성 및 흐름', description: '최소한의 문법 오류, 논리적 흐름, 다양한 문장 구조를 보여줍니다.', order: 4 }
              ],
              detailed: [
                { name: '주제 이해도', description: '논술 주제에 대한 깊이 있는 이해를 보여줍니다.', order: 1 },
                { name: '논리적 구성', description: '논술이 체계적이고 논리적으로 구성되어 있습니다.', order: 2 },
                { name: '근거 제시', description: '주장을 뒷받침하는 충분한 근거를 제시했습니다.', order: 3 },
                { name: '비판적 사고', description: '다양한 관점을 고려하고 비판적으로 사고했습니다.', order: 4 },
                { name: '언어 표현력', description: '적절하고 풍부한 어휘를 사용하여 표현했습니다.', order: 5 },
                { name: '맞춤법과 문법', description: '맞춤법과 문법이 정확합니다.', order: 6 }
              ],
              simple: [
                { name: '내용 충실성', description: '논술 주제에 맞는 내용을 충실히 작성했습니다.', order: 1 },
                { name: '논리성', description: '논리적으로 일관성 있게 작성했습니다.', order: 2 },
                { name: '표현력', description: '생각을 명확하게 표현했습니다.', order: 3 }
              ]
            };
            return rubrics[type] || rubrics.standard;
          }

          // Rubric type switching for assignment creation
          function switchAssignmentRubricType(type) {
            const platformBtn = document.getElementById('assignmentPlatformRubricBtn');
            const customBtn = document.getElementById('assignmentCustomRubricBtn');
            const platformContainer = document.getElementById('assignmentPlatformRubricContainer');
            const customContainer = document.getElementById('assignmentCustomRubricContainer');

            if (type === 'platform') {
              platformBtn.classList.add('active');
              customBtn.classList.remove('active');
              platformContainer.classList.remove('hidden');
              customContainer.classList.add('hidden');
            } else {
              customBtn.classList.add('active');
              platformBtn.classList.remove('active');
              customContainer.classList.remove('hidden');
              platformContainer.classList.add('hidden');
            }
          }

          // Show/hide modals
          function showCreateAssignmentModal() {
            document.getElementById('createAssignmentModal').classList.remove('hidden');
            // Default to platform rubric
            switchAssignmentRubricType('platform');
          }

          function closeCreateAssignmentModal() {
            document.getElementById('createAssignmentModal').classList.add('hidden');
            document.getElementById('createAssignmentForm').reset();
            document.getElementById('rubricCriteriaList').innerHTML = '';
            criterionCounter = 0;
            
            // Reset rubric type to platform
            switchAssignmentRubricType('platform');
            
            // Reset reference materials to 4 default slots
            const container = document.getElementById('assignmentReferenceMaterials');
            container.innerHTML = \`
              <div class="reference-item flex gap-2">
                <input type="text" class="reference-input flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="참고 자료 URL 또는 설명 (선택사항)">
                <button type="button" onclick="removeReferenceMaterial(this)" class="px-3 py-2 text-red-600 hover:text-red-800 text-sm">
                  <i class="fas fa-times"></i>
                </button>
              </div>
              <div class="reference-item flex gap-2">
                <input type="text" class="reference-input flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="참고 자료 URL 또는 설명 (선택사항)">
                <button type="button" onclick="removeReferenceMaterial(this)" class="px-3 py-2 text-red-600 hover:text-red-800 text-sm">
                  <i class="fas fa-times"></i>
                </button>
              </div>
              <div class="reference-item flex gap-2">
                <input type="text" class="reference-input flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="참고 자료 URL 또는 설명 (선택사항)">
                <button type="button" onclick="removeReferenceMaterial(this)" class="px-3 py-2 text-red-600 hover:text-red-800 text-sm">
                  <i class="fas fa-times"></i>
                </button>
              </div>
              <div class="reference-item flex gap-2">
                <input type="text" class="reference-input flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="참고 자료 URL 또는 설명 (선택사항)">
                <button type="button" onclick="removeReferenceMaterial(this)" class="px-3 py-2 text-red-600 hover:text-red-800 text-sm">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            \`;
            updateReferenceCount();
          }

          function closeAssignmentDetailModal() {
            document.getElementById('assignmentDetailModal').classList.add('hidden');
            currentAssignmentId = null;
          }

          // Add rubric criterion
          function addRubricCriterion() {
            criterionCounter++;
            const container = document.getElementById('rubricCriteriaList');
            const div = document.createElement('div');
            div.className = 'border border-gray-200 rounded-lg p-3 bg-white';
            div.id = \`criterion-\${criterionCounter}\`;
            div.innerHTML = \`
              <div class="flex justify-between items-center mb-2">
                <span class="text-xs font-semibold text-gray-600">기준 \${criterionCounter}</span>
                <button type="button" onclick="removeCriterion(\${criterionCounter})" class="text-red-500 hover:text-red-700 text-xs">
                  <i class="fas fa-times"></i>
                </button>
              </div>
              <input type="text" class="criterion-name w-full px-3 py-2 border border-gray-200 rounded mb-2 text-sm" placeholder="기준 이름" required>
              <textarea class="criterion-description w-full px-3 py-2 border border-gray-200 rounded text-sm" rows="2" placeholder="기준 설명" required></textarea>
            \`;
            container.appendChild(div);
          }

          function removeCriterion(id) {
            document.getElementById(\`criterion-\${id}\`).remove();
          }

          // Reference materials management
          function updateReferenceCount() {
            const count = document.querySelectorAll('#assignmentReferenceMaterials .reference-item').length;
            document.getElementById('referenceCount').textContent = \`\${count} / 11\`;
            const addBtn = document.getElementById('addReferenceBtn');
            if (count >= 11) {
              addBtn.disabled = true;
              addBtn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
              addBtn.disabled = false;
              addBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
          }

          function addReferenceMaterial() {
            const container = document.getElementById('assignmentReferenceMaterials');
            const count = container.querySelectorAll('.reference-item').length;
            if (count >= 11) return;

            const div = document.createElement('div');
            div.className = 'reference-item flex gap-2';
            div.innerHTML = \`
              <input type="text" class="reference-input flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="참고 자료 URL 또는 설명 (선택사항)">
              <button type="button" onclick="removeReferenceMaterial(this)" class="px-3 py-2 text-red-600 hover:text-red-800 text-sm">
                <i class="fas fa-times"></i>
              </button>
            \`;
            container.appendChild(div);
            updateReferenceCount();
          }

          function removeReferenceMaterial(btn) {
            const container = document.getElementById('assignmentReferenceMaterials');
            if (container.querySelectorAll('.reference-item').length <= 1) {
              alert('최소 1개의 참고 자료 슬롯은 유지해야 합니다.');
              return;
            }
            btn.closest('.reference-item').remove();
            updateReferenceCount();
          }

          // Handle create assignment
          async function handleCreateAssignment(event) {
            event.preventDefault();

            const title = document.getElementById('assignmentTitle').value;
            const description = document.getElementById('assignmentDescription').value;
            const grade_level = document.getElementById('assignmentGradeLevel').value;
            const due_date = document.getElementById('assignmentDueDate').value;

            // Check which rubric type is selected
            const isCustomRubric = !document.getElementById('assignmentCustomRubricContainer').classList.contains('hidden');
            
            let rubric_criteria = [];
            
            if (isCustomRubric) {
              // Custom rubric
              const criteriaElements = document.querySelectorAll('#rubricCriteriaList > div');
              if (criteriaElements.length === 0) {
                alert('최소 1개의 평가 기준을 추가해주세요.');
                return;
              }
              rubric_criteria = Array.from(criteriaElements).map((el, idx) => ({
                name: el.querySelector('.criterion-name').value,
                description: el.querySelector('.criterion-description').value,
                order: idx + 1
              }));
            } else {
              // Platform rubric
              const platformRubricType = document.getElementById('assignmentPlatformRubric').value;
              rubric_criteria = getPlatformRubricCriteria(platformRubricType);
            }

            try {
              await axios.post('/api/assignments', {
                title,
                description,
                grade_level,
                due_date: due_date || null,
                rubric_criteria
              });

              alert('과제가 생성되었습니다!');
              closeCreateAssignmentModal();
              loadAssignments();
            } catch (error) {
              console.error('Error creating assignment:', error);
              alert('과제 생성에 실패했습니다.');
            }
          }

          // Delete assignment
          async function deleteAssignment(assignmentId) {
            if (!confirm('정말 이 과제를 삭제하시겠습니까?')) return;

            try {
              await axios.delete(\`/api/assignment/\${assignmentId}\`);
              alert('과제가 삭제되었습니다.');
              loadAssignments();
            } catch (error) {
              console.error('Error deleting assignment:', error);
              alert('삭제에 실패했습니다.');
            }
          }

          // Show/hide submission form
          function showAddSubmissionForm() {
            document.getElementById('addSubmissionForm').classList.remove('hidden');
          }

          function hideAddSubmissionForm() {
            document.getElementById('addSubmissionForm').classList.add('hidden');
          }

          // Handle add submission
          async function handleAddSubmission(event) {
            event.preventDefault();

            const student_name = document.getElementById('studentName').value;
            const essay_text = document.getElementById('studentEssay').value;

            try {
              await axios.post(\`/api/assignment/\${currentAssignmentId}/submission\`, {
                student_name,
                essay_text
              });

              alert('답안지가 추가되었습니다!');
              hideAddSubmissionForm();
              viewAssignment(currentAssignmentId); // Reload
            } catch (error) {
              console.error('Error adding submission:', error);
              alert('답안지 추가에 실패했습니다.');
            }
          }

          // Grade submission
          async function gradeSubmission(submissionId) {
            if (!confirm('이 답안을 AI로 채점하시겠습니까? 채점에는 약 10-30초가 소요됩니다.')) return;

            const button = event.target;
            const originalText = button.innerHTML;
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>채점 중...';

            try {
              const response = await axios.post(\`/api/submission/\${submissionId}/grade\`);
              
              alert(\`채점 완료!\\n\\n전체 점수: \${response.data.grading_result.overall_score}/4\\n\\n종합 피드백: \${response.data.grading_result.overall_feedback}\`);
              
              // Reload assignment to show updated status
              viewAssignment(currentAssignmentId);
            } catch (error) {
              console.error('Error grading submission:', error);
              alert('채점에 실패했습니다: ' + (error.response?.data?.error || error.message));
              button.disabled = false;
              button.innerHTML = originalText;
            }
          }

          // Load history
          async function loadHistory() {
            try {
              const response = await axios.get('/api/grading-history');
              const history = response.data;

              const container = document.getElementById('historyList');

              if (history.length === 0) {
                container.innerHTML = \`
                  <div class="text-center py-12">
                    <i class="fas fa-history text-6xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500 text-lg">아직 채점 이력이 없습니다.</p>
                    <p class="text-gray-400 text-sm mt-2">학생 답안을 채점하면 여기에 기록이 남습니다.</p>
                  </div>
                \`;
                return;
              }

              container.innerHTML = \`
                <div class="space-y-4">
                  \${history.map(item => \`
                    <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
                      <div class="flex justify-between items-start mb-3">
                        <div class="flex-1">
                          <h3 class="text-lg font-bold text-gray-900">\${item.assignment_title}</h3>
                          <p class="text-sm text-gray-600 mt-1">
                            <i class="fas fa-user mr-2"></i>\${item.student_name}
                            <span class="mx-2">•</span>
                            <i class="fas fa-graduation-cap mr-2"></i>\${item.grade_level}
                          </p>
                        </div>
                        <div class="text-right">
                          <div class="text-2xl font-bold text-navy-900">\${item.overall_score}/4</div>
                          <div class="text-xs text-gray-500 mt-1">
                            <i class="fas fa-clock mr-1"></i>
                            \${new Date(item.graded_at).toLocaleString('ko-KR')}
                          </div>
                        </div>
                      </div>
                      <div class="bg-gray-50 rounded-lg p-4 mt-4">
                        <div class="text-sm font-semibold text-gray-700 mb-2">종합 피드백</div>
                        <div class="text-sm text-gray-600">\${item.overall_feedback}</div>
                      </div>
                      <div class="mt-4 pt-4 border-t border-gray-200">
                        <div class="text-xs text-gray-500">
                          <i class="fas fa-calendar mr-1"></i>
                          제출일: \${new Date(item.submitted_at).toLocaleString('ko-KR')}
                        </div>
                      </div>
                    </div>
                  \`).join('')}
                </div>
              \`;
            } catch (error) {
              console.error('Error loading history:', error);
              document.getElementById('historyList').innerHTML = \`
                <div class="text-center py-8 text-red-600">
                  <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                  <p>채점 이력을 불러오는데 실패했습니다.</p>
                </div>
              \`;
            }
          }

          // Initial load
          loadAssignments();
        </script>
    </body>
    </html>
  `)
})

// Admin Page - Resource Management
app.get('/admin', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>관리자 페이지 | AI 논술 평가</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  navy: {
                    50: '#f0f4ff',
                    100: '#e0e9ff',
                    200: '#c7d7ff',
                    300: '#a4b8ff',
                    400: '#8195ff',
                    500: '#6366f1',
                    600: '#4f46e5',
                    700: '#4338ca',
                    800: '#3730a3',
                    900: '#1e3a8a',
                  }
                }
              }
            }
          }
        </script>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16 items-center">
                    <a href="/" class="flex items-center">
                        <span class="text-2xl font-bold text-navy-900">
                            <i class="fas fa-graduation-cap mr-2"></i>AI 논술 평가
                        </span>
                    </a>
                    <div class="flex items-center space-x-4">
                        <a href="/" class="text-gray-700 hover:text-navy-700 font-medium">홈</a>
                        <span class="text-navy-700 font-semibold">관리자 페이지</span>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div class="mb-8 flex justify-between items-center">
                <div>
                    <h1 class="text-4xl font-bold text-gray-900 mb-2">자료 관리</h1>
                    <p class="text-xl text-gray-600">평가 관련 자료를 추가하고 관리하세요</p>
                </div>
                <button onclick="showCreateForm()" class="bg-navy-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-navy-800 transition">
                    <i class="fas fa-plus mr-2"></i>새 자료 작성
                </button>
            </div>

            <!-- Create/Edit Form (Hidden by default) -->
            <div id="resourceForm" class="hidden bg-white rounded-xl shadow-lg p-8 mb-8">
                <h2 class="text-2xl font-bold text-gray-900 mb-6">자료 작성</h2>
                <form id="postForm" onsubmit="handleSubmit(event)">
                    <input type="hidden" id="postId" value="">
                    
                    <div class="mb-4">
                        <label class="block text-sm font-semibold text-gray-700 mb-2">카테고리</label>
                        <select id="category" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500" required>
                            <option value="rubric">루브릭</option>
                            <option value="evaluation">논술 평가 자료</option>
                        </select>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-semibold text-gray-700 mb-2">제목</label>
                        <input type="text" id="title" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500" placeholder="자료 제목을 입력하세요" required>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-semibold text-gray-700 mb-2">작성자</label>
                        <input type="text" id="author" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500" placeholder="작성자 이름" value="Admin">
                    </div>
                    
                    <div class="mb-6">
                        <label class="block text-sm font-semibold text-gray-700 mb-2">내용</label>
                        <textarea id="content" rows="12" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500" placeholder="자료 내용을 입력하세요" required></textarea>
                    </div>
                    
                    <div class="flex gap-4">
                        <button type="submit" class="flex-1 bg-navy-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-navy-800 transition">
                            <i class="fas fa-save mr-2"></i>저장
                        </button>
                        <button type="button" onclick="hideForm()" class="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition">
                            취소
                        </button>
                    </div>
                </form>
            </div>

            <!-- Posts List -->
            <div class="grid md:grid-cols-2 gap-6">
                <!-- Rubric Posts -->
                <div>
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">
                        <i class="fas fa-clipboard-list text-navy-700 mr-2"></i>루브릭
                    </h2>
                    <div id="rubricPosts" class="space-y-4">
                        <p class="text-gray-500 text-center py-4">불러오는 중...</p>
                    </div>
                </div>
                
                <!-- Evaluation Posts -->
                <div>
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">
                        <i class="fas fa-book text-navy-700 mr-2"></i>논술 평가 자료
                    </h2>
                    <div id="evaluationPosts" class="space-y-4">
                        <p class="text-gray-500 text-center py-4">불러오는 중...</p>
                    </div>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
          async function loadAllPosts() {
            await loadPostsByCategory('rubric', 'rubricPosts');
            await loadPostsByCategory('evaluation', 'evaluationPosts');
          }
          
          async function loadPostsByCategory(category, containerId) {
            try {
              const response = await axios.get(\`/api/resources/\${category}\`);
              const posts = response.data;
              
              const container = document.getElementById(containerId);
              
              if (posts.length === 0) {
                container.innerHTML = '<p class="text-gray-500 text-center py-4">자료가 없습니다</p>';
                return;
              }
              
              container.innerHTML = posts.map(post => \`
                <div class="bg-white rounded-lg shadow p-4 hover:shadow-md transition">
                  <h3 class="font-bold text-gray-900 mb-2">\${post.title}</h3>
                  <p class="text-sm text-gray-600 mb-3">\${post.content.substring(0, 100)}...</p>
                  <div class="flex gap-2">
                    <a href="/resource/\${post.id}" class="flex-1 text-center px-3 py-2 bg-navy-100 text-navy-800 rounded text-sm font-semibold hover:bg-navy-200 transition">
                      보기
                    </a>
                    <button onclick="editPost(\${post.id})" class="px-3 py-2 bg-gray-100 text-gray-700 rounded text-sm font-semibold hover:bg-gray-200 transition">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deletePost(\${post.id})" class="px-3 py-2 bg-red-100 text-red-700 rounded text-sm font-semibold hover:bg-red-200 transition">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              \`).join('');
            } catch (error) {
              console.error('Error loading posts:', error);
              document.getElementById(containerId).innerHTML = '<p class="text-red-500 text-center py-4">불러오기 실패</p>';
            }
          }
          
          function showCreateForm() {
            document.getElementById('resourceForm').classList.remove('hidden');
            document.getElementById('postId').value = '';
            document.getElementById('postForm').reset();
          }
          
          function hideForm() {
            document.getElementById('resourceForm').classList.add('hidden');
          }
          
          async function handleSubmit(event) {
            event.preventDefault();
            
            const postId = document.getElementById('postId').value;
            const category = document.getElementById('category').value;
            const title = document.getElementById('title').value;
            const content = document.getElementById('content').value;
            const author = document.getElementById('author').value;
            
            try {
              if (postId) {
                // Update existing post
                await axios.put(\`/api/admin/resource/\${postId}\`, { title, content, author });
                alert('자료가 수정되었습니다.');
              } else {
                // Create new post
                await axios.post('/api/admin/resource', { category, title, content, author });
                alert('자료가 등록되었습니다.');
              }
              
              hideForm();
              loadAllPosts();
            } catch (error) {
              console.error('Error saving post:', error);
              alert('저장 중 오류가 발생했습니다.');
            }
          }
          
          async function editPost(id) {
            try {
              const response = await axios.get(\`/api/resource/\${id}\`);
              const post = response.data;
              
              document.getElementById('postId').value = post.id;
              document.getElementById('category').value = post.category;
              document.getElementById('title').value = post.title;
              document.getElementById('content').value = post.content;
              document.getElementById('author').value = post.author || 'Admin';
              
              document.getElementById('resourceForm').classList.remove('hidden');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } catch (error) {
              console.error('Error loading post:', error);
              alert('불러오기 실패');
            }
          }
          
          async function deletePost(id) {
            if (!confirm('정말 삭제하시겠습니까?')) return;
            
            try {
              await axios.delete(\`/api/admin/resource/\${id}\`);
              alert('삭제되었습니다.');
              loadAllPosts();
            } catch (error) {
              console.error('Error deleting post:', error);
              alert('삭제 중 오류가 발생했습니다.');
            }
          }
          
          loadAllPosts();
        </script>
    </body>
    </html>
  `)
})

export default app
