import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import type { Bindings } from '../types'
import { asyncHandler } from '../middleware/error'
import { hashPassword, verifyPassword } from '../utils/helpers'
import { sendEmail } from '../utils/email'
import { 
  userSignupSchema, 
  userLoginSchema,
  validate 
} from '../utils/validation'

const auth = new Hono<{ Bindings: Bindings }>()

/**
 * POST /api/auth/signup - User signup (SECURITY ENHANCED with Zod validation)
 */
auth.post('/signup', asyncHandler(async (c) => {
  const body = await c.req.json()
  const db = c.env.DB
  
  // Zod validation - comprehensive input validation
  const validation = validate(userSignupSchema, body)
  if (!validation.success) {
    // Extract first error message for user-friendly display
    const firstError = Object.values(validation.errors)[0]?.[0] || '입력값 검증 실패'
    return c.json({ 
      error: firstError,
      details: validation.errors 
    }, 400)
  }
  
  const { name, email, password } = validation.data
  
  // Check if user already exists
  const existingUser = await db.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first()
  
  if (existingUser) {
    // Constant-time response to prevent user enumeration
    await new Promise(resolve => setTimeout(resolve, 100))
    return c.json({ error: '이메일이 이미 등록되었거나 비밀번호가 올바르지 않습니다' }, 400)
  }
  
  // Hash password using bcrypt (12 rounds - OWASP recommended)
  const passwordHash = await hashPassword(password)
  
  // Insert new user
  const result = await db.prepare(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
  ).bind(name, email.toLowerCase(), passwordHash).run()
  
  // Create free subscription
  await db.prepare(
    'INSERT INTO subscriptions (user_id, plan_type, billing_cycle) VALUES (?, ?, ?)'
  ).bind(result.meta.last_row_id, 'free', 'monthly').run()
  
  // Log security event
  const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
  await db.prepare(
    'INSERT INTO security_logs (event_type, user_id, ip_address, details, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind('signup_success', result.meta.last_row_id, clientIP, JSON.stringify({ email: email.toLowerCase() }), new Date().toISOString()).run()
  
  return c.json({ 
    success: true, 
    user_id: result.meta.last_row_id,
    message: '회원가입이 완료되었습니다'
  })
}))

/**
 * POST /api/auth/login - User login (SECURITY ENHANCED with Zod validation)
 */
auth.post('/login', asyncHandler(async (c) => {
  const body = await c.req.json()
  const db = c.env.DB
  const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
  
  // Zod validation
  const validation = validate(userLoginSchema, body)
  if (!validation.success) {
    return c.json({ 
      error: '입력값 검증 실패', 
      details: validation.errors 
    }, 400)
  }
  
  const { email, password } = validation.data
  
  // Rate limiting check (simple implementation - use Redis in production)
  const recentAttempts = await db.prepare(
    'SELECT COUNT(*) as count FROM security_logs WHERE ip_address = ? AND event_type = ? AND created_at > datetime("now", "-15 minutes")'
  ).bind(clientIP, 'login_failure').first()
  
  if (recentAttempts && recentAttempts.count >= 5) {
    return c.json({ 
      error: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요' 
    }, 429)
  }
  
  // Find user
  const user = await db.prepare(
    'SELECT id, name, email, password_hash FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first()
  
  // Constant-time response preparation
  const startTime = Date.now()
  let isValid = false
  
  if (user) {
    // Verify password using bcrypt
    isValid = await verifyPassword(password, user.password_hash as string)
  } else {
    // Perform fake hash to prevent timing attacks
    await hashPassword(password)
  }
  
  // Ensure minimum response time to prevent timing attacks
  const elapsedTime = Date.now() - startTime
  if (elapsedTime < 100) {
    await new Promise(resolve => setTimeout(resolve, 100 - elapsedTime))
  }
  
  if (!isValid || !user) {
    // Log failed login attempt
    await db.prepare(
      'INSERT INTO security_logs (event_type, user_id, ip_address, details, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind('login_failure', null, clientIP, JSON.stringify({ email: email.toLowerCase() }), new Date().toISOString()).run()
    
    return c.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' }, 401)
  }
  
  // Create session
  const sessionId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours (reduced from 7 days)
  const userAgent = c.req.header('User-Agent') || 'unknown'
  
  await db.prepare(
    'INSERT INTO sessions (id, user_id, ip_address, user_agent, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(sessionId, user.id, clientIP, userAgent, expiresAt.toISOString(), new Date().toISOString()).run()
  
  // Log successful login
  await db.prepare(
    'INSERT INTO security_logs (event_type, user_id, ip_address, details, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind('login_success', user.id, clientIP, JSON.stringify({ email: email.toLowerCase() }), new Date().toISOString()).run()
  
  // Set secure cookie (secure: false for local development)
  const isProduction = c.req.url.includes('pages.dev') || c.req.url.includes('https://')
  setCookie(c, 'session_id', sessionId, {
    httpOnly: true,        // Prevents JavaScript access (XSS protection)
    secure: isProduction,  // HTTPS only in production
    sameSite: 'Strict',    // CSRF protection
    maxAge: 24 * 60 * 60,  // 24 hours
    path: '/'
  })
  
  return c.json({
    success: true,
    session_id: sessionId,  // Include session_id for frontend compatibility
    user: {
      id: user.id,
      name: user.name,
      email: user.email
    }
  })
}))

/**
 * POST /api/auth/logout - User logout (SECURITY ENHANCED)
 */
auth.post('/logout', asyncHandler(async (c) => {
  const db = c.env.DB
  const sessionId = c.req.header('X-Session-ID') || c.req.cookie('session_id')
  const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
  
  if (sessionId) {
    // Get user ID before deleting session
    const session = await db.prepare(
      'SELECT user_id FROM sessions WHERE id = ?'
    ).bind(sessionId).first()
    
    // Delete session
    await db.prepare(
      'DELETE FROM sessions WHERE id = ?'
    ).bind(sessionId).run()
    
    // Log logout event
    if (session) {
      await db.prepare(
        'INSERT INTO security_logs (event_type, user_id, ip_address, details, created_at) VALUES (?, ?, ?, ?, ?)'
      ).bind('logout', session.user_id, clientIP, JSON.stringify({ session_id: sessionId }), new Date().toISOString()).run()
    }
  }
  
  // Delete cookie
  deleteCookie(c, 'session_id', {
    path: '/',
    secure: true,
    sameSite: 'Strict'
  })
  
  return c.json({ success: true, message: '로그아웃되었습니다' })
}))

/**
 * POST /api/student/auth/signup - Student signup (SECURITY ENHANCED with Zod validation)
 * Note: Using email-based student signup (access code removed for now)
 */
auth.post('/student/signup', asyncHandler(async (c) => {
  const body = await c.req.json()
  const db = c.env.DB
  const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
  
  // Zod validation
  const validation = validate(userSignupSchema, body)
  if (!validation.success) {
    // Extract first error message for user-friendly display
    const firstError = Object.values(validation.errors)[0]?.[0] || '입력값 검증 실패'
    return c.json({ 
      error: firstError,
      details: validation.errors 
    }, 400)
  }
  
  const { name, email, password } = validation.data
  const grade_level = body.grade_level || '고등' // Default to 고등
  
  // Check if student already exists
  const existingStudent = await db.prepare(
    'SELECT id FROM student_users WHERE email = ?'
  ).bind(email.toLowerCase()).first()
  
  if (existingStudent) {
    await new Promise(resolve => setTimeout(resolve, 100))
    return c.json({ error: '이미 등록된 이메일입니다' }, 400)
  }
  
  // Hash password using bcrypt
  const passwordHash = await hashPassword(password)
  
  // Insert new student
  const result = await db.prepare(
    'INSERT INTO student_users (name, email, password_hash, grade_level) VALUES (?, ?, ?, ?)'
  ).bind(name, email.toLowerCase(), passwordHash, grade_level).run()
  
  // Log security event
  await db.prepare(
    'INSERT INTO security_logs (event_type, user_id, ip_address, details, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind('student_signup_success', result.meta.last_row_id, clientIP, JSON.stringify({ email: email.toLowerCase(), type: 'student' }), new Date().toISOString()).run()
  
  return c.json({ 
    success: true, 
    student_id: result.meta.last_row_id,
    message: '학생 회원가입이 완료되었습니다'
  })
}))

/**
 * POST /api/student/auth/login - Student login (SECURITY ENHANCED with Zod validation)
 */
auth.post('/student/login', asyncHandler(async (c) => {
  const body = await c.req.json()
  const db = c.env.DB
  const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
  
  // Zod validation
  const validation = validate(userLoginSchema, body)
  if (!validation.success) {
    return c.json({ 
      error: '입력값 검증 실패', 
      details: validation.errors 
    }, 400)
  }
  
  const { email, password } = validation.data
  
  // Rate limiting check
  const recentAttempts = await db.prepare(
    'SELECT COUNT(*) as count FROM security_logs WHERE ip_address = ? AND event_type = ? AND created_at > datetime("now", "-15 minutes")'
  ).bind(clientIP, 'student_login_failure').first()
  
  if (recentAttempts && recentAttempts.count >= 5) {
    return c.json({ 
      error: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요' 
    }, 429)
  }
  
  // Find student
  const student = await db.prepare(
    'SELECT id, name, email, password_hash, grade_level FROM student_users WHERE email = ?'
  ).bind(email.toLowerCase()).first()
  
  // Constant-time response
  const startTime = Date.now()
  let isValid = false
  
  if (student) {
    isValid = await verifyPassword(password, student.password_hash as string)
  } else {
    await hashPassword(password)
  }
  
  const elapsedTime = Date.now() - startTime
  if (elapsedTime < 100) {
    await new Promise(resolve => setTimeout(resolve, 100 - elapsedTime))
  }
  
  if (!isValid || !student) {
    await db.prepare(
      'INSERT INTO security_logs (event_type, user_id, ip_address, details, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind('student_login_failure', null, clientIP, JSON.stringify({ email: email.toLowerCase(), type: 'student' }), new Date().toISOString()).run()
    
    return c.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' }, 401)
  }
  
  // Create session
  const sessionId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  const userAgent = c.req.header('User-Agent') || 'unknown'
  
  await db.prepare(
    'INSERT INTO student_sessions (id, student_id, ip_address, user_agent, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(sessionId, student.id, clientIP, userAgent, expiresAt.toISOString(), new Date().toISOString()).run()
  
  // Log successful login
  await db.prepare(
    'INSERT INTO security_logs (event_type, user_id, ip_address, details, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind('student_login_success', student.id, clientIP, JSON.stringify({ email: email.toLowerCase(), type: 'student' }), new Date().toISOString()).run()
  
  // Set secure cookie (secure: false for local development)
  const isProduction = c.req.url.includes('pages.dev') || c.req.url.includes('https://')
  setCookie(c, 'student_session_id', sessionId, {
    httpOnly: true,
    secure: isProduction,  // HTTPS only in production
    sameSite: 'Strict',
    maxAge: 24 * 60 * 60,
    path: '/'
  })
  
  return c.json({
    success: true,
    session_id: sessionId,  // Include session_id for frontend compatibility
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      grade_level: student.grade_level
    }
  })
}))

/**
 * OPTIONS /api/auth/forgot-password - CORS preflight
 */
auth.options('/forgot-password', (c) => {
  return c.text('', 204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  })
})

/**
 * POST /api/auth/forgot-password - Send password reset email
 */
auth.post('/forgot-password', asyncHandler(async (c) => {
  const { email } = await c.req.json()
  const db = c.env.DB
  
  if (!email || !email.includes('@')) {
    return c.json({ error: '올바른 이메일 주소를 입력해주세요.' }, 400)
  }
  
  // Find user by email
  const user = await db.prepare(
    'SELECT id, name, email FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first()
  
  // Always return success to prevent user enumeration
  if (!user) {
    // Simulate delay to prevent timing attacks
    await new Promise(resolve => setTimeout(resolve, 100))
    return c.json({ success: true, message: '비밀번호 재설정 링크가 이메일로 전송되었습니다.' })
  }
  
  // Generate reset token (valid for 1 hour)
  const resetToken = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
  
  // Store reset token in database
  await db.prepare(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at) 
     VALUES (?, ?, ?, ?)`
  ).bind(user.id, resetToken, expiresAt.toISOString(), new Date().toISOString()).run()
  
  // Get client info
  const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
  const requestTime = new Date().toLocaleString('ko-KR', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric', 
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })
  
  // Generate reset URL
  const resetUrl = `${new URL(c.req.url).origin}/reset-password?token=${resetToken}`
  
  // Email content (HTML format)
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1e3a8a; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
        .button { display: inline-block; background-color: #1e3a8a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .info { background-color: #e0e7ff; padding: 15px; border-left: 4px solid: #3b82f6; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Ai-Nonsool.kr 비밀번호 재설정</h1>
        </div>
        <div class="content">
          <p>친애하는 <strong>${user.name}</strong>님,</p>
          
          <p>Ai-Nonsool 계정 비밀번호를 재설정하려면 아래 버튼을 클릭하세요.</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">비밀번호 재설정하기</a>
          </div>
          
          <div class="info">
            <p><strong>참고로 알려드립니다:</strong></p>
            <p>• 사용자 이름: ${user.name}</p>
            <p>• 요청 시간: ${requestTime}</p>
            <p>• IP 주소: ${clientIP}</p>
          </div>
          
          <p>위 버튼을 클릭할 수 없는 경우, 아래 링크를 복사하여 브라우저에 붙여넣으세요:</p>
          <p style="word-break: break-all; background-color: #f3f4f6; padding: 10px; border-radius: 5px; font-size: 12px;">
            ${resetUrl}
          </p>
          
          <p style="color: #ef4444; font-weight: bold;">이 링크는 1시간 동안만 유효합니다.</p>
          
          <p>비밀번호 재설정을 요청하지 않으셨다면, 이 이메일을 무시하셔도 됩니다.</p>
        </div>
        <div class="footer">
          <p>궁금한 점이나 문의 사항이 있으시면 저희에게 연락해 주세요.</p>
          <p>감사합니다,<br><strong>AI 논술 팀</strong></p>
        </div>
      </div>
    </body>
    </html>
  `
  
  // Send email using Daum Smartwork SMTP
  try {
    const emailSent = await sendEmail({
      to: email,
      subject: 'Ai-Nonsool 비밀번호 재설정',
      html: emailHtml
    }, c.env)
    
    if (!emailSent) {
      console.error('Failed to send email, but returning success to prevent user enumeration')
    } else {
      console.log('Password reset email sent successfully to:', email)
    }
  } catch (error) {
    console.error('Email sending error:', error)
    // Continue anyway to prevent user enumeration
  }
  
  return c.json({ 
    success: true, 
    message: '비밀번호 재설정 링크가 이메일로 전송되었습니다.'
  })
}))

/**
 * OPTIONS /api/auth/validate-reset-token - CORS preflight
 */
auth.options('/validate-reset-token', (c) => {
  return c.text('', 204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  })
})

/**
 * POST /api/auth/validate-reset-token - Validate password reset token
 */
auth.post('/validate-reset-token', asyncHandler(async (c) => {
  const { token } = await c.req.json()
  const db = c.env.DB
  
  if (!token) {
    return c.json({ valid: false, error: '토큰이 필요합니다.' }, 400)
  }
  
  // Find valid reset token
  const resetRequest = await db.prepare(
    `SELECT user_id, expires_at FROM password_reset_tokens 
     WHERE token = ? AND used_at IS NULL`
  ).bind(token).first()
  
  if (!resetRequest) {
    return c.json({ valid: false, error: '유효하지 않은 토큰입니다.' })
  }
  
  // Check if token is expired
  if (new Date() > new Date(resetRequest.expires_at as string)) {
    return c.json({ valid: false, error: '토큰이 만료되었습니다.' })
  }
  
  return c.json({ valid: true })
}))

/**
 * OPTIONS /api/auth/reset-password - CORS preflight
 */
auth.options('/reset-password', (c) => {
  return c.text('', 204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  })
})

/**
 * POST /api/auth/reset-password - Reset password with token
 */
auth.post('/reset-password', asyncHandler(async (c) => {
  const { token, new_password } = await c.req.json()
  const db = c.env.DB
  
  if (!token || !new_password) {
    return c.json({ error: '토큰과 새 비밀번호를 입력해주세요.' }, 400)
  }
  
  if (new_password.length < 10) {
    return c.json({ error: '비밀번호는 최소 10자 이상이어야 합니다.' }, 400)
  }
  
  // Find valid reset token
  const resetRequest = await db.prepare(
    `SELECT user_id, expires_at FROM password_reset_tokens 
     WHERE token = ? AND used_at IS NULL`
  ).bind(token).first()
  
  if (!resetRequest) {
    return c.json({ error: '유효하지 않거나 만료된 토큰입니다.' }, 400)
  }
  
  // Check if token is expired
  if (new Date() > new Date(resetRequest.expires_at as string)) {
    return c.json({ error: '토큰이 만료되었습니다. 다시 요청해주세요.' }, 400)
  }
  
  // Hash new password
  const passwordHash = await hashPassword(new_password)
  
  // Update user password
  await db.prepare(
    'UPDATE users SET password_hash = ? WHERE id = ?'
  ).bind(passwordHash, resetRequest.user_id).run()
  
  // Mark token as used
  await db.prepare(
    'UPDATE password_reset_tokens SET used_at = ? WHERE token = ?'
  ).bind(new Date().toISOString(), token).run()
  
  // Log security event (using 'password_change' to match CHECK constraint)
  const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
  await db.prepare(
    'INSERT INTO security_logs (event_type, user_id, ip_address, details, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind('password_change', resetRequest.user_id, clientIP, JSON.stringify({ method: 'reset_token', token }), new Date().toISOString()).run()
  
  return c.json({ 
    success: true, 
    message: '비밀번호가 성공적으로 재설정되었습니다.' 
  })
}))

export default auth
