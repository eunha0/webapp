/**
 * Rate Limiting Middleware for Cloudflare Workers
 * Protects against brute force attacks and abuse
 */

import type { Context, MiddlewareHandler } from 'hono'
import type { Bindings } from '../types'

interface RateLimitConfig {
  maxRequests: number      // Maximum requests allowed
  windowMs: number         // Time window in milliseconds
  keyPrefix?: string       // KV key prefix
  skipSuccessfulRequests?: boolean  // Don't count successful requests
}

/**
 * Create rate limiter middleware using Cloudflare KV
 * @param config - Rate limit configuration
 * @returns Middleware handler
 */
export function createRateLimiter(config: RateLimitConfig): MiddlewareHandler<{ Bindings: Bindings }> {
  const {
    maxRequests,
    windowMs,
    keyPrefix = 'ratelimit',
    skipSuccessfulRequests = false
  } = config

  return async (c: Context<{ Bindings: Bindings }>, next) => {
    // Get client IP from Cloudflare headers
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
    
    // Create unique key for this IP and endpoint
    const path = new URL(c.req.url).pathname
    const key = `${keyPrefix}:${path}:${clientIP}`
    
    try {
      // Get current request count from KV
      const kv = c.env.KV
      if (!kv) {
        console.warn('KV namespace not configured for rate limiting')
        await next()
        return
      }

      const data = await kv.get(key, 'json') as { count: number; resetTime: number } | null
      
      const now = Date.now()
      const resetTime = data?.resetTime || now + windowMs
      
      // Reset counter if window has expired
      let count = (data && resetTime > now) ? data.count : 0
      
      // Check if limit exceeded
      if (count >= maxRequests) {
        const retryAfter = Math.ceil((resetTime - now) / 1000)
        
        return c.json({
          error: 'Too many requests. Please try again later.',
          retryAfter
        }, 429, {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(resetTime).toISOString()
        })
      }
      
      // Increment counter
      count++
      await kv.put(key, JSON.stringify({ count, resetTime }), {
        expirationTtl: Math.ceil(windowMs / 1000) + 60 // Extra 60s buffer
      })
      
      // Add rate limit headers
      c.header('X-RateLimit-Limit', maxRequests.toString())
      c.header('X-RateLimit-Remaining', (maxRequests - count).toString())
      c.header('X-RateLimit-Reset', new Date(resetTime).toISOString())
      
      await next()
      
      // If configured to skip successful requests, decrement counter
      if (skipSuccessfulRequests && c.res.status >= 200 && c.res.status < 300) {
        count--
        await kv.put(key, JSON.stringify({ count, resetTime }), {
          expirationTtl: Math.ceil(windowMs / 1000) + 60
        })
      }
      
    } catch (error) {
      console.error('Rate limiter error:', error)
      // On error, allow request to proceed (fail open)
      await next()
    }
  }
}

/**
 * Strict rate limiter for authentication endpoints
 * Protects against brute force attacks
 */
export const authRateLimiter = createRateLimiter({
  maxRequests: 5,           // 5 attempts
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'auth',
  skipSuccessfulRequests: true // Only count failed login attempts
})

/**
 * General API rate limiter
 * Protects against API abuse
 */
export const apiRateLimiter = createRateLimiter({
  maxRequests: 100,         // 100 requests
  windowMs: 60 * 1000,      // 1 minute
  keyPrefix: 'api'
})

/**
 * Strict rate limiter for sensitive operations
 */
export const sensitiveOpRateLimiter = createRateLimiter({
  maxRequests: 3,           // 3 attempts
  windowMs: 60 * 60 * 1000, // 1 hour
  keyPrefix: 'sensitive'
})
