import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import type { Bindings } from './types'

// Route imports
import auth from './routes/auth'
import grading from './routes/grading'
import upload from './routes/upload'
import assignments from './routes/assignments'
import submissions from './routes/submissions'
import admin from './routes/admin'
// import students from './routes/students' // REMOVED: Using inline routes instead

// Import authentication helpers from middleware
import { getUserFromSession, requireAuth, requireStudentAuth, getStudentFromSession, requireAdminAuth, isErrorResponse } from './middleware/auth'

// Import utility functions
import { hashPassword, verifyPassword } from './utils/helpers'


const app = new Hono<{ Bindings: Bindings }>()

// CRITICAL: Global storage utility functions (defined ONCE for all pages)
// These are injected into every HTML page to handle Safari's localStorage blocking
const STORAGE_UTILS_SCRIPT = `
<script>
// Storage fallback for Safari's tracking prevention
function getStorageItem(key) {
  try {
    const value = localStorage.getItem(key);
    return value || sessionStorage.getItem(key);
  } catch (e) {
    // If localStorage is blocked, use sessionStorage
    try {
      return sessionStorage.getItem(key);
    } catch (e2) {
      console.error('Both localStorage and sessionStorage blocked:', e2);
      return null;
    }
  }
}

function setStorageItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // If localStorage is blocked, use sessionStorage
    try {
      sessionStorage.setItem(key, value);
    } catch (e2) {
      console.error('Both localStorage and sessionStorage blocked:', e2);
    }
  }
}

function removeStorageItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    // Ignore errors for localStorage
  }
  try {
    sessionStorage.removeItem(key);
  } catch (e) {
    // Ignore errors for sessionStorage
  }
}

// Make globally available
window.getStorageItem = getStorageItem;
window.setStorageItem = setStorageItem;
window.removeStorageItem = removeStorageItem;
</script>
`

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './' }))
app.use('/rubric-pdfs/*', serveStatic({ root: './' }))
app.use('/rubric-docs/*', serveStatic({ root: './', rewriteRequestPath: (path) => path }))
app.use('/rubric-files/*', serveStatic({ root: './' }))
app.use('/exam-questions/*', serveStatic({ root: './' }))
app.use('/guide-screenshots/*', serveStatic({ root: './' }))

// API route to serve uploaded files from R2 storage or database
app.get('/api/files/*', async (c) => {
  try {
    const fullPath = c.req.path
    // Extract file path after /api/files/
    const storageKey = fullPath.replace('/api/files/', '')
    
    console.log('[File Serve] Requested path:', fullPath)
    console.log('[File Serve] Storage key:', storageKey)
    
    // First, try to get file from database (base64 fallback)
    const db = c.env.DB
    const fileRecord = await db.prepare(
      'SELECT file_data, mime_type, storage_url FROM uploaded_files WHERE storage_key = ?'
    ).bind(storageKey).first()
    
    if (fileRecord && fileRecord.file_data) {
      // File is stored as base64 in database
      console.log('[File Serve] Serving from database (base64)')
      
      // Convert base64 to binary
      const binaryString = atob(fileRecord.file_data as string)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      
      const headers = new Headers()
      headers.set('Content-Type', fileRecord.mime_type as string || 'application/octet-stream')
      headers.set('Cache-Control', 'public, max-age=31536000')
      
      return new Response(bytes.buffer, { headers })
    }
    
    // If file_data is not in DB, try R2 storage
    const r2Bucket = c.env.R2_BUCKET
    if (r2Bucket) {
      const object = await r2Bucket.get(storageKey)
      
      if (object) {
        console.log('[File Serve] Serving from R2, size:', object.size)
        
        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('etag', object.httpEtag)
        headers.set('Cache-Control', 'public, max-age=31536000')
        
        return new Response(object.body, { headers })
      }
    }
    
    console.log('[File Serve] File not found:', storageKey)
    return c.text('File not found', 404)
  } catch (error) {
    console.error('[File Serve] Error:', error)
    return c.text(`Internal Server Error: ${error}`, 500)
  }
})

// Serve uploaded files from R2 storage (old pattern, kept for compatibility)
// Pattern: /user_3/1766590006882_wh9qm______.png
app.get('/user_*', async (c) => {
  // Redirect to API route
  const newPath = `/api/files${c.req.path}`
  return c.redirect(newPath)
})

// Serve favicon directly
app.get('/favicon.svg', (c) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#1e3a8a"/>
  <text x="50" y="70" font-family="Arial" font-size="60" font-weight="bold" fill="white" text-anchor="middle">AI</text>
</svg>`;
  return c.body(svg, 200, {
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'public, max-age=31536000'
  });
})

// Mount API route modules
app.route('/api/auth', auth)
app.route('/api', grading)
app.route('/api/upload', upload)
// app.route('/api/assignment', assignments) // REMOVED: Using inline routes instead to support library assignments
app.route('/api/submission', submissions)
app.route('/api/admin', admin)
// app.route('/api/student', students) // REMOVED: Using inline routes instead

// Rubric detail pages
app.get('/rubric-detail/:rubricId', (c) => {
  const rubricId = c.req.param('rubricId')
  
  // Rubric data map
  const rubricData: Record<string, { title: string, pdf: string, criteria: Array<{ name: string, desc: string }> }> = {
    'standard': {
      title: '표준 논술 루브릭 (4개 기준)',
      pdf: '/rubric-pdfs/표준 논술 루브릭(4개 기준).pdf',
      criteria: [
        { name: '핵심 개념의 이해와 분석', desc: '논제를 정확하게 파악하고 깊이 있게 분석했습니다.', max_score: 4 },
        { name: '증거와 사례 활용', desc: '논거가 논리적이고 설득력이 있습니다.', max_score: 4 },
        { name: '출처 인용의 정확성', desc: '구체적이고 적절한 사례를 효과적으로 활용했습니다.', max_score: 4 },
        { name: '문법 정확성, 구성 및 흐름', desc: '문법, 어휘, 문장 구조가 정확하고 적절합니다.', max_score: 4 }
      ]
    },
    'kr_elementary': {
      title: '초등학생용 평가 기준',
      pdf: '/rubric-pdfs/초등학생용 평가 기준.pdf',
      criteria: [
        { name: '내용의 풍부성', desc: '자신의 생각이나 느낌, 경험을 구체적이고 솔직하게 표현했습니다.', max_score: 40 },
        { name: '글의 짜임', desc: '글의 시작(처음), 중간(가운데), 끝(맺음)이 자연스럽게 연결됩니다.', max_score: 30 },
        { name: '표현과 맞춤법', desc: '문장의 자연스러움과 맞춤법, 띄어쓰기 등 기초적인 표기법이 올바릅니다.', max_score: 30 }
      ]
    },
    'kr_middle': {
      title: '중학생용 평가 기준',
      pdf: '/rubric-pdfs/중학생용 평가 기준.pdf',
      criteria: [
        { name: '주제의 명료성', desc: '글쓴이의 주장이나 주제가 분명하게 드러납니다.', max_score: 20 },
        { name: '논리적 구성', desc: '서론(도입)-본론(전개)-결론(정리)의 형식을 갖추고 문단이 잘 구분되었습니다.', max_score: 30 },
        { name: '근거의 적절성', desc: '주장을 뒷받침하기 위해 적절한 이유나 예시를 들었습니다.', max_score: 30 },
        { name: '표현의 정확성', desc: '표준어 사용, 맞춤법, 문장의 호응 등 기본적인 국어 사용 능력이 우수합니다.', max_score: 20 }
      ]
    },
    'kr_high': {
      title: '고등학생용 평가 기준',
      pdf: '/rubric-pdfs/고등학생용 평가 기준.pdf',
      criteria: [
        { name: '통찰력 및 비판적 사고', desc: '주제를 단순히 나열하지 않고, 자신만의 관점으로 심도 있게 분석하거나 비판적으로 고찰했습니다.', max_score: 30 },
        { name: '논증의 체계성', desc: '논지가 유기적으로 연결되며, 예상되는 반론을 고려하거나 논리적 완결성을 갖추었습니다.', max_score: 30 },
        { name: '근거의 타당성 및 다양성', desc: '객관적 자료, 전문가 견해 등 신뢰할 수 있는 근거를 활용하여 설득력을 높였습니다.', max_score: 25 },
        { name: '문체 및 어법의 세련됨', desc: '학술적 글쓰기에 적합한 어조와 세련된 문장 구사력을 보여줍니다.', max_score: 15 }
      ]
    },
    'nyregents': {
      title: '뉴욕 주 리젠트 시험 논증적 글쓰기 루브릭 (4개 기준)',
      pdf: '/rubric-pdfs/뉴욕 주 리젠트 시험 논증적 글쓰기 루브릭.pdf',
      criteria: [
        { name: 'Content and Analysis (내용과 분석)', desc: '명확하고 통찰력 있는 논제를 제시하며, 과제와 맥락에 대한 깊이 있는 이해를 보여줍니다. 복잡한 개념을 효과적으로 분석하고 설명합니다.' },
        { name: 'Use of Evidence (증거 활용)', desc: '제공된 문서(documents)를 효과적으로 활용하여 논증을 뒷받침합니다. 관련성 높은 증거를 명시적으로 인용하고, 증거와 논제 간의 관계를 명확하게 설명합니다.' },
        { name: 'Coherence, Organization (일관성과 구성)', desc: '논리적으로 잘 구성되어 있으며, 명확한 서론-본론-결론 구조를 갖추고 있습니다. 각 단락이 효과적으로 연결되어 전체 논지가 일관성 있게 전개됩니다.' },
        { name: 'Language Use and Conventions (언어 사용과 규칙)', desc: '문법과 철자가 정확하며, 적절한 학술적 어휘를 사용합니다. 문장 구조가 다양하고 명확하여 읽기 쉽습니다.' }
      ]
    },
    'nyregents_analytical': {
      title: '뉴욕 주 리젠트 시험 분석적 글쓰기 루브릭',
      pdf: '/rubric-pdfs/뉴욕 주 리젠트 시험 분석적 글쓰기 루브릭.pdf',
      criteria: [
        { name: 'Analysis and Interpretation (분석과 해석)', desc: '텍스트에 대한 깊이 있는 분석을 제시하며, 복잡한 개념과 관계를 명확하게 해석합니다. 통찰력 있는 결론을 도출하고 비판적 사고를 보여줍니다.' },
        { name: 'Use of Evidence (증거 활용)', desc: '텍스트에서 적절하고 관련성 높은 증거를 선택하여 효과적으로 인용합니다. 각 증거가 분석을 어떻게 뒷받침하는지 명확하게 설명합니다.' },
        { name: 'Organization and Development (구성과 전개)', desc: '논리적이고 일관성 있는 구조로 분석을 전개합니다. 명확한 서론-본론-결론 구조를 갖추며, 각 단락이 효과적으로 연결됩니다.' },
        { name: 'Language Use and Style (언어 사용과 스타일)', desc: '문법과 철자가 정확하며, 학술적이고 세련된 어휘를 사용합니다. 다양한 문장 구조를 활용하여 명확하고 유창하게 표현합니다.' }
      ]
    },
    'ny_middle': {
      title: '뉴욕 주 중학교 논술 루브릭',
      pdf: '/rubric-pdfs/뉴욕 주 중학교 논술 루브릭.pdf',
      criteria: [
        { name: 'Content and Analysis (내용과 분석)', desc: '역사적 사건과 개념을 정확하게 이해하고 분석합니다. 과제 요구사항을 충실히 따르며, 역사적 맥락 내에서 복잡한 관계를 설명합니다.' },
        { name: 'Use of Documents (문서 활용)', desc: '제공된 역사 문서를 효과적으로 활용하여 주장을 뒷받침합니다. 문서의 핵심 정보를 정확하게 인용하고 해석합니다.' },
        { name: 'Organization (구성)', desc: '논리적이고 체계적인 구조를 갖추고 있습니다. 서론-본론-결론이 명확하며, 각 단락이 효과적으로 연결되어 일관성 있게 전개됩니다.' },
        { name: 'Language Use (언어 사용)', desc: '중학교 수준에 적합한 어휘와 문법을 정확하게 사용합니다. 문장 구조가 다양하고 명확하여 이해하기 쉽습니다.' }
      ]
    },
    'ny_elementary': {
      title: '뉴욕 주 초등학교 논술 루브릭',
      pdf: '/rubric-pdfs/뉴욕 주 초등학교 논술 루브릭.pdf',
      criteria: [
        { name: 'Understanding the Topic (주제 이해)', desc: '주제를 정확하게 이해하고, 질문에 충실하게 답변합니다. 배운 내용을 바탕으로 명확하게 설명합니다.' },
        { name: 'Use of Examples (예시 활용)', desc: '구체적이고 적절한 예시를 사용하여 설명합니다. 자료나 배운 내용을 효과적으로 활용합니다.' },
        { name: 'Organization (구성)', desc: '글이 체계적으로 구성되어 있으며, 처음-중간-끝이 명확합니다. 문장들이 자연스럽게 연결되어 이해하기 쉽습니다.' },
        { name: 'Writing Skills (글쓰기 기술)', desc: '맞춤법과 문법이 정확합니다. 학년 수준에 맞는 어휘를 사용하며, 문장이 명확하고 읽기 쉽습니다.' }
      ]
    },
    'ib_myp_highschool': {
      title: 'IB 중등 프로그램 (MYP) 고등학교 개인과 사회 논술 루브릭',
      pdf: '/rubric-pdfs/IB 중등 프로그램 고등학교 개인과 사회 논술 루브릭.pdf',
      criteria: [
        { name: 'Criterion A: Knowing and Understanding (지식과 이해)', desc: '특정 분야의 다양한 주제에 대한 지식을 포괄적으로 설명합니다. 개념, 사건, 문제점, 관점 등을 정확하고 자세하게 기술합니다.' },
        { name: 'Criterion B: Investigating (탐구)', desc: '명확하고 집중된 연구 질문을 수립합니다. 다양한 관점에서 정보를 수집하고 기록하며, 신뢰할 수 있는 정보의 출처를 평가합니다.' },
        { name: 'Criterion C: Communicating (의사소통)', desc: '조사 결과를 적절한 형식으로 명확하고 일관성 있게 전달합니다. 상황과 목적에 적합한 방식으로 정보를 종합하여 제시합니다.' },
        { name: 'Criterion D: Thinking Critically (비판적 사고)', desc: '다양한 출처의 정보를 분석하여 유효성과 관련성을 평가합니다. 여러 관점을 종합하여 타당한 논증을 구성하고, 통찰력 있는 결론을 도출합니다.' }
      ]
    },
    'ib_myp_middleschool': {
      title: 'IB 중등 프로그램 (MYP) 중학교 개인과 사회 논술 루브릭',
      pdf: '/rubric-pdfs/IB 중등 프로그램 중학교 개인과 사회 논술 루브릭.pdf',
      criteria: [
        { name: 'Criterion A: Knowing and Understanding (지식과 이해)', desc: '특정 분야의 다양한 주제에 대한 지식을 효과적으로 설명합니다. 개념, 사건, 문제점을 적절한 용어를 사용하여 기술합니다.' },
        { name: 'Criterion B: Investigating (탐구)', desc: '명확한 연구 질문을 수립하고, 관련 정보를 수집하고 기록합니다. 정보 출처의 신뢰성을 평가하며 효과적으로 활용합니다.' },
        { name: 'Criterion C: Communicating (의사소통)', desc: '조사 결과를 적절한 형식으로 명확하게 전달합니다. 정보를 효과적으로 종합하여 목적에 맞게 제시합니다.' },
        { name: 'Criterion D: Thinking Critically (비판적 사고)', desc: '다양한 출처의 정보를 분석하여 신뢰성을 평가합니다. 여러 관점을 고려하여 타당한 논증을 구성하고, 합리적인 결론을 도출합니다.' }
      ]
    },
    'ib_myp_science': {
      title: 'IB 중등 프로그램 (MYP) 과학 논술 루브릭',
      pdf: '/rubric-pdfs/IB 중등 프로그램 과학 논술 루브릭.pdf',
      criteria: [
        { name: 'Criterion A: Knowing and Understanding (지식과 이해)', desc: '과학적 지식을 포괄적으로 설명하고, 과학 이론과 법칙을 정확하게 기술합니다. 과학적 개념을 상황에 맞게 적용하고 해결책을 제시합니다.' },
        { name: 'Criterion B: Inquiring and Designing (탐구와 설계)', desc: '검증 가능한 과학적 연구 질문을 수립하고, 변인을 정확하게 설정합니다. 타당한 가설을 제시하고 효과적인 실험 방법을 설계합니다.' },
        { name: 'Criterion C: Processing and Evaluating (처리와 평가)', desc: '실험 데이터를 정확하게 기록하고 효과적으로 처리합니다. 데이터의 타당성을 평가하고, 경향성과 패턴을 해석하여 과학적 결론을 도출합니다.' },
        { name: 'Criterion D: Reflecting on Scientific Impact (과학적 영향 성찰)', desc: '과학이 사회와 환경에 미치는 영향을 심도 있게 논의합니다. 과학 발전의 긍정적/부정적 측면을 균형 있게 평가하고 윤리적 함의를 고려합니다.' }
      ]
    }
  }
  
  const rubric = rubricData[rubricId]
  if (!rubric) {
    return c.html('<html><body><h1>루브릭을 찾을 수 없습니다</h1></body></html>', 404)
  }
  
  const criteriaHtml = rubric.criteria.map((criterion, idx) => {
    const colors = ['blue', 'green', 'purple', 'orange']
    const color = colors[idx % colors.length]
    const maxScore = criterion.max_score || 4
    return '<div class="border-l-4 border-' + color + '-500 pl-4 py-2">' +
      '<h2 class="text-xl font-semibold text-gray-800 mb-2">' + (idx + 1) + '. ' + criterion.name + '</h2>' +
      '<div class="bg-' + color + '-50 p-4 rounded">' +
      '<p class="text-sm font-semibold text-' + color + '-700 mb-2">최고 수준 (' + maxScore + '점)</p>' +
      '<p class="text-gray-700">' + criterion.desc + '</p>' +
      '</div></div>'
  }).join('\n')
  
  return c.html('<!DOCTYPE html>' +
    '<html lang="ko"><head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + rubric.title + '</title>' +
    '<script src="https://cdn.tailwindcss.com"></script>' +
    '</head><body class="bg-gray-50 p-8">' +
    '<div class="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">' +
    '<h1 class="text-3xl font-bold text-gray-800 mb-6">' + rubric.title + '</h1>' +
    '<div class="mb-8">' +
    '<p class="text-gray-600 mb-4">각 기준별 최고 수준의 성취 기준은 다음과 같습니다.</p>' +
    '</div><div class="space-y-6">' + criteriaHtml + '</div>' +
    '<div class="mt-8 pt-6 border-t border-gray-200">' +
    '<h3 class="text-lg font-semibold text-gray-800 mb-3">상세 루브릭 파일</h3>' +
    '<div class="flex gap-3">' +
    '<a href="' + rubric.pdf + '" target="_blank" ' +
    'class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">' +
    '<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />' +
    '</svg>PDF 파일 다운로드</a>' +
    '<a href="/resources/rubric" ' +
    'class="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors">' +
    '<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />' +
    '</svg>목록으로 가기</a>' +
    '</div></div></div></body></html>')
})

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Google OAuth 2.0 Callback
app.get('/api/auth/google/callback', async (c) => {
  try {
    const { code, state, error } = c.req.query()
    
    console.log('[OAuth] Callback received:', { hasCode: !!code, hasState: !!state, error })
    console.log('[OAuth] Environment check:', { 
      hasClientId: !!c.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!c.env.GOOGLE_CLIENT_SECRET,
      hasDB: !!c.env.DB
    })
    
    // Check for OAuth errors
    if (error) {
      console.error('[OAuth] Google error:', error)
      return c.html(`
        <!DOCTYPE html>
        <html>
        <head><title>로그인 오류</title></head>
        <body>
          <script>
            alert('Google 로그인 오류: ${error}');
            window.location.href = '/signup';
          </script>
        </body>
        </html>
      `)
    }
    
    if (!code) {
      console.error('[OAuth] No authorization code received')
      return c.html(`
        <!DOCTYPE html>
        <html>
        <head><title>로그인 오류</title></head>
        <body>
          <script>
            alert('인증 코드가 없습니다.');
            window.location.href = '/signup';
          </script>
        </body>
        </html>
      `)
    }
    
    // Check environment variables
    if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
      console.error('[OAuth] Missing environment variables')
      return c.html(`
        <!DOCTYPE html>
        <html>
        <head><title>로그인 오류</title></head>
        <body>
          <script>
            alert('서버 설정 오류: Google OAuth 환경변수가 없습니다.');
            window.location.href = '/signup';
          </script>
        </body>
        </html>
      `)
    }
    
    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code,
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${new URL(c.req.url).origin}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    })
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('[OAuth] Token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorData
      })
      return c.html(`
        <!DOCTYPE html>
        <html>
        <head><title>로그인 오류</title></head>
        <body>
          <script>
            alert('토큰 교환 실패: ${tokenResponse.status} - ${errorData.substring(0, 100)}');
            window.location.href = '/signup';
          </script>
        </body>
        </html>
      `)
    }
    
    console.log('[OAuth] Token exchange successful')
    
    const tokenData = await tokenResponse.json()
    
    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    })
    
    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text()
      console.error('[OAuth] User info fetch failed:', {
        status: userInfoResponse.status,
        error: errorText
      })
      return c.html(`
        <!DOCTYPE html>
        <html>
        <head><title>로그인 오류</title></head>
        <body>
          <script>
            alert('사용자 정보 가져오기 실패: ${userInfoResponse.status}');
            window.location.href = '/signup';
          </script>
        </body>
        </html>
      `)
    }
    
    const googleUser = await userInfoResponse.json()
    console.log('[OAuth] User info retrieved:', { email: googleUser.email, name: googleUser.name })
    
    // Check if user exists
    const existingUser = await c.env.DB.prepare(`
      SELECT id, name, email, subscription, is_admin FROM users WHERE email = ?
    `).bind(googleUser.email).first()
    
    if (existingUser) {
      // Check if admin status needs to be updated
      const shouldBeAdmin = googleUser.email === 'dudtp999@gmail.com'
      if (shouldBeAdmin && existingUser.is_admin !== 1) {
        await c.env.DB.prepare(`
          UPDATE users SET is_admin = 1 WHERE id = ?
        `).bind(existingUser.id).run()
        console.log('[OAuth] Updated user to admin:', existingUser.email)
      }
      
      // User exists, log them in
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`
      
      // Session expires in 30 days
      await c.env.DB.prepare(`
        INSERT INTO sessions (id, user_id, expires_at, created_at)
        VALUES (?, ?, datetime('now', '+30 days'), datetime('now'))
      `).bind(sessionId, existingUser.id).run()
      
      console.log('[OAuth] Existing user logged in:', { 
        email: existingUser.email,
        is_admin: shouldBeAdmin,
        user_id: existingUser.id
      })
      
      return c.html(`
        <!DOCTYPE html>
        <html>
        <head><title>로그인 성공</title></head>
        <body>
          <script>
            localStorage.setItem('session_id', '${sessionId}');
            localStorage.setItem('user_name', '${existingUser.name}');
            localStorage.setItem('user_email', '${existingUser.email}');
            localStorage.setItem('isLoggedIn', 'true');
            alert('Google 로그인 성공!');
            window.location.href = '/my-page';
          </script>
        </body>
        </html>
      `)
    } else {
      // Create new user
      const hashedPassword = await hashPassword('google-oauth-' + googleUser.id)
      
      // Check if this is the admin account
      const isAdmin = googleUser.email === 'dudtp999@gmail.com' ? 1 : 0
      
      const insertResult = await c.env.DB.prepare(`
        INSERT INTO users (name, email, password_hash, subscription, is_admin, created_at)
        VALUES (?, ?, ?, '무료', ?, datetime('now'))
      `).bind(googleUser.name, googleUser.email, hashedPassword, isAdmin).run()
      
      const userId = insertResult.meta.last_row_id
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`
      
      // Session expires in 30 days
      await c.env.DB.prepare(`
        INSERT INTO sessions (id, user_id, expires_at, created_at)
        VALUES (?, ?, datetime('now', '+30 days'), datetime('now'))
      `).bind(sessionId, userId).run()
      
      console.log('[OAuth] New user created:', { 
        email: googleUser.email, 
        is_admin: isAdmin,
        user_id: userId 
      })
      
      return c.html(`
        <!DOCTYPE html>
        <html>
        <head><title>회원가입 성공</title></head>
        <body>
          <script>
            localStorage.setItem('session_id', '${sessionId}');
            localStorage.setItem('user_name', '${googleUser.name}');
            localStorage.setItem('user_email', '${googleUser.email}');
            localStorage.setItem('isLoggedIn', 'true');
            alert('Google 회원가입 및 로그인 성공!');
            window.location.href = '/my-page';
          </script>
        </body>
        </html>
      `)
    }
  } catch (error) {
    console.error('[OAuth] Unexpected error:', error)
    console.error('[OAuth] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head><title>로그인 오류</title></head>
      <body>
        <script>
          alert('Google 로그인 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}');
          window.location.href = '/signup';
        </script>
      </body>
      </html>
    `)
  }
})

// Legacy API Routes (to be removed - keeping for compatibility)

/**
 * POST /api/grade - Grade an essay (DEPRECATED - use mounted route)
 */
/*
app.post('/api/grade', async (c) => {
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
 * POST /api/upload/image - Upload and process image file
 */
app.post('/api/upload/image', async (c) => {
  try {
    const user = await getUserFromSession(c)
    const student = await getStudentFromSession(c)
    
    // Either teacher or student must be logged in
    if (!user && !student) {
      return c.json({ error: '로그인이 필요합니다' }, 401)
    }
    
    const db = c.env.DB
    const credentialsJson = c.env.GOOGLE_APPLICATION_CREDENTIALS
    
    // Parse multipart form data
    const formData = await c.req.formData()
    const file = formData.get('file') as File
    const submissionId = formData.get('submission_id') as string | null
    const skipOcrRaw = formData.get('skip_ocr')
    const skipOcr = skipOcrRaw === 'true' // Flag to skip OCR for charts/graphs/maps
    
    // Debug log
    console.log('[DEBUG] /api/upload/image - skip_ocr received:', skipOcrRaw, 'parsed as:', skipOcr)
    
    if (!file) {
      return c.json({ error: '파일이 제공되지 않았습니다' }, 400)
    }
    
    // Get allowed types and max size from environment
    const maxSize = parseInt(c.env.MAX_FILE_SIZE || '10485760') // 10MB default
    const allowedTypes = (c.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/jpg,image/webp').split(',')
    
    // Validate file
    const validation = validateFile(file, allowedTypes, maxSize)
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400)
    }
    
    // Generate storage key
    const storageKey = generateStorageKey(user?.id || student?.id || null, file.name)
    
    // Read file as ArrayBuffer
    const fileBuffer = await file.arrayBuffer()
    
    // Upload to R2 storage
    const r2Bucket = c.env.R2_BUCKET
    const r2Result = await uploadToR2(r2Bucket, storageKey, fileBuffer, file.type)
    
    if (!r2Result.success) {
      return c.json({ error: r2Result.error || 'R2 업로드 실패' }, 500)
    }
    
    // Store file metadata in database
    const result = await db.prepare(
      `INSERT INTO uploaded_files 
       (user_id, student_user_id, submission_id, file_name, file_type, mime_type, file_size, storage_key, storage_url, processing_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      user?.id || null,
      student?.id || null,
      submissionId || null,
      file.name,
      'image',
      file.type,
      file.size,
      storageKey,
      r2Result.url || null,
      'processing'
    ).run()
    
    const uploadedFileId = result.meta.last_row_id as number
    
    // Log upload step
    await logProcessingStep(db, uploadedFileId, 'upload', 'completed', 'R2 업로드 및 메타데이터 저장 완료', null)
    
    // If skip_ocr flag is set, return image URL directly without OCR processing
    // This is useful for charts, graphs, maps, and other visual content
    if (skipOcr) {
      console.log('[DEBUG] Skipping OCR for file:', file.name, '(skip_ocr=true)')
      
      await db.prepare(
        `UPDATE uploaded_files 
         SET processing_status = ?, processed_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind('completed', uploadedFileId).run()
      
      await logProcessingStep(
        db,
        uploadedFileId,
        'ocr',
        'skipped',
        'OCR 건너뜀 (시각적 자료)',
        0
      )
      
      const skipResponse = {
        success: true,
        file_id: uploadedFileId,
        file_name: file.name,
        storage_url: r2Result.url,
        image_url: r2Result.url,
        extracted_text: null,
        ocr_skipped: true,
        message: '이미지가 업로드되었습니다 (OCR 건너뜀)'
      }
      console.log('[DEBUG] Returning skip_ocr response:', JSON.stringify(skipResponse))
      return c.json(skipResponse)
    }
    
    console.log('[DEBUG] Proceeding with OCR processing for file:', file.name)
    
    // Process image with OCR - Try Google Vision API first (higher accuracy)
    let extractedText = null
    const startTime = Date.now()
    
    try {
      // Try Google Vision API first if credentials available
      if (credentialsJson) {
        try {
          const ocrResult = await processImageOCR(
            { name: file.name, buffer: fileBuffer, type: file.type, size: file.size },
            credentialsJson
          )
          
          if (ocrResult.success && ocrResult.extractedText) {
            extractedText = ocrResult.extractedText
            
            // Update database with extracted text
            await db.prepare(
              `UPDATE uploaded_files 
               SET extracted_text = ?, processing_status = ?, processed_at = CURRENT_TIMESTAMP
               WHERE id = ?`
            ).bind(ocrResult.extractedText, 'completed', uploadedFileId).run()
            
            // Log OCR step
            await logProcessingStep(
              db,
              uploadedFileId,
              'ocr',
              'completed',
              `추출된 텍스트: ${ocrResult.extractedText.length} characters (Google Vision)`,
              ocrResult.processingTimeMs || null
            )
          } else {
            throw new Error('Google Vision OCR failed - no text extracted')
          }
        } catch (googleError) {
          console.error('Google Vision API error, trying OCR.space fallback:', googleError)
          
          // Fallback to OCR.space using file upload (supports larger files than base64)
          const ocrApiKey = c.env.OCR_SPACE_API_KEY || 'K87899142388957'
          
          console.log('Uploading file directly to OCR.space...')
          
          // Create a File-like object from ArrayBuffer
          const blob = new Blob([fileBuffer], { type: file.type })
          const ocrFormData = new FormData()
          ocrFormData.append('file', blob, file.name)
          ocrFormData.append('language', 'kor')
          ocrFormData.append('isOverlayRequired', 'false')
          ocrFormData.append('detectOrientation', 'true')
          ocrFormData.append('scale', 'true')
          ocrFormData.append('OCREngine', '2')
          ocrFormData.append('apikey', ocrApiKey)
          
          const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            body: ocrFormData
          })
          
          const ocrData = await ocrResponse.json()
          console.log('OCR.space response (file upload):', JSON.stringify(ocrData))
          
          if (ocrData.IsErroredOnProcessing === false && ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
            extractedText = ocrData.ParsedResults[0].ParsedText
            
            if (extractedText && extractedText.trim().length > 0) {
              // Update database with extracted text
              await db.prepare(
                `UPDATE uploaded_files 
                 SET extracted_text = ?, processing_status = ?, processed_at = CURRENT_TIMESTAMP
                 WHERE id = ?`
              ).bind(extractedText, 'completed', uploadedFileId).run()
              
              // Log OCR step
              await logProcessingStep(
                db,
                uploadedFileId,
                'ocr',
                'completed',
                `추출된 텍스트: ${extractedText.length} characters (OCR.space fallback)`,
                Date.now() - startTime
              )
            } else {
              console.error('OCR.space: Empty text extracted')
              throw new Error('OCR.space fallback: 이미지에서 텍스트를 찾을 수 없습니다')
            }
          } else {
            const errorMsg = ocrData.ErrorMessage && ocrData.ErrorMessage.length > 0 
              ? ocrData.ErrorMessage.join(', ') 
              : `OCR.space 오류: ${JSON.stringify(ocrData)}`
            console.error('OCR.space failed:', errorMsg)
            throw new Error(errorMsg)
          }
        }
      } else {
        // No Google credentials - use OCR.space as primary
        const ocrApiKey = c.env.OCR_SPACE_API_KEY || 'K87899142388957'
        
        console.log('Uploading file directly to OCR.space (primary)...')
        
        // Create a File-like object from ArrayBuffer
        const blob = new Blob([fileBuffer], { type: file.type })
        const ocrFormData = new FormData()
        ocrFormData.append('file', blob, file.name)
        ocrFormData.append('language', 'kor')
        ocrFormData.append('isOverlayRequired', 'false')
        ocrFormData.append('detectOrientation', 'true')
        ocrFormData.append('scale', 'true')
        ocrFormData.append('OCREngine', '2')
        ocrFormData.append('apikey', ocrApiKey)
        
        const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
          method: 'POST',
          body: ocrFormData
        })
        
        const ocrData = await ocrResponse.json()
        console.log('OCR.space response (file upload, primary):', JSON.stringify(ocrData))
        
        if (ocrData.IsErroredOnProcessing === false && ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
          extractedText = ocrData.ParsedResults[0].ParsedText
          
          if (extractedText && extractedText.trim().length > 0) {
            // Update database with extracted text
            await db.prepare(
              `UPDATE uploaded_files 
               SET extracted_text = ?, processing_status = ?, processed_at = CURRENT_TIMESTAMP
               WHERE id = ?`
            ).bind(extractedText, 'completed', uploadedFileId).run()
            
            // Log OCR step
            await logProcessingStep(
              db,
              uploadedFileId,
              'ocr',
              'completed',
              `추출된 텍스트: ${extractedText.length} characters (OCR.space)`,
              Date.now() - startTime
            )
          } else {
            console.error('OCR.space: Empty text extracted')
            throw new Error('이미지에서 텍스트를 찾을 수 없습니다')
          }
        } else {
          const errorMsg = ocrData.ErrorMessage && ocrData.ErrorMessage.length > 0 
            ? ocrData.ErrorMessage.join(', ') 
            : `OCR.space 오류: ${JSON.stringify(ocrData)}`
          console.error('OCR.space failed:', errorMsg)
          throw new Error(errorMsg)
        }
      }
    } catch (error) {
      console.error('All OCR methods failed:', error)
      
      // All OCR methods failed - mark as completed without text
      await db.prepare(
        `UPDATE uploaded_files 
         SET processing_status = ?, processed_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind('completed', uploadedFileId).run()
      
      await logProcessingStep(
        db,
        uploadedFileId,
        'ocr',
        'failed',
        `모든 OCR 방법 실패: ${String(error)}`,
        Date.now() - startTime
      )
    }
    
    // Return response with OCR status
    if (!extractedText || extractedText.trim().length === 0) {
      return c.json({
        success: true,
        file_id: uploadedFileId,
        file_name: file.name,
        storage_url: r2Result.url,
        image_url: r2Result.url,
        extracted_text: null,
        ocr_available: !!credentialsJson,
        message: '이미지가 업로드되었습니다. OCR로 텍스트를 추출할 수 없었습니다.'
      })
    }
    
    return c.json({
      success: true,
      file_id: uploadedFileId,
      file_name: file.name,
      storage_url: r2Result.url,
      image_url: r2Result.url,
      extracted_text: extractedText,
      ocr_available: !!credentialsJson
    })
  } catch (error) {
    console.error('Image upload error:', error)
    return c.json({ error: '이미지 업로드 처리 실패', details: String(error) }, 500)
  }
})

/**
 * POST /api/upload/pdf - Upload and process PDF file
 */
app.post('/api/upload/pdf', async (c) => {
  try {
    const user = await getUserFromSession(c)
    const student = await getStudentFromSession(c)
    
    // Either teacher or student must be logged in
    if (!user && !student) {
      return c.json({ error: '로그인이 필요합니다' }, 401)
    }
    
    const db = c.env.DB
    const credentialsJson = c.env.GOOGLE_APPLICATION_CREDENTIALS
    
    // Parse multipart form data
    const formData = await c.req.formData()
    const file = formData.get('file') as File
    const submissionId = formData.get('submission_id') as string | null
    
    if (!file) {
      return c.json({ error: '파일이 제공되지 않았습니다' }, 400)
    }
    
    // Get allowed types and max size from environment
    const maxSize = parseInt(c.env.MAX_FILE_SIZE || '10485760') // 10MB default
    const allowedTypes = (c.env.ALLOWED_PDF_TYPES || 'application/pdf').split(',')
    
    // Validate file
    const validation = validateFile(file, allowedTypes, maxSize)
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400)
    }
    
    // Generate storage key
    const storageKey = generateStorageKey(user?.id || student?.id || null, file.name)
    
    // Read file as ArrayBuffer
    const fileBuffer = await file.arrayBuffer()
    
    // Upload to R2 storage
    const r2Bucket = c.env.R2_BUCKET
    const r2Result = await uploadToR2(r2Bucket, storageKey, fileBuffer, file.type)
    
    if (!r2Result.success) {
      return c.json({ error: r2Result.error || 'R2 업로드 실패' }, 500)
    }
    
    // Store file metadata in database
    const result = await db.prepare(
      `INSERT INTO uploaded_files 
       (user_id, student_user_id, submission_id, file_name, file_type, mime_type, file_size, storage_key, storage_url, processing_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      user?.id || null,
      student?.id || null,
      submissionId || null,
      file.name,
      'pdf',
      file.type,
      file.size,
      storageKey,
      r2Result.url || null,
      'processing'
    ).run()
    
    const uploadedFileId = result.meta.last_row_id as number
    
    // Log upload step
    await logProcessingStep(db, uploadedFileId, 'upload', 'completed', 'R2 업로드 및 메타데이터 저장 완료', null)
    
    // For PDF files, use OCR.space API
    // OCR.space natively supports PDF files and works well in Cloudflare Workers
    try {
      const ocrSpaceApiKey = c.env.OCR_SPACE_API_KEY
      
      if (!ocrSpaceApiKey) {
        throw new Error('OCR.space API key not configured')
      }
      
      await logProcessingStep(
        db,
        uploadedFileId,
        'pdf_processing',
        'started',
        'PDF OCR 처리 시작 (OCR.space)...',
        null
      )
      
      const ocrResult = await processOCRSpace(
        { name: file.name, buffer: fileBuffer, type: file.type, size: file.size },
        ocrSpaceApiKey
      )
      
      if (ocrResult.success && ocrResult.extractedText) {
        await db.prepare(
          `UPDATE uploaded_files 
           SET extracted_text = ?, processing_status = ?, processed_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).bind(ocrResult.extractedText, 'completed', uploadedFileId).run()
        
        await logProcessingStep(
          db,
          uploadedFileId,
          'pdf_ocr',
          'completed',
          `추출된 텍스트 (OCR): ${ocrResult.extractedText.length} characters`,
          ocrResult.processingTimeMs || null
        )
        
        return c.json({
          success: true,
          file_id: uploadedFileId,
          file_name: file.name,
          extracted_text: ocrResult.extractedText,
          method: 'ocr',
          processing_time_ms: ocrResult.processingTimeMs
        })
      } else {
        throw new Error(ocrResult.error || 'PDF OCR failed')
      }
    } catch (error) {
      // Log error
      await db.prepare(
        `UPDATE uploaded_files 
         SET processing_status = ?, error_message = ?, processed_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind('failed', String(error), uploadedFileId).run()
      
      await logProcessingStep(db, uploadedFileId, 'pdf_processing', 'failed', String(error), null)
      
      throw error
    }
  } catch (error) {
    console.error('PDF upload error:', error)
    return c.json({ error: 'PDF 업로드 처리 실패', details: String(error) }, 500)
  }
})

/**
 * GET /api/upload/:id - Get uploaded file details
 */
app.get('/api/upload/:id', async (c) => {
  try {
    const user = await getUserFromSession(c)
    const student = await getStudentFromSession(c)
    
    if (!user && !student) {
      return c.json({ error: '로그인이 필요합니다' }, 401)
    }
    
    const fileId = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    // Get file details
    const file = await db.prepare(
      `SELECT * FROM uploaded_files WHERE id = ? AND (user_id = ? OR student_user_id = ?)`
    ).bind(fileId, user?.id || null, student?.id || null).first()
    
    if (!file) {
      return c.json({ error: '파일을 찾을 수 없습니다' }, 404)
    }
    
    // Get processing logs
    const logs = await db.prepare(
      `SELECT * FROM file_processing_log WHERE uploaded_file_id = ? ORDER BY created_at`
    ).bind(fileId).all()
    
    return c.json({
      file,
      processing_logs: logs.results || []
    })
  } catch (error) {
    console.error('Get file error:', error)
    return c.json({ error: '파일 정보를 가져오는 데 실패했습니다' }, 500)
  }
})

/**
 * DELETE /api/upload/:id - Delete uploaded file
 */
app.delete('/api/upload/:id', async (c) => {
  try {
    const user = await getUserFromSession(c)
    const student = await getStudentFromSession(c)
    
    if (!user && !student) {
      return c.json({ error: '로그인이 필요합니다' }, 401)
    }
    
    const fileId = parseInt(c.req.param('id'))
    const db = c.env.DB
    const r2Bucket = c.env.R2_BUCKET
    
    // Get file info first
    const file = await db.prepare(
      'SELECT storage_key FROM uploaded_files WHERE id = ? AND (user_id = ? OR student_user_id = ?)'
    ).bind(fileId, user?.id || null, student?.id || null).first()
    
    if (!file) {
      return c.json({ error: '파일을 찾을 수 없습니다' }, 404)
    }
    
    // Delete from R2
    const r2Result = await deleteFromR2(r2Bucket, file.storage_key as string)
    
    if (!r2Result.success) {
      console.error('R2 delete failed:', r2Result.error)
      // Continue to delete from database even if R2 delete fails
    }
    
    // Delete from database
    await db.prepare(
      'DELETE FROM uploaded_files WHERE id = ?'
    ).bind(fileId).run()
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Delete file error:', error)
    return c.json({ error: '파일 삭제에 실패했습니다' }, 500)
  }
})

/**
 * POST /api/auth/signup - User signup
 */
// NOTE: Authentication routes are now handled by ./routes/auth.ts (mounted at line 38)
// - POST /api/auth/signup - User signup with bcrypt hashing
// - POST /api/auth/login - User login with secure cookie (HttpOnly, Secure, SameSite)
// - POST /api/auth/logout - User logout with cookie deletion
// - POST /api/auth/student/signup - Student signup with bcrypt hashing
// - POST /api/auth/student/login - Student login with secure cookie

// NOTE: Student authentication helpers are now in ./middleware/auth.ts
// - getStudentFromSession(c) - Get student from session (cookie or header)
// - requireStudentAuth(c) - Require student authentication middleware

/**
 * GET /api/user/me - Get current user info
 */
app.get('/api/user/me', async (c) => {
  try {
    const user = await requireAuth(c)
    if (isErrorResponse(user)) return user
    
    const db = c.env.DB
    
    // Get user with subscription and monthly grading count
    const userInfo = await db.prepare(`
      SELECT id, name, email, subscription, monthly_graded_count, is_admin, created_at
      FROM users
      WHERE id = ?
    `).bind(user.id).first()
    
    if (!userInfo) {
      return c.json({ error: 'User not found' }, 404)
    }
    
    return c.json({
      id: userInfo.id,
      name: userInfo.name,
      email: userInfo.email,
      subscription: userInfo.subscription || '무료',
      monthly_graded_count: userInfo.monthly_graded_count || 0,
      is_admin: userInfo.is_admin === 1,
      created_at: userInfo.created_at
    })
  } catch (error) {
    console.error('Error fetching user info:', error)
    return c.json({ error: 'Failed to fetch user info' }, 500)
  }
})

/**
 * POST /api/user/change-password - Change user password
 */
app.post('/api/user/change-password', async (c) => {
  try {
    const user = await requireAuth(c)
    if (isErrorResponse(user)) return user
    
    const { current_password, new_password } = await c.req.json()
    
    if (!current_password || !new_password) {
      return c.json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' }, 400)
    }
    
    if (new_password.length < 10) {
      return c.json({ error: '새 비밀번호는 최소 10자 이상이어야 합니다.' }, 400)
    }
    
    const db = c.env.DB
    
    // Get current user's password hash
    const userRecord = await db.prepare(`
      SELECT password_hash FROM users WHERE id = ?
    `).bind(user.id).first()
    
    if (!userRecord) {
      return c.json({ error: 'User not found' }, 404)
    }
    
    // Verify current password
    const isValidPassword = await verifyPassword(current_password, userRecord.password_hash as string)
    if (!isValidPassword) {
      return c.json({ error: '현재 비밀번호가 올바르지 않습니다.' }, 401)
    }
    
    // Hash new password
    const newPasswordHash = await hashPassword(new_password)
    
    // Update password
    await db.prepare(`
      UPDATE users SET password_hash = ? WHERE id = ?
    `).bind(newPasswordHash, user.id).run()
    
    return c.json({ 
      success: true, 
      message: '비밀번호가 성공적으로 변경되었습니다.' 
    })
  } catch (error) {
    console.error('Error changing password:', error)
    return c.json({ error: '비밀번호 변경 중 오류가 발생했습니다.' }, 500)
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
    
    const { title, description, grade_level, due_date, rubric_criteria, prompts, subject, tags } = await c.req.json()
    const db = c.env.DB
    
    // Create assignment without access code (will be generated later if needed)
    const promptsJSON = prompts ? JSON.stringify(prompts) : null
    const result = await db.prepare(
      'INSERT INTO assignments (user_id, title, description, grade_level, due_date, prompts, access_code, subject) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)'
    ).bind(user.id, title, description, grade_level, due_date, promptsJSON, subject || null).run()
    
    const assignmentId = result.meta.last_row_id
    
    // Add rubric criteria
    if (rubric_criteria && rubric_criteria.length > 0) {
      for (const criterion of rubric_criteria) {
        await db.prepare(
          'INSERT INTO assignment_rubrics (assignment_id, criterion_name, criterion_description, criterion_order, max_score) VALUES (?, ?, ?, ?, ?)'
        ).bind(assignmentId, criterion.name, criterion.description, criterion.order, criterion.max_score || 4).run()
      }
    }
    
    // Add tags (NEW)
    if (tags && Array.isArray(tags) && tags.length > 0) {
      for (const tag of tags) {
        await db.prepare(
          'INSERT INTO assignment_tags (assignment_id, tag) VALUES (?, ?)'
        ).bind(assignmentId, tag).run()
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
app.get('/api/assignment/code/:accessCode', async (c) => {
  try {
    const accessCode = c.req.param('accessCode')
    const db = c.env.DB
    
    console.log('[ACCESS_CODE] Looking for:', accessCode)
    
    // Find assignment by access code (from assignment_access_codes table)
    const assignment = await db.prepare(
      `SELECT a.* 
       FROM assignments a
       JOIN assignment_access_codes ac ON a.id = ac.assignment_id
       WHERE ac.access_code = ?`
    ).bind(accessCode).first()
    
    console.log('[ACCESS_CODE] Found assignment:', assignment ? assignment.id : 'NOT FOUND')
    
    if (!assignment) {
      return c.json({ error: '유효하지 않은 액세스 코드입니다.' }, 404)
    }
    
    // Parse prompts if exists
    if (assignment.prompts) {
      try {
        assignment.prompts = JSON.parse(assignment.prompts)
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
    return c.json({ error: '과제를 불러오는 데 실패했습니다.' }, 500)
  }
})

/**
 * POST /api/assignment/:id/generate-access-code - Generate access code for assignment
 */
app.post('/api/assignment/:id/generate-access-code', async (c) => {
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
app.get('/api/assignment/:id', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user // Return error response
    
    const assignmentId = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    // Get assignment first
    const assignment = await db.prepare(
      'SELECT * FROM assignments WHERE id = ?'
    ).bind(assignmentId).first()
    
    console.log('[ASSIGNMENT_ACCESS] Assignment:', assignment?.id, 'User:', user.id, 'Owner:', assignment?.user_id, 'is_library:', assignment?.is_library, 'Type:', typeof assignment?.is_library)
    
    if (!assignment) {
      return c.json({ error: 'Assignment not found' }, 404)
    }
    
    // Check if user owns the assignment OR if it's a library assignment
    // is_library is 1 or 0 (number) from SQLite, need to convert to boolean
    const isLibrary = Boolean(assignment.is_library)
    const isOwner = assignment.user_id === user.id
    
    console.log('[ASSIGNMENT_ACCESS] isOwner:', isOwner, 'isLibrary:', isLibrary, 'Access allowed:', isOwner || isLibrary)
    
    if (!isOwner && !isLibrary) {
      return c.json({ error: 'Access denied' }, 403)
    }
    
    // Get rubrics
    const rubrics = await db.prepare(
      'SELECT * FROM assignment_rubrics WHERE assignment_id = ? ORDER BY criterion_order'
    ).bind(assignmentId).all()
    
    // Get submissions (status-based, no JOIN needed)
    const submissions = await db.prepare(
      `SELECT * FROM student_submissions 
       WHERE assignment_id = ? 
       ORDER BY submitted_at DESC`
    ).bind(assignmentId).all()
    
    // Parse prompts from JSON and add graded flag to submissions
    // Map submissions and ensure graded is true boolean (not 0/1)
    const mappedSubmissions = (submissions.results || []).map((sub: any) => {
      const result: any = { ...sub };
      // Force boolean conversion - use explicit true/false
      result.graded = (sub.status === 'graded') ? true : false;
      return result;
    });
    
    const parsedAssignment = {
      ...assignment,
      prompts: assignment.prompts ? JSON.parse(assignment.prompts) : [],
      rubrics: rubrics.results || [],
      submissions: mappedSubmissions
    }
    
    // Use direct Response instead of c.json() to bypass D1 serialization
    return new Response(JSON.stringify(parsedAssignment), {
      headers: {
        'Content-Type': 'application/json'
      }
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
 * POST /api/assignment/:id/access-code - Generate access code for assignment
 */
app.post('/api/assignment/:id/access-code', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user
    
    const assignmentId = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    // Verify ownership
    const assignment = await db.prepare(
      'SELECT id FROM assignments WHERE id = ? AND user_id = ?'
    ).bind(assignmentId, user.id).first()
    
    if (!assignment) {
      return c.json({ error: 'Assignment not found' }, 404)
    }
    
    // Check if access code already exists
    const existing = await db.prepare(
      'SELECT access_code FROM assignment_access_codes WHERE assignment_id = ?'
    ).bind(assignmentId).first()
    
    if (existing) {
      return c.json({ access_code: existing.access_code })
    }
    
    // Generate 6-digit access code
    const accessCode = Math.floor(100000 + Math.random() * 900000).toString()
    
    await db.prepare(
      'INSERT INTO assignment_access_codes (assignment_id, access_code) VALUES (?, ?)'
    ).bind(assignmentId, accessCode).run()
    
    return c.json({ access_code: accessCode })
  } catch (error) {
    console.error('Error generating access code:', error)
    return c.json({ error: 'Failed to generate access code' }, 500)
  }
})

/**
 * POST /api/assignment/:id/register-to-library - Register assignment to library
 */
app.post('/api/assignment/:id/register-to-library', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user
    
    const assignmentId = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    // Check if assignment belongs to user
    const assignment = await db.prepare(
      'SELECT * FROM assignments WHERE id = ? AND user_id = ?'
    ).bind(assignmentId, user.id).first()
    
    if (!assignment) {
      return c.json({ error: '과제를 찾을 수 없습니다' }, 404)
    }
    
    // Register to library
    await db.prepare(
      'UPDATE assignments SET is_library = 1, library_registered_at = datetime(\'now\') WHERE id = ?'
    ).bind(assignmentId).run()
    
    return c.json({ success: true, message: '과제가 라이브러리에 등록되었습니다' })
  } catch (error) {
    console.error('Error registering assignment to library:', error)
    return c.json({ error: '라이브러리 등록에 실패했습니다' }, 500)
  }
})

/**
 * GET /api/library/assignments - Get library assignments with filtering and sorting
 */
app.get('/api/library/assignments', async (c) => {
  try {
    const db = c.env.DB
    
    // Get query parameters
    const sortBy = c.req.query('sortBy') || 'created_at'
    const sortOrder = c.req.query('sortOrder') || 'DESC'
    const authorFilter = c.req.query('author')
    const gradeLevelFilter = c.req.query('gradeLevel')
    const subjectFilter = c.req.query('subject')
    const searchQuery = c.req.query('search') // NEW: 키워드 검색
    const tagFilter = c.req.query('tag') // NEW: 태그 필터
    
    // Build query with new fields
    let query = `
      SELECT 
        a.id, a.title, a.description, a.grade_level, a.subject, 
        a.created_at, a.library_registered_at,
        a.usage_count, a.average_rating, a.rating_count,
        u.name as author_name, u.id as author_id
      FROM assignments a
      JOIN users u ON a.user_id = u.id
      WHERE a.is_library = 1
    `
    
    const params: any[] = []
    
    // Apply filters
    if (authorFilter) {
      if (authorFilter === '관리자') {
        query += ' AND u.name LIKE ?'
        params.push('%관리자%')
      } else if (authorFilter === '사용자') {
        query += ' AND u.name NOT LIKE ?'
        params.push('%관리자%')
      }
    }
    
    if (gradeLevelFilter) {
      query += ' AND a.grade_level = ?'
      params.push(gradeLevelFilter)
    }
    
    if (subjectFilter) {
      query += ' AND a.subject = ?'
      params.push(subjectFilter)
    }
    
    // NEW: Search filter
    if (searchQuery) {
      query += ' AND (a.title LIKE ? OR a.description LIKE ?)'
      params.push(`%${searchQuery}%`, `%${searchQuery}%`)
    }
    
    // NEW: Tag filter
    if (tagFilter) {
      query += ` AND a.id IN (SELECT assignment_id FROM assignment_tags WHERE tag = ?)`
      params.push(tagFilter)
    }
    
    // Apply sorting - add new sort options
    const validSortFields = ['title', 'author_name', 'grade_level', 'subject', 'created_at', 'usage_count', 'average_rating']
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at'
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
    
    // Handle table aliases
    const sortColumn = sortField === 'created_at' ? 'a.created_at' : 
                      sortField === 'usage_count' ? 'a.usage_count' :
                      sortField === 'average_rating' ? 'a.average_rating' :
                      sortField
    query += ` ORDER BY ${sortColumn} ${validSortOrder}`
    
    // Execute query
    let statement = db.prepare(query)
    if (params.length > 0) {
      statement = statement.bind(...params)
    }
    
    const result = await statement.all()
    
    // Get tags for each assignment
    const assignments = result.results || []
    for (const assignment of assignments) {
      const tags = await db.prepare(
        'SELECT tag FROM assignment_tags WHERE assignment_id = ?'
      ).bind(assignment.id).all()
      assignment.tags = tags.results?.map((t: any) => t.tag) || []
    }
    
    return c.json({ assignments })
  } catch (error) {
    console.error('Error fetching library assignments:', error)
    return c.json({ error: '라이브러리 과제 조회에 실패했습니다' }, 500)
  }
})

/**
 * POST /api/assignment/:id/increment-usage - Increment assignment usage count (when loaded from library)
 */
app.post('/api/assignment/:id/increment-usage', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user
    
    const assignmentId = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    // Increment usage count
    await db.prepare(
      'UPDATE assignments SET usage_count = usage_count + 1 WHERE id = ?'
    ).bind(assignmentId).run()
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Error incrementing usage count:', error)
    return c.json({ error: 'Failed to update usage count' }, 500)
  }
})

/**
 * POST /api/assignment/:id/rating - Add or update rating for an assignment
 */
app.post('/api/assignment/:id/rating', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user
    
    const assignmentId = parseInt(c.req.param('id'))
    const { rating, review } = await c.req.json()
    const db = c.env.DB
    
    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return c.json({ error: '별점은 1~5 사이여야 합니다' }, 400)
    }
    
    // Check if user already rated
    const existing = await db.prepare(
      'SELECT id FROM assignment_ratings WHERE assignment_id = ? AND user_id = ?'
    ).bind(assignmentId, user.id).first()
    
    if (existing) {
      // Update existing rating
      await db.prepare(
        'UPDATE assignment_ratings SET rating = ?, review = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(rating, review || null, existing.id).run()
    } else {
      // Insert new rating
      await db.prepare(
        'INSERT INTO assignment_ratings (assignment_id, user_id, rating, review) VALUES (?, ?, ?, ?)'
      ).bind(assignmentId, user.id, rating, review || null).run()
    }
    
    // Update assignment average rating
    const stats = await db.prepare(
      'SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM assignment_ratings WHERE assignment_id = ?'
    ).bind(assignmentId).first()
    
    await db.prepare(
      'UPDATE assignments SET average_rating = ?, rating_count = ? WHERE id = ?'
    ).bind(stats.avg_rating || 0, stats.count || 0, assignmentId).run()
    
    return c.json({ success: true, average_rating: stats.avg_rating, rating_count: stats.count })
  } catch (error) {
    console.error('Error saving rating:', error)
    return c.json({ error: '별점 저장에 실패했습니다' }, 500)
  }
})

/**
 * GET /api/assignment/:id/ratings - Get all ratings for an assignment
 */
app.get('/api/assignment/:id/ratings', async (c) => {
  try {
    const assignmentId = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    const ratings = await db.prepare(
      `SELECT r.id, r.rating, r.review, r.created_at, r.updated_at,
              u.name as user_name
       FROM assignment_ratings r
       JOIN users u ON r.user_id = u.id
       WHERE r.assignment_id = ?
       ORDER BY r.created_at DESC`
    ).bind(assignmentId).all()
    
    return c.json({ ratings: ratings.results || [] })
  } catch (error) {
    console.error('Error fetching ratings:', error)
    return c.json({ error: '별점 조회에 실패했습니다' }, 500)
  }
})

/**
 * POST /api/assignment/:id/tags - Add tags to an assignment
 */
app.post('/api/assignment/:id/tags', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user
    
    const assignmentId = parseInt(c.req.param('id'))
    const { tags } = await c.req.json()
    const db = c.env.DB
    
    // Verify ownership
    const assignment = await db.prepare(
      'SELECT id FROM assignments WHERE id = ? AND user_id = ?'
    ).bind(assignmentId, user.id).first()
    
    if (!assignment) {
      return c.json({ error: 'Assignment not found or access denied' }, 404)
    }
    
    // Delete existing tags
    await db.prepare(
      'DELETE FROM assignment_tags WHERE assignment_id = ?'
    ).bind(assignmentId).run()
    
    // Insert new tags
    if (tags && Array.isArray(tags) && tags.length > 0) {
      for (const tag of tags) {
        await db.prepare(
          'INSERT INTO assignment_tags (assignment_id, tag) VALUES (?, ?)'
        ).bind(assignmentId, tag).run()
      }
    }
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Error saving tags:', error)
    return c.json({ error: '태그 저장에 실패했습니다' }, 500)
  }
})

/**
 * GET /api/library/tags - Get all unique tags used in library
 */
app.get('/api/library/tags', async (c) => {
  try {
    const db = c.env.DB
    
    const tags = await db.prepare(
      `SELECT DISTINCT tag, COUNT(*) as count
       FROM assignment_tags
       WHERE assignment_id IN (SELECT id FROM assignments WHERE is_library = 1)
       GROUP BY tag
       ORDER BY count DESC, tag ASC`
    ).all()
    
    return c.json({ tags: tags.results || [] })
  } catch (error) {
    console.error('Error fetching tags:', error)
    return c.json({ error: '태그 조회에 실패했습니다' }, 500)
  }
})

/**
 * GET /api/student/assignment/:code - Get assignment by access code
 */
app.get('/api/student/assignment/:code', async (c) => {
  try {
    const student = await requireStudentAuth(c)
    if (!student.id) return student
    
    const accessCode = c.req.param('code')
    const db = c.env.DB
    
    // Find assignment by access code
    const result = await db.prepare(
      `SELECT a.id, a.title, a.description, a.grade_level, a.due_date
       FROM assignments a
       JOIN assignment_access_codes ac ON a.id = ac.assignment_id
       WHERE ac.access_code = ?`
    ).bind(accessCode).first()
    
    if (!result) {
      return c.json({ error: '유효하지 않은 액세스 코드입니다' }, 404)
    }
    
    // Get rubrics
    const rubrics = await db.prepare(
      'SELECT criterion_name, criterion_description FROM assignment_rubrics WHERE assignment_id = ? ORDER BY criterion_order'
    ).bind(result.id).all()
    
    return c.json({
      ...result,
      rubrics: rubrics.results || []
    })
  } catch (error) {
    console.error('Error fetching assignment:', error)
    return c.json({ error: 'Failed to fetch assignment' }, 500)
  }
})

/**
 * POST /api/student/submit - Submit student essay
 */
/**
 * POST /api/student/submit - Submit student essay (안 터지는 구조)
 */
app.post('/api/student/submit', async (c) => {
  try {
    // 1. 학생 인증 확인 (안전한 에러 처리)
    const student = await requireStudentAuth(c)
    if (!student.id) return student
    
    // 2. 요청 데이터 파싱 (안전한 에러 처리)
    let accessCode: string, essayText: string
    try {
      const body = await c.req.json()
      accessCode = body.accessCode?.trim()
      essayText = body.essayText?.trim()
      
      if (!accessCode || !essayText) {
        return c.json({ 
          error: '액세스 코드와 답안을 모두 입력해 주세요',
          debug: `accessCode: ${!!accessCode}, essayText: ${!!essayText}`
        }, 400)
      }
      
      if (essayText.length < 50) {
        return c.json({ 
          error: '답안은 최소 50자 이상이어야 합니다',
          debug: `현재 길이: ${essayText.length}자`
        }, 400)
      }
    } catch (err) {
      return c.json({ 
        error: '요청 데이터를 파싱하는 데 실패했습니다',
        debug: err instanceof Error ? err.message : String(err)
      }, 400)
    }
    
    const db = c.env.DB
    console.log('[SUBMIT] Student:', { id: student.id, name: student.name, accessCode })
    
    // 3. 과제 조회 (안전한 에러 처리)
    let assignment: any
    try {
      assignment = await db.prepare(
        `SELECT a.id, a.title, a.user_id
         FROM assignments a
         JOIN assignment_access_codes ac ON a.id = ac.assignment_id
         WHERE ac.access_code = ?`
      ).bind(accessCode).first()
      
      if (!assignment) {
        return c.json({ 
          error: '과제를 찾을 수 없습니다',
          debug: `액세스 코드: ${accessCode}`
        }, 404)
      }
      
      console.log('[SUBMIT] Found assignment:', { id: assignment.id, title: assignment.title })
    } catch (err) {
      console.error('[SUBMIT] Assignment query error:', err)
      return c.json({ 
        error: '과제를 조회하는 데 실패했습니다',
        debug: err instanceof Error ? err.message : String(err)
      }, 500)
    }
    
    // 4. 이전 제출 확인 (안전한 에러 처리)
    let previousSubmission: any = null
    let submissionVersion = 1
    try {
      previousSubmission = await db.prepare(
        `SELECT id, submission_version FROM student_submissions 
         WHERE assignment_id = ? AND student_user_id = ?
         ORDER BY submitted_at DESC LIMIT 1`
      ).bind(assignment.id, student.id).first()
      
      if (previousSubmission) {
        const maxVersionResult = await db.prepare(
          'SELECT MAX(submission_version) as max FROM student_submissions WHERE assignment_id = ? AND student_user_id = ?'
        ).bind(assignment.id, student.id).first()
        
        submissionVersion = (maxVersionResult?.max || 0) + 1
      }
      
      console.log('[SUBMIT] Submission version:', submissionVersion, 'Previous:', previousSubmission?.id || 'none')
    } catch (err) {
      console.error('[SUBMIT] Previous submission query error:', err)
      // 이전 제출 확인 실패해도 계속 진행 (기본값 1 사용)
      submissionVersion = 1
    }
    
    // 5. 새 제출 생성 (안전한 NULL 처리)
    try {
      // 디버그: 모든 값 출력
      console.log('[SUBMIT] Bind values check:', {
        'assignment.id': assignment.id,
        'student.id': student.id,
        'student.name': student.name,
        'essayText.length': essayText?.length,
        'submissionVersion': submissionVersion,
        'previousSubmission': previousSubmission ? { id: previousSubmission.id } : null
      })
      
      // 값 검증 (undefined 방지)
      if (!assignment.id || !student.id || !essayText) {
        return c.json({
          error: '필수 값이 누락되었습니다',
          debug: {
            hasAssignmentId: !!assignment.id,
            hasStudentId: !!student.id,
            hasEssayText: !!essayText
          }
        }, 400)
      }
      
      // D1은 NULL을 지원하지 않으므로 조건부로 다른 쿼리 사용
      let result: any
      
      if (previousSubmission) {
        // 재제출인 경우
        result = await db.prepare(
          `INSERT INTO student_submissions 
           (assignment_id, student_user_id, student_name, essay_text, submission_version, is_resubmission, previous_submission_id, graded, submitted_at)
           VALUES (?, ?, ?, ?, ?, 1, ?, 0, datetime('now'))`
        ).bind(
          assignment.id,
          student.id,
          student.name || '익명 학생',
          essayText,
          submissionVersion,
          previousSubmission.id
        ).run()
      } else {
        // 첫 제출인 경우
        result = await db.prepare(
          `INSERT INTO student_submissions 
           (assignment_id, student_user_id, student_name, essay_text, submission_version, is_resubmission, graded, submitted_at)
           VALUES (?, ?, ?, ?, ?, 0, 0, datetime('now'))`
        ).bind(
          assignment.id,
          student.id,
          student.name || '익명 학생',
          essayText,
          submissionVersion
        ).run()
      }
      
      const submissionId = result.meta.last_row_id
      console.log('[SUBMIT] Success:', { submissionId, version: submissionVersion })
      
      return c.json({ 
        success: true, 
        submission_id: submissionId,
        submission_version: submissionVersion,
        message: previousSubmission ? 
          `답안이 성공적으로 재제출되었습니다 (버전 ${submissionVersion})` :
          '답안이 성공적으로 제출되었습니다'
      })
    } catch (err) {
      console.error('[SUBMIT] Insert error:', err)
      return c.json({ 
        error: '답안 저장에 실패했습니다',
        debug: err instanceof Error ? err.message : String(err)
      }, 500)
    }
  } catch (error) {
    console.error('[SUBMIT] Unexpected error:', error)
    return c.json({ 
      error: '예상치 못한 오류가 발생했습니다',
      debug: error instanceof Error ? error.message : String(error)
    }, 500)
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
    
    // Check subscription limits for grading (NEW)
    const userInfo = await db.prepare(
      'SELECT subscription FROM users WHERE id = ?'
    ).bind(user.id).first()
    
    // Count graded submissions for this user
    const gradedCount = await db.prepare(
      `SELECT COUNT(*) as count 
       FROM student_submissions s
       JOIN assignments a ON s.assignment_id = a.id
       WHERE a.user_id = ? AND s.graded = 1`
    ).bind(user.id).first()
    
    const subscription = userInfo?.subscription || '무료'
    const currentGradedCount = gradedCount?.count || 0
    
    // Define subscription limits for grading (채점 횟수 제한)
    const gradingLimits = {
      '무료': 20,
      '스타터': 90,
      '베이직': 300,
      '프로': 600
    }
    
    const limit = gradingLimits[subscription] || gradingLimits['무료']
    
    if (currentGradedCount >= limit) {
      return c.json({ 
        error: `현재 구독 플랜(${subscription})의 채점 한도(${limit}회)를 초과했습니다. 구독 플랜을 업그레이드해주세요.`,
        limit_reached: true,
        current_plan: subscription,
        current_count: currentGradedCount,
        max_limit: limit
      }, 403)
    }
    
    // Get grading settings from request body (optional)
    const body = await c.req.json().catch(() => ({}))
    const feedbackLevel = body.feedback_level || 'detailed' // 'detailed', 'moderate', 'brief'
    const gradingStrictness = body.grading_strictness || 'moderate' // 'lenient', 'moderate', 'strict'
    
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
      'SELECT id, criterion_name, criterion_description, max_score FROM assignment_rubrics WHERE assignment_id = ? ORDER BY criterion_order'
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
        criterion_order: idx + 1,
        max_score: r.max_score || 4
      }))
    }
    
    // Create grading session
    const sessionId = await createGradingSession(db, gradingRequest)
    
    // Create essay
    const essayId = await createEssay(db, sessionId, submission.essay_text as string)
    
    // Grade the essay using AI (with graceful fallback)
    let gradingResult: any
    let detailedFeedback: any
    
    try {
      gradingResult = await gradeEssayHybrid(gradingRequest, c.env)
      
      // Generate detailed feedback with grade-level tone adjustment and custom settings
      detailedFeedback = await generateDetailedFeedback({
        essay_text: submission.essay_text as string,
        grade_level: submission.grade_level as string,
        rubric_criteria: rubrics.results.map((r: any) => ({
          criterion_name: r.criterion_name,
          criterion_description: r.criterion_description,
          max_score: r.max_score || 4
        })),
        criterion_scores: gradingResult.criterion_scores.map((cs: any) => ({
          criterion_name: cs.criterion_name,
          score: cs.score,
          strengths: cs.strengths,
          areas_for_improvement: cs.areas_for_improvement
        })),
        feedback_level: feedbackLevel,
        grading_strictness: gradingStrictness
      })
    } catch (aiError) {
      console.error('[GRADING] AI grading failed, using fallback:', aiError)
      
      // Graceful fallback: 기본 채점 생성
      const criteriaCount = rubrics.results.length
      const defaultScore = 2 // 중간 점수
      
      gradingResult = {
        criterion_scores: rubrics.results.map((r: any) => ({
          criterion_name: r.criterion_name,
          score: defaultScore,
          strengths: 'AI 채점 시스템이 일시적으로 사용할 수 없습니다. 교사의 수동 채점을 기다려 주세요.',
          areas_for_improvement: '자동 채점 실패로 인해 세부 피드백을 제공할 수 없습니다.'
        })),
        revision_suggestions: 'AI 채점 시스템 오류로 인해 수정 제안을 생성할 수 없습니다.',
        next_steps_advice: '교사의 피드백을 기다려 주세요.',
        summary_evaluation: 'AI 채점 실패 - 교사 검토 필요'
      }
      
      detailedFeedback = {
        criterion_feedbacks: rubrics.results.map((r: any) => ({
          criterion_name: r.criterion_name,
          score: defaultScore,
          positive_feedback: 'AI 채점 시스템이 일시적으로 사용할 수 없습니다.',
          improvement_areas: '교사의 수동 채점을 기다려 주세요.',
          specific_suggestions: '자동 피드백을 생성할 수 없습니다.'
        })),
        overall_summary: {
          total_score: defaultScore * criteriaCount,
          strengths: 'AI 채점 시스템 오류',
          weaknesses: '자동 채점 실패',
          overall_comment: 'AI 채점 시스템이 일시적으로 사용할 수 없어 기본 점수를 부여했습니다. 교사의 수동 채점을 기다려 주세요.',
          improvement_priority: '교사 검토 필요'
        }
      }
    }
    
    // Store grading result
    const resultId = await storeGradingResult(db, essayId, sessionId, gradingResult)
    
    // Delete existing feedback for regrade (if any)
    await db.prepare(
      'DELETE FROM submission_feedback WHERE submission_id = ?'
    ).bind(submissionId).run()
    
    await db.prepare(
      'DELETE FROM submission_summary WHERE submission_id = ?'
    ).bind(submissionId).run()
    
    // Store detailed feedback for each criterion
    for (let i = 0; i < detailedFeedback.criterion_feedbacks.length; i++) {
      const feedback = detailedFeedback.criterion_feedbacks[i]
      const rubric = rubrics.results.find((r: any) => r.criterion_name === feedback.criterion_name)
      
      if (rubric) {
        await db.prepare(
          `INSERT INTO submission_feedback 
           (submission_id, criterion_id, score, positive_feedback, improvement_areas, specific_suggestions)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          submissionId,
          rubric.id,
          feedback.score,
          feedback.positive_feedback,
          feedback.improvement_areas,
          feedback.specific_suggestions
        ).run()
      }
    }
    
    // Store overall summary
    await db.prepare(
      `INSERT INTO submission_summary 
       (submission_id, total_score, strengths, weaknesses, overall_comment, improvement_priority, revision_suggestions, next_steps_advice, summary_evaluation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      submissionId,
      detailedFeedback.overall_summary.total_score,
      detailedFeedback.overall_summary.strengths,
      detailedFeedback.overall_summary.weaknesses,
      detailedFeedback.overall_summary.overall_comment,
      detailedFeedback.overall_summary.improvement_priority,
      gradingResult.revision_suggestions || '',
      gradingResult.next_steps_advice || '',
      gradingResult.summary_evaluation || ''
    ).run()
    
    // Update submission with grading result
    await db.prepare(
      'UPDATE student_submissions SET graded = 1, grade_result_id = ? WHERE id = ?'
    ).bind(resultId, submissionId).run()
    
    // Update student progress tracking
    const studentUserId = submission.student_user_id
    if (studentUserId) {
      const assignmentId = submission.assignment_id
      
      // Get previous submissions count and scores
      const progressData = await db.prepare(
        `SELECT COUNT(*) as count, MAX(ss.total_score) as best_score
         FROM student_submissions s
         LEFT JOIN submission_summary ss ON s.id = ss.submission_id
         WHERE s.assignment_id = ? AND s.student_user_id = ?`
      ).bind(assignmentId, studentUserId).first()
      
      const submissionCount = (progressData?.count as number) || 0
      const bestScore = (progressData?.best_score as number) || detailedFeedback.overall_summary.total_score
      const latestScore = detailedFeedback.overall_summary.total_score
      
      // Calculate improvement rate (if there's a previous submission)
      let improvementRate = 0
      if (submissionCount > 1 && bestScore) {
        improvementRate = ((latestScore - bestScore) / bestScore) * 100
      }
      
      // Update or insert progress record
      await db.prepare(
        `INSERT INTO student_progress (student_user_id, assignment_id, submission_count, best_score, latest_score, improvement_rate)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(student_user_id, assignment_id) DO UPDATE SET
         submission_count = ?,
         best_score = MAX(best_score, ?),
         latest_score = ?,
         improvement_rate = ?,
         tracked_at = CURRENT_TIMESTAMP`
      ).bind(
        studentUserId, assignmentId, submissionCount, bestScore, latestScore, improvementRate,
        submissionCount, latestScore, latestScore, improvementRate
      ).run()
    }
    
    return c.json({
      success: true,
      submission_id: submissionId,
      result_id: resultId,
      grading_result: gradingResult,
      detailed_feedback: detailedFeedback
    })
  } catch (error) {
    console.error('Error grading submission:', error)
    return c.json({ error: 'Failed to grade submission', details: String(error) }, 500)
  }
})

/**
 * GET /api/submission/:id - Get submission details
 */
app.get('/api/submission/:id', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user
    
    const submissionId = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    // Get submission with assignment info
    const submission = await db.prepare(
      `SELECT s.*, a.title as assignment_title, a.user_id
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
    
    return c.json(submission)
  } catch (error) {
    console.error('Error fetching submission:', error)
    return c.json({ error: 'Failed to fetch submission', details: String(error) }, 500)
  }
})

/**
 * GET /api/submission/:id/feedback - Get feedback for teacher review
 */
app.get('/api/submission/:id/feedback', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user
    
    const submissionId = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    // Verify ownership
    const submission = await db.prepare(
      `SELECT s.*, a.user_id 
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
    
    // Get criterion feedbacks
    const feedbacks = await db.prepare(
      `SELECT 
        sf.*,
        ar.criterion_name,
        ar.criterion_description,
        ar.max_score
       FROM submission_feedback sf
       JOIN assignment_rubrics ar ON sf.criterion_id = ar.id
       WHERE sf.submission_id = ?
       ORDER BY sf.id`
    ).bind(submissionId).all()
    
    // Get overall summary
    const summary = await db.prepare(
      'SELECT * FROM submission_summary WHERE submission_id = ?'
    ).bind(submissionId).first()
    
    return c.json({
      criteria: feedbacks.results || [],
      summary: summary || null
    })
  } catch (error) {
    console.error('Error fetching feedback:', error)
    return c.json({ error: 'Failed to fetch feedback', details: String(error) }, 500)
  }
})

/**
 * PUT /api/submission/:id/feedback - Update grading feedback
 */
app.put('/api/submission/:id/feedback', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user
    
    const submissionId = parseInt(c.req.param('id'))
    const { grading_result } = await c.req.json()
    const db = c.env.DB
    
    // Verify ownership
    const submission = await db.prepare(
      `SELECT s.*, a.user_id FROM student_submissions s
       JOIN assignments a ON s.assignment_id = a.id
       WHERE s.id = ?`
    ).bind(submissionId).first()
    
    if (!submission) {
      return c.json({ error: 'Submission not found' }, 404)
    }
    
    if (submission.user_id !== user.id) {
      return c.json({ error: 'Access denied' }, 403)
    }
    
    // Update submission summary
    await db.prepare(
      `UPDATE submission_summary 
       SET total_score = ?, overall_comment = ?
       WHERE submission_id = ?`
    ).bind(
      grading_result.total_score,
      grading_result.overall_comment,
      submissionId
    ).run()
    
    // Update criterion feedback
    for (let i = 0; i < grading_result.criterion_scores.length; i++) {
      const criterion = grading_result.criterion_scores[i]
      
      // Get rubric ID by name
      const rubric = await db.prepare(
        `SELECT r.id FROM assignment_rubrics r
         JOIN assignments a ON r.assignment_id = a.id
         JOIN student_submissions s ON s.assignment_id = a.id
         WHERE s.id = ? AND r.criterion_name = ?`
      ).bind(submissionId, criterion.criterion_name).first()
      
      if (rubric) {
        await db.prepare(
          `UPDATE submission_feedback 
           SET score = ?, positive_feedback = ?, improvement_areas = ?
           WHERE submission_id = ? AND criterion_id = ?`
        ).bind(
          criterion.score,
          criterion.strengths,
          criterion.areas_for_improvement,
          submissionId,
          rubric.id
        ).run()
      }
    }
    
    // Mark as graded
    await db.prepare(
      'UPDATE student_submissions SET graded = 1 WHERE id = ?'
    ).bind(submissionId).run()
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Error updating feedback:', error)
    return c.json({ error: 'Failed to update feedback', details: String(error) }, 500)
  }
})

// NOTE: /api/grading-history endpoint is now handled by ./routes/grading.ts
// It was moved to the grading routes module for better organization

/**
 * GET /api/admin/subscription-stats - Get subscription statistics (TEST)
 */
app.get('/api/admin/subscription-stats', async (c) => {
  try {
    const db = c.env.DB
    const result = await db.prepare(
      `SELECT subscription, COUNT(*) as count
       FROM users
       GROUP BY subscription`
    ).all()
    
    return c.json(result.results || [])
  } catch (error) {
    return c.json([], 500)
  }
})

/**
 * GET /api/admin/stats - Get system-wide statistics (Admin only)
 */
app.get('/api/admin/stats', async (c) => {
  try {
    const db = c.env.DB
    
    // Total users (teachers)
    const teacherCount = await db.prepare('SELECT COUNT(*) as count FROM users').first()
    
    // Total students
    const studentCount = await db.prepare('SELECT COUNT(*) as count FROM student_users').first()
    
    // Total assignments
    const assignmentCount = await db.prepare('SELECT COUNT(*) as count FROM assignments').first()
    
    // Total submissions
    const submissionCount = await db.prepare('SELECT COUNT(*) as count FROM student_submissions').first()
    
    // Graded submissions
    const gradedCount = await db.prepare('SELECT COUNT(*) as count FROM student_submissions WHERE graded = 1').first()
    
    // Average scores
    const avgScores = await db.prepare(
      'SELECT AVG(total_score) as avg_score FROM submission_summary'
    ).first()
    
    // Recent activity (last 7 days)
    const recentSubmissions = await db.prepare(
      `SELECT COUNT(*) as count FROM student_submissions 
       WHERE submitted_at > datetime('now', '-7 days')`
    ).first()
    
    const recentGrading = await db.prepare(
      `SELECT COUNT(*) as count FROM student_submissions 
       WHERE graded = 1 AND submitted_at > datetime('now', '-7 days')`
    ).first()
    
    // Top teachers by submissions
    const topTeachers = await db.prepare(
      `SELECT u.name, u.email, COUNT(s.id) as submission_count
       FROM users u
       JOIN assignments a ON u.id = a.user_id
       JOIN student_submissions s ON a.id = s.assignment_id
       GROUP BY u.id
       ORDER BY submission_count DESC
       LIMIT 10`
    ).all()
    
    // Most active students
    const activeStudents = await db.prepare(
      `SELECT su.name, su.email, su.grade_level, COUNT(s.id) as submission_count
       FROM student_users su
       JOIN student_submissions s ON su.id = s.student_user_id
       GROUP BY su.id
       ORDER BY submission_count DESC
       LIMIT 10`
    ).all()
    
    // Subscription statistics
    const subscriptionStatsResult = await db.prepare(
      `SELECT subscription, COUNT(*) as count
       FROM users
       GROUP BY subscription`
    ).all()
    
    // Build response object
    const responseObj = {
      overview: {
        total_teachers: teacherCount?.count || 0,
        total_students: studentCount?.count || 0,
        total_assignments: assignmentCount?.count || 0,
        total_submissions: submissionCount?.count || 0,
        graded_submissions: gradedCount?.count || 0,
        pending_submissions: (submissionCount?.count || 0) - (gradedCount?.count || 0),
        average_score: avgScores?.avg_score || 0
      },
      recent_activity: {
        submissions_last_7_days: recentSubmissions?.count || 0,
        graded_last_7_days: recentGrading?.count || 0
      },
      top_teachers: topTeachers.results || [],
      active_students: activeStudents.results || [],
      subscription_stats: subscriptionStatsResult.results || []
    }
    
    return c.json(responseObj)
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    console.error('Error stack:', error.stack)
    console.error('Error message:', error.message)
    return c.json({ 
      error: 'Failed to fetch statistics',
      error_message: error.message,
      error_details: String(error)
    }, 500)
  }
})

/**
 * GET /api/admin/recent-activity - Get recent system activity
 */
app.get('/api/admin/recent-activity', async (c) => {
  try {
    const db = c.env.DB
    
    const activities = await db.prepare(
      `SELECT 
        'submission' as type,
        s.id,
        s.submitted_at as timestamp,
        s.student_name,
        a.title as assignment_title,
        u.name as teacher_name,
        s.graded
       FROM student_submissions s
       JOIN assignments a ON s.assignment_id = a.id
       JOIN users u ON a.user_id = u.id
       ORDER BY s.submitted_at DESC
       LIMIT 50`
    ).all()
    
    return c.json(activities.results || [])
  } catch (error) {
    console.error('Error fetching recent activity:', error)
    return c.json({ error: 'Failed to fetch activity' }, 500)
  }
})

/**
 * GET /api/admin/users/subscriptions - Get all users subscription info (WORKAROUND)
 */
app.get('/api/admin/users/subscriptions', async (c) => {
  try {
    const db = c.env.DB
    
    const result = await db.prepare(
      `SELECT id, subscription FROM users ORDER BY id`
    ).all()
    
    console.log('[BACKEND] users/subscriptions:', result.results)
    
    return c.json(result.results || [])
  } catch (error) {
    console.error('Error fetching subscriptions:', error)
    return c.json({ error: 'Failed to fetch subscriptions' }, 500)
  }
})

/**
 * GET /api/admin/users - Get all users with details
 */
app.get('/api/admin/users', async (c) => {
  try {
    const db = c.env.DB
    
    // Teachers
    const teachers = await db.prepare(
      `SELECT 
        u.id,
        u.name,
        u.email,
        u.subscription,
        u.created_at,
        COUNT(DISTINCT a.id) as assignment_count,
        COUNT(DISTINCT s.id) as submission_count
       FROM users u
       LEFT JOIN assignments a ON u.id = a.user_id
       LEFT JOIN student_submissions s ON a.id = s.assignment_id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    ).all()
    
    // Students
    const students = await db.prepare(
      `SELECT 
        su.id,
        su.name,
        su.email,
        su.grade_level,
        su.created_at,
        COUNT(s.id) as submission_count
       FROM student_users su
       LEFT JOIN student_submissions s ON su.id = s.student_user_id
       GROUP BY su.id
       ORDER BY su.created_at DESC`
    ).all()
    
    return c.json({
      teachers: teachers.results || [],
      students: students.results || []
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return c.json({ error: 'Failed to fetch users' }, 500)
  }
})

/**
 * GET /api/user/grading-quota - Get user's grading quota information
 */
app.get('/api/user/grading-quota', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user
    
    const db = c.env.DB
    
    // Get user subscription and monthly graded count
    const userInfo = await db.prepare(
      'SELECT subscription, monthly_graded_count FROM users WHERE id = ?'
    ).bind(user.id).first()
    
    const subscription = userInfo?.subscription || '무료'
    const currentCount = userInfo?.monthly_graded_count || 0
    
    // Define monthly limits
    const gradingLimits = {
      '무료': 20,
      '스타터': 90,
      '베이직': 300,
      '프로': 600
    }
    
    const maxLimit = gradingLimits[subscription] || gradingLimits['무료']
    const remaining = Math.max(0, maxLimit - currentCount)
    const percentage = maxLimit > 0 ? Math.round((currentCount / maxLimit) * 100) : 0
    
    return c.json({
      subscription,
      current_count: currentCount,
      max_limit: maxLimit,
      remaining,
      percentage,
      limit_reached: currentCount >= maxLimit
    })
  } catch (error) {
    console.error('Error fetching grading quota:', error)
    return c.json({ error: 'Failed to fetch grading quota' }, 500)
  }
})

/**
 * PUT /api/admin/users/:id/subscription - Update user subscription plan (Admin only)
 */
app.put('/api/admin/users/:id/subscription', async (c) => {
  try {
    // Check admin authentication
    const user = await requireAdminAuth(c)
    if (isErrorResponse(user)) return user

    const userId = parseInt(c.req.param('id'))
    const { subscription } = await c.req.json()
    
    // Validate subscription plan
    const validPlans = ['무료', '스타터', '베이직', '프로']
    if (!validPlans.includes(subscription)) {
      return c.json({ error: '유효하지 않은 구독 플랜입니다' }, 400)
    }

    const db = c.env.DB

    // Update user subscription
    await db.prepare(
      'UPDATE users SET subscription = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(subscription, userId).run()

    return c.json({ success: true, message: '구독 플랜이 업데이트되었습니다', subscription })
  } catch (error) {
    console.error('Error updating subscription:', error)
    return c.json({ error: '구독 플랜 업데이트에 실패했습니다' }, 500)
  }
})

/**
 * DELETE /api/submissions/:id - Delete a submission (teacher only)
 */
app.delete('/api/submissions/:id', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user
    
    const submissionId = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    // Verify ownership - check if teacher owns the assignment
    const submission = await db.prepare(
      `SELECT s.*, a.user_id 
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
    
    // Delete related feedback first (foreign key cascade)
    await db.prepare(
      'DELETE FROM submission_feedback WHERE submission_id = ?'
    ).bind(submissionId).run()
    
    await db.prepare(
      'DELETE FROM submission_summary WHERE submission_id = ?'
    ).bind(submissionId).run()
    
    // Delete the submission
    await db.prepare(
      'DELETE FROM student_submissions WHERE id = ?'
    ).bind(submissionId).run()
    
    return c.json({ success: true, message: 'Submission deleted successfully' })
  } catch (error) {
    console.error('Error deleting submission:', error)
    return c.json({ error: 'Failed to delete submission', details: String(error) }, 500)
  }
})

/**
 * GET /api/student/my-submissions - Get student's own submissions
 */
app.get('/api/student/my-submissions', async (c) => {
  try {
    // 1. 학생 인증 확인
    const student = await requireStudentAuth(c)
    if (!student.id) {
      // 인증 실패 시 빈 배열 반환 (프론트엔드 호환)
      console.log('[MY_SUBMISSIONS] Authentication failed')
      return c.json([])
    }
    
    const db = c.env.DB
    console.log('[MY_SUBMISSIONS] Fetching for student:', student.id)
    
    // 2. 제출물 조회 (안전한 에러 처리)
    try {
      const submissions = await db.prepare(
        `SELECT 
          s.id,
          s.assignment_id,
          s.submitted_at,
          s.graded,
          s.submission_version,
          s.is_resubmission,
          s.overall_score,
          a.title as assignment_title,
          a.grade_level,
          ss.total_score,
          ss.strengths,
          ss.weaknesses
         FROM student_submissions s
         JOIN assignments a ON s.assignment_id = a.id
         LEFT JOIN submission_summary ss ON s.id = ss.submission_id
         WHERE s.student_user_id = ?
         ORDER BY s.submitted_at DESC`
      ).bind(student.id).all()
      
      const results = submissions.results || []
      console.log('[MY_SUBMISSIONS] Found:', results.length, 'submissions')
      
      return c.json(results)
    } catch (err) {
      console.error('[MY_SUBMISSIONS] Query error:', err)
      return c.json({ 
        error: '제출물을 불러오는 데 실패했습니다',
        debug: err instanceof Error ? err.message : String(err)
      }, 500)
    }
  } catch (error) {
    console.error('[MY_SUBMISSIONS] Unexpected error:', error)
    return c.json({ 
      error: '예상치 못한 오류가 발생했습니다',
      debug: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

/**
 * GET /api/student/submission/:id/feedback - Get detailed feedback for submission
 */
app.get('/api/student/submission/:id/feedback', async (c) => {
  try {
    const student = await requireStudentAuth(c)
    if (!student.id) return student
    
    const submissionId = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    // Verify ownership
    const submission = await db.prepare(
      'SELECT id FROM student_submissions WHERE id = ? AND student_user_id = ?'
    ).bind(submissionId, student.id).first()
    
    if (!submission) {
      return c.json({ error: '제출물을 찾을 수 없습니다' }, 404)
    }
    
    // Get criterion feedbacks
    const feedbacks = await db.prepare(
      `SELECT 
        sf.*,
        ar.criterion_name,
        ar.criterion_description,
        ar.max_score
       FROM submission_feedback sf
       JOIN assignment_rubrics ar ON sf.criterion_id = ar.id
       WHERE sf.submission_id = ?
       ORDER BY sf.id`
    ).bind(submissionId).all()
    
    // Get overall summary
    const summary = await db.prepare(
      'SELECT * FROM submission_summary WHERE submission_id = ?'
    ).bind(submissionId).first()
    
    return c.json({
      criterion_feedbacks: feedbacks.results || [],
      summary: summary || null
    })
  } catch (error) {
    console.error('Error fetching feedback:', error)
    return c.json({ error: '피드백을 불러오는 데 실패했습니다' }, 500)
  }
})

/**
 * GET /api/student/progress - Get student's progress across all assignments
 */
app.get('/api/student/progress', async (c) => {
  try {
    const student = await requireStudentAuth(c)
    if (!student.id) return student
    
    const db = c.env.DB
    
    const progress = await db.prepare(
      `SELECT 
        sp.*,
        a.title as assignment_title
       FROM student_progress sp
       JOIN assignments a ON sp.assignment_id = a.id
       WHERE sp.student_user_id = ?
       ORDER BY sp.tracked_at DESC`
    ).bind(student.id).all()
    
    return c.json(progress.results || [])
  } catch (error) {
    console.error('Error fetching progress:', error)
    return c.json({ error: '성장 기록을 불러오는 데 실패했습니다' }, 500)
  }
})

/**
 * GET /api/resources/:category - Get resource posts by category
 */
app.get('/api/resources/:category', async (c) => {
  try {
    const category = c.req.param('category')
    
    // Handle exam category (static PDF files)
    if (category === 'exam') {
      const examQuestions = [
        {
          id: 'exam-1',
          title: '201001 리젠트 시험 DBQ - 신석기 혁명 농업 혁명 그린 혁명',
          content: 'PDF 파일',
          file: '/exam-questions/201001 리젠트 시험 DBQ - 신석기 혁명 농업 혁명 그린 혁명.pdf',
          author: 'Admin',
          created_at: '2010-01-01'
        },
        {
          id: 'exam-2',
          title: '201206 리젠트 시험 DBQ - 독재 정치가 진시황제 표트르 루이14세',
          content: 'PDF 파일',
          file: '/exam-questions/201206 리젠트 시험 DBQ - 독재 정치가 진시황제 표트르 루이14세.pdf',
          author: 'Admin',
          created_at: '2012-06-01'
        },
        {
          id: 'exam-3',
          title: '201506 리젠트 시험 DBQ - 로마 제국 오스만 제국 대영 제국 멸망',
          content: 'PDF 파일',
          file: '/exam-questions/201506 리젠트 시험 DBQ - 로마 제국 오스만 제국 대영 제국 멸망.pdf',
          author: 'Admin',
          created_at: '2015-06-01'
        },
        {
          id: 'exam-4',
          title: '200906 리젠트 시험 DBQ - 중세말의 사회 변화 산업 혁명 세계화',
          content: 'PDF 파일',
          file: '/exam-questions/200906 리젠트 시험 DBQ - 중세말의 사회 변화 산업 혁명 세계화.pdf',
          author: 'Admin',
          created_at: '2009-06-01'
        }
      ]
      return c.json(examQuestions)
    }
    
    // Handle other categories from database
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

// User Guide Page
app.get('/guide', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>사용법 안내 | AI 논술 평가</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js"></script>
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
        <style>
          .guide-section {
            scroll-margin-top: 100px;
          }
          .step-number {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            background: #1e3a8a;
            color: white;
            border-radius: 50%;
            font-weight: bold;
            margin-right: 12px;
          }
          .feature-badge {
            display: inline-block;
            background: #dbeafe;
            color: #1e40af;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.875rem;
            font-weight: 600;
            margin-top: 8px;
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
                        <a href="/guide" class="text-navy-700 font-semibold">사용법 안내</a>
                        <a href="/login?type=teacher" class="bg-navy-900 text-white px-6 py-2 rounded-lg font-semibold hover:bg-navy-800 transition">
                            시작하기
                        </a>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Hero Section -->
        <div class="bg-gradient-to-r from-navy-900 to-navy-700 text-white py-12">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 class="text-4xl font-bold mb-4">
                    <i class="fas fa-book-open mr-3"></i>사용법 안내
                </h1>
                <p class="text-xl text-blue-100">AI 논술 채점 서비스를 처음 이용하시는 교사분들을 위한 상세 가이드</p>
            </div>
        </div>

        <!-- Quick Navigation -->
        <div class="bg-white border-b border-gray-200 sticky top-16 z-40">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div class="flex flex-wrap gap-3 items-center text-sm">
                    <span class="font-semibold text-gray-700">바로가기:</span>
                    <a href="#section-a" class="text-navy-700 hover:text-navy-900 font-medium">A. 과제 관리</a>
                    <span class="text-gray-300">•</span>
                    <a href="#section-b" class="text-navy-700 hover:text-navy-900 font-medium">B. 학생 답안 관리</a>
                    <span class="text-gray-300">•</span>
                    <a href="#section-c" class="text-navy-700 hover:text-navy-900 font-medium">C. 액세스 코드</a>
                    <span class="text-gray-300">•</span>
                    <a href="#section-d" class="text-navy-700 hover:text-navy-900 font-medium">D. AI 채점</a>
                    <span class="text-gray-300">•</span>
                    <a href="#section-e" class="text-navy-700 hover:text-navy-900 font-medium">E. 채점 이력</a>
                </div>
            </div>
        </div>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            
            <!-- Section A: 과제 관리 -->
            <section id="section-a" class="guide-section mb-16">
                <div class="bg-white rounded-xl shadow-lg p-8">
                    <h2 class="text-3xl font-bold text-gray-900 mb-6 border-b-4 border-navy-700 pb-3">
                        A. 과제 관리
                    </h2>

                    <!-- A-1: 새 과제 만들기 -->
                    <div class="mb-10">
                        <h3 class="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                            <i class="fas fa-plus-circle text-navy-700 mr-3"></i>
                            새 과제 만들기
                        </h3>
                        
                        <div class="space-y-4 ml-8">
                            <div class="flex items-start">
                                <span class="step-number">1</span>
                                <div class="flex-1">
                                    <p class="text-gray-700 font-medium">"새 과제 만들기" 버튼 클릭</p>
                                    <p class="text-gray-600 text-sm mt-1">나의 페이지 우측 상단에 있는 파란색 버튼을 클릭하세요.</p>
                                    <div class="mt-3 flex justify-center">
                                        <img src="/guide-screenshots/step1-my-page.png" alt="나의 페이지 - 새 과제 만들기 버튼" class="w-3/4 rounded-lg shadow-lg border border-gray-300">
                                    </div>
                                </div>
                            </div>

                            <div class="flex items-start">
                                <span class="step-number">2</span>
                                <div class="flex-1">
                                    <p class="text-gray-700 font-medium mb-3">과제 정보 입력</p>
                                    
                                    <!-- Option A: Load from Library -->
                                    <div class="mb-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                                        <p class="text-gray-800 font-semibold mb-2">a. 과제 불러오기 실행</p>
                                        <ul class="list-disc list-inside text-gray-600 space-y-1 ml-4 text-sm">
                                            <li>"기존 과제 불러오기"나 "과제 라이브러리에서 불러오기" 중에서 선택</li>
                                            <li>기존 과제를 불러오려면 기존 과제 목록 중에서 과제 선택 후 "불러오기" 버튼 클릭</li>
                                            <li>과제 라이브러리에서 불러오려면 "라이브러리 열기" 버튼 클릭 → 과제 라이브러리에서 원하는 과제 선택 후 "불러오기" 버튼 클릭</li>
                                        </ul>
                                        <div class="mt-3 flex justify-center flex-col gap-3">
                                            <img src="/guide-screenshots/library-load-from-file.png" alt="기존 과제 불러오기" class="w-3/4 rounded-lg shadow-lg border border-gray-300 mx-auto">
                                            <img src="/guide-screenshots/library-modal-view.png" alt="과제 라이브러리에서 불러오기" class="w-3/4 rounded-lg shadow-lg border border-gray-300 mx-auto">
                                        </div>
                                    </div>
                                    
                                    <!-- Option B: Direct Input -->
                                    <div class="bg-green-50 p-4 rounded-lg border border-green-200">
                                        <p class="text-gray-800 font-semibold mb-2">b. 과제 정보 직접 입력</p>
                                        <ul class="list-disc list-inside text-gray-600 space-y-1 ml-4 text-sm">
                                            <li><strong>제목:</strong> 예) "제2차 세계 대전의 원인"</li>
                                            <li><strong>설명:</strong> 예) "1939년 시작된 제2차 세계대전은... 결론을 논술하시오"</li>
                                            <li><strong>학년 수준:</strong> 드롭다운에서 선택 (초등/중등/고등)</li>
                                            <li><strong>마감일:</strong> 날짜 선택 (선택사항)</li>
                                        </ul>
                                        <div class="mt-3 flex justify-center">
                                            <img src="/guide-screenshots/library-create-from-scratch.png" alt="과제 정보 직접 입력 화면" class="w-3/4 rounded-lg shadow-lg border border-gray-300">
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="flex items-start">
                                <span class="step-number">3</span>
                                <div class="flex-1">
                                    <p class="text-gray-700 font-medium mb-2">제시문 추가 <span class="feature-badge"><i class="fas fa-image mr-1"></i>이미지 업로드 지원</span></p>
                                    <ul class="list-disc list-inside text-gray-600 space-y-2 ml-4">
                                        <li>4개 기본 제시문 입력 필드 제공 (최대 11개까지 추가 가능)</li>
                                        <li>각 제시문에 텍스트 직접 입력 또는 이미지 업로드</li>
                                    </ul>
                                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-3">
                                        <p class="font-semibold text-blue-900 mb-2"><i class="fas fa-magic mr-2"></i>이미지 업로드 기능</p>
                                        <ul class="list-disc list-inside text-blue-800 text-sm space-y-1 ml-4">
                                            <li>"이미지 업로드" 버튼 클릭</li>
                                            <li>이미지 파일 선택 (JPG, PNG, WebP, 최대 10MB)</li>
                                            <li>자동 OCR 처리로 텍스트 추출</li>
                                            <li>추출된 텍스트가 입력 필드에 자동 삽입</li>
                                            <li>처리 시간: 약 5-10초</li>
                                        </ul>
                                    </div>
                                    <div class="mt-3 flex justify-center">
                                        <img src="/guide-screenshots/step3-add-prompts.png" alt="제시문 추가 및 루브릭 설정" class="w-3/4 rounded-lg shadow-lg border border-gray-300">
                                    </div>
                                </div>
                            </div>

                            <div class="flex items-start">
                                <span class="step-number">4</span>
                                <div class="flex-1">
                                    <p class="text-gray-700 font-medium mb-3">루브릭 기준 설정</p>
                                    
                                    <!-- Option A: Platform Rubric -->
                                    <div class="mb-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                                        <p class="text-gray-800 font-semibold mb-2">a. 플랫폼 루브릭 중 선택</p>
                                        <ul class="list-disc list-inside text-gray-600 space-y-1 ml-4 text-sm">
                                            <li>플랫폼 루브릭 탭 선택 (기본값)</li>
                                            <li>루브릭 카드 클릭 → PDF 미리보기 모달 확인</li>
                                            <li>PDF 내용 확인 (스크롤 가능)</li>
                                            <li>"선택하기 →" 버튼 클릭 → 루브릭 선택 확인</li>
                                        </ul>
                                        <div class="mt-3 flex justify-center">
                                            <img src="/guide-screenshots/rubric-selection-platform.png" alt="플랫폼 루브릭 선택" class="w-3/4 rounded-lg shadow-lg border border-gray-300">
                                        </div>
                                    </div>
                                    
                                    <!-- Option B: Custom Rubric -->
                                    <div class="bg-green-50 p-4 rounded-lg border border-green-200">
                                        <p class="text-gray-800 font-semibold mb-2">b. 나의 루브릭 작성</p>
                                        <ul class="list-disc list-inside text-gray-600 space-y-1 ml-4 text-sm">
                                            <li>"기준 1"의 이름과 설명, 최대 점수 입력</li>
                                            <li>"기준 2"의 이름과 설명, 최대 점수 입력</li>
                                            <li>"기준 3"의 이름과 설명, 최대 점수 입력</li>
                                            <li>"기준 4"의 이름과 설명, 최대 점수 입력</li>
                                            <li>"평가 기준 추가" 버튼 클릭 (상세 기준이 5개 이상일 경우)</li>
                                        </ul>
                                        <div class="mt-3 flex justify-center">
                                            <img src="/guide-screenshots/custom-rubric-creation.png" alt="나의 루브릭 작성" class="w-3/4 rounded-lg shadow-lg border border-gray-300">
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="flex items-start">
                                <span class="step-number">5</span>
                                <div class="flex-1">
                                    <p class="text-gray-700 font-medium">"과제 생성" 버튼 클릭</p>
                                    <p class="text-gray-600 text-sm mt-1">모든 정보 입력 후 과제를 생성합니다.</p>
                                    <div class="mt-3 flex justify-center">
                                        <img src="/guide-screenshots/step5-assignment-modal.png" alt="과제 생성 모달" class="w-3/4 rounded-lg shadow-lg border border-gray-300">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- A-2: 과제 상세 정보 확인 및 출력 -->
                    <div class="mb-6">
                        <h3 class="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                            <i class="fas fa-info-circle text-navy-700 mr-3"></i>
                            과제 상세 정보 확인 및 출력
                        </h3>
                        
                        <div class="space-y-4 ml-8">
                            <div class="flex items-start">
                                <span class="step-number">1</span>
                                <div class="flex-1">
                                    <p class="text-gray-700 font-medium">과제 카드 클릭</p>
                                    <p class="text-gray-600 text-sm mt-1">과제 목록에서 원하는 과제를 클릭하면 상세 정보 모달이 열립니다.</p>
                                    <div class="mt-3 flex justify-center">
                                        <img src="/guide-screenshots/step4-assignment-created.png" alt="과제 생성 완료" class="w-3/4 rounded-lg shadow-lg border border-gray-300">
                                    </div>
                                </div>
                            </div>

                            <div class="flex items-start">
                                <span class="step-number">2</span>
                                <div class="flex-1">
                                    <p class="text-gray-700 font-medium mb-2">표시되는 정보</p>
                                    <ul class="list-disc list-inside text-gray-600 space-y-1 ml-4">
                                        <li>과제 제목 및 설명</li>
                                        <li>제시문 (입력된 경우 모두 표시)</li>
                                        <li>평가 루브릭 (기준 및 설명)</li>
                                        <li>학생 액세스 코드 (생성된 경우)</li>
                                    </ul>
                                    <div class="mt-3 flex justify-center">
                                        <img src="/guide-screenshots/assignment-detail-with-library.png" alt="과제 상세 정보 확인" class="w-3/4 rounded-lg shadow-lg border border-gray-300">
                                    </div>
                                </div>
                            </div>

                            <div class="flex items-start">
                                <span class="step-number">3</span>
                                <div class="flex-1">
                                    <p class="text-gray-700 font-medium mb-2">과제 라이브러리 등록</p>
                                    <ul class="list-disc list-inside text-gray-600 space-y-1 ml-4">
                                        <li>모달 우측 상단 "라이브러리에 등록하기" 버튼 클릭</li>
                                        <li>"이 과제를 라이브러리에 등록하시겠습니까? 등록된 과제는 모든 사용자가 볼 수 있습니다." 메시지를 확인하고 "확인" 버튼 클릭</li>
                                    </ul>
                                </div>
                            </div>

                            <div class="flex items-start">
                                <span class="step-number">4</span>
                                <div class="flex-1">
                                    <p class="text-gray-700 font-medium mb-2">출력 기능 <span class="feature-badge"><i class="fas fa-print mr-1"></i>인쇄 가능</span></p>
                                    <ul class="list-disc list-inside text-gray-600 space-y-1 ml-4">
                                        <li>모달 우측 상단 "출력" 버튼 클릭</li>
                                        <li>새 창에서 과제 전체 정보 표시</li>
                                        <li>내용 확인 후 "출력" 버튼으로 인쇄</li>
                                        <li>포함 항목: 과제 제목, 설명, 제시문, 평가 루브릭, 학생 액세스 코드</li>
                                    </ul>
                                </div>
                            </div>

                            <div class="flex items-start">
                                <span class="step-number">5</span>
                                <div class="flex-1">
                                    <p class="text-gray-700 font-medium">과제 삭제</p>
                                    <p class="text-gray-600 text-sm mt-1">
                                        <i class="fas fa-exclamation-triangle text-yellow-600 mr-1"></i>
                                        "삭제" 버튼 클릭 시 과제와 관련된 학생 제출물도 함께 삭제됩니다.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Section B: 학생 답안 관리 -->
            <section id="section-b" class="guide-section mb-16">
                <div class="bg-white rounded-xl shadow-lg p-8">
                    <h2 class="text-3xl font-bold text-gray-900 mb-6 border-b-4 border-navy-700 pb-3">
                        B. 학생 답안 관리
                    </h2>

                    <!-- B-1: 텍스트로 답안 추가 -->
                    <div class="mb-10">
                        <h3 class="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                            <i class="fas fa-keyboard text-navy-700 mr-3"></i>
                            텍스트로 답안 추가
                        </h3>
                        
                        <div class="space-y-4 ml-8">
                            <div class="flex items-start">
                                <span class="step-number">1</span>
                                <div class="flex-1">
                                    <p class="text-gray-700 font-medium">과제 카드 클릭하여 상세 페이지 열기</p>
                                </div>
                            </div>

                            <div class="flex items-start">
                                <span class="step-number">2</span>
                                <div class="flex-1">
                                    <p class="text-gray-700 font-medium">"답안지 추가" 버튼 클릭</p>
                                </div>
                            </div>

                            <div class="flex items-start">
                                <span class="step-number">3</span>
                                <div class="flex-1">
                                    <p class="text-gray-700 font-medium mb-2">학생 정보 입력</p>
                                    <ul class="list-disc list-inside text-gray-600 space-y-1 ml-4">
                                        <li>학생 이름</li>
                                        <li>논술 내용 (텍스트 입력)</li>
                                    </ul>
                                </div>
                            </div>

                            <div class="flex items-start">
                                <span class="step-number">4</span>
                                <div class="flex-1">
                                    <p class="text-gray-700 font-medium">"추가" 버튼 클릭</p>
                                    <div class="mt-3 flex justify-center">
                                        <img src="/guide-screenshots/step8-text-input.png" alt="텍스트로 답안 추가" class="w-3/4 rounded-lg shadow-lg border border-gray-300">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- B-2: 파일로 답안 추가 -->
                    <div class="mb-6">
                        <h3 class="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                            <i class="fas fa-file-upload text-navy-700 mr-3"></i>
                            파일로 답안 추가 <span class="feature-badge"><i class="fas fa-robot mr-1"></i>AI OCR 지원</span>
                        </h3>
                        
                        <div class="space-y-4 ml-8">
                            <div class="flex items-start">
                                <span class="step-number">1</span>
                                <div class="flex-1">
                                    <p class="text-gray-700 font-medium">"파일 선택" 탭 클릭</p>
                                </div>
                            </div>

                            <div class="flex items-start">
                                <span class="step-number">2</span>
                                <div class="flex-1">
                                    <p class="text-gray-700 font-medium mb-2">지원 파일 형식</p>
                                    <ul class="list-disc list-inside text-gray-600 space-y-1 ml-4">
                                        <li><strong>이미지:</strong> JPG, PNG, WebP (최대 10MB)</li>
                                        <li><strong>PDF:</strong> 텍스트/이미지 기반 PDF (최대 10MB)</li>
                                    </ul>
                                </div>
                            </div>

                            <div class="flex items-start">
                                <span class="step-number">3</span>
                                <div class="flex-1">
                                    <p class="text-gray-700 font-medium mb-2">파일 업로드 프로세스</p>
                                    <ol class="list-decimal list-inside text-gray-600 space-y-1 ml-4">
                                        <li>파일 선택 또는 드래그앤드롭</li>
                                        <li>파일 미리보기 확인</li>
                                        <li>"추가" 버튼 클릭</li>
                                        <li>자동으로 텍스트 추출 진행</li>
                                        <li>"채점하기" 버튼 클릭</li>
                                        <li>추출된 텍스트로 채점 진행</li>
                                    </ol>
                                </div>
                            </div>

                            <div class="flex items-start">
                                <span class="step-number">4</span>
                                <div class="flex-1">
                                    <p class="text-gray-700 font-medium mb-2">처리 시간</p>
                                    <ul class="list-disc list-inside text-gray-600 space-y-1 ml-4">
                                        <li>이미지 OCR: 5-10초</li>
                                        <li>텍스트 PDF: 3-5초</li>
                                        <li>이미지 PDF OCR: 10-15초</li>
                                    </ul>
                                    <div class="mt-3 flex justify-center">
                                        <img src="/guide-screenshots/step7-add-submission-file.png" alt="파일로 답안 추가" class="w-3/4 rounded-lg shadow-lg border border-gray-300">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Section C: 액세스 코드 생성 및 공유 -->
            <section id="section-c" class="guide-section mb-16">
                <div class="bg-white rounded-xl shadow-lg p-8">
                    <h2 class="text-3xl font-bold text-gray-900 mb-6 border-b-4 border-navy-700 pb-3">
                        C. 액세스 코드 생성 및 공유
                    </h2>

                    <div class="space-y-4 ml-8">
                        <div class="flex items-start">
                            <span class="step-number">1</span>
                            <div class="flex-1">
                                <p class="text-gray-700 font-medium">과제 상세 페이지에서 "액세스 코드 생성" 버튼 클릭</p>
                            </div>
                        </div>

                        <div class="flex items-start">
                            <span class="step-number">2</span>
                            <div class="flex-1">
                                <p class="text-gray-700 font-medium">6자리 숫자 코드 자동 생성</p>
                                <p class="text-gray-600 text-sm mt-1">예시: 123456</p>
                            </div>
                        </div>

                        <div class="flex items-start">
                            <span class="step-number">3</span>
                            <div class="flex-1">
                                <p class="text-gray-700 font-medium mb-2">학생들에게 코드 공유 방법</p>
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <p class="font-semibold text-blue-900 mb-2">
                                            <i class="fas fa-desktop mr-2"></i>화면 공유
                                        </p>
                                        <p class="text-sm text-blue-800">과제 상세 모달에서 직접 코드 표시</p>
                                    </div>
                                    <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                                        <p class="font-semibold text-green-900 mb-2">
                                            <i class="fas fa-print mr-2"></i>인쇄물 배포
                                        </p>
                                        <p class="text-sm text-green-800">"출력" 버튼으로 액세스 코드 포함하여 인쇄</p>
                                    </div>
                                    <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                        <p class="font-semibold text-purple-900 mb-2">
                                            <i class="fas fa-share-alt mr-2"></i>디지털 공유
                                        </p>
                                        <p class="text-sm text-purple-800">코드 복사하여 이메일/메신저로 전송</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="flex items-start">
                            <span class="step-number">4</span>
                            <div class="flex-1">
                                <p class="text-gray-700 font-medium">학생들이 코드로 과제 접근 및 제출</p>
                                <p class="text-gray-600 text-sm mt-1">학생 대시보드에서 액세스 코드를 입력하면 과제에 접근하여 답안을 제출할 수 있습니다.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Section D: AI 채점 및 피드백 검토 -->
            <section id="section-d" class="guide-section mb-16">
                <div class="bg-white rounded-xl shadow-lg p-8">
                    <h2 class="text-3xl font-bold text-gray-900 mb-6 border-b-4 border-navy-700 pb-3">
                        D. AI 채점 및 피드백 검토
                    </h2>

                    <div class="space-y-4 ml-8">
                        <div class="flex items-start">
                            <span class="step-number">1</span>
                            <div class="flex-1">
                                <p class="text-gray-700 font-medium">과제 상세 페이지에서 제출물 목록 확인</p>
                            </div>
                        </div>

                        <div class="flex items-start">
                            <span class="step-number">2</span>
                            <div class="flex-1">
                                <p class="text-gray-700 font-medium">"채점하기" 버튼 클릭</p>
                            </div>
                        </div>

                        <div class="flex items-start">
                            <span class="step-number">3</span>
                            <div class="flex-1">
                                <p class="text-gray-700 font-medium">AI 채점 진행</p>
                                <p class="text-gray-600 text-sm mt-1">
                                    <i class="fas fa-clock mr-1"></i>소요 시간: 약 10-30초
                                </p>
                            </div>
                        </div>

                        <div class="flex items-start">
                            <span class="step-number">4</span>
                            <div class="flex-1">
                                <p class="text-gray-700 font-medium mb-2">채점 결과 검토 모달 (Split-Screen Layout)</p>
                                <div class="bg-gray-50 border border-gray-300 rounded-lg p-4 mt-3">
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <p class="font-semibold text-gray-900 mb-2">
                                                <i class="fas fa-file-alt text-blue-600 mr-2"></i>왼쪽 패널
                                            </p>
                                            <ul class="list-disc list-inside text-gray-600 text-sm space-y-1 ml-4">
                                                <li>학생 답안 전체 내용</li>
                                                <li>읽기 전용</li>
                                                <li>스크롤 가능</li>
                                            </ul>
                                        </div>
                                        <div>
                                            <p class="font-semibold text-gray-900 mb-2">
                                                <i class="fas fa-edit text-green-600 mr-2"></i>오른쪽 패널
                                            </p>
                                            <ul class="list-disc list-inside text-gray-600 text-sm space-y-1 ml-4">
                                                <li>피드백 및 평가 (편집 가능)</li>
                                                <li>전체 점수 수정 (0-10점)</li>
                                                <li>종합 평가 편집</li>
                                                <li>기준별 점수 및 피드백 수정</li>
                                                <li>종합 의견, 수정 제안, 다음 단계 조언 편집</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                                <div class="mt-3 flex justify-center">
                                    <img src="/guide-screenshots/step10-grading-settings.png" alt="채점 설정" class="w-3/4 rounded-lg shadow-lg border border-gray-300">
                                </div>
                                <div class="mt-3 flex justify-center">
                                    <img src="/guide-screenshots/step10-grading-review-modal.png" alt="채점 결과 검토" class="w-3/4 rounded-lg shadow-lg border border-gray-300">
                                </div>
                            </div>
                        </div>

                        <div class="flex items-start">
                            <span class="step-number">5</span>
                            <div class="flex-1">
                                <p class="text-gray-700 font-medium mb-2">검토 후 3가지 옵션</p>
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <p class="font-semibold text-blue-900 mb-2">
                                            <i class="fas fa-print mr-2"></i>출력
                                        </p>
                                        <p class="text-sm text-blue-800">채점 결과 및 피드백을 별도 창에서 출력/저장</p>
                                    </div>
                                    <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                                        <p class="font-semibold text-green-900 mb-2">
                                            <i class="fas fa-save mr-2"></i>저장하고 완료
                                        </p>
                                        <p class="text-sm text-green-800">수정된 피드백을 데이터베이스에 저장</p>
                                    </div>
                                    <div class="bg-gray-50 border border-gray-300 rounded-lg p-4">
                                        <p class="font-semibold text-gray-900 mb-2">
                                            <i class="fas fa-times mr-2"></i>취소
                                        </p>
                                        <p class="text-sm text-gray-700">변경사항 없이 모달 닫기</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="flex items-start">
                            <span class="step-number">6</span>
                            <div class="flex-1">
                                <p class="text-gray-700 font-medium mb-2">상세 피드백 자동 생성</p>
                                <ul class="list-disc list-inside text-gray-600 space-y-1 ml-4">
                                    <li>각 기준별 긍정적 피드백</li>
                                    <li>개선이 필요한 부분</li>
                                    <li>구체적인 개선 방법 (단계별)</li>
                                    <li>학년에 맞는 톤 조정 (초등/중등/고등)</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Section E: 채점 이력 확인 및 일괄 출력 -->
            <section id="section-e" class="guide-section mb-16">
                <div class="bg-white rounded-xl shadow-lg p-8">
                    <h2 class="text-3xl font-bold text-gray-900 mb-6 border-b-4 border-navy-700 pb-3">
                        E. 채점 이력 확인 및 일괄 출력
                    </h2>

                    <div class="space-y-4 ml-8">
                        <div class="flex items-start">
                            <span class="step-number">1</span>
                            <div class="flex-1">
                                <p class="text-gray-700 font-medium">"채점 이력" 탭 클릭</p>
                                <p class="text-gray-600 text-sm mt-1">나의 페이지 상단 탭에서 "채점 이력"을 선택하세요.</p>
                            </div>
                        </div>

                        <div class="flex items-start">
                            <span class="step-number">2</span>
                            <div class="flex-1">
                                <p class="text-gray-700 font-medium mb-2">모든 채점 완료된 답안 확인</p>
                                <p class="text-gray-600 text-sm mb-2">다음 정보가 표시됩니다:</p>
                                <ul class="list-disc list-inside text-gray-600 space-y-1 ml-4">
                                    <li>과제 제목</li>
                                    <li>학생 이름</li>
                                    <li>점수</li>
                                    <li>종합 피드백</li>
                                    <li>제출일 및 채점일</li>
                                </ul>
                                <div class="mt-3 flex justify-center">
                                    <img src="/guide-screenshots/step11-grading-history-list.png" alt="채점 이력 확인" class="w-3/4 rounded-lg shadow-lg border border-gray-300">
                                </div>
                            </div>
                        </div>

                        <div class="flex items-start">
                            <span class="step-number">3</span>
                            <div class="flex-1">
                                <p class="text-gray-700 font-medium mb-2">답안 재검토 기능</p>
                                <ul class="list-disc list-inside text-gray-600 space-y-1 ml-4">
                                    <li>답안 카드 클릭 시 Split-Screen 검토 모달 열림</li>
                                    <li>학생 답안(좌측) + 피드백(우측) 동시 확인</li>
                                    <li>모든 피드백 필드 수정 가능</li>
                                    <li>수정 후 "저장하고 완료" 또는 "출력" 선택</li>
                                </ul>
                            </div>
                        </div>

                        <div class="flex items-start">
                            <span class="step-number">4</span>
                            <div class="flex-1">
                                <p class="text-gray-700 font-medium mb-2">일괄 출력 기능 사용 <span class="feature-badge"><i class="fas fa-file-pdf mr-1"></i>PDF 통합 지원</span></p>
                                <ol class="list-decimal list-inside text-gray-600 space-y-2 ml-4">
                                    <li>각 답안 왼쪽 체크박스로 출력할 항목 선택</li>
                                    <li>"전체 선택" 체크박스로 모든 답안 선택 가능</li>
                                    <li>"출력" 버튼 클릭하여 드롭다운 메뉴 열기</li>
                                </ol>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <p class="font-semibold text-blue-900 mb-2">
                                            <i class="fas fa-file-alt mr-2"></i>PDF (개별 출력)
                                        </p>
                                        <p class="text-sm text-blue-800">각 답안을 별도 창에서 열어 개별 인쇄</p>
                                    </div>
                                    <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                                        <p class="font-semibold text-green-900 mb-2">
                                            <i class="fas fa-file-pdf mr-2"></i>단일 PDF 파일로 내보내기
                                        </p>
                                        <p class="text-sm text-green-800">모든 선택 답안을 하나의 문서로 통합하여 일괄 인쇄</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Bottom CTA -->
            <div class="bg-gradient-to-r from-navy-900 to-navy-700 rounded-xl shadow-lg p-8 text-center text-white">
                <h3 class="text-2xl font-bold mb-4">
                    <i class="fas fa-rocket mr-2"></i>지금 바로 시작하세요!
                </h3>
                <p class="text-xl text-blue-100 mb-6">AI 논술 채점 서비스로 채점 시간을 90% 줄이세요</p>
                <div class="flex justify-center gap-4">
                    <a href="/login?type=teacher" class="bg-white text-navy-900 px-8 py-3 rounded-lg font-bold hover:bg-blue-50 transition">
                        교사 로그인
                    </a>
                    <a href="/signup" class="bg-lime-400 text-navy-900 px-8 py-3 rounded-lg font-bold hover:bg-lime-300 transition">
                        무료로 시작하기
                    </a>
                </div>
            </div>

        </div>

        <!-- Footer -->
        <footer class="bg-gray-900 text-gray-300 py-12 mt-16">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <p class="text-lg font-semibold text-white mb-2">AI 논술 평가 시스템</p>
                <p class="text-sm">© 2024 All rights reserved.</p>
                <div class="mt-4">
                    <a href="/" class="text-blue-400 hover:text-blue-300 mx-2">홈</a>
                    <a href="/guide" class="text-blue-400 hover:text-blue-300 mx-2">사용법</a>
                    <a href="/pricing" class="text-blue-400 hover:text-blue-300 mx-2">요금제</a>
                </div>
            </div>
        </footer>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    </body>
    </html>
  `)
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
        <meta name="description" content="AI로 논술 답안지를 10배 빠르게 채점하세요. 상세하고 실행 가능한 피드백을 받으세요. 1,000명 이상의 교사가 신뢰합니다.">
        <link rel="icon" type="image/svg+xml" href="/favicon.svg">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js"></script>
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
            position: relative !important;
            display: inline-block !important;
          }
          .dropdown-content {
            display: none !important;
            position: absolute !important;
            top: 100% !important;
            left: 0 !important;
            background-color: white !important;
            min-width: 220px !important;
            box-shadow: 0 8px 16px 0 rgba(0,0,0,0.2) !important;
            z-index: 1000 !important;
            border-radius: 8px !important;
            overflow: hidden !important;
            margin-top: 0px !important;
            padding-top: 8px !important;
          }
          .dropdown:hover .dropdown-content,
          .dropdown-content:hover {
            display: block !important;
          }
          .dropdown button {
            font-size: 1rem !important;
            padding: 8px 0 !important;
            outline: none !important;
            background: transparent !important;
            border: none !important;
          }
          .dropdown button:focus {
            outline: none !important;
          }
          .dropdown-content a {
            color: #374151 !important;
            padding: 12px 16px !important;
            text-decoration: none !important;
            display: block !important;
            transition: background-color 0.2s !important;
          }
          .dropdown-content a:hover {
            background-color: #f3f4f6 !important;
            color: #1e3a8a !important;
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
                        <a href="#features" class="text-gray-700 hover:text-navy-700 font-bold">기능</a>
                        <a href="/guide" class="text-gray-700 hover:text-navy-700 font-bold">사용법 안내</a>
                        <div class="dropdown">
                            <button class="text-gray-700 hover:text-navy-700 font-bold cursor-pointer">
                                평가 관련 자료 <i class="fas fa-chevron-down text-xs ml-1"></i>
                            </button>
                            <div class="dropdown-content">
                                <a href="/resources/rubric"><i class="fas fa-clipboard-list mr-2 text-navy-700"></i>루브릭</a>
                                <a href="/resources/exam"><i class="fas fa-file-alt mr-2 text-navy-700"></i>기출 문제</a>
                                <a href="/resources/evaluation"><i class="fas fa-book mr-2 text-navy-700"></i>논술 평가 자료</a>
                            </div>
                        </div>
                        <a href="#faq" class="text-gray-700 hover:text-navy-700 font-bold">자주 묻는 질문</a>
                        <a href="/pricing" class="text-gray-700 hover:text-navy-700 font-bold">요금제</a>
                        <a href="/my-page" id="myPageLink" class="text-gray-700 hover:text-navy-700 font-bold" style="display: none;">나의 페이지</a>
                        <div class="dropdown" id="loginDropdown">
                            <button class="text-gray-700 hover:text-navy-700 font-bold cursor-pointer">
                                로그인 <i class="fas fa-chevron-down text-xs ml-1"></i>
                            </button>
                            <div class="dropdown-content">
                                <a href="/login?type=teacher"><i class="fas fa-chalkboard-teacher mr-2 text-navy-700"></i>교사</a>
                                <a href="/login?type=student"><i class="fas fa-user-graduate mr-2 text-navy-700"></i>학생</a>
                            </div>
                        </div>
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
                        1,000명 이상의 교사가 신뢰하는 서비스
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
                        <div class="text-sm text-gray-600">신뢰하는 교사</div>
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
                        <p class="text-gray-600">채점 루브릭을 생성하거나 가져오세요. 10개 이상의 사전 제작 루브릭 중에서 선택하거나 직접 맞춤 설정하세요.</p>
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
                <!-- First row: 3 columns -->
                <div class="grid md:grid-cols-3 gap-8 mb-8">
                    <div class="feature-card bg-white p-6 rounded-xl shadow-md">
                        <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                            <i class="fas fa-folder-open text-2xl text-green-600"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">기존 과제 불러오기</h3>
                        <p class="text-gray-600">새 과제 만들기에서 기존에 출제했던 과제나 다른 교사들이 공유한 과제, 플랫폼 제공 과제를 불러올 수 있습니다. 편집하여 사용하세요.</p>
                    </div>
                    <div class="feature-card bg-white p-6 rounded-xl shadow-md">
                        <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                            <i class="fas fa-pen-fancy text-2xl text-purple-600"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">손글씨 텍스트 변환</h3>
                        <p class="text-gray-600">학생이 손글씨로 작성한 논술문을 업로드하여 채점하세요. 광학 문자 인식(OCR) 도구로 손글씨 이미지를 디지털 텍스트로 변환합니다.</p>
                    </div>
                    <div class="feature-card bg-white p-6 rounded-xl shadow-md">
                        <div class="w-12 h-12 bg-navy-100 rounded-lg flex items-center justify-center mb-4">
                            <i class="fas fa-bolt text-2xl text-navy-700"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">초고속 채점</h3>
                        <p class="text-gray-600">전체 학급을 몇 분 안에 채점하세요. 매주 몇 시간의 채점 시간을 절약하세요.</p>
                    </div>
                </div>
                
                <!-- Second row: 2 columns centered -->
                <div class="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
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
                </div>
            </div>
        </section>

        <!-- Grading Interface -->
        <section id="grader" class="py-20 bg-white">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="text-center mb-12">
                    <h2 class="text-4xl font-bold text-gray-900 mb-4">지금 사용해 보기</h2>
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
                                            <i class="fas fa-paperclip mr-2 text-navy-700"></i>제시문
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
                                            <option value="">루브릭을 불러오는 중...</option>
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
                    <p class="text-gray-500 mt-2">일반적으로 30-50초 소요됩니다</p>
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
                        <summary class="font-bold cursor-pointer">AI 논술 평가 서비스를 이용하면 어떤 이점이 있나요?</summary>
                        <p class="mt-4 text-gray-600">AI 논술 평가 서비스는 교사가 학생의 논술 실력 향상을 위해 구체적이고 시의적절한 피드백을 제공하도록 돕습니다. 학생은 개인화된 상세 피드백으로 개선이 필요한 영역을 명확히 알게 되어 빠른 향상과 학습 성과를 얻습니다.</p>
                    </details>
                    <details class="bg-gray-50 p-6 rounded-lg">
                        <summary class="font-bold cursor-pointer">AI 채점은 얼마나 정확한가요?</summary>
                        <p class="mt-4 text-gray-600">우리 AI는 인간 채점자와 비교하여 4% 미만의 편차를 달성하며, 학문적 사용에 필요한 실질적 일치 임계값(QWK 0.61+)을 충족합니다.</p>
                    </details>
                    <details class="bg-gray-50 p-6 rounded-lg">
                        <summary class="font-bold cursor-pointer">AI 논술 평가의 최종 성적은 누가 책임 지나요?</summary>
                        <p class="mt-4 text-gray-600">AI 논술 평가 서비스는 인공지능 기반 제안으로 채점 과정을 간소화하여 교사를 지원하도록 설계된 것으로 어디까지나 보조적인 용도로 사용해야 합니다. 교사는 채점 결과를 최종 확정하기 전에 성적과 피드백을 검토하고 검증해야 합니다. 따라서 채점 결과에 대한 책임은 교사에게 있습니다.</p>
                    </details>
                    <details class="bg-gray-50 p-6 rounded-lg">
                        <summary class="font-bold cursor-pointer">학생이 논술 답안을 어떻게 제출하나요?</summary>
                        <p class="mt-4 text-gray-600">네! 교사가 과제를 생성하면 학생 전용 액세스 코드가 생성됩니다. 학생들은 이 액세스 코드를 통해 논술 답안을 간편하게 제출할 수 있습니다.</p>
                    </details>
                    <details class="bg-gray-50 p-6 rounded-lg">
                        <summary class="font-bold cursor-pointer">무료 체험이 가능한가요?</summary>
                        <p class="mt-4 text-gray-600">네! 무료 체험 플랜으로 월 20개의 논술 답안지를 채점할 수 있습니다. 유료 플랜은 한달에 7,500원으로 90개의 논술 답안지를 채점할 수 있는 "스타터" 요금제부터 시작합니다.</p>
                    </details>
                </div>
            </div>
        </section>

        <!-- CTA Section -->
        <section class="hero-gradient text-white py-20">
            <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <h2 class="text-2xl md:text-3xl font-bold mb-6">논술 채점에 들어가는 시간을 절약할 준비가 되셨나요?</h2>
                <p class="text-xl mb-8">AI 논술 평가를 사용하는 1,000명 이상의 교사와 함께하세요</p>
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
                            <li><a href="#features" class="hover:text-white">기능</a></li>
                            <li><a href="/pricing" class="hover:text-white">요금제</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 class="font-bold mb-4">고객 지원</h4>
                        <ul class="space-y-2 text-gray-400 text-sm">
                            <li><a href="mailto:simmanistudy@gmail.com" class="hover:text-white">문의하기</a></li>
                            <li class="text-gray-400">✉ simmanistudy@gmail.com</li>
                            <li class="text-gray-400">☎ 02-6339-6059</li>
                        </ul>
                    </div>
                    <div>
                        <h4 class="font-bold mb-4">법적 고지</h4>
                        <ul class="space-y-2 text-gray-400 text-sm">
                            <li><a href="/terms" class="hover:text-white">이용 약관</a></li>
                            <li><a href="/privacy" class="hover:text-white">개인정보 처리방침</a></li>
                        </ul>
                    </div>
                </div>
                <div class="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 text-sm">
                    <p>© 2025 AI 논술 평가. All rights reserved.</p>
                </div>
            </div>
        </footer>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        ${STORAGE_UTILS_SCRIPT}
        <script>
          // Check if user is logged in and show "나의 페이지" link
          function checkLoginStatus() {
            const isLoggedIn = getStorageItem('isLoggedIn') === 'true';
            const myPageLink = document.getElementById('myPageLink');
            if (isLoggedIn && myPageLink) {
              myPageLink.style.display = 'inline-block';
            }
          }
          
          // Run on page load
          document.addEventListener('DOMContentLoaded', checkLoginStatus);
        </script>
        <script src="/static/app.js?v=20260118b"></script>
    </body>
    </html>
  `)
})

// Resource List Page
app.get('/resources/:category', async (c) => {
  const category = c.req.param('category')
  const categoryName = category === 'rubric' ? '루브릭' : category === 'exam' ? '기출 문제' : '논술 평가 자료'
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${categoryName} | AI 논술 평가</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js"></script>
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

            <!-- Search Box -->
            <div class="mb-8">
                <div class="relative max-w-2xl mx-auto">
                    <input 
                        type="text" 
                        id="searchInput" 
                        placeholder="자료 검색..." 
                        class="w-full px-6 py-4 pl-12 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-navy-700 transition"
                        onkeyup="filterResources()"
                    />
                    <i class="fas fa-search absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl"></i>
                </div>
            </div>

            <div id="postsList" class="space-y-6">
                <p class="text-gray-500 text-center py-8">자료를 불러오는 중...</p>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <script>
          const category = '${category}';
          let allItems = [];
          
          // 플랫폼 루브릭 목록
          const platformRubrics = [
            { id: 'standard', title: '표준 논술 루브릭(4개 기준)', pdf: '/rubric-pdfs/표준 논술 루브릭(4개 기준).pdf', value: 'standard' },
            { id: 'kr_elementary', title: '초등학생용 평가 기준', pdf: '/rubric-pdfs/초등학생용 평가 기준.pdf', value: 'kr_elementary' },
            { id: 'kr_middle', title: '중학생용 평가 기준', pdf: '/rubric-pdfs/중학생용 평가 기준.pdf', value: 'kr_middle' },
            { id: 'kr_high', title: '고등학생용 평가 기준', pdf: '/rubric-pdfs/고등학생용 평가 기준.pdf', value: 'kr_high' },
            { id: 'nyregents', title: '뉴욕 주 리젠트 시험 논증적 글쓰기 루브릭', pdf: '/rubric-pdfs/뉴욕 주 리젠트 시험 논증적 글쓰기 루브릭.pdf', value: 'nyregents' },
            { id: 'nyregents_analytical', title: '뉴욕 주 리젠트 시험 분석적 글쓰기 루브릭', pdf: '/rubric-pdfs/뉴욕 주 리젠트 시험 분석적 글쓰기 루브릭.pdf', value: 'nyregents_analytical' },
            { id: 'ny_middle', title: '뉴욕 주 중학교 논술 루브릭', pdf: '/rubric-pdfs/뉴욕 주 중학교 논술 루브릭.pdf', value: 'ny_middle' },
            { id: 'ny_elementary', title: '뉴욕 주 초등학교 논술 루브릭', pdf: '/rubric-pdfs/뉴욕 주 초등학교 논술 루브릭.pdf', value: 'ny_elementary' },
            { id: 'ib_myp_highschool', title: 'IB 중등 프로그램 고등학교 개인과 사회 논술 루브릭', pdf: '/rubric-pdfs/IB 중등 프로그램 고등학교 개인과 사회 논술 루브릭.pdf', value: 'ib_myp_highschool' },
            { id: 'ib_myp_middleschool', title: 'IB 중등 프로그램 중학교 개인과 사회 논술 루브릭', pdf: '/rubric-pdfs/IB 중등 프로그램 중학교 개인과 사회 논술 루브릭.pdf', value: 'ib_myp_middleschool' },
            { id: 'ib_myp_science', title: 'IB 중등 프로그램 과학 논술 루브릭', pdf: '/rubric-pdfs/IB 중등 프로그램 과학 논술 루브릭.pdf', value: 'ib_myp_science' }
          ];
          
          // 기출 문제 목록
          const examQuestions = [
            {
              id: 'exam-1',
              title: '201001 리젠트 시험 DBQ - 신석기 혁명 농업 혁명 그린 혁명',
              file: '/exam-questions/201001 리젠트 시험 DBQ - 신석기 혁명 농업 혁명 그린 혁명.pdf',
              date: '2010-01-01'
            },
            {
              id: 'exam-2',
              title: '201206 리젠트 시험 DBQ - 독재 정치가 진시황제 표트르 루이14세',
              file: '/exam-questions/201206 리젠트 시험 DBQ - 독재 정치가 진시황제 표트르 루이14세.pdf',
              date: '2012-06-01'
            },
            {
              id: 'exam-3',
              title: '201506 리젠트 시험 DBQ - 로마 제국 오스만 제국 대영 제국 멸망',
              file: '/exam-questions/201506 리젠트 시험 DBQ - 로마 제국 오스만 제국 대영 제국 멸망.pdf',
              date: '2015-06-01'
            },
            {
              id: 'exam-4',
              title: '200906 리젠트 시험 DBQ - 중세말의 사회 변화 산업 혁명 세계화',
              file: '/exam-questions/200906 리젠트 시험 DBQ - 중세말의 사회 변화 산업 혁명 세계화.pdf',
              date: '2009-06-01'
            }
          ];
          
          function filterResources() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            const filtered = allItems.filter(item => 
              item.title.toLowerCase().includes(searchTerm)
            );
            displayItems(filtered);
          }
          
          function displayItems(items) {
            const container = document.getElementById('postsList');
            
            if (items.length === 0) {
              container.innerHTML = \`
                <div class="text-center py-12">
                  <i class="fas fa-inbox text-6xl text-gray-300 mb-4"></i>
                  <p class="text-gray-500 text-lg">검색 결과가 없습니다.</p>
                </div>
              \`;
              return;
            }
            
            if (category === 'rubric') {
              container.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' + items.map(item => \`
                <div class="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-navy-700 hover:shadow-xl transition">
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <h3 class="text-xl font-bold text-gray-900 mb-3">\${item.title}</h3>
                      <div class="mt-4">
                        <button onclick="event.stopPropagation(); window.open('/rubric-detail/\${item.value}', '_blank')" 
                                class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition font-semibold">
                          <i class="fas fa-eye mr-2"></i>상세보기
                        </button>
                      </div>
                    </div>
                    <i class="fas fa-file-pdf text-red-600 text-3xl ml-4"></i>
                  </div>
                </div>
              \`).join('') + '</div>';
            } else if (category === 'exam') {
              container.innerHTML = items.map(item => \`
                <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-xl transition cursor-pointer" onclick="openPDF('\${item.file}', '\${item.title}')">
                  <div class="flex items-center justify-between">
                    <div class="flex-1">
                      <h2 class="text-2xl font-bold text-gray-900 mb-3 hover:text-navy-700 transition">\${item.title}</h2>
                      <div class="flex items-center text-sm text-gray-500">
                        <i class="fas fa-file-pdf mr-2 text-red-600"></i>
                        <span>PDF 문서</span>
                        <span class="mx-2">•</span>
                        <i class="fas fa-calendar mr-2"></i>
                        <span>\${new Date(item.date).toLocaleDateString('ko-KR')}</span>
                      </div>
                    </div>
                    <div>
                      <i class="fas fa-eye text-3xl text-navy-700"></i>
                    </div>
                  </div>
                </div>
              \`).join('');
            } else {
              container.innerHTML = items.map(post => {
                const hasFile = post.file && post.file.trim() !== '';
                const onclick = hasFile ? \`openDocument('\${post.file}', '\${post.title}')\` : \`location.href='/resource/\${post.id}'\`;
                return \`
                  <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-xl transition cursor-pointer" onclick="\${onclick}">
                    <div class="flex items-center justify-between">
                      <div class="flex-1">
                        <h2 class="text-2xl font-bold text-gray-900 mb-3 hover:text-navy-700 transition">\${post.title}</h2>
                        <div class="flex items-center text-sm text-gray-500">
                          <i class="fas fa-user mr-2"></i>
                          <span>\${post.author || 'AI 논술 평가 시스템'}</span>
                          <span class="mx-2">•</span>
                          <i class="fas fa-calendar mr-2"></i>
                          <span>\${new Date(post.created_at).toLocaleDateString('ko-KR')}</span>
                          \${hasFile ? '<span class="mx-2">•</span><i class="fas fa-file-alt mr-2 text-navy-600"></i><span class="text-navy-600">문서</span>' : ''}
                        </div>
                      </div>
                      <div>
                        <i class="fas \${hasFile ? 'fa-eye' : 'fa-arrow-right'} text-3xl text-navy-700"></i>
                      </div>
                    </div>
                  </div>
                \`;
              }).join('');
            }
          }
          
          function openPDF(url, title) {
            const modal = document.createElement('div');
            modal.id = 'pdfModal';
            modal.className = 'fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4';
            modal.innerHTML = \`
              <div class="bg-white rounded-lg w-full max-w-6xl h-5/6 flex flex-col">
                <div class="flex items-center justify-between p-4 border-b">
                  <h3 class="text-xl font-bold text-gray-900 truncate">\${title}</h3>
                  <button onclick="closePDF()" class="text-gray-500 hover:text-gray-700 text-2xl font-bold">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
                <div class="flex-1 overflow-auto">
                  <iframe src="\${url}" class="w-full h-full" frameborder="0"></iframe>
                </div>
              </div>
            \`;
            document.body.appendChild(modal);
          }
          
          function openDocument(url, title) {
            const modal = document.createElement('div');
            modal.id = 'documentModal';
            modal.className = 'fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4';
            modal.innerHTML = \`
              <div class="bg-white rounded-lg w-full max-w-6xl h-5/6 flex flex-col">
                <div class="flex items-center justify-between p-4 border-b bg-navy-900">
                  <h3 class="text-xl font-bold text-white truncate">\${title}</h3>
                  <button onclick="closeDocument()" class="text-white hover:text-gray-300 text-2xl font-bold p-2 hover:bg-navy-800 rounded transition">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
                <div class="flex-1 overflow-auto bg-white">
                  <iframe src="\${url}" class="w-full h-full border-0"></iframe>
                </div>
              </div>
            \`;
            document.body.appendChild(modal);
          }
          
          function closePDF() {
            const modal = document.getElementById('pdfModal');
            if (modal) {
              modal.remove();
            }
          }
          
          function closeDocument() {
            const modal = document.getElementById('documentModal');
            if (modal) {
              modal.remove();
            }
          }
          
          async function loadPosts() {
            try {
              if (category === 'exam') {
                allItems = examQuestions;
                displayItems(allItems);
              } else if (category === 'rubric') {
                allItems = platformRubrics;
                displayItems(allItems);
              } else {
                const response = await axios.get('/api/resources/' + category);
                allItems = response.data;
                displayItems(allItems);
              }
            } catch (error) {
              console.error('Error loading posts:', error);
              document.getElementById('postsList').innerHTML = \`
                <div class="text-center py-8 text-red-600">
                  <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                  <p>자료를 불러오는 데 실패했습니다.</p>
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
        <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js"></script>
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
          // Simple markdown-like formatting to HTML converter
          function formatContent(content) {
            // If content already contains HTML tags (rubric-container, div class, etc.), return as-is
            if (content.includes('<div') || content.includes('rubric-container')) {
              return content;
            }
            
            // Otherwise, apply simple markdown-like formatting
            return content
              .split('\\n')
              .map(line => {
                // Convert **text** to <strong>text</strong>
                line = line.replace(/\\*\\*(.*?)\\*\\*/g, '<strong class="text-navy-900 font-bold">$1</strong>');
                
                // Convert bullet points (•) to proper list items
                if (line.trim().startsWith('•')) {
                  return \`<li class="ml-4 mb-2 text-gray-700">\${line.replace('•', '').trim()}</li>\`;
                }
                
                // Empty lines
                if (line.trim() === '') {
                  return '<div class="h-2"></div>';
                }
                
                // Regular paragraphs
                return \`<p class="mb-3 text-gray-700 leading-relaxed">\${line}</p>\`;
              })
              .join('');
          }
        
          async function loadPost() {
            try {
              const response = await axios.get('/api/resource/${id}');
              const post = response.data;
              
              const categoryName = post.category === 'rubric' ? '루브릭' : '논술 평가 자료';
              const formattedContent = formatContent(post.content);
              
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
                      \${formattedContent}
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
                  <p>자료를 불러오는 데 실패했습니다.</p>
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

// Student Login Page
app.get('/student/login', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>학생 로그인 | AI 논술 평가</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js"></script>
    </head>
    <body class="bg-gray-50">
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

        <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div class="max-w-md w-full space-y-8">
                <div>
                    <h2 class="mt-6 text-center text-3xl font-bold text-gray-900">
                        학생 로그인
                    </h2>
                    <p class="mt-2 text-center text-sm text-gray-600">
                        또는
                        <a href="/student/signup" class="font-medium text-blue-600 hover:text-blue-700">
                            새 계정 만들기
                        </a>
                    </p>
                </div>
                <form class="mt-8 space-y-6" onsubmit="handleLogin(event)">
                    <div class="rounded-md shadow-sm space-y-4">
                        <div>
                            <label for="email" class="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                            <input id="email" name="email" type="email" required 
                                   class="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
                                   placeholder="이메일 주소">
                        </div>
                        <div>
                            <label for="password" class="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                            <input id="password" name="password" type="password" required 
                                   class="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
                                   placeholder="비밀번호">
                        </div>
                    </div>

                    <div>
                        <button type="submit" 
                                class="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                            로그인
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
          // Storage fallback for Safari's tracking prevention
          function getStorageItem(key) {
            try {
              return localStorage.getItem(key) || sessionStorage.getItem(key);
            } catch (e) {
              console.warn('localStorage blocked, using sessionStorage:', e);
              return sessionStorage.getItem(key);
            }
          }
          
          function setStorageItem(key, value) {
            try {
              localStorage.setItem(key, value);
            } catch (e) {
              console.warn('localStorage blocked, using sessionStorage:', e);
              sessionStorage.setItem(key, value);
            }
          }
          
          function removeStorageItem(key) {
            try {
              localStorage.removeItem(key);
            } catch (e) {
              console.warn('localStorage blocked, using sessionStorage:', e);
            }
            sessionStorage.removeItem(key);
          }
          
          async function handleLogin(event) {
            event.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            try {
              const response = await axios.post('/api/auth/student/login', {
                email,
                password
              });
              
              if (response.data.success) {
                setStorageItem('student_session_id', response.data.session_id);
                setStorageItem('student_name', response.data.student.name);
                setStorageItem('student_email', response.data.student.email);
                setStorageItem('student_grade_level', response.data.student.grade_level);
                setStorageItem('isLoggedIn', 'true');
                
                alert(\`환영합니다, \${response.data.student.name}님!\`);
                window.location.href = '/student/dashboard';
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

// Student Signup Page
app.get('/student/signup', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>학생 회원가입 | AI 논술 평가</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js"></script>
    </head>
    <body class="bg-gray-50">
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

        <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div class="max-w-md w-full space-y-8">
                <div>
                    <h2 class="mt-6 text-center text-3xl font-bold text-gray-900">
                        학생 회원가입
                    </h2>
                    <p class="mt-2 text-center text-sm text-gray-600">
                        이미 계정이 있으신가요?
                        <a href="/student/login" class="font-medium text-blue-600 hover:text-blue-700">
                            로그인하기
                        </a>
                    </p>
                </div>
                <form id="studentSignupForm" class="mt-8 space-y-6">
                    <div class="rounded-md shadow-sm space-y-4">
                        <div>
                            <label for="name" class="block text-sm font-medium text-gray-700 mb-1">이름</label>
                            <input id="name" name="name" type="text" required 
                                   class="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
                                   placeholder="이름">
                        </div>
                        <div>
                            <label for="email" class="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                            <input id="email" name="email" type="email" required 
                                   class="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
                                   placeholder="이메일 주소">
                        </div>
                        <div>
                            <label for="password" class="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                            <input id="password" name="password" type="password" required 
                                   class="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
                                   placeholder="비밀번호 (대문자, 소문자, 숫자, 특수문자 포함 10자 이상)">
                            <p class="mt-1 text-xs text-gray-500">예: MyPass123!</p>
                        </div>
                        <div>
                            <label for="grade_level" class="block text-sm font-medium text-gray-700 mb-1">학년</label>
                            <select id="grade_level" name="grade_level" required
                                   class="appearance-none relative block w-full px-3 py-3 border border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500">
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
                    </div>

                    <div>
                        <button type="submit" 
                                class="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
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
            event.stopPropagation();
            
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const grade_level = document.getElementById('grade_level').value;
            
            // 비밀번호 검증
            if (password.length < 10) {
              alert('회원가입 실패: 비밀번호는 최소 10자 이상이어야 합니다.');
              return;
            }
            if (!/[a-z]/.test(password)) {
              alert('회원가입 실패: 비밀번호에는 소문자가 포함되어야 합니다.');
              return;
            }
            if (!/[A-Z]/.test(password)) {
              alert('회원가입 실패: 비밀번호에는 대문자가 포함되어야 합니다.');
              return;
            }
            if (!/[0-9]/.test(password)) {
              alert('회원가입 실패: 비밀번호에는 숫자가 포함되어야 합니다.');
              return;
            }
            // 특수문자 검증 (정규식 사용)
            const specialCharsRegex = /[@$!%*?&#^()_+\\-=\\[\\]{}|\\\\:;"'<>,./~]/;
            if (!specialCharsRegex.test(password)) {
              alert('회원가입 실패: 비밀번호에는 특수문자가 포함되어야 합니다.');
              return;
            }
            
            try {
              const response = await axios.post('/api/auth/student/signup', {
                name,
                email,
                password,
                grade_level
              });
              
              if (response.data.success) {
                alert('회원가입이 완료되었습니다! 로그인해 주세요.');
                window.location.href = '/student/login';
              }
            } catch (error) {
              alert('회원가입 실패: ' + (error.response?.data?.error || error.message));
            }
          }
          
          // Attach event listener after DOM is ready
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
              document.getElementById('studentSignupForm').addEventListener('submit', handleSignup);
            });
          } else {
            document.getElementById('studentSignupForm').addEventListener('submit', handleSignup);
          }
        </script>
    </body>
    </html>
  `)
})

// Teacher Login Page
app.get('/login', (c) => {
  const type = c.req.query('type') || 'teacher';
  const isTeacher = type === 'teacher';
  const pageTitle = isTeacher ? '교사 로그인' : '학생 로그인';
  const icon = isTeacher ? 'fa-chalkboard-teacher' : 'fa-user-graduate';
  const alternateType = isTeacher ? 'student' : 'teacher';
  const alternateText = isTeacher ? '학생이신가요?' : '교사이신가요?';
  const alternateLink = isTeacher ? '학생 로그인' : '교사 로그인';
  const signupLink = isTeacher ? '/signup' : '/student/signup'; // NEW: Different signup link for student
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${pageTitle} | AI 논술 평가</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js"></script>
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
                    <div class="flex justify-center mb-4">
                        <div class="w-16 h-16 bg-navy-100 rounded-full flex items-center justify-center">
                            <i class="fas ${icon} text-3xl text-navy-900"></i>
                        </div>
                    </div>
                    <h2 class="mt-6 text-center text-3xl font-bold text-gray-900">
                        ${pageTitle}
                    </h2>
                    <p class="mt-2 text-center text-sm text-gray-600">
                        또는
                        <a href="${signupLink}" class="font-medium text-navy-700 hover:text-navy-800">
                            새 계정 만들기
                        </a>
                    </p>
                    <p class="mt-1 text-center text-sm text-gray-600">
                        ${alternateText}
                        <a href="/login?type=${alternateType}" class="font-medium text-blue-600 hover:text-blue-700">
                            ${alternateLink}
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
                            <button type="button" onclick="showForgotPasswordModal()" class="font-medium text-navy-700 hover:text-navy-800">
                                비밀번호 찾기
                            </button>
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
                        <button onclick="loginWithGoogle()" type="button" class="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                            <i class="fab fa-google text-red-500 mr-2"></i>
                            Google
                        </button>
                        <button type="button" class="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 opacity-50 cursor-not-allowed">
                            <i class="fas fa-comment text-yellow-400 mr-2"></i>
                            Kakao
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Forgot Password Modal -->
        <div id="forgotPasswordModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
                <div class="text-center">
                    <h3 class="text-2xl font-bold text-gray-900 mb-2">Ai-Nonsool</h3>
                    <p class="text-gray-600 mb-6">이메일을 입력하고 버튼을 누르면,<br>비밀번호 재설정 링크가 발송됩니다.</p>
                    
                    <input type="email" id="resetEmail" placeholder="이메일을 입력해주세요" 
                           class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4">
                    
                    <button onclick="sendResetLink()" 
                            class="w-full bg-navy-900 text-white py-3 rounded-lg font-semibold hover:bg-navy-800 transition mb-3">
                        비밀번호 재설정 링크 보내기
                    </button>
                    
                    <button onclick="closeForgotPasswordModal()" 
                            class="w-full text-gray-600 py-2 hover:text-gray-800">
                        취소
                    </button>
                </div>
            </div>
        </div>

        <!-- Reset Link Sent Modal -->
        <div id="resetLinkSentModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
                <div class="text-center">
                    <h3 class="text-2xl font-bold text-gray-900 mb-2">Ai-Nonsool</h3>
                    <p class="text-gray-600 mb-6">비밀번호 재설정 링크가<br>이메일로 발송되었습니다.</p>
                    
                    <button onclick="closeResetLinkSentModal()" 
                            class="w-full bg-navy-900 text-white py-3 rounded-lg font-semibold hover:bg-navy-800 transition">
                        확인
                    </button>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
          // Storage fallback for Safari's tracking prevention
          function getStorageItem(key) {
            try {
              return localStorage.getItem(key) || sessionStorage.getItem(key);
            } catch (e) {
              console.warn('localStorage blocked, using sessionStorage:', e);
              return sessionStorage.getItem(key);
            }
          }
          
          function setStorageItem(key, value) {
            try {
              localStorage.setItem(key, value);
            } catch (e) {
              console.warn('localStorage blocked, using sessionStorage:', e);
              sessionStorage.setItem(key, value);
            }
          }
          
          function removeStorageItem(key) {
            try {
              localStorage.removeItem(key);
            } catch (e) {
              console.warn('localStorage blocked, using sessionStorage:', e);
            }
            sessionStorage.removeItem(key);
          }
          
          const urlParams = new URLSearchParams(window.location.search);
          const loginType = urlParams.get('type') || 'teacher';
          const isStudentLogin = loginType === 'student';
          
          function loginWithGoogle() {
            // Google OAuth 2.0 인증 URL (교사 로그인용)
            const clientId = '424693149052-utmma72l4l2a8crnib06pmcpcs1k2178.apps.googleusercontent.com';
            const redirectUri = window.location.origin + '/api/auth/google/callback';
            const scope = 'profile email';
            const state = Math.random().toString(36).substring(7);
            
            sessionStorage.setItem('google_oauth_state', state);
            
            const googleAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
              'client_id=' + encodeURIComponent(clientId) +
              '&redirect_uri=' + encodeURIComponent(redirectUri) +
              '&response_type=code' +
              '&scope=' + encodeURIComponent(scope) +
              '&state=' + encodeURIComponent(state) +
              '&access_type=offline' +
              '&prompt=select_account';
            
            window.location.href = googleAuthUrl;
          }
          
          async function handleLogin(event) {
            event.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            try {
              // Use different API endpoint based on login type
              const apiEndpoint = isStudentLogin ? '/api/auth/student/login' : '/api/auth/login';
              const response = await axios.post(apiEndpoint, {
                email,
                password
              });
              
              if (response.data.success) {
                if (isStudentLogin) {
                  // Student login - store student session
                  setStorageItem('student_session_id', response.data.session_id);
                  setStorageItem('student_name', response.data.student.name);
                  setStorageItem('student_email', response.data.student.email);
                  setStorageItem('student_grade_level', response.data.student.grade_level);
                  setStorageItem('isStudentLoggedIn', 'true');
                  
                  alert(\`환영합니다, \${response.data.student.name}님!\`);
                  window.location.href = '/student/dashboard';
                } else {
                  // Teacher login - store teacher session
                  setStorageItem('session_id', response.data.session_id);
                  setStorageItem('user_name', response.data.user.name);
                  setStorageItem('user_email', response.data.user.email);
                  setStorageItem('isLoggedIn', 'true');
                  
                  alert(\`환영합니다, \${response.data.user.name}님!\`);
                  window.location.href = '/my-page';
                }
              }
            } catch (error) {
              alert('로그인 실패: ' + (error.response?.data?.error || error.message));
            }
          }
          
          function showForgotPasswordModal() {
            document.getElementById('forgotPasswordModal').classList.remove('hidden');
          }
          
          function closeForgotPasswordModal() {
            document.getElementById('forgotPasswordModal').classList.add('hidden');
            document.getElementById('resetEmail').value = '';
          }
          
          function closeResetLinkSentModal() {
            document.getElementById('resetLinkSentModal').classList.add('hidden');
          }
          
          async function sendResetLink() {
            const email = document.getElementById('resetEmail').value;
            
            if (!email || !email.includes('@')) {
              alert('올바른 이메일 주소를 입력해주세요.');
              return;
            }
            
            try {
              const response = await axios.post('/api/auth/forgot-password', { email });
              
              if (response.data.success) {
                closeForgotPasswordModal();
                document.getElementById('resetLinkSentModal').classList.remove('hidden');
              }
            } catch (error) {
              alert('비밀번호 재설정 링크 전송 실패: ' + (error.response?.data?.error || error.message));
            }
          }
        </script>
    </body>
    </html>
  `)
})

// Reset Password Page
app.get('/reset-password', (c) => {
  // Add cache busting with timestamp
  const timestamp = Date.now();
  
  // Set no-cache headers
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  c.header('Pragma', 'no-cache');
  c.header('Expires', '0');
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>비밀번호 재설정 | AI 논술 평가 - v${timestamp}</title>
        <script src="https://cdn.tailwindcss.com?v=${timestamp}"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css?v=${timestamp}" rel="stylesheet">
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
    <body class="bg-gray-50 min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div class="max-w-md w-full space-y-8">
            <div class="text-center">
                <h2 class="mt-6 text-3xl font-extrabold text-gray-900">
                    비밀번호 재설정
                </h2>
                <p class="mt-2 text-sm text-gray-600">
                    새로운 비밀번호를 입력해주세요
                </p>
            </div>

            <div id="contentArea" class="bg-white rounded-xl shadow-lg p-8">
                <!-- Token validation loading -->
                <div id="loadingState" class="text-center py-8">
                    <i class="fas fa-spinner fa-spin text-4xl text-navy-900 mb-4"></i>
                    <p class="text-gray-600">토큰을 확인하는 중...</p>
                </div>

                <!-- Token expired/invalid -->
                <div id="expiredState" class="hidden text-center py-8">
                    <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                    <h3 class="text-xl font-bold text-gray-900 mb-2">링크가 만료되었습니다</h3>
                    <p class="text-gray-600 mb-6">
                        비밀번호 재설정 링크가 만료되었거나 유효하지 않습니다.<br>
                        다시 요청해주세요.
                    </p>
                    <a href="/login" class="inline-block bg-navy-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-navy-800 transition">
                        로그인 페이지로 이동
                    </a>
                </div>

                <!-- Reset password form -->
                <form id="resetForm" class="hidden space-y-6" onsubmit="handleResetPassword(event)">
                    <div>
                        <label for="newPassword" class="block text-sm font-medium text-gray-700 mb-1">
                            새 비밀번호
                        </label>
                        <input 
                            id="newPassword" 
                            name="newPassword" 
                            type="password" 
                            required 
                            class="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
                            placeholder="비밀번호 (대문자, 소문자, 숫자, 특수문자 포함 10자 이상)">
                        <p class="mt-1 text-xs text-gray-500">예: MyPass123!</p>
                    </div>

                    <div>
                        <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-1">
                            비밀번호 확인
                        </label>
                        <input 
                            id="confirmPassword" 
                            name="confirmPassword" 
                            type="password" 
                            required 
                            class="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
                            placeholder="비밀번호 확인">
                    </div>

                    <div>
                        <button 
                            type="submit" 
                            class="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-navy-900 hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-navy-700">
                            비밀번호 재설정
                        </button>
                    </div>
                </form>

                <!-- Success state -->
                <div id="successState" class="hidden text-center py-8">
                    <i class="fas fa-check-circle text-4xl text-green-500 mb-4"></i>
                    <h3 class="text-xl font-bold text-gray-900 mb-2">재설정 완료!</h3>
                    <p class="text-gray-600 mb-6">
                        비밀번호가 성공적으로 변경되었습니다.<br>
                        새 비밀번호로 로그인해주세요.
                    </p>
                    <a href="/login" class="inline-block bg-navy-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-navy-800 transition">
                        로그인하기
                    </a>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/reset-password.js?v=${timestamp}"></script>
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
        <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js"></script>
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
                    <p class="mt-1 text-center text-sm text-gray-600">
                        학생이신가요?
                        <a href="/student/signup" class="font-medium text-blue-600 hover:text-blue-700">
                            학생 회원가입
                        </a>
                    </p>
                </div>
                
                <!-- Google Sign Up Button -->
                <div class="mt-8">
                    <button type="button" onclick="signUpWithGoogle()" 
                            class="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-navy-700 transition">
                        <svg class="w-6 h-6" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        <span class="text-base font-medium text-gray-700">Google로 가입하기</span>
                    </button>
                </div>
                
                <!-- Divider -->
                <div class="mt-6">
                    <div class="relative">
                        <div class="absolute inset-0 flex items-center">
                            <div class="w-full border-t border-gray-300"></div>
                        </div>
                        <div class="relative flex justify-center text-sm">
                            <span class="px-2 bg-white text-gray-500">또는 이메일로 가입</span>
                        </div>
                    </div>
                </div>
                
                <form id="signupForm" class="mt-6 space-y-6">
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
                                   placeholder="비밀번호 (대문자, 소문자, 숫자, 특수문자 포함 10자 이상)">
                            <p class="mt-1 text-xs text-gray-500">예: MyPass123!</p>
                        </div>
                        <div>
                            <label for="password-confirm" class="sr-only">비밀번호 확인</label>
                            <input id="password-confirm" name="password-confirm" type="password" required 
                                   class="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-navy-700 focus:border-navy-700 sm:text-sm" 
                                   placeholder="비밀번호 확인">
                        </div>
                    </div>

                    <div class="flex items-center">
                        <input id="terms" name="terms" type="checkbox"
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
          // Google Sign Up
          function signUpWithGoogle() {
            // Google OAuth 2.0 인증 URL
            const clientId = '424693149052-utmma72l4l2a8crnib06pmcpcs1k2178.apps.googleusercontent.com';
            const redirectUri = window.location.origin + '/api/auth/google/callback';
            const scope = 'profile email';
            const state = Math.random().toString(36).substring(7); // CSRF protection
            
            // Store state for verification
            sessionStorage.setItem('google_oauth_state', state);
            
            const googleAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
              'client_id=' + encodeURIComponent(clientId) +
              '&redirect_uri=' + encodeURIComponent(redirectUri) +
              '&response_type=code' +
              '&scope=' + encodeURIComponent(scope) +
              '&state=' + encodeURIComponent(state) +
              '&access_type=offline' +
              '&prompt=select_account';
            
            window.location.href = googleAuthUrl;
          }
          
          async function handleSignup(event) {
            console.log('handleSignup called');
            event.preventDefault();
            event.stopPropagation();
            
            console.log('Form submission prevented');
            
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const passwordConfirm = document.getElementById('password-confirm').value;
            const termsCheckbox = document.getElementById('terms');
            
            console.log('Form data:', { name, email, passwordLength: password.length, termsChecked: termsCheckbox.checked });
            
            // 약관 동의 확인
            if (!termsCheckbox.checked) {
              alert('이용약관과 개인정보처리방침에 동의해야 합니다.');
              return;
            }
            
            if (password !== passwordConfirm) {
              alert('비밀번호가 일치하지 않습니다.');
              return;
            }
            
            // 비밀번호 검증
            if (password.length < 10) {
              alert('회원가입 실패: 비밀번호는 최소 10자 이상이어야 합니다.');
              return;
            }
            if (!/[a-z]/.test(password)) {
              alert('회원가입 실패: 비밀번호에는 소문자가 포함되어야 합니다.');
              return;
            }
            if (!/[A-Z]/.test(password)) {
              alert('회원가입 실패: 비밀번호에는 대문자가 포함되어야 합니다.');
              return;
            }
            if (!/[0-9]/.test(password)) {
              alert('회원가입 실패: 비밀번호에는 숫자가 포함되어야 합니다.');
              return;
            }
            // 특수문자 검증 (정규식 사용)
            const specialCharsRegex = /[@$!%*?&#^()_+\\-=\\[\\]{}|\\\\:;"'<>,./~]/;
            if (!specialCharsRegex.test(password)) {
              alert('회원가입 실패: 비밀번호에는 특수문자가 포함되어야 합니다.');
              return;
            }
            
            try {
              const response = await axios.post('/api/auth/signup', {
                name,
                email,
                password
              });
              
              if (response.data.success) {
                // Redirect to email verification confirmation page
                window.location.href = '/email-verification-sent?email=' + encodeURIComponent(email);
              }
            } catch (error) {
              alert('회원가입 실패: ' + (error.response?.data?.error || error.message));
            }
          }
          
          // Attach event listener after DOM is ready
          if (document.readyState === 'loading') {
            console.log('Waiting for DOMContentLoaded');
            document.addEventListener('DOMContentLoaded', function() {
              console.log('DOMContentLoaded fired');
              const form = document.getElementById('signupForm');
              console.log('Form element:', form);
              if (form) {
                form.addEventListener('submit', handleSignup);
                console.log('Event listener attached to form');
              } else {
                console.error('Form element not found!');
              }
            });
          } else {
            console.log('DOM already loaded');
            const form = document.getElementById('signupForm');
            console.log('Form element:', form);
            if (form) {
              form.addEventListener('submit', handleSignup);
              console.log('Event listener attached to form');
            } else {
              console.error('Form element not found!');
            }
          }
        </script>
    </body>
    </html>
  `)
})

// Email Verification Sent Page
app.get('/email-verification-sent', (c) => {
  const email = c.req.query('email') || ''
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>인증 메일 전송 | AI 논술 평가</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
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

        <!-- Email Verification Sent Content -->
        <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div class="max-w-md w-full">
                <div class="bg-white rounded-lg shadow-lg p-8 text-center">
                    <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
                        <i class="fas fa-envelope-open-text text-3xl text-green-600"></i>
                    </div>
                    
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">
                        인증 메일 전송
                    </h2>
                    
                    <p class="text-gray-700 mb-6">
                        인증 메일이 <strong class="text-navy-700">${email}</strong>로 전송되었습니다.
                    </p>
                    
                    <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 text-left">
                        <p class="text-sm text-gray-700 mb-2">
                            받으신 이메일을 열어 링크를 클릭하면 가입이 완료됩니다.
                        </p>
                    </div>
                    
                    <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6 text-left">
                        <p class="text-sm text-gray-700 font-semibold mb-2">
                            인증 메일이 도착하지 않았나요?
                        </p>
                        <p class="text-sm text-gray-600 mb-2">
                            • 스팸 메일함을 확인하거나,<br>
                            • 잠시 후 다시 시도해 주시기 바랍니다.
                        </p>
                    </div>
                    
                    <button onclick="resendVerification()" 
                            id="resendBtn"
                            class="w-full bg-navy-700 text-white py-3 px-4 rounded-lg hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-navy-700 transition mb-4">
                        <i class="fas fa-redo mr-2"></i>인증 메일 다시 보내기
                    </button>
                    
                    <a href="/login" 
                       class="block w-full text-center bg-gray-200 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition">
                        <i class="fas fa-sign-in-alt mr-2"></i>로그인 페이지로 이동
                    </a>
                </div>
            </div>
        </div>

        <script>
          async function resendVerification() {
            const email = '${email}';
            const btn = document.getElementById('resendBtn');
            
            if (!email) {
              alert('이메일 주소가 없습니다.');
              return;
            }
            
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>전송 중...';
            
            try {
              const response = await axios.post('/api/auth/resend-verification', { email });
              
              if (response.data.success) {
                alert('인증 메일이 재전송되었습니다. 이메일을 확인해주세요.');
                btn.innerHTML = '<i class="fas fa-check mr-2"></i>전송 완료!';
                setTimeout(() => {
                  btn.disabled = false;
                  btn.innerHTML = '<i class="fas fa-redo mr-2"></i>인증 메일 다시 보내기';
                }, 3000);
              }
            } catch (error) {
              alert('메일 재전송 실패: ' + (error.response?.data?.error || error.message));
              btn.disabled = false;
              btn.innerHTML = '<i class="fas fa-redo mr-2"></i>인증 메일 다시 보내기';
            }
          }
        </script>
    </body>
    </html>
  `)
})

// Email Verification Handler Page
app.get('/verify-email', (c) => {
  const token = c.req.query('token')
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>이메일 인증 중... | AI 논술 평가</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
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

        <!-- Email Verification Processing Content -->
        <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div class="max-w-md w-full">
                <div class="bg-white rounded-lg shadow-lg p-8 text-center">
                    <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-6">
                        <i class="fas fa-spinner fa-spin text-3xl text-blue-600"></i>
                    </div>
                    
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">
                        이메일 인증 중...
                    </h2>
                    
                    <p class="text-gray-700 mb-6">
                        잠시만 기다려주세요.
                    </p>
                </div>
            </div>
        </div>

        <script>
          // Wait for axios to load
          function waitForAxios() {
            return new Promise((resolve) => {
              if (typeof axios !== 'undefined') {
                resolve();
              } else {
                const interval = setInterval(() => {
                  if (typeof axios !== 'undefined') {
                    clearInterval(interval);
                    resolve();
                  }
                }, 100);
              }
            });
          }

          async function verifyEmail() {
            const token = '${token}';
            
            if (!token) {
              alert('인증 토큰이 없습니다.');
              window.location.href = '/signup';
              return;
            }

            try {
              await waitForAxios();
              
              console.log('Verifying email with token:', token);
              
              const response = await axios.get('/api/auth/verify-email?token=' + token);
              
              console.log('Verification response:', response.data);
              
              if (response.data.success) {
                // Success - redirect to success page
                window.location.href = '/email-verified';
              } else {
                // Unexpected case
                alert(response.data.error || '인증 처리 중 오류가 발생했습니다.');
                window.location.href = '/signup';
              }
            } catch (error) {
              console.error('Verification error:', error);
              
              if (error.response) {
                // API returned an error
                const errorMessage = error.response.data.error || '인증에 실패했습니다.';
                alert(errorMessage);
                
                // Redirect based on error
                if (errorMessage.includes('이미 인증')) {
                  window.location.href = '/login';
                } else {
                  window.location.href = '/signup';
                }
              } else {
                // Network or other error
                alert('인증 처리 중 오류가 발생했습니다: ' + error.message);
                window.location.href = '/signup';
              }
            }
          }

          // Start verification when page loads
          verifyEmail();
        </script>
    </body>
    </html>
  `)
})

// Email Verification Success Page
app.get('/email-verified', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>이메일 인증 완료 | AI 논술 평가</title>
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

        <!-- Email Verification Success Content -->
        <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div class="max-w-md w-full">
                <div class="bg-white rounded-lg shadow-lg p-8 text-center">
                    <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
                        <i class="fas fa-check-circle text-3xl text-green-600"></i>
                    </div>
                    
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">
                        이메일 인증이 완료되었습니다.
                    </h2>
                    
                    <p class="text-gray-700 mb-8">
                        이제 당신의 계정으로 로그인할 수 있습니다.
                    </p>
                    
                    <a href="/login" 
                       class="block w-full bg-navy-700 text-white py-3 px-4 rounded-lg hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-navy-700 transition">
                        <i class="fas fa-sign-in-alt mr-2"></i>로그인 페이지로 가기
                    </a>
                </div>
            </div>
        </div>
    </body>
    </html>
  `)
})

// Terms of Service Page
app.get('/terms', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>이용 약관 | AI 논술 평가</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js"></script>
    </head>
    <body class="bg-gray-50">
        <nav class="bg-white border-b border-gray-200 sticky top-0 z-10">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16 items-center">
                    <a href="/" class="flex items-center">
                        <span class="text-2xl font-bold text-gray-900">
                            <i class="fas fa-graduation-cap mr-2"></i>AI 논술 평가
                        </span>
                    </a>
                </div>
            </div>
        </nav>

        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h1 class="text-4xl font-bold text-gray-900 mb-2 text-center">AI 논술 평가 서비스</h1>
            <h2 class="text-3xl font-bold text-gray-800 mb-8 text-center">이용약관</h2>
            
            <div class="bg-white rounded-lg shadow-lg p-8">
                <p class="text-gray-700 mb-3 leading-relaxed">AI 논술 평가 서비스 이용약관</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제1조 (목적)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">이 약관은 심마니 스터디(이하 "회사")가 제공하는 인공지능 기반 논술 평가 서비스 "AI 논술 평가"(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제2조 (용어의 정의)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">이 약관에서 사용되는 주요한 용어의 정의는 다음과 같습니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">1. "서비스"란 회사가 제공하는 AI 기반 논술 답안지 평가 및 관련 제반 서비스를 의미합니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">2. "회원"이란 이 약관에 동의하고 회사와 서비스 이용계약을 체결하고, 회사가 제공하는 서비스를 이용하는 자를 말합니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">3. "아이디(ID)"란 회원의 식별과 서비스 이용을 위하여 회원이 설정하고 회사가 승인한 이메일 주소를 말합니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">4. "비밀번호"란 회원의 정보 보호를 위해 회원 자신이 설정한 문자와 숫자의 조합을 말합니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">5. "구독"이란 일정 기간 동안 서비스를 이용할 수 있는 권리를 의미합니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">6. "정기결제"란 회원이 선택한 구독 플랜에 따라 자동으로 결제가 이루어지는 것을 말합니다.</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제3조 (약관의 효력 및 변경)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">1. 이 약관은 서비스를 이용하고자 하는 모든 회원에게 그 효력이 발생합니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">2. 회사는 필요한 경우 관련 법령을 위배하지 않는 범위 내에서 이 약관을 변경할 수 있으며, 약관이 변경되는 경우 변경사항을 시행일자 7일 전부터 공지합니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">3. 회원이 변경된 약관에 동의하지 않는 경우, 서비스 이용을 중단하고 탈퇴할 수 있습니다. 변경된 약관의 효력 발생일 이후에도 서비스를 계속 이용하는 경우에는 약관 변경에 동의한 것으로 간주합니다.</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제4조 (회원가입)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">1. 회원가입은 이용신청자가 약관의 내용에 대하여 동의하고 회원가입 신청을 한 후 회사가 이러한 신청에 대하여 승인함으로써 체결됩니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">2. 회사는 다음 각 호에 해당하는 신청에 대하여는 승인을 하지 않거나 사후에 이용계약을 해지할 수 있습니다.</p>
<p class="text-gray-600 ml-6 mb-2">• 실명이 아니거나 타인의 명의를 이용한 경우</p>
<p class="text-gray-600 ml-6 mb-2">• 허위의 정보를 기재하거나, 회사가 제시하는 내용을 기재하지 않은 경우</p>
<p class="text-gray-600 ml-6 mb-2">• 14세 미만 아동이 법정 대리인의 동의를 얻지 아니한 경우</p>
<p class="text-gray-600 ml-6 mb-2">• 이용자의 귀책사유로 인하여 승인이 불가능하거나 기타 규정한 제반 사항을 위반하며 신청하는 경우</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제5조 (회원탈퇴 및 자격 상실)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">1. 회원은 언제든지 탈퇴를 요청할 수 있으며, 회사는 즉시 회원탈퇴를 처리합니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">2. 회원이 다음 각 호의 사유에 해당하는 경우, 회사는 회원자격을 제한 및 정지시킬 수 있습니다.</p>
<p class="text-gray-600 ml-6 mb-2">• 가입 신청 시에 허위 내용을 등록한 경우</p>
<p class="text-gray-600 ml-6 mb-2">• 다른 사람의 서비스 이용을 방해하거나 그 정보를 도용하는 등 전자상거래 질서를 위협하는 경우</p>
<p class="text-gray-600 ml-6 mb-2">• 서비스를 이용하여 법령 또는 본 약관이 금지하거나 공서양속에 반하는 행위를 하는 경우</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제6조 (서비스의 제공 및 변경)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">1. 회사는 다음과 같은 서비스를 제공합니다.</p>
<p class="text-gray-600 ml-6 mb-2">• 인공지능 기반 논술 답안지 자동 채점 및 피드백 서비스</p>
<p class="text-gray-600 ml-6 mb-2">• 논리 구조, 근거 타당성, 언어표현력 분석</p>
<p class="text-gray-600 ml-6 mb-2">• 상세한 피드백 및 개선 제안</p>
<p class="text-gray-600 ml-6 mb-2">• 기타 회사가 정하는 서비스</p>
<p class="text-gray-700 mb-3 leading-relaxed">2. 회사는 필요한 경우 서비스의 내용을 변경할 수 있으며, 변경 시 사전에 공지합니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">3. 회사는 서비스의 품질 향상을 위해 지속적으로 노력합니다.</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제7조 (서비스의 중단)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">1. 회사는 컴퓨터 등 정보통신 설비의 보수 점검, 교체 및 고장, 통신의 두절 등의 사유가 발생한 경우에는 서비스의 제공을 일시적으로 중단할 수 있습니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">2. 회사는 천재지변, 국가비상사태 등 불가항력적 사유로 서비스를 제공할 수 없는 경우에는 서비스의 제공을 제한하거나 중단할 수 있습니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">3. 제1항 및 제2항에 의한 서비스 중단의 경우에는 회사는 제10조에 정한 방법으로 회원에게 통지합니다.</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제8조 (구독 서비스 및 이용요금)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">1. 서비스는 기본적으로 무료 체험 또는 유료 구독 형태로 제공됩니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">2. 유료 구독 서비스의 이용 요금은 회사가 정한 바에 따르며, 서비스 화면에 명시됩니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">3. 회원은 회사가 제공하는 결제 수단(토스페이먼츠 등)을 통해 이용요금을 결제할 수 있습니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">3. 구독 플랜별 제공 혜택은 다음과 같습니다.</p>
<p class="text-gray-600 ml-6 mb-2">• 무료 체험: 제한된 횟수의 논술 답안 평가</p>
<p class="text-gray-600 ml-6 mb-2">• 유료 구독: 플랜별 월 이용 가능 횟수 제공</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제9조 (정기결제 및 환불 규정)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">1. 정기 결제</p>
<p class="text-gray-700 mb-3 leading-relaxed">① 회원이 정기결제를 신청한 경우, 최초 결제일을 기준으로 매월 자동으로 결제가 진행됩니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">정기결제는 회원이 해지하기 전까지 자동으로 갱신됩니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">② 회원은 언제든지 정기결제를 해지할 수 있으며, 해지 시 다음 결제일부터 청구가 중단됩니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">정기결제 수단(카드 등)의 변경이 필요한 경우, 고객센터를 통해 변경 요청할 수 있습니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">2. 환불 규정</p>
<p class="text-gray-700 mb-3 leading-relaxed">가. 일반 환불 원칙</p>
<p class="text-gray-700 mb-3 leading-relaxed">① 서비스 이용 전(결제 후 서비스 미사용): 전액 환불</p>
<p class="text-gray-700 mb-3 leading-relaxed">② 서비스 일부 이용 후: 사용하지 않은 기간에 대해 일할 계산하여 환불</p>
<p class="text-gray-600 ml-6 mb-2">• 환불 금액 = (구독 금액 / 30일) × 남은 일수</p>
<p class="text-gray-600 ml-6 mb-2">• 단, 이미 사용한 답안지 채점 횟수가 있는 경우, 사용 횟수에 따른 금액을 차감</p>
<p class="text-gray-700 mb-3 leading-relaxed">③ 결제 수단의 환불 수수료가 발생하는 경우, 해당 수수료는 회원이 부담합니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">나. 정기결제 중도 해지 시 환불</p>
<p class="text-gray-700 mb-3 leading-relaxed">① 정기결제를 중도 해지하는 경우, 이미 결제된 당월 이용료는 환불되지 않으며, 당월 말일까지 서비스를 이용할 수 있습니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">② 단, 결제 후 7일 이내이고 서비스를 전혀 이용하지 않은 경우에는 전액 환불이 가능합니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">③ 다음 달부터는 결제가 자동으로 중단됩니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">다. 환불 제한 사항</p>
<p class="text-gray-700 mb-3 leading-relaxed">① 회원의 귀책사유로 서비스 이용이 제한된 경우에는 환불이 제한될 수 있습니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">② 할인 혜택을 받은 경우, 환불 시 정상가 기준으로 사용 금액을 차감합니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">③ 무료 체험 기간은 환불 대상이 아닙니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">라. 환불 신청 방법</p>
<p class="text-gray-700 mb-3 leading-relaxed">① 환불을 원하시는 경우, 고객센터(02-6339-6059)로 연락 주시기 바랍니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">② 환불 신청 후 영업일 기준 3~5일 이내에 처리됩니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">③ 환불은 원결제 수단으로 처리되며, 카드 취소의 경우 카드사 정책에 따라 영업일 기준 3~7일 소요될 수 있습니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">3. 결제 오류 및 과오납</p>
<p class="text-gray-700 mb-3 leading-relaxed">① 시스템 오류 등으로 인한 과오납의 경우, 즉시 전액 환불 처리됩니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">② 회원의 실수로 인한 중복 결제의 경우, 고객센터를 통해 환불 신청하시면 확인 후 처리됩니다.</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제10조 (회원에 대한 통지)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">1. 회사가 회원에 대한 통지를 하는 경우, 회원이 등록한 이메일 주소로 할 수 있습니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">2. 회사는 불특정다수 회원에 대한 통지의 경우 웹사이트 공지사항에 게시함으로써 개별 통지에 갈음할 수 있습니다.</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제11조 (회원의 의무)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">회원은 다음 행위를 하여서는 안 됩니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">▶ 신청 또는 변경 시 허위 내용의 등록</p>
<p class="text-gray-700 mb-3 leading-relaxed">▶ 타인의 정보 도용</p>
<p class="text-gray-700 mb-3 leading-relaxed">▶ 회사가 게시한 정보의 변경</p>
<p class="text-gray-700 mb-3 leading-relaxed">▶ 회사가 정한 정보 이외의 정보(컴퓨터 프로그램 등) 등의 송신 또는 게시</p>
<p class="text-gray-700 mb-3 leading-relaxed">▶ 회사 기타 제3자의 저작권 등 지적재산권에 대한 침해</p>
<p class="text-gray-700 mb-3 leading-relaxed">▶ 회사 기타 제3자의 명예를 손상시키거나 업무를 방해하는 행위</p>
<p class="text-gray-700 mb-3 leading-relaxed">▶ 외설 또는 폭력적인 메시지, 화상, 음성, 기타 공서양속에 반하는 정보를 서비스에 공개 또는 게시하는 행위</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제12조 (저작권의 귀속 및 이용제한)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">1. 회사가 작성한 저작물에 대한 저작권 기타 지적재산권은 회사에 귀속합니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">2. 회원이 서비스 내에 게시한 게시물의 저작권은 해당 게시물의 저작자에게 귀속됩니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">3. 회원은 서비스를 이용함으로써 얻은 정보 중 회사에게 지적재산권이 귀속된 정보를 회사의 사전 승낙 없이 복제, 송신, 출판, 배포, 방송 기타 방법에 의하여 영리목적으로 이용하거나 제3자에게 이용하게 하여서는 안됩니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">4. 회원이 업로드한 논술 답안 및 관련 파일에 대한 저작권은 회원에게 있으며, 회사는 서비스 제공 목적으로만 이용합니다.</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제13조 (개인정보보호)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">1. 회사는 회원의 개인정보 수집 시 서비스 제공을 위하여 필요한 범위에서 최소한의 개인정보를 수집합니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">2. 회사는 회원의 개인정보를 보호하기 위하여 관련 법령이 정하는 바를 준수하며, 개인정보의 보호 및 사용에 대해서는 관련 법령 및 회사의 개인정보처리방침이 적용됩니다.</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제14조 (회사의 의무)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">1. 회사는 법령과 본 약관이 금지하거나 공서양속에 반하는 행위를 하지 않으며 본 약관이 정하는 바에 따라 지속적이고, 안정적으로 서비스를 제공하는데 최선을 다하여야 합니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">2. 회사는 회원이 안전하게 서비스를 이용할 수 있도록 회원의 개인정보 보호를 위한 보안 시스템을 구축합니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">3. 회사는 서비스 이용과 관련하여 발생하는 회원의 불만 또는 피해구제 요청을 적절하게 처리할 수 있도록 필요한 인력 및 시스템을 구비합니다.</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제15조 (손해 배상)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">1. 회사는 서비스의 이용과 관련하여 회원에게 발생한 손해에 대하여 회사의 고의 또는 중과실이 없는 한 책임을 지지 않습니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">2. 회원이 본 약관을 위반하여 회사에 손해가 발생한 경우, 회원은 회사에 발생한 모든 손해를 배상하여야 합니다.</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제16조 (면책 조항)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">1. 회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">2. 회사는 회원의 귀책사유로 인한 서비스 이용의 장애에 대하여 책임을 지지 않습니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">3. 회사는 회원이 서비스를 이용하여 기대하는 수익을 상실한 것에 대하여 책임을 지지 않으며, 그 밖에 서비스를 통하여 얻은 자료로 인한 손해 등에 대하여도 책임을 지지 않습니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">4. 회사는 AI 분석 결과의 정확성을 보장하지 않으며, 해당 결과는 참고용으로만 활용되어야 합니다.</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제17조 (분쟁 해결)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">1. 회사는 회원이 제기하는 정당한 의견이나 불만을 반영하고 그 피해를 보상처리하기 위하여 피해보상처리기구를 설치·운영합니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">2. 회사는 회원으로부터 제출되는 불만사항 및 의견을 우선적으로 처리합니다. 다만, 신속한 처리가 곤란한 경우에는 회원에게 그 사유와 처리일정을 즉시 통보합니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">3. 회사와 회원 간에 발생한 분쟁은 전자거래기본법 제28조 및 동 시행령 제15조에 의하여 설치된 전자거래분쟁조정위원회의 조정에 따를 수 있습니다.</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제18조 (재판권 및 준거법)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">1. 회사와 회원 간에 발생한 전자거래 분쟁에 관한 소송은 제소 당시의 회원의 주소에 의하고, 주소가 없는 경우에는 거주지를 관할하는 지방법원의 전속관할로 합니다. 다만, 제소 당시 회원의 주소 또는 거주지가 분명하지 않거나 외국 거주자의 경우에는 민사소송법상의 관할법원에 제기합니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">2. 회사와 회원 간에 제기된 전자거래 소송에는 대한민국 법률을 적용합니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">부칙</p>
<p class="text-gray-700 mb-3 leading-relaxed">이 약관은 2026년 1월 3일부터 시행됩니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">이 이용약관에 대한 문의사항이 있으시면 고객센터(02-6339-6059)로 연락주시기 바랍니다.</p>
            </div>
            
            <div class="mt-8 text-center">
                <a href="/" class="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium">
                    <i class="fas fa-arrow-left mr-2"></i>홈으로 돌아가기
                </a>
            </div>
        </div>
    </body>
    </html>
  `)
})

// Privacy Policy Page
app.get('/privacy', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>개인정보 처리방침 | AI 논술 평가</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js"></script>
    </head>
    <body class="bg-gray-50">
        <nav class="bg-white border-b border-gray-200 sticky top-0 z-10">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16 items-center">
                    <a href="/" class="flex items-center">
                        <span class="text-2xl font-bold text-gray-900">
                            <i class="fas fa-graduation-cap mr-2"></i>AI 논술 평가
                        </span>
                    </a>
                </div>
            </div>
        </nav>

        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h1 class="text-4xl font-bold text-gray-900 mb-8 text-center">개인정보 처리방침</h1>
            
            <div class="bg-white rounded-lg shadow-lg p-8">
                <p class="text-gray-700 mb-3 leading-relaxed">개인정보 처리방침</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제1조 (개인정보의 처리 목적)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">심마니 스터디(이하 "회사")는 이용자의 개인정보를 중요시하며, 「개인정보 보호법」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 등 관련 법령을 준수하고 있습니다. 회사는 개인정보 처리방침을 통하여 이용자가 제공하는 개인정보가 어떠한 용도와 방식으로 이용되고 있으며, 개인정보 보호를 위해 어떠한 조치가 취해지고 있는지 알려드립니다.</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제2조 (수집하는 개인정보의 항목 및 수집 방법)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">1. 수집하는 개인정보의 항목</p>
<p class="text-gray-700 mb-3 leading-relaxed">가. 회원가입 시</p>
<p class="text-gray-600 ml-6 mb-2">• 필수항목: 이메일 주소, 비밀번호, 사용자명</p>
<p class="text-gray-600 ml-6 mb-2">• 소셜(SNS)을 통하여 회원가입하는 경우 : 소셜(SNS)에서 제공하는 사용자의 계정 정보와 친구 관계 정보 등 연동되는 SNS에서 허용하는 모든 정보</p>
<p class="text-gray-700 mb-3 leading-relaxed">나. 서비스 이용 시</p>
<p class="text-gray-600 ml-6 mb-2">• 직접 작성하거나 업로드한 논술 문제 및 평가 기준 파일</p>
<p class="text-gray-600 ml-6 mb-2">• 직접 작성하거나 업로드한 학생 답안 파일</p>
<p class="text-gray-600 ml-6 mb-2">• AI 분석 결과 및 첨삭 데이터</p>
<p class="text-gray-600 ml-6 mb-2">• 서비스 이용 기록, 접속 로그, IP 주소</p>
<p class="text-gray-700 mb-3 leading-relaxed">다. 결제 시</p>
<p class="text-gray-600 ml-6 mb-2">• 결제 정보는 계약된 PG사를 통해 처리되며, 회사는 결제 완료 정보만 수신합니다.</p>
<p class="text-gray-600 ml-6 mb-2">• 카드번호, 유효기간 등 민감한 결제정보는 회사가 직접 보관하지 않습니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">2. 개인정보 수집 방법</p>
<p class="text-gray-600 ml-6 mb-2">• 웹사이트를 통한 회원가입 및 서비스 이용</p>
<p class="text-gray-600 ml-6 mb-2">• 파일 업로드 및 서비스 이용 과정</p>
<p class="text-gray-600 ml-6 mb-2">• 고객센터를 통한 상담 과정</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제3조 (개인정보의 수집 및 이용 목적)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">회사는 수집한 개인정보를 다음의 목적을 위해 활용합니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">1. 서비스 제공</p>
<p class="text-gray-600 ml-6 mb-2">• AI 논술 첨삭 서비스 제공</p>
<p class="text-gray-600 ml-6 mb-2">• 문제 및 기준 업로드, 답안 제출, 분석 결과 제공</p>
<p class="text-gray-600 ml-6 mb-2">• 맞춤형 학습 피드백 제공</p>
<p class="text-gray-700 mb-3 leading-relaxed">2. 회원 관리</p>
<p class="text-gray-600 ml-6 mb-2">• 회원제 서비스 이용에 따른 본인 확인, 개인 식별</p>
<p class="text-gray-600 ml-6 mb-2">• 불법적 이용 방지 및 비인가 사용 방지</p>
<p class="text-gray-600 ml-6 mb-2">• 가입 의사 확인, 연령확인</p>
<p class="text-gray-600 ml-6 mb-2">• 불만처리 등 민원처리, 고지사항 전달</p>
<p class="text-gray-700 mb-3 leading-relaxed">3. 요금 결제 및 정산</p>
<p class="text-gray-600 ml-6 mb-2">• 구독 서비스 이용에 대한 요금 결제</p>
<p class="text-gray-600 ml-6 mb-2">• 정기결제 처리 및 결제 내역 관리</p>
<p class="text-gray-600 ml-6 mb-2">• 환불 처리</p>
<p class="text-gray-700 mb-3 leading-relaxed">4. 서비스 개선</p>
<p class="text-gray-600 ml-6 mb-2">• 신규 서비스 개발 및 기존 서비스 개선</p>
<p class="text-gray-600 ml-6 mb-2">• 통계학적 특성에 따른 서비스 제공 및 광고 게재</p>
<p class="text-gray-600 ml-6 mb-2">• 서비스 이용 통계 분석</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제4조 (개인정보의 보유 및 이용 기간)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">회사는 원칙적으로 개인정보 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체없이 파기합니다. 단, 다음의 정보에 대해서는 아래의 이유로 명시한 기간 동안 보존합니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">1. 회사 내부 방침에 의한 정보보유 사유</p>
<p class="text-gray-600 ml-6 mb-2">• 부정 이용 기록: 1년 (부정 이용 방지)</p>
<p class="text-gray-600 ml-6 mb-2">• 서비스 이용 기록: 회원 탈퇴 시까지</p>
<p class="text-gray-700 mb-3 leading-relaxed">2. 관련 법령에 의한 정보보유 사유</p>
<p class="text-gray-600 ml-6 mb-2">• 계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)</p>
<p class="text-gray-600 ml-6 mb-2">• 대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)</p>
<p class="text-gray-600 ml-6 mb-2">• 소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)</p>
<p class="text-gray-600 ml-6 mb-2">• 웹사이트 방문 기록: 3개월 (통신비밀보호법)</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제5조 (개인정보의 파기 절차 및 방법)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">1. 파기 절차</p>
<p class="text-gray-700 mb-3 leading-relaxed">이용자가 회원가입 등을 위해 입력한 정보는 목적이 달성된 후 별도의 DB로 옮겨져 내부 방침 및 기타 관련 법령에 의한 정보보호 사유에 따라 일정 기간 저장된 후 파기됩니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">2. 파기 방법</p>
<p class="text-gray-600 ml-6 mb-2">• 전자적 파일 형태의 정보: 기록을 재생할 수 없는 기술적 방법을 사용하여 삭제</p>
<p class="text-gray-600 ml-6 mb-2">• 종이에 출력된 개인정보: 분쇄기로 분쇄하거나 소각</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제6조 (개인정보의 제3자 제공)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 아래의 경우에는 예외로 합니다.</p>
<p class="text-gray-600 ml-6 mb-2">• 이용자가 사전에 동의한 경우</p>
<p class="text-gray-600 ml-6 mb-2">• 법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제7조 (개인정보 처리의 위탁)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">회사는 서비스 향상을 위해 아래와 같이 개인정보를 위탁하고 있으며, 관계 법령에 따라 위탁계약 시 개인정보가 안전하게 관리될 수 있도록 필요한 사항을 규정하고 있습니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">수탁업체</p>
<p class="text-gray-700 mb-3 leading-relaxed">위탁업무 내용</p>
<p class="text-gray-700 mb-3 leading-relaxed">토스페이먼츠</p>
<p class="text-gray-700 mb-3 leading-relaxed">결제 처리 및 결제 정보 관리</p>
<p class="text-gray-700 mb-3 leading-relaxed">Google (Gemini API)</p>
<p class="text-gray-700 mb-3 leading-relaxed">AI 논술 분석 서비스 제공</p>
<p class="text-gray-700 mb-3 leading-relaxed">카페24</p>
<p class="text-gray-700 mb-3 leading-relaxed">데이터베이스 호스팅 및 관리</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제8조 (이용자의 권리와 행사 방법)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">이용자는 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.</p>
<p class="text-gray-600 ml-6 mb-2">• 개인정보 열람 요구</p>
<p class="text-gray-600 ml-6 mb-2">• 개인정보에 오류가 있을 경우 정정 요구</p>
<p class="text-gray-600 ml-6 mb-2">• 개인정보 삭제 요구</p>
<p class="text-gray-600 ml-6 mb-2">• 개인정보 처리 정지 요구</p>
<p class="text-gray-700 mb-3 leading-relaxed">위 권리 행사는 고객센터를 통해 하실 수 있으며, 회사는 이에 대해 지체 없이 조치하겠습니다.</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제9조 (개인정보 보호책임자)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 이용자의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
<p class="text-gray-700 mb-3 leading-relaxed">개인정보 보호책임자</p>
<p class="text-gray-700 mb-3 leading-relaxed">성명: 이영세</p>
<p class="text-gray-700 mb-3 leading-relaxed">직책: 대표</p>
<p class="text-gray-700 mb-3 leading-relaxed">연락처: 02-6339-6059 또는 simmanistudy@google.com</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제10조 (개인정보 처리방침의 변경)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">이 개인정보 처리방침은 2026년 1월 3일부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.</p>
<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">제11조 (개인정보의 안전성 확보조치)</h2>
<p class="text-gray-700 mb-3 leading-relaxed">회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.</p>
<p class="text-gray-600 ml-6 mb-2">• 관리적 조치: 내부관리계획 수립·시행, 정기적 직원 교육</p>
<p class="text-gray-600 ml-6 mb-2">• 기술적 조치: 개인정보처리시스템 등의 접근권한 관리, 접근통제시스템 설치, 개인정보의 암호화, 보안프로그램 설치</p>
<p class="text-gray-600 ml-6 mb-2">• 물리적 조치: 전산실, 자료보관실 등의 접근통제</p>
<p class="text-gray-700 mb-3 leading-relaxed">본 개인정보 처리방침에 대한 문의사항이 있는 분은 고객센터(02-6339-6059)로 연락 주시기 바랍니다.</p>
            </div>
            
            <div class="mt-8 text-center">
                <a href="/" class="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium">
                    <i class="fas fa-arrow-left mr-2"></i>홈으로 돌아가기
                </a>
            </div>
        </div>
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
        <title>요금제 | AI 논술 평가</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js"></script>
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
                        <a href="/my-page" id="myPageLink" class="text-gray-700 hover:text-navy-700 font-bold" style="display: none;">나의 페이지</a>
                        <div class="dropdown" id="loginDropdown">
                            <a href="/login" class="text-gray-700 hover:text-navy-700 font-medium">로그인</a>
                        </div>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Pricing Section -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <!-- Header -->
            <div class="text-center mb-12">
                <span class="inline-block bg-navy-100 text-navy-800 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                    요금제
                </span>
                <h1 class="text-4xl font-bold text-gray-900 mb-4">채점해야 할 분량에 따른 다양한 구독 플랜</h1>
                <p class="text-xl text-gray-600 mb-8">
                    자신의 평가 계획에 맞는 최적의 플랜을 선택하여 AI 논술 평가 서비스를 이용해 보세요.
                </p>
                
                <!-- Billing Toggle -->
                <div class="flex items-center justify-center space-x-4 mb-4">
                    <span id="monthlyLabel" class="text-lg font-semibold text-navy-900">월간 결제</span>
                    <label class="billing-toggle">
                        <input type="checkbox" id="billingToggle" onchange="toggleBilling()">
                        <span class="slider"></span>
                    </label>
                    <span id="yearlyLabel" class="text-lg font-semibold text-gray-500">매년</span>
                </div>
                <p class="text-purple-600 font-semibold">
                    <i class="fas fa-tag mr-2"></i>연간 결제시 최대 20% 할인
                </p>
            </div>

            <!-- Pricing Cards -->
            <div class="grid md:grid-cols-4 gap-6">
                <!-- Free Plan -->
                <div class="pricing-card bg-white rounded-xl shadow-lg p-6 border border-gray-200" data-plan="free">
                    <div class="mb-6">
                        <h3 class="text-xl font-bold text-gray-900 mb-2">무료 체험</h3>
                        <p class="text-sm text-gray-600 mb-4">
                            정규 수업에서 처음으로 논술형 평가를 도입해 보려고 하는 교사들을 위하여
                        </p>
                        <div class="text-4xl font-bold text-gray-900 mb-2">무료</div>
                    </div>
                    
                    <ul class="space-y-3 mb-6 text-sm">
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>한달에 20개 논술 답안지 채점</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>논술 1개당 최대 글자 수는 3,000자</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>논술 평가 피드백 및 평가 결과 보고서 제공</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>간편하게 루브릭 작성</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>학생이 손 글씨로 작성한 답안을 인식하여 디지털 문자로 변환</span>
                        </li>
                    </ul>
                    
                    <button onclick="selectPlan('free', 'monthly')" data-plan-button="free" class="w-full bg-navy-900 text-white py-3 rounded-lg font-semibold hover:bg-navy-800 transition">
                        무료로 시작하세요
                    </button>
                </div>

                <!-- Starter Plan -->
                <div class="pricing-card bg-white rounded-xl shadow-lg p-6 border border-gray-200" data-plan="starter">
                    <div class="mb-6">
                        <h3 class="text-xl font-bold text-gray-900 mb-2">스타터</h3>
                        <p class="text-sm text-gray-600 mb-4">
                            논술 학원이나 방과 후 수업에서 논술을 지도하는 교사들을 위하여
                        </p>
                        <div class="monthly-price">
                            <div class="text-4xl font-bold text-gray-900">7,500원<span class="text-lg text-gray-500">/월</span></div>
                        </div>
                        <div class="yearly-price hidden">
                            <div class="text-4xl font-bold text-gray-900">6,000원<span class="text-lg text-gray-500">/월</span></div>
                            <div class="text-sm text-gray-500">(연간 72,000원)</div>
                        </div>
                    </div>
                    
                    <ul class="space-y-3 mb-6 text-sm">
                        <li class="flex items-start">
                            <i class="fas fa-arrow-left text-navy-700 mr-2 mt-1"></i>
                            <span>무료 체험 요금제의 모든 기능 +</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>한달에 90개 논술 답안지 채점</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>논술 1개당 최대 글자 수는 5,000자</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>교사가 출제한 문항에 학생이 직접 답안지를 제출할 수 있도록 학생 접속 코드 제공</span>
                        </li>
                    </ul>
                    
                    <button onclick="selectPlan('starter', 'monthly')" data-plan-button="starter" class="w-full bg-navy-900 text-white py-3 rounded-lg font-semibold hover:bg-navy-800 transition">
                        무료로 시작하세요
                    </button>
                </div>

                <!-- Basic Plan (Featured) -->
                <div class="pricing-card bg-white rounded-xl shadow-2xl p-6 border-2 border-navy-700 relative" data-plan="basic">
                    <div class="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <span class="bg-gradient-to-r from-purple-500 to-navy-700 text-white px-6 py-1 rounded-full text-sm font-semibold flex items-center">
                            <i class="fas fa-star mr-2"></i>적극 추천
                        </span>
                    </div>
                    
                    <div class="mb-6 mt-4">
                        <h3 class="text-xl font-bold text-gray-900 mb-2">베이직</h3>
                        <p class="text-sm text-gray-600 mb-4">
                            정규 수업에서 논술 평가를 실시해 보고자 하는 교사들을 위하여
                        </p>
                        <div class="monthly-price">
                            <div class="text-4xl font-bold text-gray-900">20,000원<span class="text-lg text-gray-500">/월</span></div>
                        </div>
                        <div class="yearly-price hidden">
                            <div class="text-4xl font-bold text-gray-900">16,000원<span class="text-lg text-gray-500">/월</span></div>
                            <div class="text-sm text-gray-500">(연간 192,000원)</div>
                        </div>
                    </div>
                    
                    <ul class="space-y-3 mb-6 text-sm">
                        <li class="flex items-start">
                            <i class="fas fa-arrow-left text-navy-700 mr-2 mt-1"></i>
                            <span>스타터 요금제의 모든 기능 +</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>한달에 300개 논술 답안지 채점</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>논술 1개당 최대 글자 수는 10,000자</span>
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
                    
                    <button onclick="selectPlan('basic', 'monthly')" data-plan-button="basic" class="w-full bg-gradient-to-r from-navy-700 to-navy-900 text-white py-3 rounded-lg font-semibold hover:shadow-xl transition">
                        무료로 시작하세요
                    </button>
                </div>

                <!-- Pro Plan -->
                <div class="pricing-card bg-white rounded-xl shadow-lg p-6 border border-gray-200" data-plan="pro">
                    <div class="mb-6">
                        <h3 class="text-xl font-bold text-gray-900 mb-2">프로</h3>
                        <p class="text-sm text-gray-600 mb-4">
                            아주 많은 분량의 논술문을 채점하는 교사들을 위하여
                        </p>
                        <div class="monthly-price">
                            <div class="text-4xl font-bold text-gray-900">39,000원<span class="text-lg text-gray-500">/월</span></div>
                        </div>
                        <div class="yearly-price hidden">
                            <div class="text-4xl font-bold text-gray-900">31,000원<span class="text-lg text-gray-500">/월</span></div>
                            <div class="text-sm text-gray-500">(연간 372,000원)</div>
                        </div>
                    </div>
                    
                    <ul class="space-y-3 mb-6 text-sm">
                        <li class="flex items-start">
                            <i class="fas fa-arrow-left text-navy-700 mr-2 mt-1"></i>
                            <span>베이직 요금제의 모든 기능 +</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>한달에 600개 논술 답안지 채점</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-check text-green-500 mr-2 mt-1"></i>
                            <span>논술 1개당 최대 글자 수는 15,000자</span>
                        </li>
                    </ul>
                    
                    <button onclick="selectPlan('pro', 'monthly')" data-plan-button="pro" class="w-full bg-navy-900 text-white py-3 rounded-lg font-semibold hover:bg-navy-800 transition">
                        무료로 시작하세요
                    </button>
                </div>
            </div>

        </div>

        <script>
          // CRITICAL: Storage utility functions to handle Safari localStorage blocking
          function getStorageItem(key) {
            try {
              return localStorage.getItem(key);
            } catch (e) {
              console.warn('localStorage not available, using memory storage');
              return window['_memStorage_' + key];
            }
          }

          function setStorageItem(key, value) {
            try {
              localStorage.setItem(key, value);
            } catch (e) {
              console.warn('localStorage not available, using memory storage');
              window['_memStorage_' + key] = value;
            }
          }

          function removeStorageItem(key) {
            try {
              localStorage.removeItem(key);
            } catch (e) {
              console.warn('localStorage not available, using memory storage');
              delete window['_memStorage_' + key];
            }
          }

          let currentBilling = 'monthly';
          let currentPlan = 'free'; // Default plan
          
          // Get current plan from server
          window.addEventListener('DOMContentLoaded', async () => {
            // Check login status and show/hide navigation links
            const isTeacherLoggedIn = getStorageItem('isLoggedIn') === 'true';
            const isStudentLoggedIn = getStorageItem('isStudentLoggedIn') === 'true';
            const isLoggedIn = isTeacherLoggedIn || isStudentLoggedIn;
            
            const myPageLink = document.getElementById('myPageLink');
            const loginDropdown = document.getElementById('loginDropdown');
            
            if (isLoggedIn) {
              // Show "나의 페이지" and hide "로그인" dropdown
              if (myPageLink) myPageLink.style.display = 'block';
              if (loginDropdown) loginDropdown.style.display = 'none';
              
              // Fetch current subscription from server
              try {
                const sessionId = getStorageItem('session_id');
                if (sessionId) {
                  const response = await fetch('/api/user/me', {
                    headers: { 'X-Session-ID': sessionId }
                  });
                  
                  if (response.ok) {
                    const userData = await response.json();
                    if (userData.subscription) {
                      const planMap = { '무료': 'free', '스타터': 'starter', '베이직': 'basic', '프로': 'pro' };
                      currentPlan = planMap[userData.subscription] || 'free';
                      updatePlanDisplay();
                    }
                  }
                }
              } catch (error) {
                console.error('Failed to fetch user subscription:', error);
              }
            } else {
              // Hide "나의 페이지" and show "로그인" dropdown
              if (myPageLink) myPageLink.style.display = 'none';
              if (loginDropdown) loginDropdown.style.display = 'block';
            }
            
            const urlParams = new URLSearchParams(window.location.search);
            const plan = urlParams.get('plan');
            if (plan) {
              currentPlan = plan;
              updatePlanDisplay();
            }
          });
          
          function updatePlanDisplay() {
            // Update button texts based on current plan
            document.querySelectorAll('[data-plan-button]').forEach(button => {
              const planType = button.getAttribute('data-plan-button');
              if (planType === currentPlan) {
                button.textContent = '이용 중';
                button.disabled = true;
                button.classList.remove('bg-navy-900', 'hover:bg-navy-800', 'bg-gradient-to-r', 'from-navy-700', 'to-navy-900', 'hover:shadow-xl');
                button.classList.add('bg-gray-400', 'cursor-not-allowed');
              } else {
                button.textContent = '업그레이드';
                button.disabled = false;
              }
            });
          }
          
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
            window.location.href = '/checkout?plan=' + plan + '&billing=' + currentBilling;
          }
        </script>
    </body>
    </html>
  `)
})

// Checkout Page
app.get('/checkout', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>결제하기 | AI 논술 평가</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js"></script>
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
          .payment-method {
            cursor: pointer;
            transition: all 0.3s ease;
          }
          .payment-method.active {
            background-color: #1e3a8a;
            color: white;
            border-color: #1e3a8a;
          }
        </style>
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
                    <button onclick="history.back()" class="text-gray-700 hover:text-navy-700 font-medium">
                        <i class="fas fa-arrow-left mr-2"></i>돌아가기
                    </button>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <!-- Header -->
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">선택한 요금제</h1>
            </div>

            <!-- Billing Toggle -->
            <div class="bg-white rounded-lg shadow-sm p-4 mb-6">
                <div class="flex items-center justify-center space-x-4">
                    <button id="monthlyBtn" onclick="toggleBilling('monthly')" class="px-6 py-2 rounded-lg font-semibold transition bg-navy-900 text-white">
                        월간
                    </button>
                    <button id="yearlyBtn" onclick="toggleBilling('yearly')" class="px-6 py-2 rounded-lg font-semibold transition bg-gray-200 text-gray-700">
                        연간 (20% 할인)
                    </button>
                </div>
            </div>

            <!-- Plan Details -->
            <div class="bg-white rounded-lg shadow-md p-8 mb-6 border-l-4 border-lime-400">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h2 id="planName" class="text-2xl font-bold text-gray-900 mb-2">스타터 요금제</h2>
                        <p id="planDescription" class="text-gray-600">논술 학원이나 방과 후 수업에서 논술을 지도하는 교사들을 위하여</p>
                    </div>
                    <div class="text-right">
                        <div id="planPrice" class="text-3xl font-bold text-gray-900">₩7,500<span class="text-lg text-gray-500">/월</span></div>
                    </div>
                </div>
            </div>

            <!-- Payment Method -->
            <div class="bg-white rounded-lg shadow-md p-8 mb-6">
                <h3 class="text-lg font-bold text-gray-900 mb-4">결제 방법</h3>
                <div class="grid grid-cols-2 gap-4">
                    <div class="payment-method active border-2 border-gray-300 rounded-lg p-4 text-center" onclick="selectPaymentMethod('card')">
                        <i class="fas fa-credit-card text-2xl mb-2"></i>
                        <div class="font-semibold">신용/체크카드</div>
                    </div>
                    <div class="payment-method border-2 border-gray-300 rounded-lg p-4 text-center" onclick="selectPaymentMethod('kakao')">
                        <i class="fas fa-comment text-2xl mb-2"></i>
                        <div class="font-semibold">카카오페이</div>
                    </div>
                </div>
                <button onclick="showAddCard()" class="mt-4 text-navy-700 hover:text-navy-900 text-sm font-semibold">
                    <i class="fas fa-plus mr-2"></i>새로운 결제 카드 추가
                </button>
            </div>

            <!-- Payment Details -->
            <div class="bg-white rounded-lg shadow-md p-8 mb-6">
                <h3 class="text-lg font-bold text-gray-900 mb-4">결제 내역</h3>
                <div class="space-y-3">
                    <div class="flex justify-between text-gray-700">
                        <span>결제 금액</span>
                        <span id="priceAmount" class="font-semibold">월 ₩7,500</span>
                    </div>
                    <div class="flex justify-between text-gray-700">
                        <span>결제일</span>
                        <span id="paymentDate" class="font-semibold">2025년 11월 23일</span>
                    </div>
                </div>
                <div class="mt-4 pt-4 border-t text-sm text-gray-600">
                    <p>결제 후 즉시 서비스를 이용하실 수 있습니다.</p>
                    <p class="mt-2">위 내용은 최종 결제시 변경될 수 있습니다.</p>
                </div>
            </div>

            <!-- Submit Button -->
            <button onclick="processPayment()" class="w-full bg-lime-400 text-black py-4 rounded-lg font-bold text-lg hover:bg-lime-500 transition">
                결제하기
            </button>
        </div>

        <!-- Add Card Modal -->
        <div id="addCardModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                <div class="p-6">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-xl font-bold text-gray-900">새로운 결제 카드 추가</h3>
                        <button onclick="closeAddCardModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>

                    <form id="addCardForm" onsubmit="registerCard(event)">
                        <!-- Card Number -->
                        <div class="mb-4">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">카드 번호</label>
                            <div class="grid grid-cols-4 gap-2">
                                <input type="text" id="cardNum1" maxlength="4" placeholder="1234" required
                                    class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent text-center"
                                    oninput="moveToNext(this, 'cardNum2')" />
                                <input type="text" id="cardNum2" maxlength="4" placeholder="1234" required
                                    class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent text-center"
                                    oninput="moveToNext(this, 'cardNum3')" />
                                <input type="text" id="cardNum3" maxlength="4" placeholder="1234" required
                                    class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent text-center"
                                    oninput="moveToNext(this, 'cardNum4')" />
                                <input type="text" id="cardNum4" maxlength="4" placeholder="1234" required
                                    class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent text-center"
                                    oninput="moveToNext(this, 'cardExpiry')" />
                            </div>
                        </div>

                        <!-- Expiry Date and CVV -->
                        <div class="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">유효 기간</label>
                                <input type="text" id="cardExpiry" maxlength="5" placeholder="MM / YY" required
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent"
                                    oninput="formatExpiry(this)" />
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    보안코드 (CVV/CVC)
                                    <i class="fas fa-question-circle text-gray-400 text-xs ml-1"></i>
                                </label>
                                <input type="password" id="cardCvv" maxlength="3" placeholder="●●●" required
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent text-center"
                                    oninput="moveToNext(this, 'cardBirthOrBusiness')" />
                            </div>
                        </div>

                        <!-- Birth Date or Business Number -->
                        <div class="mb-6">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                생년월일 (6자리) / 사업자등록번호 (10자리)
                                <i class="fas fa-question-circle text-gray-400 text-xs ml-1"></i>
                            </label>
                            <input type="text" id="cardBirthOrBusiness" maxlength="10" placeholder="생년월일 (6자리) / 사업자등록번호 (10자리)" required
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent" />
                            <p class="text-xs text-gray-500 mt-2">법인카드는 앞 10자리를 입력하세요.</p>
                        </div>

                        <!-- Submit Button -->
                        <button type="submit" class="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition">
                            등록하기
                        </button>
                    </form>
                </div>
            </div>
        </div>

        <script>
          let selectedPlan = 'starter';
          let selectedBilling = 'monthly';
          let selectedPaymentMethod = 'card';

          const planInfo = {
            free: {
              name: '무료 체험',
              description: '정규 수업에서 처음으로 논술형 평가를 도입해 보려고 하는 교사들을 위하여',
              monthlyPrice: 0,
              yearlyPrice: 0
            },
            starter: {
              name: '스타터 요금제',
              description: '논술 학원이나 방과 후 수업에서 논술을 지도하는 교사들을 위하여',
              monthlyPrice: 7500,
              yearlyPrice: 6000
            },
            basic: {
              name: '베이직 요금제',
              description: '정규 수업에서 논술 평가를 실시해 보고자 하는 교사들을 위하여',
              monthlyPrice: 20000,
              yearlyPrice: 16000
            },
            pro: {
              name: '프로 요금제',
              description: '아주 많은 분량의 논술문을 채점하는 교사들을 위하여',
              monthlyPrice: 39000,
              yearlyPrice: 31000
            }
          };

          // Initialize from URL parameters
          window.addEventListener('DOMContentLoaded', () => {
            const urlParams = new URLSearchParams(window.location.search);
            const plan = urlParams.get('plan') || 'starter';
            const billing = urlParams.get('billing') || 'monthly';
            
            selectedPlan = plan;
            selectedBilling = billing;
            
            updatePlanDisplay();
            if (billing === 'yearly') {
              toggleBilling('yearly');
            }
          });

          function toggleBilling(type) {
            selectedBilling = type;
            const monthlyBtn = document.getElementById('monthlyBtn');
            const yearlyBtn = document.getElementById('yearlyBtn');
            
            if (type === 'monthly') {
              monthlyBtn.classList.add('bg-navy-900', 'text-white');
              monthlyBtn.classList.remove('bg-gray-200', 'text-gray-700');
              yearlyBtn.classList.remove('bg-navy-900', 'text-white');
              yearlyBtn.classList.add('bg-gray-200', 'text-gray-700');
            } else {
              yearlyBtn.classList.add('bg-navy-900', 'text-white');
              yearlyBtn.classList.remove('bg-gray-200', 'text-gray-700');
              monthlyBtn.classList.remove('bg-navy-900', 'text-white');
              monthlyBtn.classList.add('bg-gray-200', 'text-gray-700');
            }
            
            updatePlanDisplay();
          }

          function updatePlanDisplay() {
            const plan = planInfo[selectedPlan];
            if (!plan) return;
            
            const price = selectedBilling === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
            const totalYearly = price * 12;
            
            document.getElementById('planName').textContent = plan.name;
            document.getElementById('planDescription').textContent = plan.description;
            document.getElementById('planPrice').innerHTML = '₩' + price.toLocaleString() + '<span class="text-lg text-gray-500">/월</span>';
            
            const billingText = selectedBilling === 'monthly' ? '월' : '연간';
            document.getElementById('priceAmount').textContent = billingText + ' ₩' + (selectedBilling === 'monthly' ? price : totalYearly).toLocaleString();
            
            // Update payment date
            const today = new Date();
            const paymentDate = new Date(today);
            paymentDate.setMonth(today.getMonth() + 1);
            document.getElementById('paymentDate').textContent = paymentDate.getFullYear() + '년 ' + (paymentDate.getMonth() + 1) + '월 ' + paymentDate.getDate() + '일';
          }

          function selectPaymentMethod(method) {
            selectedPaymentMethod = method;
            document.querySelectorAll('.payment-method').forEach(el => {
              el.classList.remove('active');
            });
            event.target.closest('.payment-method').classList.add('active');
          }

          function showAddCard() {
            document.getElementById('addCardModal').classList.remove('hidden');
          }

          function closeAddCardModal() {
            document.getElementById('addCardModal').classList.add('hidden');
            document.getElementById('addCardForm').reset();
          }

          function moveToNext(current, nextFieldId) {
            if (current.value.length >= current.maxLength) {
              const nextField = document.getElementById(nextFieldId);
              if (nextField) {
                nextField.focus();
              }
            }
          }

          function formatExpiry(input) {
            let value = input.value.replace(/\D/g, '');
            if (value.length >= 2) {
              value = value.substring(0, 2) + ' / ' + value.substring(2, 4);
            }
            input.value = value;
          }

          function registerCard(event) {
            event.preventDefault();
            
            const cardNum1 = document.getElementById('cardNum1').value;
            const cardNum2 = document.getElementById('cardNum2').value;
            const cardNum3 = document.getElementById('cardNum3').value;
            const cardNum4 = document.getElementById('cardNum4').value;
            const cardExpiry = document.getElementById('cardExpiry').value;
            const cardCvv = document.getElementById('cardCvv').value;
            const cardBirthOrBusiness = document.getElementById('cardBirthOrBusiness').value;
            
            // Basic validation
            if (cardNum1.length !== 4 || cardNum2.length !== 4 || cardNum3.length !== 4 || cardNum4.length !== 4) {
              alert('카드 번호를 올바르게 입력해 주세요.');
              return;
            }
            
            if (cardCvv.length !== 3) {
              alert('보안코드를 올바르게 입력해 주세요.');
              return;
            }
            
            if (cardBirthOrBusiness.length !== 6 && cardBirthOrBusiness.length !== 10) {
              alert('생년월일(6자리) 또는 사업자등록번호(10자리)를 입력해 주세요.');
              return;
            }
            
            // TODO: Implement actual card registration
            alert('카드가 등록되었습니다.');
            closeAddCardModal();
          }

          function processPayment() {
            if (confirm('결제를 진행하시겠습니까?')) {
              alert('결제 기능은 현재 준비 중입니다. 실제 서비스에서는 결제 API와 연동됩니다.');
              // TODO: Implement actual payment processing
              // window.location.href = '/my-page';
            }
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
        <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
        <meta http-equiv="Pragma" content="no-cache">
        <meta http-equiv="Expires" content="0">
        <title>나의 페이지 | AI 논술 평가</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js"></script>
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
          /* Reference material textarea styling */
          .reference-input {
            resize: vertical;
            min-height: 120px;
            scrollbar-width: thin;
            scrollbar-color: #cbd5e1 #f1f5f9;
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
          }
          .reference-input::-webkit-scrollbar {
            width: 8px;
          }
          .reference-input::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 4px;
          }
          .reference-input::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
          }
          .reference-input::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
          /* Profile dropdown styling */
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
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
                        
                        <!-- User Info & Usage -->
                        <div class="flex items-center space-x-3">
                            <div id="usageInfo" class="text-sm font-medium text-gray-700">무료 체험: 0 / 20</div>
                            
                            <!-- Profile Button -->
                            <div class="relative">
                                <button id="teacherProfileButton" onclick="showAccountModal()" class="w-10 h-10 bg-navy-700 rounded-full flex items-center justify-center text-white hover:bg-navy-600 transition cursor-pointer">
                                    <i class="fas fa-user"></i>
                                </button>
                            </div>
                        </div>
                        
                        <a id="upgradeButton" href="/pricing" class="bg-lime-200 text-black px-4 py-2 rounded-lg font-semibold hover:bg-lime-300 transition">
                            <i class="fas fa-arrow-up mr-2"></i>업그레이드
                        </a>
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
            <div class="flex items-center gap-2 mb-6 border-b border-gray-200">
                <button id="assignmentsTab" onclick="switchTab('assignments')" class="tab-button px-6 py-3 font-semibold rounded-t-lg transition active">
                    <i class="fas fa-clipboard-list mr-2"></i>내 과제
                </button>
                <button id="historyTab" onclick="switchTab('history')" class="tab-button px-6 py-3 font-semibold rounded-t-lg transition text-gray-700 hover:bg-gray-100">
                    <i class="fas fa-history mr-2"></i>채점 이력
                </button>
                <div class="flex items-center gap-1 text-sm text-gray-600 ml-2">
                    <i class="fas fa-info-circle" style="color: #ef4444;"></i>
                    <span>재채점 시 기존 채점 기록이 업데이트됩니다!</span>
                </div>
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

        <!-- Account Settings Modal -->
        <div id="accountModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden mx-4 flex">
                <!-- Sidebar -->
                <div class="w-48 bg-gray-50 border-r border-gray-200 py-6">
                    <button onclick="showAccountTab('profile')" id="accountTabProfile" class="account-tab-btn w-full text-left px-6 py-3 hover:bg-gray-100 transition font-medium text-gray-700">
                        내 계정
                    </button>
                    <button onclick="showAccountTab('usage')" id="accountTabUsage" class="account-tab-btn w-full text-left px-6 py-3 hover:bg-gray-100 transition font-medium text-gray-700">
                        내 사용량
                    </button>
                    <button onclick="showAccountTab('billing')" id="accountTabBilling" class="account-tab-btn w-full text-left px-6 py-3 hover:bg-gray-100 transition font-medium text-gray-700 border-b border-gray-200 pb-3 mb-3">
                        구독 결제 관리
                    </button>
                    <button onclick="logout()" class="w-full text-left px-6 py-3 hover:bg-red-50 transition font-medium text-red-600">
                        로그아웃
                    </button>
                </div>

                <!-- Main Content -->
                <div class="flex-1 overflow-y-auto">
                    <div class="p-8">
                        <div class="flex justify-between items-center mb-6">
                            <h2 id="accountModalTitle" class="text-2xl font-bold text-gray-900">내 계정</h2>
                            <button onclick="closeAccountModal()" class="text-gray-500 hover:text-gray-700">
                                <i class="fas fa-times text-2xl"></i>
                            </button>
                        </div>

                        <!-- Profile Tab Content -->
                        <div id="accountTabContent" class="space-y-6">
                            <!-- Profile Information -->
                            <div class="space-y-6">
                                <div class="text-center mb-6">
                                    <div class="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <i class="fas fa-camera text-gray-400 text-2xl"></i>
                                    </div>
                                </div>

                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">이름</label>
                                    <input type="text" id="profileName" class="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50" value="김교사" readonly>
                                </div>

                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">이메일</label>
                                    <input type="email" id="profileEmail" class="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50" value="gskim@test.com" readonly>
                                </div>

                                <div class="border-t border-gray-200 pt-6">
                                    <h3 class="text-lg font-bold text-gray-900 mb-4">비밀번호</h3>
                                    <div class="flex items-center justify-between">
                                        <div class="flex-1">
                                            <p class="text-sm text-gray-600">**************</p>
                                        </div>
                                        <button onclick="showChangePasswordModal()" class="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition font-semibold">
                                            수정하기
                                        </button>
                                    </div>
                                </div>

                                <div class="border-t border-gray-200 pt-6">
                                    <h3 class="text-lg font-bold text-gray-900 mb-4">이메일 알림</h3>
                                    <div class="space-y-4">
                                        <label class="flex items-center justify-between">
                                            <div>
                                                <p class="font-medium text-gray-900">공지사항과 큐레이션 이메일</p>
                                                <p class="text-sm text-gray-500">새로운 기능에 대한 공지사항과 관심 분야의 영상 요약 뉴스레터를 받아 수 있습니다.</p>
                                            </div>
                                            <label class="relative inline-flex items-center cursor-pointer ml-4">
                                                <input type="checkbox" id="emailNotifications" class="sr-only peer" checked>
                                                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                        </label>
                                    </div>
                                </div>

                                <div class="border-t border-gray-200 pt-6">
                                    <h3 class="text-lg font-bold text-gray-900 mb-2">계정 삭제</h3>
                                    <p class="text-sm text-gray-600 mb-4">계정을 삭제하면 모든 기록이 사라지고 복구할 수 없습니다. <a href="#" class="text-blue-600 hover:underline">탈퇴하기</a></p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Change Password Modal -->
        <div id="changePasswordModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
            <div class="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-900">비밀번호 변경</h2>
                    <button onclick="closeChangePasswordModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-2xl"></i>
                    </button>
                </div>

                <form id="changePasswordForm" onsubmit="handleChangePassword(event)">
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">현재 비밀번호</label>
                            <input type="password" id="currentPassword" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700" required>
                        </div>

                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">새 비밀번호</label>
                            <input type="password" id="newPassword" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700" required>
                        </div>

                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">새 비밀번호 확인</label>
                            <input type="password" id="confirmNewPassword" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700" required>
                        </div>
                    </div>

                    <div class="mt-6 flex gap-3">
                        <button type="button" onclick="closeChangePasswordModal()" class="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold">
                            취소
                        </button>
                        <button type="submit" class="flex-1 px-4 py-3 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition font-semibold">
                            변경하기
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Billing Management Modal Content (shown in Account Modal) -->
        <div id="billingContent" class="hidden">
            <div class="space-y-6">
                <div class="grid grid-cols-2 gap-6">
                    <div class="bg-white border border-gray-200 rounded-lg p-6">
                        <h3 class="text-sm font-semibold text-gray-700 mb-2">결제 예정 금액</h3>
                        <p class="text-3xl font-bold text-gray-900">-</p>
                    </div>
                    <div class="bg-white border border-gray-200 rounded-lg p-6">
                        <h3 class="text-sm font-semibold text-gray-700 mb-2">구독 만료일</h3>
                        <p class="text-3xl font-bold text-gray-900">-</p>
                    </div>
                </div>

                <div class="border-t border-gray-200 pt-6">
                    <h3 class="text-lg font-bold text-gray-900 mb-4">구독 중인 요금제</h3>
                    <div class="bg-gray-50 rounded-lg p-4 mb-4">
                        <p class="text-sm font-medium text-gray-700">결제 중인 요금제가 없습니다.</p>
                    </div>
                </div>

                <div class="border-t border-gray-200 pt-6">
                    <h3 class="text-lg font-bold text-gray-900 mb-4">결제 정보</h3>
                    <div class="flex items-center justify-between bg-gray-50 rounded-lg p-4 mb-4">
                        <div class="flex items-center">
                            <i class="fas fa-credit-card text-gray-400 text-xl mr-3"></i>
                            <span class="text-sm font-medium text-gray-700">카카오페이</span>
                        </div>
                        <button class="text-sm text-gray-600 hover:text-gray-900">변경</button>
                    </div>
                </div>

                <div class="border-t border-gray-200 pt-6">
                    <h3 class="text-lg font-bold text-gray-900 mb-4">결제 내역</h3>
                    <div class="overflow-hidden border border-gray-200 rounded-lg">
                        <table class="w-full">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700">날짜</th>
                                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700">결제 내역</th>
                                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700">결제 금액</th>
                                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700">결제 수단</th>
                                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700">상태</th>
                                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700">영수증</th>
                                </tr>
                            </thead>
                            <tbody id="billingHistoryList">
                                <tr>
                                    <td class="px-4 py-3 text-sm text-gray-900">2025.05.07</td>
                                    <td class="px-4 py-3 text-sm text-gray-900">월간 결제</td>
                                    <td class="px-4 py-3 text-sm text-gray-900">₩7,900</td>
                                    <td class="px-4 py-3 text-sm text-gray-900">카카오페이</td>
                                    <td class="px-4 py-3 text-sm text-gray-900">결제 완료</td>
                                    <td class="px-4 py-3 text-sm text-gray-900">
                                        <a href="#" class="text-blue-600 hover:underline">영수증 보기</a>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
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

                <!-- Load Existing Assignment -->
                <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        <i class="fas fa-folder-open mr-2 text-blue-600"></i>기존 과제 불러오기
                    </label>
                    <div class="flex gap-2">
                        <select id="existingAssignmentSelect" class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700">
                            <option value="">-- 기존 과제를 선택하세요 --</option>
                        </select>
                        <button type="button" onclick="loadExistingAssignment()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold">
                            <i class="fas fa-download mr-2"></i>불러오기
                        </button>
                    </div>
                    <p class="text-xs text-gray-600 mt-2">
                        <i class="fas fa-info-circle mr-1"></i>기존 과제를 선택하고 '불러오기'를 클릭하면 내용을 편집하여 사용할 수 있습니다.
                    </p>
                </div>

                <!-- Load from Library -->
                <div class="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                    <div class="flex justify-between items-center mb-2">
                        <label class="block text-sm font-semibold text-gray-700">
                            <i class="fas fa-book-open mr-2 text-green-600"></i>과제 라이브러리에서 불러오기
                        </label>
                        <button type="button" onclick="openLibraryModal()" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-sm">
                            <i class="fas fa-search mr-2"></i>라이브러리 열기
                        </button>
                    </div>
                    <p class="text-xs text-gray-600">
                        <i class="fas fa-info-circle mr-1"></i>다른 교사들이 공유한 과제나 플랫폼 제공 과제를 불러올 수 있습니다.
                    </p>
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

                        <!-- Prompts (Reference Materials) -->
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">제시문</label>
                            <div id="assignmentReferenceMaterials" class="space-y-3 mb-2">
                                <!-- Initial 4 reference slots with image upload -->
                                <div class="reference-item">
                                    <div class="flex gap-2 mb-2">
                                        <textarea class="reference-input flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm overflow-y-auto" rows="5" placeholder="제시문 내용 (선택사항)"></textarea>
                                        <button type="button" onclick="removeReferenceMaterial(this)" class="px-3 py-2 text-red-600 hover:text-red-800 text-sm self-start">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                    <!-- Image Preview Container -->
                                    <div class="image-preview-container mb-2 flex flex-wrap gap-2" style="display: none;"></div>
                                    <div class="flex gap-3 items-center">
                                        <button type="button" onclick="handleReferenceImageUpload(this)" class="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-xs">
                                            <i class="fas fa-image mr-1"></i>이미지 업로드
                                        </button>
                                        <label class="flex items-center gap-1 text-xs text-gray-700 cursor-pointer hover:text-gray-900">
                                            <input type="checkbox" class="skip-ocr-checkbox w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" checked>
                                            <span>OCR 건너뛰고 이미지 그대로 삽입</span>
                                        </label>
                                        <span class="text-xs text-gray-500 self-center upload-status"></span>
                                    </div>
                                </div>
                                <div class="reference-item">
                                    <div class="flex gap-2 mb-2">
                                        <textarea class="reference-input flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm overflow-y-auto" rows="5" placeholder="제시문 내용 (선택사항)"></textarea>
                                        <button type="button" onclick="removeReferenceMaterial(this)" class="px-3 py-2 text-red-600 hover:text-red-800 text-sm self-start">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                    <!-- Image Preview Container -->
                                    <div class="image-preview-container mb-2 flex flex-wrap gap-2" style="display: none;"></div>
                                    <div class="flex gap-3 items-center">
                                        <button type="button" onclick="handleReferenceImageUpload(this)" class="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-xs">
                                            <i class="fas fa-image mr-1"></i>이미지 업로드
                                        </button>
                                        <label class="flex items-center gap-1 text-xs text-gray-700 cursor-pointer hover:text-gray-900">
                                            <input type="checkbox" class="skip-ocr-checkbox w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" checked>
                                            <span>OCR 건너뛰고 이미지 그대로 삽입</span>
                                        </label>
                                        <span class="text-xs text-gray-500 self-center upload-status"></span>
                                    </div>
                                </div>
                                <div class="reference-item">
                                    <div class="flex gap-2 mb-2">
                                        <textarea class="reference-input flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm overflow-y-auto" rows="5" placeholder="제시문 내용 (선택사항)"></textarea>
                                        <button type="button" onclick="removeReferenceMaterial(this)" class="px-3 py-2 text-red-600 hover:text-red-800 text-sm self-start">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                    <!-- Image Preview Container -->
                                    <div class="image-preview-container mb-2 flex flex-wrap gap-2" style="display: none;"></div>
                                    <div class="flex gap-3 items-center">
                                        <button type="button" onclick="handleReferenceImageUpload(this)" class="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-xs">
                                            <i class="fas fa-image mr-1"></i>이미지 업로드
                                        </button>
                                        <label class="flex items-center gap-1 text-xs text-gray-700 cursor-pointer hover:text-gray-900">
                                            <input type="checkbox" class="skip-ocr-checkbox w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" checked>
                                            <span>OCR 건너뛰고 이미지 그대로 삽입</span>
                                        </label>
                                        <span class="text-xs text-gray-500 self-center upload-status"></span>
                                    </div>
                                </div>
                                <div class="reference-item">
                                    <div class="flex gap-2 mb-2">
                                        <textarea class="reference-input flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm overflow-y-auto" rows="5" placeholder="제시문 내용 (선택사항)"></textarea>
                                        <button type="button" onclick="removeReferenceMaterial(this)" class="px-3 py-2 text-red-600 hover:text-red-800 text-sm self-start">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                    <!-- Image Preview Container -->
                                    <div class="image-preview-container mb-2 flex flex-wrap gap-2" style="display: none;"></div>
                                    <div class="flex gap-3 items-center">
                                        <button type="button" onclick="handleReferenceImageUpload(this)" class="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-xs">
                                            <i class="fas fa-image mr-1"></i>이미지 업로드
                                        </button>
                                        <label class="flex items-center gap-1 text-xs text-gray-700 cursor-pointer hover:text-gray-900">
                                            <input type="checkbox" class="skip-ocr-checkbox w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" checked>
                                            <span>OCR 건너뛰고 이미지 그대로 삽입</span>
                                        </label>
                                        <span class="text-xs text-gray-500 self-center upload-status"></span>
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center justify-between">
                                <button type="button" onclick="addReferenceMaterial()" id="addReferenceBtn" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm">
                                    <i class="fas fa-plus mr-2"></i>제시문 추가
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
                                <label class="block text-sm font-semibold text-gray-700 mb-2">교과목 구분</label>
                                <select id="assignmentSubject" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700">
                                    <option value="">교과목 선택</option>
                                    <option value="국어">국어</option>
                                    <option value="수학">수학</option>
                                    <option value="사회">사회</option>
                                    <option value="과학">과학</option>
                                    <option value="역사">역사</option>
                                </select>
                            </div>

                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">제출 마감일</label>
                                <input type="date" id="assignmentDueDate" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700">
                            </div>
                            
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-tags mr-2"></i>태그 (선택사항)
                                </label>
                                <input 
                                    type="text" 
                                    id="assignmentTags" 
                                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700" 
                                    placeholder="태그를 쉼표로 구분하여 입력 (예: 역사, 논술, 세계사)"
                                >
                                <p class="text-xs text-gray-500 mt-1">
                                    태그를 추가하면 다른 교사들이 라이브러리에서 쉽게 찾을 수 있습니다.
                                </p>
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
                                <div id="platformRubricList" class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <!-- Platform rubrics will be loaded here -->
                                </div>
                                <input type="hidden" id="selectedPlatformRubric" value="" />
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

        <!-- Assignment Library Modal -->
        <div id="libraryModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-xl shadow-2xl p-8 max-w-6xl w-full max-h-[90vh] overflow-y-auto mx-4">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-900">
                        <i class="fas fa-book-open mr-2 text-green-600"></i>과제 라이브러리
                    </h2>
                    <button onclick="closeLibraryModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-2xl"></i>
                    </button>
                </div>

                <!-- Filters and Sort -->
                <div class="mb-6 p-4 bg-gray-50 rounded-lg">
                    <!-- Search Bar -->
                    <div class="mb-4">
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-search mr-2"></i>키워드 검색
                        </label>
                        <input 
                            type="text" 
                            id="librarySearch" 
                            placeholder="과제 제목이나 설명에서 검색..." 
                            onkeyup="handleSearchKeyup(event)"
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        >
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">작성자</label>
                            <select id="libraryFilterAuthorType" onchange="filterLibrary()" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                                <option value="">전체</option>
                                <option value="admin">관리자</option>
                                <option value="user">사용자</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">학교급</label>
                            <select id="libraryFilterGrade" onchange="filterLibrary()" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                                <option value="">전체</option>
                                <option value="초등학교">초등학교</option>
                                <option value="중학교">중학교</option>
                                <option value="고등학교">고등학교</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">교과목</label>
                            <select id="libraryFilterSubject" onchange="filterLibrary()" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                                <option value="">전체</option>
                                <option value="국어">국어</option>
                                <option value="수학">수학</option>
                                <option value="사회">사회</option>
                                <option value="과학">과학</option>
                                <option value="역사">역사</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">태그</label>
                            <select id="libraryFilterTag" onchange="filterLibrary()" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                                <option value="">전체</option>
                                <!-- Tags will be loaded dynamically -->
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">정렬</label>
                            <select id="librarySortBy" onchange="sortLibrary()" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                                <option value="created_at">생성일</option>
                                <option value="usage_count">인기순 (사용 횟수)</option>
                                <option value="average_rating">별점순</option>
                                <option value="title">과제명</option>
                                <option value="author">작성자</option>
                                <option value="grade_level">학교급</option>
                                <option value="subject">교과목</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Library List -->
                <div id="libraryList" class="space-y-3">
                    <!-- Library assignments will be loaded here -->
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-spinner fa-spin text-3xl mb-3"></i>
                        <p>라이브러리를 불러오는 중...</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Rubric PDF Preview Modal -->
        <div id="rubricPreviewModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
            <div class="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] mx-4 flex flex-col">
                <!-- Modal Header -->
                <div class="flex justify-between items-center p-6 border-b">
                    <h2 id="rubricPreviewTitle" class="text-2xl font-bold text-gray-900"></h2>
                    <div class="flex gap-2">
                        <button onclick="selectCurrentRubric()" class="px-6 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition font-semibold">
                            선택하기 →
                        </button>
                        <button onclick="closeRubricPreview()" class="px-4 py-2 text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i> 닫기
                        </button>
                    </div>
                </div>
                
                <!-- PDF Content Area -->
                <div class="flex-1 overflow-y-auto p-6">
                    <div id="rubricPdfContainer" class="w-full">
                        <!-- PDF will be embedded here -->
                    </div>
                </div>
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
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js"></script>
        ${STORAGE_UTILS_SCRIPT}
        <script src="/static/my-page-full.js"></script>
        <script>
          // Set upgrade button link based on user's current subscription
          (async function() {
            try {
              const sessionId = getStorageItem('session_id');
              if (!sessionId) return;
              
              const response = await fetch('/api/user/me', {
                headers: { 'X-Session-ID': sessionId }
              });
              
              if (response.ok) {
                const userData = await response.json();
                const subscription = userData.subscription || '무료';
                const planMap = { '무료': 'free', '스타터': 'starter', '베이직': 'basic', '프로': 'pro' };
                const currentPlan = planMap[subscription] || 'free';
                
                const upgradeButton = document.getElementById('upgradeButton');
                if (upgradeButton) {
                  upgradeButton.href = \`/pricing?plan=\${currentPlan}\`;
                }
              }
            } catch (error) {
              console.error('Failed to fetch user subscription for upgrade button:', error);
            }
          })();
        </script>
    </body>
    </html>
  `)
})

// Admin Dashboard - System Management
app.get('/admin', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>관리자 대시보드 | AI 논술 평가</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
          .stat-card {
            transition: all 0.3s ease;
          }
          .stat-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 24px -6px rgba(0, 0, 0, 0.15);
          }
          .tab-button {
            transition: all 0.3s ease;
          }
          .tab-button.active {
            background-color: #1e3a8a;
            color: white;
          }
        </style>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-gradient-to-r from-blue-900 to-purple-900 shadow-lg sticky top-0 z-50">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16 items-center">
                    <div class="flex items-center">
                        <i class="fas fa-shield-alt text-3xl text-white mr-3"></i>
                        <span class="text-2xl font-bold text-white">관리자 대시보드</span>
                    </div>
                    <div class="flex items-center space-x-4">
                        <a href="/" class="text-white hover:text-blue-200 font-medium">
                            <i class="fas fa-home mr-1"></i>홈
                        </a>
                        <a href="/admin/cms" class="text-white hover:text-blue-200 font-medium">
                            <i class="fas fa-book mr-1"></i>CMS
                        </a>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Header -->
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">시스템 관리</h1>
                <p class="text-gray-600">AI 논술 평가 시스템의 전체 현황을 확인하고 관리하세요</p>
            </div>

            <!-- Stats Overview -->
            <div id="statsOverview" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div class="text-center py-8">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p class="text-gray-500 mt-4">통계를 불러오는 중...</p>
                </div>
            </div>

            <!-- Tabs -->
            <div class="bg-white rounded-lg shadow-md mb-8">
                <div class="border-b border-gray-200">
                    <nav class="flex space-x-4 px-6" aria-label="Tabs">
                        <button onclick="switchTab('overview')" id="tab-overview" class="tab-button active px-4 py-4 text-sm font-semibold rounded-t-lg">
                            <i class="fas fa-chart-line mr-2"></i>개요
                        </button>
                        <button onclick="switchTab('activity')" id="tab-activity" class="tab-button px-4 py-4 text-sm font-semibold rounded-t-lg text-gray-600 hover:text-gray-900">
                            <i class="fas fa-history mr-2"></i>최근 활동
                        </button>
                        <button onclick="switchTab('users')" id="tab-users" class="tab-button px-4 py-4 text-sm font-semibold rounded-t-lg text-gray-600 hover:text-gray-900">
                            <i class="fas fa-users mr-2"></i>사용자 관리
                        </button>
                        <button onclick="switchTab('analytics')" id="tab-analytics" class="tab-button px-4 py-4 text-sm font-semibold rounded-t-lg text-gray-600 hover:text-gray-900">
                            <i class="fas fa-chart-bar mr-2"></i>분석
                        </button>
                    </nav>
                </div>

                <!-- Tab Contents -->
                <div class="p-6">
                    <!-- Overview Tab -->
                    <div id="content-overview" class="tab-content">
                        <h2 class="text-xl font-bold text-gray-900 mb-6">시스템 개요</h2>
                        
                        <!-- Top Teachers -->
                        <div class="mb-8">
                            <h3 class="text-lg font-semibold text-gray-800 mb-4">
                                <i class="fas fa-trophy text-yellow-500 mr-2"></i>최다 활동 교사
                            </h3>
                            <div id="topTeachers" class="space-y-3">
                                <p class="text-gray-500">로딩 중...</p>
                            </div>
                        </div>

                        <!-- Active Students -->
                        <div>
                            <h3 class="text-lg font-semibold text-gray-800 mb-4">
                                <i class="fas fa-star text-blue-500 mr-2"></i>최다 제출 학생
                            </h3>
                            <div id="activeStudents" class="space-y-3">
                                <p class="text-gray-500">로딩 중...</p>
                            </div>
                        </div>
                    </div>

                    <!-- Activity Tab -->
                    <div id="content-activity" class="tab-content hidden">
                        <h2 class="text-xl font-bold text-gray-900 mb-6">최근 활동 (최근 50개)</h2>
                        <div id="recentActivity">
                            <p class="text-gray-500">로딩 중...</p>
                        </div>
                    </div>

                    <!-- Users Tab -->
                    <div id="content-users" class="tab-content hidden">
                        <h2 class="text-xl font-bold text-gray-900 mb-6">사용자 관리</h2>
                        
                        <!-- Teachers List -->
                        <div class="mb-8">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-lg font-semibold text-gray-800">
                                    <i class="fas fa-chalkboard-teacher text-green-600 mr-2"></i>교사 목록
                                </h3>
                                <div class="flex items-center space-x-2">
                                    <label class="text-sm text-gray-600">필터:</label>
                                    <select 
                                        onchange="filterTeachers(this.value)" 
                                        class="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="all">전체</option>
                                        <option value="무료">무료</option>
                                        <option value="스타터">스타터</option>
                                        <option value="베이직">베이직</option>
                                        <option value="프로">프로</option>
                                    </select>
                                </div>
                            </div>
                            <div id="teachersList" class="overflow-x-auto">
                                <p class="text-gray-500">로딩 중...</p>
                            </div>
                        </div>

                        <!-- Students List -->
                        <div>
                            <h3 class="text-lg font-semibold text-gray-800 mb-4">
                                <i class="fas fa-user-graduate text-blue-600 mr-2"></i>학생 목록
                            </h3>
                            <div id="studentsList" class="overflow-x-auto">
                                <p class="text-gray-500">로딩 중...</p>
                            </div>
                        </div>
                    </div>

                    <!-- Analytics Tab -->
                    <div id="content-analytics" class="tab-content hidden">
                        <h2 class="text-xl font-bold text-gray-900 mb-6">시스템 분석</h2>
                        <div class="grid md:grid-cols-2 gap-6">
                            <div class="bg-white p-6 rounded-lg border border-gray-200">
                                <h3 class="text-lg font-semibold mb-4">제출 현황</h3>
                                <canvas id="submissionChart"></canvas>
                            </div>
                            <div class="bg-white p-6 rounded-lg border border-gray-200">
                                <h3 class="text-lg font-semibold mb-4">평균 점수 분포</h3>
                                <canvas id="scoreChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        ${STORAGE_UTILS_SCRIPT}
        <script>
          // Configure axios to include session ID in all requests
          const sessionId = getStorageItem('session_id');
          
          console.log('[DEBUG] Admin page - session_id:', sessionId);
          
          if (sessionId) {
            axios.defaults.headers.common['X-Session-ID'] = sessionId;
            console.log('[DEBUG] Session found, loading stats...');
          } else {
            // For admin page, try to load anyway (will show error if unauthorized)
            console.log('[DEBUG] No session found, attempting to load stats anyway...');
          }

          let statsData = null;

          async function loadStats() {
            try {
              console.log('[DEBUG] Calling /api/admin/stats...');
              const statsResponse = await axios.get('/api/admin/stats');
              console.log('[DEBUG] Stats response:', statsResponse.data);
              console.log('[DEBUG] Stats response JSON:', JSON.stringify(statsResponse.data, null, 2));
              
              // WORKAROUND: Fetch subscription stats separately
              console.log('[DEBUG] Calling /api/admin/subscription-stats...');
              const subscriptionResponse = await axios.get('/api/admin/subscription-stats');
              console.log('[DEBUG] Subscription stats response:', subscriptionResponse.data);
              
              // Merge responses
              statsData = {
                ...statsResponse.data,
                subscription_stats: subscriptionResponse.data
              };
              
              console.log('[DEBUG] Merged data:', statsData);
              displayStats(statsData);
            } catch (error) {
              console.error('[ERROR] Error loading stats:', error);
              console.error('[ERROR] Error details:', error.response);
              document.getElementById('statsOverview').innerHTML = \`
                <div class="col-span-4 text-center py-8 text-red-600">
                  <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                  <p>통계를 불러오는 데 실패했습니다</p>
                  <p class="text-sm mt-2">먼저 교사 계정으로 로그인해 주세요</p>
                  <a href="/login" class="mt-4 inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">로그인하기</a>
                </div>
              \`;
            }
          }

          function displayStats(data) {
            console.log('[DEBUG] displayStats called with data:', data);
            console.log('[DEBUG] data keys:', Object.keys(data));
            console.log('[DEBUG] subscription_stats:', data.subscription_stats);
            console.log('[DEBUG] subscription_stats type:', typeof data.subscription_stats);
            console.log('[DEBUG] subscription_stats is array?', Array.isArray(data.subscription_stats));
            
            const overview = data.overview;
            const recent = data.recent_activity;
            
            // Build main statistics HTML
            let mainStatsHTML = 
              '<div class="stat-card bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">' +
                '<div class="flex items-center justify-between mb-4">' +
                  '<div class="bg-white/20 rounded-lg p-3">' +
                    '<i class="fas fa-chalkboard-teacher text-3xl"></i>' +
                  '</div>' +
                  '<div class="text-right">' +
                    '<div class="text-3xl font-bold">' + overview.total_teachers + '</div>' +
                    '<div class="text-sm opacity-90">명</div>' +
                  '</div>' +
                '</div>' +
                '<div class="text-lg font-semibold">전체 교사</div>' +
              '</div>' +
              
              '<div class="stat-card bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">' +
                '<div class="flex items-center justify-between mb-4">' +
                  '<div class="bg-white/20 rounded-lg p-3">' +
                    '<i class="fas fa-user-graduate text-3xl"></i>' +
                  '</div>' +
                  '<div class="text-right">' +
                    '<div class="text-3xl font-bold">' + overview.total_students + '</div>' +
                    '<div class="text-sm opacity-90">명</div>' +
                  '</div>' +
                '</div>' +
                '<div class="text-lg font-semibold">전체 학생</div>' +
              '</div>' +
              
              '<div class="stat-card bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">' +
                '<div class="flex items-center justify-between mb-4">' +
                  '<div class="bg-white/20 rounded-lg p-3">' +
                    '<i class="fas fa-file-alt text-3xl"></i>' +
                  '</div>' +
                  '<div class="text-right">' +
                    '<div class="text-3xl font-bold">' + overview.total_submissions + '</div>' +
                    '<div class="text-sm opacity-90">건</div>' +
                  '</div>' +
                '</div>' +
                '<div class="text-lg font-semibold">전체 제출물</div>' +
              '</div>' +
              
              '<div class="stat-card bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white">' +
                '<div class="flex items-center justify-between mb-4">' +
                  '<div class="bg-white/20 rounded-lg p-3">' +
                    '<i class="fas fa-check-circle text-3xl"></i>' +
                  '</div>' +
                  '<div class="text-right">' +
                    '<div class="text-3xl font-bold">' + overview.graded_submissions + '</div>' +
                    '<div class="text-sm opacity-90">건</div>' +
                  '</div>' +
                '</div>' +
                '<div class="text-lg font-semibold">채점 완료</div>' +
              '</div>' +
              
              '<div class="stat-card bg-white rounded-xl shadow-lg p-6 border-2 border-blue-200">' +
                '<div class="flex items-center justify-between mb-4">' +
                  '<div class="bg-blue-100 rounded-lg p-3">' +
                    '<i class="fas fa-clock text-3xl text-blue-600"></i>' +
                  '</div>' +
                  '<div class="text-right">' +
                    '<div class="text-3xl font-bold text-blue-900">' + overview.pending_submissions + '</div>' +
                    '<div class="text-sm text-gray-600">건</div>' +
                  '</div>' +
                '</div>' +
                '<div class="text-lg font-semibold text-gray-800">채점 대기</div>' +
              '</div>' +
              
              '<div class="stat-card bg-white rounded-xl shadow-lg p-6 border-2 border-green-200">' +
                '<div class="flex items-center justify-between mb-4">' +
                  '<div class="bg-green-100 rounded-lg p-3">' +
                    '<i class="fas fa-chart-line text-3xl text-green-600"></i>' +
                  '</div>' +
                  '<div class="text-right">' +
                    '<div class="text-3xl font-bold text-green-900">' + overview.average_score.toFixed(1) + '</div>' +
                    '<div class="text-sm text-gray-600">점</div>' +
                  '</div>' +
                '</div>' +
                '<div class="text-lg font-semibold text-gray-800">평균 점수</div>' +
              '</div>' +
              
              '<div class="stat-card bg-white rounded-xl shadow-lg p-6 border-2 border-purple-200">' +
                '<div class="flex items-center justify-between mb-4">' +
                  '<div class="bg-purple-100 rounded-lg p-3">' +
                    '<i class="fas fa-calendar-week text-3xl text-purple-600"></i>' +
                  '</div>' +
                  '<div class="text-right">' +
                    '<div class="text-3xl font-bold text-purple-900">' + recent.submissions_last_7_days + '</div>' +
                    '<div class="text-sm text-gray-600">건</div>' +
                  '</div>' +
                '</div>' +
                '<div class="text-lg font-semibold text-gray-800">최근 7일 제출</div>' +
              '</div>' +
              
              '<div class="stat-card bg-white rounded-xl shadow-lg p-6 border-2 border-orange-200">' +
                '<div class="flex items-center justify-between mb-4">' +
                  '<div class="bg-orange-100 rounded-lg p-3">' +
                    '<i class="fas fa-tasks text-3xl text-orange-600"></i>' +
                  '</div>' +
                  '<div class="text-right">' +
                    '<div class="text-3xl font-bold text-orange-900">' + overview.total_assignments + '</div>' +
                    '<div class="text-sm text-gray-600">개</div>' +
                  '</div>' +
                '</div>' +
                '<div class="text-lg font-semibold text-gray-800">전체 과제</div>' +
              '</div>';
            
            // Build subscription statistics HTML (NEW)
            let subscriptionStatsHTML = '';
            if (data.subscription_stats && data.subscription_stats.length > 0) {
              console.log('[DEBUG] Building subscription stats HTML...');
              const colors = {
                '무료': { bg: 'from-gray-400 to-gray-500', icon: 'fa-gift' },
                '스타터': { bg: 'from-blue-400 to-blue-500', icon: 'fa-rocket' },
                '베이직': { bg: 'from-indigo-400 to-indigo-500', icon: 'fa-star' },
                '프로': { bg: 'from-yellow-400 to-yellow-500', icon: 'fa-crown' }
              };
              
              const subStatsCards = data.subscription_stats.map(stat => {
                const color = colors[stat.subscription] || colors['무료'];
                return '<div class="stat-card bg-gradient-to-br ' + color.bg + ' rounded-xl shadow-lg p-6 text-white">' +
                  '<div class="flex items-center justify-between mb-4">' +
                    '<div class="bg-white/20 rounded-lg p-3">' +
                      '<i class="fas ' + color.icon + ' text-3xl"></i>' +
                    '</div>' +
                    '<div class="text-right">' +
                      '<div class="text-3xl font-bold">' + stat.count + '</div>' +
                      '<div class="text-sm opacity-90">명</div>' +
                    '</div>' +
                  '</div>' +
                  '<div class="text-lg font-semibold">' + stat.subscription + ' 플랜</div>' +
                '</div>';
              }).join('');
              
              subscriptionStatsHTML = 
                '<div class="col-span-full mt-8 mb-4">' +
                  '<h3 class="text-lg font-bold text-gray-900 mb-4">' +
                    '<i class="fas fa-crown text-yellow-500 mr-2"></i>' +
                    '구독 플랜 통계' +
                  '</h3>' +
                  '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">' +
                    subStatsCards +
                  '</div>' +
                '</div>';
              console.log('[DEBUG] subscriptionStatsHTML generated:', subscriptionStatsHTML);
            }
            
            // Set the complete HTML
            document.getElementById('statsOverview').innerHTML = mainStatsHTML + subscriptionStatsHTML;

            document.getElementById('statsOverview').innerHTML = \`
              <div class="stat-card bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                <div class="flex items-center justify-between mb-4">
                  <div class="bg-white/20 rounded-lg p-3">
                    <i class="fas fa-chalkboard-teacher text-3xl"></i>
                  </div>
                  <div class="text-right">
                    <div class="text-3xl font-bold">\${overview.total_teachers}</div>
                    <div class="text-sm opacity-90">명</div>
                  </div>
                </div>
                <div class="text-lg font-semibold">전체 교사</div>
              </div>

              <div class="stat-card bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                <div class="flex items-center justify-between mb-4">
                  <div class="bg-white/20 rounded-lg p-3">
                    <i class="fas fa-user-graduate text-3xl"></i>
                  </div>
                  <div class="text-right">
                    <div class="text-3xl font-bold">\${overview.total_students}</div>
                    <div class="text-sm opacity-90">명</div>
                  </div>
                </div>
                <div class="text-lg font-semibold">전체 학생</div>
              </div>

              <div class="stat-card bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                <div class="flex items-center justify-between mb-4">
                  <div class="bg-white/20 rounded-lg p-3">
                    <i class="fas fa-file-alt text-3xl"></i>
                  </div>
                  <div class="text-right">
                    <div class="text-3xl font-bold">\${overview.total_submissions}</div>
                    <div class="text-sm opacity-90">건</div>
                  </div>
                </div>
                <div class="text-lg font-semibold">전체 제출물</div>
              </div>

              <div class="stat-card bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
                <div class="flex items-center justify-between mb-4">
                  <div class="bg-white/20 rounded-lg p-3">
                    <i class="fas fa-check-circle text-3xl"></i>
                  </div>
                  <div class="text-right">
                    <div class="text-3xl font-bold">\${overview.graded_submissions}</div>
                    <div class="text-sm opacity-90">건</div>
                  </div>
                </div>
                <div class="text-lg font-semibold">채점 완료</div>
              </div>

              <div class="stat-card bg-white rounded-xl shadow-lg p-6 border-2 border-blue-200">
                <div class="flex items-center justify-between mb-4">
                  <div class="bg-blue-100 rounded-lg p-3">
                    <i class="fas fa-clock text-3xl text-blue-600"></i>
                  </div>
                  <div class="text-right">
                    <div class="text-3xl font-bold text-blue-900">\${overview.pending_submissions}</div>
                    <div class="text-sm text-gray-600">건</div>
                  </div>
                </div>
                <div class="text-lg font-semibold text-gray-800">채점 대기</div>
              </div>

              <div class="stat-card bg-white rounded-xl shadow-lg p-6 border-2 border-green-200">
                <div class="flex items-center justify-between mb-4">
                  <div class="bg-green-100 rounded-lg p-3">
                    <i class="fas fa-chart-line text-3xl text-green-600"></i>
                  </div>
                  <div class="text-right">
                    <div class="text-3xl font-bold text-green-900">\${overview.average_score.toFixed(1)}</div>
                    <div class="text-sm text-gray-600">점</div>
                  </div>
                </div>
                <div class="text-lg font-semibold text-gray-800">평균 점수</div>
              </div>

              <div class="stat-card bg-white rounded-xl shadow-lg p-6 border-2 border-purple-200">
                <div class="flex items-center justify-between mb-4">
                  <div class="bg-purple-100 rounded-lg p-3">
                    <i class="fas fa-calendar-week text-3xl text-purple-600"></i>
                  </div>
                  <div class="text-right">
                    <div class="text-3xl font-bold text-purple-900">\${recent.submissions_last_7_days}</div>
                    <div class="text-sm text-gray-600">건</div>
                  </div>
                </div>
                <div class="text-lg font-semibold text-gray-800">최근 7일 제출</div>
              </div>

              <div class="stat-card bg-white rounded-xl shadow-lg p-6 border-2 border-orange-200">
                <div class="flex items-center justify-between mb-4">
                  <div class="bg-orange-100 rounded-lg p-3">
                    <i class="fas fa-tasks text-3xl text-orange-600"></i>
                  </div>
                  <div class="text-right">
                    <div class="text-3xl font-bold text-orange-900">\${overview.total_assignments}</div>
                    <div class="text-sm text-gray-600">개</div>
                  </div>
                </div>
                <div class="text-lg font-semibold text-gray-800">전체 과제</div>
              </div>
            \` + subscriptionStatsHTML;
            
            // Display top teachers
            if (data.top_teachers.length > 0) {
              document.getElementById('topTeachers').innerHTML = data.top_teachers.map((t, idx) => \`
                <div class="flex items-center justify-between bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition">
                  <div class="flex items-center space-x-4">
                    <div class="bg-yellow-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
                      \${idx + 1}
                    </div>
                    <div>
                      <div class="font-semibold text-gray-900">\${t.name}</div>
                      <div class="text-sm text-gray-600">\${t.email}</div>
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-xl font-bold text-blue-600">\${t.submission_count}</div>
                    <div class="text-xs text-gray-500">제출물</div>
                  </div>
                </div>
              \`).join('');
            } else {
              document.getElementById('topTeachers').innerHTML = '<p class="text-gray-500">데이터가 없습니다</p>';
            }

            // Display active students
            if (data.active_students.length > 0) {
              document.getElementById('activeStudents').innerHTML = data.active_students.map((s, idx) => \`
                <div class="flex items-center justify-between bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition">
                  <div class="flex items-center space-x-4">
                    <div class="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
                      \${idx + 1}
                    </div>
                    <div>
                      <div class="font-semibold text-gray-900">\${s.name}</div>
                      <div class="text-sm text-gray-600">\${s.email} • \${s.grade_level}</div>
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-xl font-bold text-green-600">\${s.submission_count}</div>
                    <div class="text-xs text-gray-500">제출물</div>
                  </div>
                </div>
              \`).join('');
            } else {
              document.getElementById('activeStudents').innerHTML = '<p class="text-gray-500">데이터가 없습니다</p>';
            }
          }

          async function loadRecentActivity() {
            try {
              const response = await axios.get('/api/admin/recent-activity');
              const activities = response.data.activity || [];

              if (activities.length === 0) {
                document.getElementById('recentActivity').innerHTML = \`
                  <div class="text-center py-12">
                    <i class="fas fa-inbox text-6xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">최근 활동이 없습니다</p>
                  </div>
                \`;
                return;
              }

              document.getElementById('recentActivity').innerHTML = \`
                <div class="space-y-3">
                  \${activities.map(act => \`
                    <div class="flex items-center justify-between bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition">
                      <div class="flex items-center space-x-4">
                        <div class="\${act.status === 'graded' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'} rounded-lg p-3">
                          <i class="fas \${act.status === 'graded' ? 'fa-check-circle' : 'fa-clock'} text-xl"></i>
                        </div>
                        <div>
                          <div class="font-semibold text-gray-900">\${act.student_name}의 제출물</div>
                          <div class="text-sm text-gray-600">
                            <span class="font-medium">\${act.assignment_title}</span>
                          </div>
                        </div>
                      </div>
                      <div class="text-right">
                        <div class="text-sm font-medium \${act.status === 'graded' ? 'text-green-600' : 'text-yellow-600'}">
                          \${act.status === 'graded' ? '채점 완료' : '채점 대기'}
                        </div>
                        <div class="text-xs text-gray-500">
                          \${new Date(act.created_at).toLocaleString('ko-KR')}
                        </div>
                      </div>
                    </div>
                  \`).join('')}
                </div>
              \`;
            } catch (error) {
              console.error('Error loading activity:', error);
              document.getElementById('recentActivity').innerHTML = \`
                <p class="text-red-600">활동 내역을 불러오는 데 실패했습니다</p>
              \`;
            }
          }

          // Update user subscription plan
          async function updateSubscription(userId, newPlan) {
            try {
              const response = await axios.put('/api/admin/users/' + userId + '/subscription', {
                subscription: newPlan
              });
              
              if (response.data.success) {
                // Show success message
                const select = document.querySelector('select[data-user-id="' + userId + '"]');
                const originalBg = select.className;
                select.className = originalBg.replace('bg-blue-600', 'bg-green-600');
                setTimeout(() => {
                  select.className = originalBg;
                }, 1000);
                
                // Reload stats to update subscription statistics
                loadStats();
              }
            } catch (error) {
              console.error('Error updating subscription:', error);
              alert('구독 플랜 업데이트에 실패했습니다');
              // Reload to reset the select
              loadUsers();
            }
          }

          async function loadUsers() {
            try {
              // Fetch users data
              const usersResponse = await axios.get('/api/admin/users');
              let { teachers, students } = usersResponse.data;

              // WORKAROUND: Fetch subscriptions separately and merge
              try {
                const subscriptionsResponse = await axios.get('/api/admin/users/subscriptions');
                const subscriptions = subscriptionsResponse.data;
                
                console.log('[DEBUG] Subscriptions fetched:', subscriptions);
                
                // Merge subscription data into teachers
                if (Array.isArray(subscriptions) && subscriptions.length > 0) {
                  const subscriptionMap = {};
                  subscriptions.forEach(sub => {
                    subscriptionMap[sub.id] = sub.subscription || '무료';
                  });
                  
                  teachers = teachers.map(t => ({
                    ...t,
                    subscription: subscriptionMap[t.id] || t.subscription || '무료'
                  }));
                  
                  console.log('[DEBUG] Teachers after merge:', teachers);
                }
              } catch (subError) {
                console.error('[ERROR] Failed to fetch subscriptions:', subError);
                // Default to '무료' if subscription fetch fails
                teachers = teachers.map(t => ({
                  ...t,
                  subscription: t.subscription || '무료'
                }));
              }

              // Display teachers
              if (teachers.length > 0) {
                document.getElementById('teachersList').innerHTML = \`
                  <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                      <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이메일</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">구독 중인 요금제</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">과제</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">제출물</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">가입일</th>
                      </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                      \${teachers.map(t => \`
                        <tr class="hover:bg-gray-50">
                          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">\${t.name}</td>
                          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">\${t.email}</td>
                          <td class="px-6 py-4 whitespace-nowrap">
                            <select 
                              class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white border-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                              onchange="updateSubscription(\${t.id}, this.value)"
                              data-user-id="\${t.id}"
                            >
                              <option value="무료" \${t.subscription === '무료' ? 'selected' : ''}>무료</option>
                              <option value="스타터" \${t.subscription === '스타터' ? 'selected' : ''}>스타터</option>
                              <option value="베이직" \${t.subscription === '베이직' ? 'selected' : ''}>베이직</option>
                              <option value="프로" \${t.subscription === '프로' ? 'selected' : ''}>프로</option>
                            </select>
                          </td>
                          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">\${t.assignment_count || 0}</td>
                          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">\${t.submission_count || 0}</td>
                          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            \${new Date(t.created_at).toLocaleDateString('ko-KR')}
                          </td>
                        </tr>
                      \`).join('')}
                    </tbody>
                  </table>
                \`;
              } else {
                document.getElementById('teachersList').innerHTML = '<p class="text-gray-500">교사가 없습니다</p>';
              }

              // Display students
              if (students.length > 0) {
                document.getElementById('studentsList').innerHTML = \`
                  <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                      <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이메일</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">학년</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">제출물</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">가입일</th>
                      </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                      \${students.map(s => \`
                        <tr class="hover:bg-gray-50">
                          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">\${s.name}</td>
                          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">\${s.email}</td>
                          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">\${s.grade_level || '-'}</td>
                          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">\${s.submission_count || 0}</td>
                          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            \${new Date(s.created_at).toLocaleDateString('ko-KR')}
                          </td>
                        </tr>
                      \`).join('')}
                    </tbody>
                  </table>
                \`;
              } else {
                document.getElementById('studentsList').innerHTML = '<p class="text-gray-500">학생이 없습니다</p>';
              }
            } catch (error) {
              console.error('Error loading users:', error);
              document.getElementById('teachersList').innerHTML = '<p class="text-red-600">사용자 정보를 불러오는 데 실패했습니다</p>';
              document.getElementById('studentsList').innerHTML = '<p class="text-red-600">사용자 정보를 불러오는 데 실패했습니다</p>';
            }
          }

          // Update subscription plan
          async function updateSubscription(userId, newPlan) {
            try {
              const response = await axios.put(\`/api/admin/users/\${userId}/subscription\`, {
                subscription: newPlan
              });

              if (response.data.success) {
                // Show success message
                const message = document.createElement('div');
                message.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
                message.innerHTML = \`
                  <i class="fas fa-check-circle mr-2"></i>
                  구독 플랜이 '\${newPlan}'(으)로 변경되었습니다
                \`;
                document.body.appendChild(message);

                setTimeout(() => {
                  message.remove();
                }, 3000);

                // Reload stats to update subscription statistics
                loadStats();
              }
            } catch (error) {
              console.error('Error updating subscription:', error);
              alert('구독 플랜 변경에 실패했습니다');
              // Reload users to revert the dropdown
              loadUsers();
            }
          }

          // Filter teachers by subscription
          function filterTeachers(subscription) {
            const rows = document.querySelectorAll('#teachersList tbody tr');
            rows.forEach(row => {
              if (subscription === 'all') {
                row.style.display = '';
              } else {
                const select = row.querySelector('select');
                if (select && select.value === subscription) {
                  row.style.display = '';
                } else {
                  row.style.display = 'none';
                }
              }
            });
          }

          function switchTab(tabName) {
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(tab => {
              tab.classList.add('hidden');
            });

            // Remove active class from all buttons
            document.querySelectorAll('.tab-button').forEach(btn => {
              btn.classList.remove('active');
              btn.classList.add('text-gray-600');
            });

            // Show selected tab
            document.getElementById(\`content-\${tabName}\`).classList.remove('hidden');
            const activeBtn = document.getElementById(\`tab-\${tabName}\`);
            activeBtn.classList.add('active');
            activeBtn.classList.remove('text-gray-600');

            // Load data if needed
            if (tabName === 'activity' && document.getElementById('recentActivity').innerHTML.includes('로딩')) {
              loadRecentActivity();
            } else if (tabName === 'users' && document.getElementById('teachersList').innerHTML.includes('로딩')) {
              loadUsers();
            } else if (tabName === 'analytics') {
              loadAnalytics();
            }
          }

          function loadAnalytics() {
            if (!statsData) return;

            const overview = statsData.overview;

            // Submission Status Chart
            const submissionCtx = document.getElementById('submissionChart').getContext('2d');
            new Chart(submissionCtx, {
              type: 'doughnut',
              data: {
                labels: ['채점 완료', '채점 대기'],
                datasets: [{
                  data: [overview.graded_submissions, overview.pending_submissions],
                  backgroundColor: ['#10b981', '#f59e0b']
                }]
              },
              options: {
                responsive: true,
                plugins: {
                  legend: {
                    position: 'bottom'
                  }
                }
              }
            });

            // Score Distribution Chart (dummy data for now)
            const scoreCtx = document.getElementById('scoreChart').getContext('2d');
            new Chart(scoreCtx, {
              type: 'bar',
              data: {
                labels: ['0-25%', '26-50%', '51-75%', '76-100%'],
                datasets: [{
                  label: '학생 수',
                  data: [12, 35, 68, 45],
                  backgroundColor: '#3b82f6'
                }]
              },
              options: {
                responsive: true,
                plugins: {
                  legend: {
                    display: false
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true
                  }
                }
              }
            });
          }

          // Initial load
          loadStats();
        </script>
    </body>
    </html>
  `)
})

// Admin CMS Page - Resource Management
app.get('/admin/cms', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>관리자 페이지 | AI 논술 평가</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js"></script>
        
        <!-- Quill Rich Text Editor -->
        <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
        <script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>
        
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
                            <option value="exam">기출 문제</option>
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
                        <!-- Quill Rich Text Editor -->
                        <div id="editor-container" style="height: 400px; background: white;"></div>
                        <input type="hidden" id="content" required>
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
            <div class="grid md:grid-cols-3 gap-6">
                <!-- Rubric Posts -->
                <div>
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">
                        <i class="fas fa-clipboard-list text-navy-700 mr-2"></i>루브릭
                    </h2>
                    <div id="rubricPosts" class="space-y-4">
                        <p class="text-gray-500 text-center py-4">불러오는 중...</p>
                    </div>
                </div>
                
                <!-- Exam Posts -->
                <div>
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">
                        <i class="fas fa-file-alt text-navy-700 mr-2"></i>기출 문제
                    </h2>
                    <div id="examPosts" class="space-y-4">
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
          // Initialize Quill Rich Text Editor
          let quillEditor = null;
          
          function initializeQuill() {
            if (quillEditor) {
              return; // Already initialized
            }
            
            quillEditor = new Quill('#editor-container', {
              theme: 'snow',
              modules: {
                toolbar: [
                  [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                  [{ 'size': ['small', false, 'large', 'huge'] }],
                  ['bold', 'italic', 'underline', 'strike'],
                  [{ 'color': [] }, { 'background': [] }],
                  [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                  [{ 'align': [] }],
                  ['link', 'image'],
                  ['clean']
                ]
              },
              placeholder: '자료 내용을 입력하세요...'
            });
            
            // Custom image handler for better UX
            quillEditor.getModule('toolbar').addHandler('image', function() {
              const input = document.createElement('input');
              input.setAttribute('type', 'file');
              input.setAttribute('accept', 'image/*');
              input.click();
              
              input.onchange = async () => {
                const file = input.files[0];
                if (file) {
                  // Check file size (max 5MB)
                  if (file.size > 5 * 1024 * 1024) {
                    alert('이미지 파일은 5MB 이하여야 합니다.');
                    return;
                  }
                  
                  // Convert to base64 for embedding
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    const range = quillEditor.getSelection(true);
                    quillEditor.insertEmbed(range.index, 'image', e.target.result);
                    quillEditor.setSelection(range.index + 1);
                  };
                  reader.readAsDataURL(file);
                }
              };
            });
          }
          
          async function loadAllPosts() {
            await loadPostsByCategory('rubric', 'rubricPosts');
            await loadPostsByCategory('exam', 'examPosts');
            await loadPostsByCategory('evaluation', 'evaluationPosts');
          }
          
          async function loadPostsByCategory(category, containerId) {
            try {
              // 루브릭의 경우 플랫폼 루브릭 표시
              if (category === 'rubric') {
                const platformRubrics = [
                  { id: 'standard', title: '표준 논술 루브릭(4개 기준)', value: 'standard' },
                  { id: 'kr_elementary', title: '초등학생용 평가 기준', value: 'kr_elementary' },
                  { id: 'kr_middle', title: '중학생용 평가 기준', value: 'kr_middle' },
                  { id: 'kr_high', title: '고등학생용 평가 기준', value: 'kr_high' },
                  { id: 'nyregents', title: '뉴욕 주 리젠트 시험 논증적 글쓰기 루브릭', value: 'nyregents' },
                  { id: 'nyregents_analytical', title: '뉴욕 주 리젠트 시험 분석적 글쓰기 루브릭', value: 'nyregents_analytical' },
                  { id: 'ny_middle', title: '뉴욕 주 중학교 논술 루브릭', value: 'ny_middle' },
                  { id: 'ny_elementary', title: '뉴욕 주 초등학교 논술 루브릭', value: 'ny_elementary' },
                  { id: 'ib_myp_highschool', title: 'IB 중등 프로그램 고등학교 개인과 사회 논술 루브릭', value: 'ib_myp_highschool' },
                  { id: 'ib_myp_middleschool', title: 'IB 중등 프로그램 중학교 개인과 사회 논술 루브릭', value: 'ib_myp_middleschool' },
                  { id: 'ib_myp_science', title: 'IB 중등 프로그램 과학 논술 루브릭', value: 'ib_myp_science' }
                ];
                
                const container = document.getElementById(containerId);
                container.innerHTML = platformRubrics.map(rubric => \`
                  <div class="bg-white rounded-lg shadow hover:shadow-md transition">
                    <div class="p-4 flex items-center justify-between">
                      <div class="flex-1">
                        <h3 class="font-bold text-gray-900">\${rubric.title}</h3>
                        <p class="text-sm text-gray-500 mt-1">
                          <span>플랫폼 루브릭</span>
                        </p>
                      </div>
                      <div class="flex gap-2 ml-4">
                        <a href="/rubric-detail/\${rubric.value}" target="_blank" class="px-4 py-2 bg-navy-100 text-navy-800 rounded text-sm font-semibold hover:bg-navy-200 transition">
                          <i class="fas fa-eye mr-1"></i>상세보기
                        </a>
                      </div>
                    </div>
                  </div>
                \`).join('');
                return;
              }
              
              const response = await axios.get(\`/api/resources/\${category}\`);
              const posts = response.data;
              
              const container = document.getElementById(containerId);
              
              if (posts.length === 0) {
                container.innerHTML = '<p class="text-gray-500 text-center py-4">자료가 없습니다</p>';
                return;
              }
              
              container.innerHTML = posts.map(post => \`
                <div class="bg-white rounded-lg shadow hover:shadow-md transition">
                  <div class="p-4 flex items-center justify-between">
                    <div class="flex-1">
                      <h3 class="font-bold text-gray-900">\${post.title}</h3>
                      <p class="text-sm text-gray-500 mt-1">
                        <span>\${post.author || 'Admin'}</span>
                        <span class="mx-2">•</span>
                        <span>\${new Date(post.created_at).toLocaleDateString('ko-KR')}</span>
                      </p>
                    </div>
                    <div class="flex gap-2 ml-4">
                      \${category === 'exam' ? \`
                        <a href="\${post.file}" target="_blank" class="px-4 py-2 bg-navy-100 text-navy-800 rounded text-sm font-semibold hover:bg-navy-200 transition">
                          <i class="fas fa-file-pdf mr-1"></i>PDF 보기
                        </a>
                      \` : \`
                        <a href="/resource/\${post.id}" class="px-4 py-2 bg-navy-100 text-navy-800 rounded text-sm font-semibold hover:bg-navy-200 transition">
                          <i class="fas fa-eye mr-1"></i>보기
                        </a>
                        <button onclick="editPost(\${post.id})" class="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm font-semibold hover:bg-gray-200 transition">
                          <i class="fas fa-edit mr-1"></i>수정
                        </button>
                        <button onclick="deletePost(\${post.id})" class="px-4 py-2 bg-red-100 text-red-700 rounded text-sm font-semibold hover:bg-red-200 transition">
                          <i class="fas fa-trash mr-1"></i>삭제
                        </button>
                      \`}
                    </div>
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
            
            // Initialize Quill editor
            initializeQuill();
            quillEditor.setContents([]); // Clear editor content
          }
          
          function hideForm() {
            document.getElementById('resourceForm').classList.add('hidden');
          }
          
          async function handleSubmit(event) {
            event.preventDefault();
            
            const postId = document.getElementById('postId').value;
            const category = document.getElementById('category').value;
            const title = document.getElementById('title').value;
            const author = document.getElementById('author').value;
            
            // Get content from Quill editor
            const content = quillEditor.root.innerHTML;
            
            // Validate content
            if (!content || content.trim() === '<p><br></p>' || content.trim() === '') {
              alert('내용을 입력해 주세요.');
              return;
            }
            
            // Update hidden input for form validation
            document.getElementById('content').value = content;
            
            // Prevent creating/editing exam category (static files)
            if (category === 'exam') {
              alert('기출 문제는 정적 파일로 관리됩니다. PDF 파일을 직접 업로드하려면 관리자에게 문의하세요.');
              return;
            }
            
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
              document.getElementById('author').value = post.author || 'Admin';
              
              // Initialize Quill editor and load content
              initializeQuill();
              
              // Set HTML content in Quill editor
              quillEditor.root.innerHTML = post.content;
              
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

// Student Dashboard Page
app.get('/student/dashboard', (c) => {
  const html = `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>학생 대시보드 | AI 논술 평가</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
          // Storage fallback for Safari's tracking prevention
          function getStorageItem(key) {
            try {
              return localStorage.getItem(key) || sessionStorage.getItem(key);
            } catch (e) {
              console.warn('localStorage blocked, using sessionStorage:', e);
              return sessionStorage.getItem(key);
            }
          }
          
          function setStorageItem(key, value) {
            try {
              localStorage.setItem(key, value);
            } catch (e) {
              console.warn('localStorage blocked, using sessionStorage:', e);
              sessionStorage.setItem(key, value);
            }
          }
          
          function removeStorageItem(key) {
            try {
              localStorage.removeItem(key);
            } catch (e) {
              console.warn('localStorage blocked, using sessionStorage:', e);
            }
            sessionStorage.removeItem(key);
          }
          
          // Global variables
          let currentAccessCode = null;
          let currentAssignment = null;
          
          // Markdown to HTML conversion function
          function convertMarkdownToHtml(markdown) {
            if (!markdown) return '';
            try {
              const html = marked.parse(markdown);
              return DOMPurify.sanitize(html);
            } catch (error) {
              console.error('Markdown conversion error:', error);
              return markdown;
            }
          }
          
          // Display Assignment Function (MUST BE DEFINED BEFORE USAGE)
          window.displayAssignment = function(assignment) {
            console.log('[FRONTEND] === DISPLAY ASSIGNMENT CALLED ===');
            console.log('[FRONTEND] Assignment object:', assignment);
            
            try {
              // Set title
              const titleElement = document.getElementById('assignmentTitle');
              if (!titleElement) {
                console.error('[FRONTEND] assignmentTitle element not found!');
                throw new Error('assignmentTitle element not found');
              }
              titleElement.textContent = assignment.title;
              console.log('[FRONTEND] Title set:', assignment.title);
              
              // Set description
              const descElement = document.getElementById('assignmentDescription');
              if (!descElement) {
                console.error('[FRONTEND] assignmentDescription element not found!');
                throw new Error('assignmentDescription element not found');
              }
              descElement.textContent = assignment.description;
              console.log('[FRONTEND] Description set');
              
              // Clear rubrics list first
              const rubricsList = document.getElementById('rubricsList');
              if (!rubricsList) {
                console.error('[FRONTEND] rubricsList element not found!');
                throw new Error('rubricsList element not found');
              }
              rubricsList.innerHTML = '';
              
              // Display prompts if available
              if (assignment.prompts && assignment.prompts.length > 0) {
                console.log('[FRONTEND] Processing', assignment.prompts.length, 'prompts');
                
                // Create prompts container
                const promptsContainer = document.createElement('div');
                promptsContainer.className = 'mb-6';
                
                const promptsTitle = document.createElement('h3');
                promptsTitle.className = 'font-semibold text-gray-800 mb-2';
                promptsTitle.textContent = '\u{C81C}\u{C2DC}\u{BB38}:';
                promptsContainer.appendChild(promptsTitle);
                
                const promptsList = document.createElement('div');
                promptsList.className = 'space-y-3';
                
                assignment.prompts.forEach((prompt, idx) => {
                  const convertedPrompt = convertMarkdownToHtml(prompt);
                  
                  const promptItem = document.createElement('div');
                  promptItem.className = 'bg-blue-50 border border-blue-200 p-4 rounded-lg';
                  
                  const promptHeader = document.createElement('div');
                  promptHeader.className = 'font-semibold text-blue-900 mb-2';
                  promptHeader.textContent = '\u{C81C}\u{C2DC}\u{BB38} ' + (idx + 1);
                  
                  const promptContent = document.createElement('div');
                  promptContent.className = 'prose max-w-none text-gray-700';
                  promptContent.innerHTML = convertedPrompt;
                  
                  promptItem.appendChild(promptHeader);
                  promptItem.appendChild(promptContent);
                  promptsList.appendChild(promptItem);
                });
                
                promptsContainer.appendChild(promptsList);
                rubricsList.appendChild(promptsContainer);
              }
              console.log('[FRONTEND] Prompts processed');
              
              // Display rubrics
              assignment.rubrics.forEach((r, idx) => {
                const rubricItem = document.createElement('div');
                rubricItem.className = 'bg-gray-50 p-3 rounded-lg';
                
                const rubricName = document.createElement('span');
                rubricName.className = 'font-semibold text-blue-700';
                rubricName.textContent = (idx + 1) + '. ' + r.criterion_name;
                
                const rubricDesc = document.createElement('p');
                rubricDesc.className = 'text-sm text-gray-600 mt-1';
                rubricDesc.textContent = r.criterion_description;
                
                rubricItem.appendChild(rubricName);
                rubricItem.appendChild(rubricDesc);
                rubricsList.appendChild(rubricItem);
              });
              console.log('[FRONTEND] Rubrics list updated');
              
              // Show assignment details
              const detailsElement = document.getElementById('assignmentDetails');
              if (!detailsElement) {
                console.error('[FRONTEND] assignmentDetails element not found!');
                throw new Error('assignmentDetails element not found');
              }
              detailsElement.classList.remove('hidden');
              console.log('[FRONTEND] Assignment details shown');
              
              // Focus on essay text
              const essayText = document.getElementById('essayText');
              if (essayText) {
                essayText.focus();
                console.log('[FRONTEND] Essay text focused');
              } else {
                console.warn('[FRONTEND] essayText element not found');
              }
              
              console.log('[FRONTEND] === DISPLAY ASSIGNMENT COMPLETED ===');
            } catch (error) {
              console.error('[FRONTEND] Error in displayAssignment:', error);
              alert('과제를 표시하는 중 오류가 발생했습니다: ' + error.message);
              throw error;
            }
          };
          
          // Access Code Handler
          window.handleAccessCode = async function(event) {
            try {
              console.log('[FRONTEND] === ACCESS CODE CHECK STARTED ===');
              if (event && event.preventDefault) {
                event.preventDefault();
              }
              
              const accessCodeInput = document.getElementById('accessCode');
              if (!accessCodeInput) {
                console.error('[FRONTEND] accessCode input element not found!');
                alert('액세스 코드 입력 필드를 찾을 수 없습니다. 페이지를 새로고침해 주세요.');
                return;
              }
              
              const accessCode = accessCodeInput.value;
              const sessionId = getStorageItem('student_session_id');
              
              console.log('[FRONTEND] Access Code:', accessCode);
              console.log('[FRONTEND] Session ID:', sessionId);
              
              if (!accessCode || accessCode.length !== 6) {
                alert('6자리 액세스 코드를 입력해 주세요');
                return;
              }
              
              console.log('[FRONTEND] Fetching assignment from:', '/api/assignment/code/' + accessCode);
              
              const response = await axios.get('/api/assignment/code/' + accessCode);
              
              console.log('[FRONTEND] Full response object:', response);
              console.log('[FRONTEND] Response status:', response.status);
              console.log('[FRONTEND] Response data:', response.data);
              console.log('[FRONTEND] Response data type:', typeof response.data);
              
              if (!response.data) {
                console.error('[FRONTEND] Response data is empty!');
                alert('서버에서 빈 응답을 받았습니다. 관리자에게 문의하세요.');
                return;
              }
              
              console.log('[FRONTEND] Assignment received:', response.data);
              
              currentAccessCode = accessCode;
              currentAssignment = response.data;
              
              window.displayAssignment(response.data);
              console.log('[FRONTEND] Assignment displayed successfully');
            } catch (error) {
              console.error('[FRONTEND] Access code error:', error);
              console.error('[FRONTEND] Error response:', error.response);
              console.error('[FRONTEND] Error stack:', error.stack);
              alert('과제를 찾을 수 없습니다: ' + (error.response?.data?.error || error.message));
            }
          };
          
          // Submit Handler
          window.handleSubmit = async function() {
            console.log('[FRONTEND] === SUBMIT BUTTON CLICKED ===');
            const essayText = document.getElementById('essayText').value.trim();
            console.log('[FRONTEND] Essay text length:', essayText.length);
            
            if (!essayText) {
              alert('답안을 작성해 주세요');
              return;
            }
            
            if (!currentAccessCode) {
              alert('과제 액세스 코드를 먼저 입력해 주세요');
              return;
            }
            
            const sessionId = getStorageItem('student_session_id');
            console.log('[FRONTEND] Session ID:', sessionId);
            console.log('[FRONTEND] Access Code:', currentAccessCode);
            
            if (!sessionId) {
              alert('세션이 만료되었습니다. 다시 로그인해 주세요.');
              window.location.href = '/student/login';
              return;
            }
            
            console.log('[FRONTEND] Sending POST request to /api/student/submit');
            
            try {
              const response = await axios.post('/api/student/submit', {
                accessCode: currentAccessCode,
                essayText: essayText
              }, {
                headers: { 'X-Student-Session-ID': sessionId }
              });
              
              console.log('[FRONTEND] Response received:', response.data);
              
              if (response.data.success) {
                const version = response.data.version;
                const isResubmission = response.data.is_resubmission;
                
                alert(isResubmission 
                  ? '답안이 재제출되었습니다! (버전 ' + version + ')'
                  : '답안이 제출되었습니다! 선생님의 채점을 기다려 주세요.');
                
                document.getElementById('essayText').value = '';
                document.getElementById('assignmentDetails').classList.add('hidden');
                document.getElementById('accessCode').value = '';
                currentAccessCode = null;
                currentAssignment = null;
                
                window.loadSubmissions();
              }
            } catch (error) {
              console.error('[FRONTEND] Submit error:', error);
              console.error('[FRONTEND] Error response:', error.response);
              console.error('[FRONTEND] Error data:', error.response?.data);
              
              const errorMsg = error.response?.data?.error || error.message;
              const debugInfo = error.response?.data?.debug || '';
              const parts = [String.fromCharCode(51228,52636,32,49892,54056,58), String.fromCharCode(32), errorMsg];
              if (debugInfo) { parts.push(String.fromCharCode(10,10,46356,48260,44536,32,51221,48372,58), String.fromCharCode(32), debugInfo); }
              parts.push(String.fromCharCode(10,10,45796,51020,32,49324,54637,51012,32,54869,51064,54644,51452,49464,50836,58,10,49,46,32,50529,49464,49828,32,53076,46300,44032,32,50732,48148,47480,51648,32,54869,51064,10,50,46,32,47196,44536,51064,32,49345,53468,32,54869,51064,10,51,46,32,51064,53552,45367,32,50672,44208,32,54869,51064));
              alert(parts.join(''));
            }
          };
          
          // Load Submissions
          window.loadSubmissions = async function() {
            const sessionId = getStorageItem('student_session_id');
            const submissionsList = document.getElementById('submissionsList');
            
            if (!sessionId) {
              submissionsList.innerHTML = '<p class="text-red-500 text-center py-8">로그인이 필요합니다</p>';
              return;
            }
            
            try {
              const response = await axios.get('/api/student/my-submissions', {
                headers: { 'X-Student-Session-ID': sessionId }
              });
              
              if (!response.data || !Array.isArray(response.data)) {
                submissionsList.innerHTML = '<p class="text-gray-500 text-center py-8">아직 제출한 답안이 없습니다</p>';
                return;
              }
              
              if (response.data.length === 0) {
                submissionsList.innerHTML = '<p class="text-gray-500 text-center py-8">아직 제출한 답안이 없습니다</p>';
                return;
              }
              
              const html = response.data.map(sub => {
                const submittedDate = new Date(sub.submitted_at).toLocaleString('ko-KR');
                const statusBadge = sub.total_score !== null 
                  ? '<span class="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">채점 완료: ' + sub.total_score + '점</span>'
                  : '<span class="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">채점 대기중</span>';
                
                const versionBadge = sub.is_resubmission 
                  ? '<span class="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs ml-2">버전 ' + sub.version + '</span>'
                  : '';
                
                return '<div class="border-b border-gray-200 last:border-0 py-4">' +
                  '<div class="flex justify-between items-start mb-2">' +
                  '<h3 class="font-semibold text-gray-900">' + sub.assignment_title + versionBadge + '</h3>' +
                  statusBadge +
                  '</div>' +
                  '<p class="text-sm text-gray-500">제출 시각: ' + submittedDate + '</p>' +
                  '</div>';
              }).join('');
              
              submissionsList.innerHTML = html;
            } catch (error) {
              console.error('[FRONTEND] Load submissions error:', error);
              submissionsList.innerHTML = '<p class="text-red-500 text-center py-8">제출물을 불러오는 데 실패했습니다</p>';
            }
          };
          
          // Profile Menu Toggle
          window.toggleProfileMenu = function() {
            console.log('[FRONTEND] === TOGGLE PROFILE MENU CALLED ===');
            const menu = document.getElementById('profileMenu');
            console.log('[FRONTEND] Profile menu element:', menu);
            if (menu) {
              const wasHidden = menu.classList.contains('hidden');
              menu.classList.toggle('hidden');
              console.log('[FRONTEND] Menu toggled. Was hidden:', wasHidden, 'Now hidden:', menu.classList.contains('hidden'));
            } else {
              console.error('[FRONTEND] Profile menu element not found!');
            }
          };
          
          // Logout Handler
          window.handleLogout = function() {
            removeStorageItem('student_session_id');
            removeStorageItem('student_name');
            window.location.href = '/student/login';
          };
        </script>
        <style>
          .prose img {
            max-width: 100%;
            height: auto;
            margin: 16px 0;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            display: block;
          }
          .prose p {
            margin: 8px 0;
            line-height: 1.6;
          }
        </style>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16 items-center">
                    <div class="flex items-center">
                        <a href="/" class="text-2xl font-bold text-blue-900 hover:text-blue-700">
                            <i class="fas fa-graduation-cap mr-2"></i>AI 논술 평가
                        </a>
                    </div>
                    <div class="flex items-center space-x-4">
                        <!-- User Profile Dropdown -->
                        <div class="relative">
                            <button id="profileButton" onclick="toggleProfileMenu()" class="flex items-center space-x-2 text-gray-700 hover:text-blue-700 font-medium">
                                <i class="fas fa-user-circle text-2xl"></i>
                                <span id="studentName"></span>
                                <i class="fas fa-chevron-down text-sm"></i>
                            </button>
                            
                            <!-- Dropdown Menu -->
                            <div id="profileMenu" class="hidden absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                                <a href="/student/account" class="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                                    <i class="fas fa-user-cog mr-2"></i>내 계정
                                </a>
                                <a href="/student/subscription" class="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                                    <i class="fas fa-crown mr-2"></i>내 요금제
                                </a>
                                <a href="/student/billing" class="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                                    <i class="fas fa-credit-card mr-2"></i>구독 결제 관리
                                </a>
                                <div class="border-t border-gray-200 my-2"></div>
                                <button onclick="handleLogout()" class="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 font-medium">
                                    <i class="fas fa-sign-out-alt mr-2"></i>로그아웃
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Access Code Input Section -->
            <div class="bg-white rounded-xl shadow-lg p-8 mb-8">
                <h2 class="text-2xl font-bold text-gray-900 mb-4">
                    <i class="fas fa-key text-blue-600 mr-2"></i>과제 액세스 코드 입력
                </h2>
                <p class="text-gray-600 mb-6">선생님께서 제공한 6자리 액세스 코드를 입력하세요</p>
                <div class="flex gap-4">
                    <input 
                        id="accessCode" 
                        type="text" 
                        maxlength="6" 
                        pattern="[0-9]{6}"
                        class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-mono"
                        placeholder="예: 123456"
                    />
                    <button 
                        onclick="handleAccessCode(event)" 
                        type="button"
                        class="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition">
                        과제 확인
                    </button>
                </div>
            </div>

            <!-- Assignment Details (hidden by default) -->
            <div id="assignmentDetails" class="hidden bg-white rounded-xl shadow-lg p-8 mb-8">
                <h2 class="text-2xl font-bold text-gray-900 mb-4" id="assignmentTitle"></h2>
                <p class="text-gray-700 mb-4" id="assignmentDescription"></p>
                <div class="mb-6">
                    <h3 class="font-semibold text-gray-800 mb-2">평가 기준:</h3>
                    <div id="rubricsList" class="space-y-2"></div>
                </div>
                
                <!-- Essay Input -->
                <div class="mb-6">
                    <label class="block text-lg font-semibold text-gray-800 mb-2">
                        답안 작성
                    </label>
                    <textarea 
                        id="essayText" 
                        rows="12" 
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="여기에 답안을 작성하세요..."
                    ></textarea>
                </div>
                
                <button 
                    onclick="handleSubmit()" 
                    class="w-full px-8 py-4 bg-green-600 text-white rounded-lg font-bold text-lg hover:bg-green-700 transition">
                    <i class="fas fa-paper-plane mr-2"></i>답안 제출하기
                </button>
            </div>

            <!-- My Submissions Section -->
            <div class="bg-white rounded-xl shadow-lg p-8">
                <h2 class="text-2xl font-bold text-gray-900 mb-6">
                    <i class="fas fa-history text-blue-600 mr-2"></i>나의 제출물
                </h2>
                <div id="submissionsList">
                    <p class="text-gray-500 text-center py-8">제출물을 불러오는 중...</p>
                </div>
            </div>
        </div>

        <script>
          // DOM loaded event handler (initialization only)
          window.addEventListener('DOMContentLoaded', () => {
            const sessionId = getStorageItem('student_session_id');
            const studentName = getStorageItem('student_name');
            
            if (!sessionId || !studentName) {
              alert('로그인이 필요합니다');
              window.location.href = '/student/login';
              return;
            }
            
            document.getElementById('studentName').textContent = studentName + ' 학생';
            window.loadSubmissions();
          });
          
          // Close profile menu when clicking outside
          document.addEventListener('click', function(event) {
            const profileButton = document.getElementById('profileButton');
            const profileMenu = document.getElementById('profileMenu');
            
            if (profileButton && profileMenu && 
                !profileButton.contains(event.target) && 
                !profileMenu.contains(event.target)) {
              profileMenu.classList.add('hidden');
            }
          });
        </script>

    </body>
    </html>
  `;
  
  return c.html(html);
})

// Student Feedback View Page
app.get('/student/feedback/:id', (c) => {
  const submissionId = c.req.param('id')
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>피드백 상세 | AI 논술 평가</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js"></script>
        <style>
          .score-circle {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: bold;
            color: white;
          }
          .score-1 { background-color: #ef4444; }
          .score-2 { background-color: #f59e0b; }
          .score-3 { background-color: #3b82f6; }
          .score-4 { background-color: #10b981; }
        </style>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16 items-center">
                    <div class="flex items-center">
                        <span class="text-2xl font-bold text-blue-900">
                            <i class="fas fa-graduation-cap mr-2"></i>AI 논술 평가 - 학생
                        </span>
                    </div>
                    <div class="flex items-center space-x-4">
                        <a href="/student/dashboard" class="text-gray-700 hover:text-blue-700 font-medium">
                            <i class="fas fa-arrow-left mr-1"></i>대시보드로
                        </a>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div id="feedbackContent">
                <p class="text-gray-500 text-center py-8">피드백을 불러오는 중...</p>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
          const submissionId = ${submissionId};
          
          window.addEventListener('DOMContentLoaded', () => {
            const sessionId = getStorageItem('student_session_id');
            if (!sessionId) {
              alert('로그인이 필요합니다');
              window.location.href = '/student/login';
              return;
            }
            
            loadFeedback();
          });
          
          async function loadFeedback() {
            const sessionId = getStorageItem('student_session_id');
            
            try {
              const response = await axios.get(\`/api/student/submission/\${submissionId}/feedback\`, {
                headers: { 'X-Student-Session-ID': sessionId }
              });
              
              const { criterion_feedbacks, summary } = response.data;
              displayFeedback(criterion_feedbacks, summary);
            } catch (error) {
              console.error('Error loading feedback:', error);
              document.getElementById('feedbackContent').innerHTML = \`
                <div class="text-center py-8 text-red-600">
                  <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                  <p>피드백을 불러오는 데 실패했습니다</p>
                </div>
              \`;
            }
          }
          
          function displayFeedback(feedbacks, summary) {
            const container = document.getElementById('feedbackContent');
            
            container.innerHTML = \`
              <!-- Overall Summary Card -->
              <div class="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg p-8 mb-8 text-white">
                <div class="flex items-center justify-between mb-6">
                  <h1 class="text-3xl font-bold">전체 평가 결과</h1>
                  <div class="text-6xl font-bold">\${summary.total_score}점</div>
                </div>
                <p class="text-lg mb-4">\${summary.overall_comment}</p>
                
                <div class="grid md:grid-cols-2 gap-4 mt-6">
                  <div class="bg-white/20 backdrop-blur rounded-lg p-4">
                    <div class="flex items-center mb-2">
                      <i class="fas fa-thumbs-up text-2xl mr-2"></i>
                      <h3 class="font-bold text-lg">강점</h3>
                    </div>
                    <p>\${summary.strengths}</p>
                  </div>
                  
                  <div class="bg-white/20 backdrop-blur rounded-lg p-4">
                    <div class="flex items-center mb-2">
                      <i class="fas fa-lightbulb text-2xl mr-2"></i>
                      <h3 class="font-bold text-lg">보완할 점</h3>
                    </div>
                    <p>\${summary.weaknesses}</p>
                  </div>
                </div>
                
                <div class="mt-4 bg-yellow-400/30 rounded-lg p-4">
                  <h3 class="font-bold mb-2"><i class="fas fa-star mr-2"></i>우선 개선 사항</h3>
                  <p>\${summary.improvement_priority}</p>
                </div>
              </div>
              
              <!-- Criterion-by-Criterion Feedback -->
              <div class="space-y-6">
                <h2 class="text-2xl font-bold text-gray-900 mb-4">
                  <i class="fas fa-clipboard-list text-blue-600 mr-2"></i>기준별 상세 피드백
                </h2>
                
                \${feedbacks.map((fb, idx) => \`
                  <div class="bg-white rounded-xl shadow-lg p-6">
                    <div class="flex items-start justify-between mb-4">
                      <div class="flex-1">
                        <h3 class="text-xl font-bold text-gray-900 mb-1">\${fb.criterion_name}</h3>
                        <p class="text-sm text-gray-600">\${fb.criterion_description}</p>
                      </div>
                      <div class="score-circle score-\${fb.score} ml-4">
                        \${fb.score}
                      </div>
                    </div>
                    
                    <div class="space-y-4">
                      <div class="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                        <div class="flex items-center mb-2">
                          <i class="fas fa-check-circle text-green-600 mr-2"></i>
                          <h4 class="font-semibold text-green-800">잘한 점</h4>
                        </div>
                        <p class="text-gray-700">\${fb.positive_feedback}</p>
                      </div>
                      
                      <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                        <div class="flex items-center mb-2">
                          <i class="fas fa-exclamation-circle text-yellow-600 mr-2"></i>
                          <h4 class="font-semibold text-yellow-800">개선이 필요한 부분</h4>
                        </div>
                        <p class="text-gray-700">\${fb.improvement_areas}</p>
                      </div>
                      
                      <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                        <div class="flex items-center mb-2">
                          <i class="fas fa-lightbulb text-blue-600 mr-2"></i>
                          <h4 class="font-semibold text-blue-800">구체적인 개선 방법</h4>
                        </div>
                        <div class="text-gray-700 whitespace-pre-line">\${fb.specific_suggestions}</div>
                      </div>
                    </div>
                  </div>
                \`).join('')}
              </div>
              
              <!-- Action Buttons -->
              <div class="mt-8 flex gap-4">
                <a href="/student/dashboard" 
                   class="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold text-center hover:bg-gray-300 transition">
                  <i class="fas fa-arrow-left mr-2"></i>대시보드로
                </a>
                <button onclick="window.print()" 
                        class="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition">
                  <i class="fas fa-print mr-2"></i>인쇄하기
                </button>
              </div>
            \`;
          }
        </script>
    </body>
    </html>
  `)
})

export default app
