/**
 * Cryptography utilities for authentication and security
 * Uses bcrypt for password hashing (OWASP recommended)
 */

import bcrypt from 'bcryptjs'

/**
 * OWASP recommended bcrypt cost factor (2024)
 * - Minimum: 10 rounds (for fast hardware)
 * - Recommended: 12 rounds (balance between security and performance)
 * - High security: 14+ rounds (slower but more secure)
 * 
 * Each round doubles the time, so 12 rounds ≈ 0.3-0.5 seconds per hash
 */
const BCRYPT_ROUNDS = 12

/**
 * Hash password using bcrypt with salt
 * @param password - Plain text password
 * @returns Promise<string> - Hashed password with salt
 */
export async function hashPassword(password: string): Promise<string> {
  // bcrypt automatically generates and includes salt in the hash
  return await bcrypt.hash(password, BCRYPT_ROUNDS)
}

/**
 * Verify password against bcrypt hash
 * @param password - Plain text password to verify
 * @param hash - Bcrypt hash from database
 * @returns Promise<boolean> - True if password matches
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash)
  } catch (error) {
    console.error('Password verification error:', error)
    return false
  }
}

/**
 * Generate cryptographically secure random token
 * @param length - Token length in bytes (default: 32)
 * @returns string - Hex-encoded random token
 */
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate CSRF token
 * @returns string - Cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  return generateSecureToken(32)
}

/**
 * Validate CSRF token
 * @param token - Token from request
 * @param storedToken - Token from session/database
 * @returns boolean - True if tokens match
 */
export function validateCSRFToken(token: string, storedToken: string): boolean {
  if (!token || !storedToken) return false
  // Use constant-time comparison to prevent timing attacks
  if (token.length !== storedToken.length) return false
  
  let result = 0
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ storedToken.charCodeAt(i)
  }
  return result === 0
}

/**
 * Hash sensitive data using SHA-256
 * @param data - Data to hash
 * @returns Promise<string> - Hex-encoded hash
 */
export async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns { valid: boolean, errors: string[] }
 */
export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // OWASP password guidelines (2024)
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }
  
  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  
  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }
  
  // Check for common weak passwords
  const commonPasswords = ['password', '12345678', 'qwerty', 'abc123', 'password123']
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common. Please choose a stronger password')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Sanitize email address
 * @param email - Email to sanitize
 * @returns string - Sanitized email (lowercase, trimmed)
 */
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

/**
 * Validate email format
 * @param email - Email to validate
 * @returns boolean - True if valid email format
 */
export function isValidEmail(email: string): boolean {
  // RFC 5322 simplified email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}
