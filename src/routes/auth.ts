import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import type { Bindings } from '../types'
import { asyncHandler } from '../middleware/error'
import { hashPassword, verifyPassword } from '../utils/helpers'
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
    return c.json({ 
      error: '입력값 검증 실패', 
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
  
  // Set secure cookie
  setCookie(c, 'session_id', sessionId, {
    httpOnly: true,        // Prevents JavaScript access (XSS protection)
    secure: true,          // HTTPS only
    sameSite: 'Strict',    // CSRF protection
    maxAge: 24 * 60 * 60,  // 24 hours
    path: '/'
  })
  
  return c.json({
    success: true,
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
    return c.json({ 
      error: '입력값 검증 실패', 
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
  
  // Set secure cookie
  setCookie(c, 'student_session_id', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    maxAge: 24 * 60 * 60,
    path: '/'
  })
  
  return c.json({
    success: true,
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      grade_level: student.grade_level
    }
  })
}))

export default auth
