import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import type { Bindings } from '../types'

export interface User {
  id: number
  name: string
  email: string
  type?: 'teacher' | 'student'
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
    'SELECT s.*, u.id as user_id, u.name, u.email FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.expires_at > datetime("now")'
  ).bind(sessionId).first()
  
  if (!session) return null
  
  return {
    id: session.user_id as number,
    name: session.name as string,
    email: session.email as string,
    type: 'teacher'
  }
}

/**
 * Get student from session
 * Checks both Cookie (student_session_id) and Header (X-Session-ID)
 */
export async function getStudentFromSession(c: Context<{ Bindings: Bindings }>): Promise<Student | null> {
  // Try to get session ID from header first (for frontend compatibility), then from cookie
  let sessionId = c.req.header('X-Session-ID')
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
  const student = await getStudentFromSession(c)
  if (!student) {
    return c.json({ error: 'Unauthorized - Please login as student' }, 401)
  }
  return student
}

/**
 * Optional authentication - returns user or null without sending response
 */
export async function optionalAuth(c: Context<{ Bindings: Bindings }>): Promise<User | null> {
  return await getUserFromSession(c)
}

/**
 * Check if result is a Response (error response)
 */
export function isErrorResponse(result: any): result is Response {
  return result instanceof Response
}
