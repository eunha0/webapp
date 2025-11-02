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
        <title>AI 논술 평가 | 교사를 위한 AI 논술 채점 시스템</title>
        <meta name="description" content="AI로 논술 답안지를 10배 빠르게 채점하세요. 상세하고 실행 가능한 피드백을 받으세요. 1,000개 이상의 학교에서 신뢰합니다.">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  primary: '#10b981',
                  secondary: '#3b82f6',
                  accent: '#f59e0b',
                }
              }
            }
          }
        </script>
        <style>
          .hero-gradient {
            background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);
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
            border-top: 3px solid #10b981;
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
            background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);
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
                        <span class="text-2xl font-bold bg-gradient-to-r from-green-500 to-blue-500 bg-clip-text text-transparent">
                            <i class="fas fa-graduation-cap mr-2"></i>AI 논술 평가
                        </span>
                    </div>
                    <div class="hidden md:flex items-center space-x-8">
                        <a href="#how-it-works" class="text-gray-700 hover:text-green-600 font-medium">작동 방식</a>
                        <a href="#features" class="text-gray-700 hover:text-green-600 font-medium">기능</a>
                        <a href="#faq" class="text-gray-700 hover:text-green-600 font-medium">자주 묻는 질문</a>
                        <button onclick="scrollToGrader()" class="bg-gradient-to-r from-green-500 to-blue-500 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition">
                            무료로 시작하기
                        </button>
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
                    <button onclick="scrollToGrader()" class="bg-white text-green-600 px-8 py-4 rounded-lg font-bold text-lg hover:shadow-2xl transition transform hover:scale-105">
                        <i class="fas fa-rocket mr-2"></i>무료로 채점 시작하기
                    </button>
                    <button onclick="scrollToDemo()" class="bg-green-800/50 backdrop-blur text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-green-800/70 transition">
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
                        <div class="text-3xl font-bold text-green-600">10배</div>
                        <div class="text-sm text-gray-600">빠른 채점</div>
                    </div>
                    <div>
                        <div class="text-3xl font-bold text-green-600">1,000+</div>
                        <div class="text-sm text-gray-600">신뢰하는 학교</div>
                    </div>
                    <div>
                        <div class="text-3xl font-bold text-green-600">&lt;4%</div>
                        <div class="text-sm text-gray-600">점수 편차</div>
                    </div>
                    <div>
                        <div class="text-3xl font-bold text-green-600">100%</div>
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
                            <i class="fas fa-file-upload text-5xl text-green-600"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">루브릭 업로드</h3>
                        <p class="text-gray-600">채점 루브릭을 생성하거나 가져오세요. 400개 이상의 사전 제작 루브릭 중에서 선택하거나 직접 맞춤 설정하세요.</p>
                    </div>
                    <div class="text-center">
                        <div class="step-number">2</div>
                        <div class="mb-4">
                            <i class="fas fa-upload text-5xl text-green-600"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">논술 업로드</h3>
                        <p class="text-gray-600">학생 논술을 개별적으로 또는 대량으로 업로드하세요. 다양한 형식과 언어를 지원합니다.</p>
                    </div>
                    <div class="text-center">
                        <div class="step-number">3</div>
                        <div class="mb-4">
                            <i class="fas fa-download text-5xl text-green-600"></i>
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
                        <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                            <i class="fas fa-bolt text-2xl text-green-600"></i>
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
                                        <i class="fas fa-file-alt mr-2 text-green-600"></i>과제 프롬프트
                                    </label>
                                    <textarea 
                                        id="assignmentPrompt" 
                                        rows="4" 
                                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        placeholder="예: 제2차 세계대전의 주요 원인을 분석하고, 구체적인 역사적 사례를 사용하여 논거를 뒷받침하세요..."
                                        required
                                    ></textarea>
                                    
                                    <!-- Reference Materials Section -->
                                    <div class="mt-4">
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                                            <i class="fas fa-paperclip mr-2 text-green-600"></i>참고 자료 첨부 (선택사항)
                                        </label>
                                        <div id="materialsContainer" class="space-y-2">
                                            <!-- Materials will be added dynamically -->
                                        </div>
                                        <button 
                                            type="button" 
                                            onclick="addMaterial()" 
                                            class="mt-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition text-sm border border-green-200"
                                        >
                                            <i class="fas fa-plus mr-2"></i>자료 추가 (최대 11개)
                                        </button>
                                        <p class="text-xs text-gray-500 mt-1">문서, 이미지, 링크 등을 첨부할 수 있습니다</p>
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-user-graduate mr-2 text-green-600"></i>학년 수준
                                    </label>
                                    <input 
                                        type="text" 
                                        id="gradeLevel" 
                                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent mb-4"
                                        placeholder="예: 고등학교 3학년 사회"
                                        required
                                    />
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-clipboard-list mr-2 text-green-600"></i>루브릭 기준
                                    </label>
                                    <div id="rubricContainer" class="space-y-2 max-h-64 overflow-y-auto">
                                        <!-- Criteria will be added dynamically -->
                                    </div>
                                    <button 
                                        type="button" 
                                        onclick="addCriterion()" 
                                        class="mt-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm"
                                    >
                                        <i class="fas fa-plus mr-2"></i>기준 추가
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-pen-fancy mr-2 text-green-600"></i>학생 논술
                                </label>
                                <textarea 
                                    id="essayText" 
                                    rows="10" 
                                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                                    placeholder="학생이 작성한 논술을 여기에 붙여넣으세요..."
                                    required
                                ></textarea>
                            </div>

                            <div class="flex justify-center">
                                <button 
                                    type="submit" 
                                    class="bg-gradient-to-r from-green-500 to-blue-500 text-white px-12 py-4 rounded-lg font-bold text-lg hover:shadow-2xl transition transform hover:scale-105"
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
                        <i class="fas fa-lock text-4xl text-green-600 mb-4"></i>
                        <h3 class="font-bold mb-2">개인정보 보호법 준수</h3>
                        <p class="text-sm text-gray-600">학생 개인정보 보호법 완전 준수</p>
                    </div>
                    <div class="text-center">
                        <i class="fas fa-shield-alt text-4xl text-blue-600 mb-4"></i>
                        <h3 class="font-bold mb-2">AES-256 암호화</h3>
                        <p class="text-sm text-gray-600">모든 데이터에 은행급 보안 적용</p>
                    </div>
                    <div class="text-center">
                        <i class="fas fa-user-shield text-4xl text-indigo-600 mb-4"></i>
                        <h3 class="font-bold mb-2">데이터 소유권</h3>
                        <p class="text-sm text-gray-600">여러분의 데이터, 언제든지 삭제 가능</p>
                    </div>
                    <div class="text-center">
                        <i class="fas fa-certificate text-4xl text-yellow-600 mb-4"></i>
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
                <button onclick="scrollToGrader()" class="bg-white text-green-600 px-12 py-4 rounded-lg font-bold text-lg hover:shadow-2xl transition transform hover:scale-105">
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

export default app
