import { Hono } from 'hono'
import type { Bindings } from '../types'
import { asyncHandler } from '../middleware/error'
import { hashPassword } from '../utils/helpers'

const auth = new Hono<{ Bindings: Bindings }>()

/**
 * POST /api/auth/signup - User signup
 */
auth.post('/signup', asyncHandler(async (c) => {
  const { name, email, password } = await c.req.json()
  const db = c.env.DB
  
  // Check if user already exists
  const existingUser = await db.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first()
  
  if (existingUser) {
    return c.json({ error: 'Email already registered' }, 400)
  }
  
  // Hash password using btoa (simple encoding - should use bcrypt in production)
  const passwordHash = btoa(password)
  
  // Insert new user
  const result = await db.prepare(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
  ).bind(name, email, passwordHash).run()
  
  // Create free subscription
  await db.prepare(
    'INSERT INTO subscriptions (user_id, plan_type, billing_cycle) VALUES (?, ?, ?)'
  ).bind(result.meta.last_row_id, 'free', 'monthly').run()
  
  return c.json({ success: true, user_id: result.meta.last_row_id })
}))

/**
 * POST /api/auth/login - User login
 */
auth.post('/login', asyncHandler(async (c) => {
  const { email, password } = await c.req.json()
  const db = c.env.DB
  
  // Find user
  const user = await db.prepare(
    'SELECT id, name, email, password_hash FROM users WHERE email = ?'
  ).bind(email).first()
  
  if (!user) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }
  
  // Verify password (using btoa - should use bcrypt.compare in production)
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
}))

/**
 * POST /api/auth/logout - User logout
 */
auth.post('/logout', asyncHandler(async (c) => {
  const { session_id } = await c.req.json()
  const db = c.env.DB
  
  await db.prepare(
    'DELETE FROM sessions WHERE id = ?'
  ).bind(session_id).run()
  
  return c.json({ success: true })
}))

/**
 * POST /api/student/auth/signup - Student signup
 */
auth.post('/student/signup', asyncHandler(async (c) => {
  const { name, email, password, grade_level } = await c.req.json()
  const db = c.env.DB
  
  // Check if student already exists
  const existingStudent = await db.prepare(
    'SELECT id FROM student_users WHERE email = ?'
  ).bind(email).first()
  
  if (existingStudent) {
    return c.json({ error: '이미 등록된 이메일입니다' }, 400)
  }
  
  // Simple password hashing (use bcrypt in production)
  const passwordHash = btoa(password)
  
  // Insert new student
  const result = await db.prepare(
    'INSERT INTO student_users (name, email, password_hash, grade_level) VALUES (?, ?, ?, ?)'
  ).bind(name, email, passwordHash, grade_level).run()
  
  return c.json({ success: true, student_id: result.meta.last_row_id })
}))

/**
 * POST /api/student/auth/login - Student login
 */
auth.post('/student/login', asyncHandler(async (c) => {
  const { email, password } = await c.req.json()
  const db = c.env.DB
  
  // Find student
  const student = await db.prepare(
    'SELECT id, name, email, password_hash, grade_level FROM student_users WHERE email = ?'
  ).bind(email).first()
  
  if (!student) {
    return c.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' }, 401)
  }
  
  // Verify password
  const passwordHash = btoa(password)
  if (passwordHash !== student.password_hash) {
    return c.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' }, 401)
  }
  
  // Create session
  const sessionId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  
  await db.prepare(
    'INSERT INTO student_sessions (id, student_id, expires_at) VALUES (?, ?, ?)'
  ).bind(sessionId, student.id, expiresAt.toISOString()).run()
  
  return c.json({
    success: true,
    session_id: sessionId,
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      grade_level: student.grade_level
    }
  })
}))

export default auth
