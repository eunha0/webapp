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
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>EssayGrader AI | The AI Essay Grader for Teachers | Free Plans</title>
        <meta name="description" content="Grade essays 10x faster with EssayGrader AI. Get detailed, actionable feedback for student essays. Trusted by teachers at 1,000+ schools & colleges.">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  primary: '#2563eb',
                  secondary: '#10b981',
                  accent: '#f59e0b',
                }
              }
            }
          }
        </script>
        <style>
          .hero-gradient {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 50px;
            height: 50px;
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
          .step-number {
            width: 60px;
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: bold;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
                        <span class="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
                            <i class="fas fa-graduation-cap mr-2"></i>EssayGrader AI
                        </span>
                    </div>
                    <div class="hidden md:flex items-center space-x-8">
                        <a href="#how-it-works" class="text-gray-700 hover:text-purple-600 font-medium">How It Works</a>
                        <a href="#features" class="text-gray-700 hover:text-purple-600 font-medium">Features</a>
                        <a href="#faq" class="text-gray-700 hover:text-purple-600 font-medium">FAQ</a>
                        <button onclick="scrollToGrader()" class="bg-gradient-to-r from-purple-600 to-blue-500 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition">
                            Get Started Free
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
                        Trusted by teachers at 1,000+ schools & colleges
                    </span>
                </div>
                <h1 class="text-5xl md:text-6xl font-bold mb-6 leading-tight">
                    Grade Essays 10x Faster<br/>with AI
                </h1>
                <p class="text-xl md:text-2xl mb-8 text-white/90 max-w-3xl mx-auto">
                    Get detailed, actionable feedback for student essays in minutes, not hours. 
                    Save time while providing consistent, high-quality feedback.
                </p>
                <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <button onclick="scrollToGrader()" class="bg-white text-purple-600 px-8 py-4 rounded-lg font-bold text-lg hover:shadow-2xl transition transform hover:scale-105">
                        <i class="fas fa-rocket mr-2"></i>Start Grading Free
                    </button>
                    <button onclick="scrollToDemo()" class="bg-purple-800/50 backdrop-blur text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-purple-800/70 transition">
                        <i class="fas fa-play-circle mr-2"></i>See How It Works
                    </button>
                </div>
                <p class="mt-6 text-white/80 text-sm">
                    <i class="fas fa-check-circle mr-2"></i>No credit card required • Free plan available
                </p>
            </div>
        </section>

        <!-- Trust Bar -->
        <section class="bg-gray-50 py-8 border-b">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                    <div>
                        <div class="text-3xl font-bold text-purple-600">10x</div>
                        <div class="text-sm text-gray-600">Faster Grading</div>
                    </div>
                    <div>
                        <div class="text-3xl font-bold text-purple-600">1,000+</div>
                        <div class="text-sm text-gray-600">Schools Trust Us</div>
                    </div>
                    <div>
                        <div class="text-3xl font-bold text-purple-600">&lt;4%</div>
                        <div class="text-sm text-gray-600">Score Variance</div>
                    </div>
                    <div>
                        <div class="text-3xl font-bold text-purple-600">100%</div>
                        <div class="text-sm text-gray-600">Privacy First</div>
                    </div>
                </div>
            </div>
        </section>

        <!-- How It Works -->
        <section id="how-it-works" class="py-20 bg-white">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="text-center mb-16">
                    <h2 class="text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
                    <p class="text-xl text-gray-600">Three simple steps to better, faster grading</p>
                </div>
                <div class="grid md:grid-cols-3 gap-12">
                    <div class="text-center">
                        <div class="step-number">1</div>
                        <div class="mb-4">
                            <i class="fas fa-file-upload text-5xl text-purple-600"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">Upload Your Rubric</h3>
                        <p class="text-gray-600">Create or import your grading rubric. Choose from 400+ pre-built rubrics or customize your own.</p>
                    </div>
                    <div class="text-center">
                        <div class="step-number">2</div>
                        <div class="mb-4">
                            <i class="fas fa-upload text-5xl text-purple-600"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">Upload Essays</h3>
                        <p class="text-gray-600">Upload student essays individually or in bulk. Supports multiple formats and languages.</p>
                    </div>
                    <div class="text-center">
                        <div class="step-number">3</div>
                        <div class="mb-4">
                            <i class="fas fa-download text-5xl text-purple-600"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">Download Results</h3>
                        <p class="text-gray-600">Get detailed feedback with scores, comments, and suggestions. Export to your LMS or download as PDF.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- Features Section -->
        <section id="features" class="py-20 bg-gray-50">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="text-center mb-16">
                    <h2 class="text-4xl font-bold text-gray-900 mb-4">Powerful Features</h2>
                    <p class="text-xl text-gray-600">Everything you need to grade essays effectively</p>
                </div>
                <div class="grid md:grid-cols-3 gap-8">
                    <div class="feature-card bg-white p-6 rounded-xl shadow-md">
                        <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                            <i class="fas fa-bolt text-2xl text-purple-600"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">Lightning Fast</h3>
                        <p class="text-gray-600">Grade an entire class in minutes. Save hours of grading time every week.</p>
                    </div>
                    <div class="feature-card bg-white p-6 rounded-xl shadow-md">
                        <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                            <i class="fas fa-chart-line text-2xl text-green-600"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">Detailed Feedback</h3>
                        <p class="text-gray-600">Actionable comments on grammar, structure, evidence, and analysis.</p>
                    </div>
                    <div class="feature-card bg-white p-6 rounded-xl shadow-md">
                        <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                            <i class="fas fa-balance-scale text-2xl text-blue-600"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">Consistent Grading</h3>
                        <p class="text-gray-600">Remove bias and ensure fair, standards-aligned assessment for all students.</p>
                    </div>
                    <div class="feature-card bg-white p-6 rounded-xl shadow-md">
                        <div class="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                            <i class="fas fa-clipboard-check text-2xl text-yellow-600"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">Custom Rubrics</h3>
                        <p class="text-gray-600">400+ pre-built rubrics or create your own. CCSS, AP, IB, and state standards supported.</p>
                    </div>
                    <div class="feature-card bg-white p-6 rounded-xl shadow-md">
                        <div class="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                            <i class="fas fa-shield-alt text-2xl text-red-600"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">AI Detection</h3>
                        <p class="text-gray-600">Detect AI-generated text and plagiarism to ensure academic integrity.</p>
                    </div>
                    <div class="feature-card bg-white p-6 rounded-xl shadow-md">
                        <div class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                            <i class="fas fa-globe text-2xl text-indigo-600"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">Multiple Languages</h3>
                        <p class="text-gray-600">Grade essays in English, Spanish, French, German, and many more languages.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- Grading Interface -->
        <section id="grader" class="py-20 bg-white">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="text-center mb-12">
                    <h2 class="text-4xl font-bold text-gray-900 mb-4">Try It Now</h2>
                    <p class="text-xl text-gray-600">Grade your first essay in seconds</p>
                </div>

                <!-- Main Grading Interface -->
                <div id="mainInterface">
                    <div class="bg-white rounded-xl shadow-2xl p-8 border border-gray-200">
                        <form id="gradingForm" class="space-y-6">
                            <div class="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-file-alt mr-2 text-purple-600"></i>Assignment Prompt
                                    </label>
                                    <textarea 
                                        id="assignmentPrompt" 
                                        rows="4" 
                                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        placeholder="E.g., Analyze the major causes of World War II, support your arguments using specific historical examples..."
                                        required
                                    ></textarea>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-user-graduate mr-2 text-purple-600"></i>Grade Level
                                    </label>
                                    <input 
                                        type="text" 
                                        id="gradeLevel" 
                                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
                                        placeholder="E.g., 12th-grade social studies"
                                        required
                                    />
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-clipboard-list mr-2 text-purple-600"></i>Rubric Criteria
                                    </label>
                                    <div id="rubricContainer" class="space-y-2 max-h-64 overflow-y-auto">
                                        <!-- Criteria will be added dynamically -->
                                    </div>
                                    <button 
                                        type="button" 
                                        onclick="addCriterion()" 
                                        class="mt-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm"
                                    >
                                        <i class="fas fa-plus mr-2"></i>Add Criterion
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-pen-fancy mr-2 text-purple-600"></i>Student Essay
                                </label>
                                <textarea 
                                    id="essayText" 
                                    rows="10" 
                                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                                    placeholder="Paste the student essay here..."
                                    required
                                ></textarea>
                            </div>

                            <div class="flex justify-center">
                                <button 
                                    type="submit" 
                                    class="bg-gradient-to-r from-purple-600 to-blue-500 text-white px-12 py-4 rounded-lg font-bold text-lg hover:shadow-2xl transition transform hover:scale-105"
                                >
                                    <i class="fas fa-magic mr-2"></i>Grade Essay with AI
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- Loading Indicator -->
                <div id="loadingIndicator" class="hidden text-center py-20">
                    <div class="loading-spinner mx-auto mb-6"></div>
                    <p class="text-2xl font-semibold text-gray-700">Analyzing essay...</p>
                    <p class="text-gray-500 mt-2">This typically takes 5-10 seconds</p>
                </div>

                <!-- Results Display -->
                <div id="resultsContainer" class="hidden"></div>
            </div>
        </section>

        <!-- Privacy Section -->
        <section class="py-16 bg-gray-50">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="text-center mb-12">
                    <h2 class="text-3xl font-bold text-gray-900 mb-4">Privacy First by Design</h2>
                    <p class="text-xl text-gray-600">Your data is safe and secure</p>
                </div>
                <div class="grid md:grid-cols-4 gap-8">
                    <div class="text-center">
                        <i class="fas fa-lock text-4xl text-purple-600 mb-4"></i>
                        <h3 class="font-bold mb-2">FERPA Compliant</h3>
                        <p class="text-sm text-gray-600">Full compliance with student privacy laws</p>
                    </div>
                    <div class="text-center">
                        <i class="fas fa-shield-alt text-4xl text-green-600 mb-4"></i>
                        <h3 class="font-bold mb-2">AES-256 Encryption</h3>
                        <p class="text-sm text-gray-600">Bank-level security for all data</p>
                    </div>
                    <div class="text-center">
                        <i class="fas fa-user-shield text-4xl text-blue-600 mb-4"></i>
                        <h3 class="font-bold mb-2">Data Ownership</h3>
                        <p class="text-sm text-gray-600">You own your data, delete anytime</p>
                    </div>
                    <div class="text-center">
                        <i class="fas fa-certificate text-4xl text-yellow-600 mb-4"></i>
                        <h3 class="font-bold mb-2">SOC 2 Type I</h3>
                        <p class="text-sm text-gray-600">Certified security standards</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- FAQ Section -->
        <section id="faq" class="py-20 bg-white">
            <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="text-center mb-12">
                    <h2 class="text-4xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
                </div>
                <div class="space-y-4">
                    <details class="bg-gray-50 p-6 rounded-lg">
                        <summary class="font-bold cursor-pointer">How accurate is the AI grading?</summary>
                        <p class="mt-4 text-gray-600">Our AI achieves less than 4% variance compared to human graders, meeting the substantial agreement threshold (QWK 0.61+) required for academic use.</p>
                    </details>
                    <details class="bg-gray-50 p-6 rounded-lg">
                        <summary class="font-bold cursor-pointer">Can I customize the rubrics?</summary>
                        <p class="mt-4 text-gray-600">Yes! You can create custom rubrics or choose from 400+ pre-built rubrics aligned with CCSS, AP, IB, and state standards.</p>
                    </details>
                    <details class="bg-gray-50 p-6 rounded-lg">
                        <summary class="font-bold cursor-pointer">Is there a free plan?</summary>
                        <p class="mt-4 text-gray-600">Yes! Our free plan includes 25 essays per month. Paid plans start at $19.99/month for unlimited grading.</p>
                    </details>
                    <details class="bg-gray-50 p-6 rounded-lg">
                        <summary class="font-bold cursor-pointer">Does it work with my LMS?</summary>
                        <p class="mt-4 text-gray-600">Yes! We integrate with Google Classroom, Canvas, and Schoology. Sync grades and feedback directly to your LMS.</p>
                    </details>
                </div>
            </div>
        </section>

        <!-- CTA Section -->
        <section class="hero-gradient text-white py-20">
            <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <h2 class="text-4xl font-bold mb-6">Ready to Save Hours Every Week?</h2>
                <p class="text-xl mb-8">Join 1,000+ schools using EssayGrader AI</p>
                <button onclick="scrollToGrader()" class="bg-white text-purple-600 px-12 py-4 rounded-lg font-bold text-lg hover:shadow-2xl transition transform hover:scale-105">
                    <i class="fas fa-rocket mr-2"></i>Start Grading Free
                </button>
                <p class="mt-6 text-white/80 text-sm">No credit card required • Free plan available • Cancel anytime</p>
            </div>
        </section>

        <!-- Footer -->
        <footer class="bg-gray-900 text-white py-12">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="grid md:grid-cols-4 gap-8">
                    <div>
                        <h3 class="font-bold text-xl mb-4">EssayGrader AI</h3>
                        <p class="text-gray-400 text-sm">AI-powered essay grading for teachers</p>
                    </div>
                    <div>
                        <h4 class="font-bold mb-4">Product</h4>
                        <ul class="space-y-2 text-gray-400 text-sm">
                            <li><a href="#" class="hover:text-white">Features</a></li>
                            <li><a href="#" class="hover:text-white">Pricing</a></li>
                            <li><a href="#" class="hover:text-white">For Schools</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 class="font-bold mb-4">Support</h4>
                        <ul class="space-y-2 text-gray-400 text-sm">
                            <li><a href="#" class="hover:text-white">Help Center</a></li>
                            <li><a href="#" class="hover:text-white">Contact</a></li>
                            <li><a href="#" class="hover:text-white">Book Demo</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 class="font-bold mb-4">Legal</h4>
                        <ul class="space-y-2 text-gray-400 text-sm">
                            <li><a href="#" class="hover:text-white">Privacy Policy</a></li>
                            <li><a href="#" class="hover:text-white">Terms of Service</a></li>
                            <li><a href="#" class="hover:text-white">FERPA Compliance</a></li>
                        </ul>
                    </div>
                </div>
                <div class="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 text-sm">
                    <p>© 2025 EssayGrader AI. All rights reserved.</p>
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
