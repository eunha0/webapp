import { Hono } from 'hono'
import type { Bindings } from '../types'
import { requireAdminAuth, isErrorResponse } from '../middleware/auth'

const admin = new Hono<{ Bindings: Bindings }>()

/**
 * GET /api/admin/stats - Get admin statistics
 */
admin.get('/stats', async (c) => {
  try {
    const user = await requireAdminAuth(c)
    if (isErrorResponse(user)) return user
    
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
    
    return c.json({
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
      active_students: activeStudents.results || []
    })
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    return c.json({ error: 'Failed to fetch statistics' }, 500)
  }
})

/**
 * GET /api/admin/recent-activity - Get recent activity
 */
admin.get('/recent-activity', async (c) => {
  try {
    const user = await requireAdminAuth(c)
    if (isErrorResponse(user)) return user
    
    const db = c.env.DB
    
    const recentActivity = await db.prepare(`
      SELECT 
        s.id,
        s.student_name,
        s.status,
        s.submitted_at as created_at,
        a.title as assignment_title
      FROM student_submissions s
      JOIN assignments a ON s.assignment_id = a.id
      WHERE a.user_id = ?
      ORDER BY s.submitted_at DESC
      LIMIT 10
    `).bind(user.id).all()
    
    return c.json({ activity: recentActivity.results || [] })
  } catch (error) {
    console.error('Error fetching recent activity:', error)
    return c.json({ error: 'Failed to fetch recent activity' }, 500)
  }
})

/**
 * GET /api/admin/users - Get users list
 */
admin.get('/users', async (c) => {
  try {
    const user = await requireAdminAuth(c)
    if (isErrorResponse(user)) return user
    
    const db = c.env.DB
    
    // Get teachers with assignment and submission counts
    const teachers = await db.prepare(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.created_at,
        COUNT(DISTINCT a.id) as assignment_count,
        COUNT(DISTINCT s.id) as submission_count
      FROM users u
      LEFT JOIN assignments a ON u.id = a.user_id
      LEFT JOIN student_submissions s ON a.id = s.assignment_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT 100
    `).all()
    
    // Get students with submission counts
    const students = await db.prepare(`
      SELECT 
        su.id,
        su.name,
        su.email,
        su.grade_level,
        su.created_at,
        COUNT(s.id) as submission_count
      FROM student_users su
      LEFT JOIN student_submissions s ON su.id = s.student_user_id
      GROUP BY su.id
      ORDER BY su.created_at DESC
      LIMIT 100
    `).all()
    
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
 * POST /api/admin/resource - Create resource
 */
admin.post('/resource', async (c) => {
  try {
    const user = await requireAdminAuth(c)
    if (isErrorResponse(user)) return user
    
    const { title, description, type, url } = await c.req.json()
    const db = c.env.DB
    
    const result = await db.prepare(
      'INSERT INTO resources (user_id, title, description, type, url) VALUES (?, ?, ?, ?, ?)'
    ).bind(user.id, title, description, type, url).run()
    
    return c.json({ success: true, resource_id: result.meta.last_row_id })
  } catch (error) {
    console.error('Error creating resource:', error)
    return c.json({ error: 'Failed to create resource' }, 500)
  }
})

/**
 * PUT /api/admin/resource/:id - Update resource
 */
admin.put('/resource/:id', async (c) => {
  try {
    const user = await requireAdminAuth(c)
    if (isErrorResponse(user)) return user
    
    const resourceId = parseInt(c.req.param('id'))
    const { title, description, type, url } = await c.req.json()
    const db = c.env.DB
    
    await db.prepare(
      'UPDATE resources SET title = ?, description = ?, type = ?, url = ? WHERE id = ? AND user_id = ?'
    ).bind(title, description, type, url, resourceId, user.id).run()
    
    return c.json({ success: true, message: 'Resource updated successfully' })
  } catch (error) {
    console.error('Error updating resource:', error)
    return c.json({ error: 'Failed to update resource' }, 500)
  }
})

/**
 * DELETE /api/admin/resource/:id - Delete resource
 */
admin.delete('/resource/:id', async (c) => {
  try {
    const user = await requireAdminAuth(c)
    if (isErrorResponse(user)) return user
    
    const resourceId = parseInt(c.req.param('id'))
    const db = c.env.DB
    
    await db.prepare(
      'DELETE FROM resources WHERE id = ? AND user_id = ?'
    ).bind(resourceId, user.id).run()
    
    return c.json({ success: true, message: 'Resource deleted successfully' })
  } catch (error) {
    console.error('Error deleting resource:', error)
    return c.json({ error: 'Failed to delete resource' }, 500)
  }
})

/**
 * DELETE /api/admin/users/:userId - Delete a user account (admin only)
 */
admin.delete('/users/:userId', async (c) => {
  try {
    const adminUser = await requireAdminAuth(c)
    if (isErrorResponse(adminUser)) return adminUser
    
    const userId = parseInt(c.req.param('userId'))
    const userType = c.req.query('type') || 'teacher' // 'teacher' or 'student'
    const db = c.env.DB
    
    // Validate userId
    if (isNaN(userId) || userId <= 0) {
      return c.json({ error: '잘못된 사용자 ID입니다.' }, 400)
    }
    
    // Prevent self-deletion
    if (userId === adminUser.id && userType === 'teacher') {
      return c.json({ error: '자신의 관리자 계정은 삭제할 수 없습니다.' }, 403)
    }
    
    // Check if user exists
    let userTable = userType === 'student' ? 'student_users' : 'users'
    const targetUser = await db.prepare(
      `SELECT id, email FROM ${userTable} WHERE id = ?`
    ).bind(userId).first()
    
    if (!targetUser) {
      return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404)
    }
    
    // Delete user (CASCADE will delete related records)
    await db.prepare(
      `DELETE FROM ${userTable} WHERE id = ?`
    ).bind(userId).run()
    
    // Delete related sessions if teacher
    if (userType === 'teacher') {
      await db.prepare(
        'DELETE FROM sessions WHERE user_id = ?'
      ).bind(userId).run()
    }
    
    // Log security event
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
    await db.prepare(
      'INSERT INTO security_logs (event_type, user_id, ip_address, details, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(
      'account_deleted_by_admin', 
      adminUser.id, 
      clientIP, 
      JSON.stringify({ deleted_user_id: userId, deleted_user_email: targetUser.email, user_type: userType }), 
      new Date().toISOString()
    ).run()
    
    return c.json({ 
      success: true, 
      message: '사용자 계정이 성공적으로 삭제되었습니다.' 
    })
  } catch (error) {
    console.error('Error deleting user account:', error)
    return c.json({ error: '사용자 삭제 중 오류가 발생했습니다.' }, 500)
  }
})

export default admin
