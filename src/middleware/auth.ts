import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import type { Bindings } from '../types'

export interface User {
  id: number
  name: string
  email: string
  type?: 'teacher' | 'student'
  is_admin?: boolean
}

export interface Student {
  id: number
  name: string
  email: string
  type: 'student'
}

/**
 * Get user from session
 * Checks both Cookie (session_id) and Header (X-Session-ID)
 */
export async function getUserFromSession(c: Context<{ Bindings: Bindings }>): Promise<User | null> {
  // Try to get session ID from header first (for frontend compatibility), then from cookie
  let sessionId = c.req.header('X-Session-ID')
  if (!sessionId) {
    sessionId = getCookie(c, 'session_id')
  }
  if (!sessionId) return null
  
  const db = c.env.DB
  const session = await db.prepare(
    'SELECT s.*, u.id as user_id, u.name, u.email, u.is_admin FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.expires_at > datetime("now")'
  ).bind(sessionId).first()
  
  if (!session) return null
  
  return {
    id: session.user_id as number,
    name: session.name as string,
    email: session.email as string,
    type: 'teacher',
    is_admin: session.is_admin === 1
  }
}

/**
 * Get student from session
 * Checks both Cookie (student_session_id) and Header (X-Session-ID or X-Student-Session-ID)
 */
export async function getStudentFromSession(c: Context<{ Bindings: Bindings }>): Promise<Student | null> {
  // Try to get session ID from header first (for frontend compatibility), then from cookie
  let sessionId = c.req.header('X-Session-ID') || c.req.header('X-Student-Session-ID')
  if (!sessionId) {
    sessionId = getCookie(c, 'student_session_id')
  }
  if (!sessionId) return null
  
  const db = c.env.DB
  const session = await db.prepare(
    'SELECT s.*, st.id as student_id, st.name, st.email FROM student_sessions s JOIN student_users st ON s.student_id = st.id WHERE s.id = ? AND s.expires_at > datetime("now")'
  ).bind(sessionId).first()
  
  if (!session) return null
  
  return {
    id: session.student_id as number,
    name: session.name as string,
    email: session.email as string,
    type: 'student'
  }
}

/**
 * Require authentication middleware - returns user or sends 401 response
 */
export async function requireAuth(c: Context<{ Bindings: Bindings }>): Promise<User | Response> {
  const user = await getUserFromSession(c)
  if (!user) {
    return c.json({ error: 'Unauthorized - Please login' }, 401)
  }
  return user
}

/**
 * Require student authentication middleware - returns student or sends 401 response
 */
export async function requireStudentAuth(c: Context<{ Bindings: Bindings }>): Promise<Student | Response> {
  console.log('[AUTH] requireStudentAuth called')
  try {
    const student = await getStudentFromSession(c)
    console.log('[AUTH] Student from session:', student ? { id: student.id, name: student.name } : null)
    if (!student) {
      console.log('[AUTH] No student found, returning 401')
      return c.json({ error: 'Unauthorized - Please login as student' }, 401)
    }
    console.log('[AUTH] Student authenticated:', student.id)
    return student
  } catch (error) {
    console.error('[AUTH] Error in requireStudentAuth:', error)
    return c.json({ error: 'Authentication error', debug: error instanceof Error ? error.message : String(error) }, 500)
  }
}

/**
 * Optional authentication - returns user or null without sending response
 */
export async function optionalAuth(c: Context<{ Bindings: Bindings }>): Promise<User | null> {
  return await getUserFromSession(c)
}

/**
 * Require admin authentication middleware - returns admin user or sends 403 response
 */
export async function requireAdminAuth(c: Context<{ Bindings: Bindings }>): Promise<User | Response> {
  console.log('[AUTH] requireAdminAuth called')
  
  // First check if user is authenticated
  const user = await getUserFromSession(c)
  if (!user) {
    console.log('[AUTH] No user session found')
    return c.json({ error: 'Unauthorized - Please login' }, 401)
  }
  
  console.log('[AUTH] User authenticated:', { id: user.id, email: user.email, is_admin: user.is_admin })
  
  // Check if user is admin
  if (!user.is_admin) {
    console.log('[AUTH] User is not admin, access denied')
    return c.json({ 
      error: 'Forbidden - Admin access required',
      message: '관리자 권한이 필요합니다. 이 페이지는 관리자만 접근할 수 있습니다.'
    }, 403)
  }
  
  console.log('[AUTH] Admin access granted')
  return user
}

/**
 * Check if result is a Response (error response)
 */
export function isErrorResponse(result: any): result is Response {
  return result instanceof Response
}
