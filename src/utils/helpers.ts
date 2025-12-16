/**
 * Helper utility functions
 */

/**
 * Convert ArrayBuffer to base64
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Generate random string
 */
export function generateRandomString(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Generate UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Hash password using bcryptjs (PRODUCTION-READY)
 * Uses 12 rounds (recommended by OWASP)
 */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs')
  return await bcrypt.hash(password, 12)
}

/**
 * Verify password hash using bcryptjs
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs')
  return await bcrypt.compare(password, hash)
}

/**
 * Validate password strength (OWASP compliant)
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!password || password.length < 8) {
    errors.push('비밀번호는 최소 8자 이상이어야 합니다')
  }
  if (password.length > 128) {
    errors.push('비밀번호는 최대 128자까지 가능합니다')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('대문자를 1개 이상 포함해야 합니다')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('소문자를 1개 이상 포함해야 합니다')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('숫자를 1개 이상 포함해야 합니다')
  }
  if (!/[!@#$%^&*()_+=\-[\]{};:'",.<>?]/.test(password)) {
    errors.push('특수문자를 1개 이상 포함해야 합니다')
  }
  
  // Check for common weak passwords
  const commonPasswords = ['password', 'password123', '12345678', 'qwerty', 'abc123']
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('흔한 비밀번호는 사용할 수 없습니다')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_')
}

/**
 * Get file extension
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Sleep/delay function
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Truncate string
 */
export function truncate(str: string, length: number = 100): string {
  if (str.length <= length) return str
  return str.substring(0, length) + '...'
}

/**
 * Parse JSON safely
 */
export function safeJSONParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return defaultValue
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Generate access code (6 character alphanumeric)
 */
export function generateAccessCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
