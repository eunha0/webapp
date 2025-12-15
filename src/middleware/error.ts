import type { Context } from 'hono'

/**
 * Error handler middleware
 */
export async function errorHandler(err: Error, c: Context) {
  console.error('Error:', err)
  
  return c.json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  }, 500)
}

/**
 * Wrap async route handler with try-catch
 */
export function asyncHandler(fn: (c: any) => Promise<Response>) {
  return async (c: any) => {
    try {
      return await fn(c)
    } catch (error) {
      console.error('Async handler error:', error)
      return c.json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500)
    }
  }
}

/**
 * Validation error response
 */
export function validationError(c: Context, message: string) {
  return c.json({ error: 'Validation Error', message }, 400)
}

/**
 * Not found error response
 */
export function notFoundError(c: Context, resource: string = 'Resource') {
  return c.json({ error: 'Not Found', message: `${resource} not found` }, 404)
}

/**
 * Unauthorized error response
 */
export function unauthorizedError(c: Context, message: string = 'Unauthorized') {
  return c.json({ error: 'Unauthorized', message }, 401)
}

/**
 * Forbidden error response
 */
export function forbiddenError(c: Context, message: string = 'Forbidden') {
  return c.json({ error: 'Forbidden', message }, 403)
}
