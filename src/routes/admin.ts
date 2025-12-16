import { Hono } from 'hono'
import type { Bindings } from '../types'
import { requireAuth } from '../middleware/auth'

const admin = new Hono<{ Bindings: Bindings }>()

/**
 * GET /api/admin/stats - Get admin statistics
 */
admin.get('/stats', async (c) => {
  try {
    const user = await requireAuth(c)
    if (!user.id) return user
    
    const db = c.env.DB
    
    // Get various statistics
    const [totalUsers, totalStudents, totalAssignments, totalSubmissions] = await Promise.all([
      db.prepare('SELECT COUNT(*) as count FROM users').first(),
      db.prepare('SELECT COUNT(*) as count FROM student_users').first(),
      db.prepare('SELECT COUNT(*) as count FROM assignments WHERE user_id = ?').bind(user.id).first(),
      db.prepare(`
        SELECT COUNT(*) as count 
        FROM student_submissions s
        JOIN assignments a ON s.assignment_id = a.id
        WHERE a.user_id = ?
      `).bind(user.id).first()
    ])
    
    return c.json({
      total_users: totalUsers?.count || 0,
      total_students: totalStudents?.count || 0,
      total_assignments: totalAssignments?.count || 0,
      total_submissions: totalSubmissions?.count || 0
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
    const user = await requireAuth(c)
    if (!user.id) return user
    
    const db = c.env.DB
    
    const recentActivity = await db.prepare(`
      SELECT 
        s.id,
        s.student_name,
        s.status,
        s.created_at,
        a.title as assignment_title
      FROM student_submissions s
      JOIN assignments a ON s.assignment_id = a.id
      WHERE a.user_id = ?
      ORDER BY s.created_at DESC
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
    const user = await requireAuth(c)
    if (!user.id) return user
    
    const db = c.env.DB
    
    const users = await db.prepare(
      'SELECT id, name, email, created_at FROM users ORDER BY created_at DESC LIMIT 100'
    ).all()
    
    return c.json({ users: users.results || [] })
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
    const user = await requireAuth(c)
    if (!user.id) return user
    
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
    const user = await requireAuth(c)
    if (!user.id) return user
    
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
    const user = await requireAuth(c)
    if (!user.id) return user
    
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

export default admin
