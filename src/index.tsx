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

// Frontend Route
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CoGrader - AI 에세이 채점 시스템</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
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
            border-top: 3px solid #3b82f6;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
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
        </style>
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <div class="container mx-auto px-4 py-8 max-w-6xl">
            <!-- Header -->
            <header class="text-center mb-12">
                <h1 class="text-5xl font-bold text-indigo-900 mb-4">
                    <i class="fas fa-graduation-cap mr-3"></i>
                    CoGrader
                </h1>
                <p class="text-xl text-gray-700">AI 기반 루브릭 채점 시스템</p>
                <p class="text-sm text-gray-600 mt-2">자동화된 에세이 평가 및 상세 피드백</p>
            </header>

            <!-- Navigation Tabs -->
            <div class="bg-white rounded-lg shadow-md mb-8">
                <div class="flex border-b">
                    <button onclick="showTab('grading')" id="tab-grading" class="tab-button flex-1 px-6 py-4 text-center font-semibold border-b-2 border-indigo-600 text-indigo-600">
                        <i class="fas fa-edit mr-2"></i>에세이 채점
                    </button>
                    <button onclick="showTab('history')" id="tab-history" class="tab-button flex-1 px-6 py-4 text-center font-semibold text-gray-600 hover:text-indigo-600">
                        <i class="fas fa-history mr-2"></i>채점 기록
                    </button>
                </div>
            </div>

            <!-- Grading Tab -->
            <div id="content-grading" class="tab-content">
                <div class="bg-white rounded-lg shadow-lg p-8 mb-8">
                    <h2 class="text-2xl font-bold text-gray-800 mb-6">
                        <i class="fas fa-clipboard-list mr-2 text-indigo-600"></i>
                        에세이 채점 요청
                    </h2>
                    
                    <form id="gradingForm" class="space-y-6">
                        <!-- Assignment Prompt -->
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                과제 프롬프트 (Assignment Prompt)
                            </label>
                            <textarea 
                                id="assignmentPrompt" 
                                rows="4" 
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="예: Analyze the major causes of World War II, support your arguments using specific historical examples..."
                                required
                            ></textarea>
                        </div>

                        <!-- Grade Level -->
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                학년 수준 (Grade Level)
                            </label>
                            <input 
                                type="text" 
                                id="gradeLevel" 
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="예: 12th-grade social studies"
                                required
                            />
                        </div>

                        <!-- Rubric Criteria -->
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                루브릭 기준 (Rubric Criteria)
                            </label>
                            <div id="rubricContainer" class="space-y-4">
                                <!-- Criteria will be added dynamically -->
                            </div>
                            <button 
                                type="button" 
                                onclick="addCriterion()" 
                                class="mt-3 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                            >
                                <i class="fas fa-plus mr-2"></i>기준 추가
                            </button>
                        </div>

                        <!-- Essay Text -->
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                학생 에세이 (Student Essay)
                            </label>
                            <textarea 
                                id="essayText" 
                                rows="12" 
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
                                placeholder="학생이 작성한 에세이를 여기에 붙여넣으세요..."
                                required
                            ></textarea>
                        </div>

                        <!-- Submit Button -->
                        <div class="flex justify-center">
                            <button 
                                type="submit" 
                                class="px-8 py-4 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition shadow-lg"
                            >
                                <i class="fas fa-check-circle mr-2"></i>
                                에세이 채점하기
                            </button>
                        </div>
                    </form>
                </div>

                <!-- Loading Indicator -->
                <div id="loadingIndicator" class="hidden bg-white rounded-lg shadow-lg p-12 text-center">
                    <div class="loading-spinner mx-auto mb-4"></div>
                    <p class="text-xl font-semibold text-gray-700">에세이를 분석하고 있습니다...</p>
                    <p class="text-sm text-gray-500 mt-2">잠시만 기다려주세요</p>
                </div>

                <!-- Results Display -->
                <div id="resultsContainer" class="hidden"></div>
            </div>

            <!-- History Tab -->
            <div id="content-history" class="tab-content hidden">
                <div class="bg-white rounded-lg shadow-lg p-8">
                    <h2 class="text-2xl font-bold text-gray-800 mb-6">
                        <i class="fas fa-history mr-2 text-indigo-600"></i>
                        채점 기록
                    </h2>
                    <div id="historyContainer">
                        <p class="text-gray-500 text-center py-8">기록을 불러오는 중...</p>
                    </div>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app
