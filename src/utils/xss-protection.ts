/**
 * XSS Protection Utilities
 * 
 * Provides client-side XSS protection using DOMPurify
 * IMPORTANT: This is defense-in-depth. Primary XSS protection
 * should be done server-side with proper input validation.
 */

/**
 * Sanitize HTML content using DOMPurify (client-side)
 * Must be used in browser context where DOMPurify is loaded via CDN
 * 
 * @param dirty - Untrusted HTML string
 * @returns Sanitized HTML safe for insertion into DOM
 */
export function sanitizeHTML(dirty: string): string {
  // Check if DOMPurify is available (loaded via CDN)
  if (typeof window !== 'undefined' && (window as any).DOMPurify) {
    return (window as any).DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'span', 'div'
      ],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
      ALLOW_DATA_ATTR: false
    });
  }
  
  // Fallback: basic HTML escaping if DOMPurify is not available
  return escapeHTML(dirty);
}

/**
 * Sanitize plain text (remove all HTML tags)
 * Use for user-generated content that should not contain any HTML
 * 
 * @param dirty - Untrusted text
 * @returns Plain text with all HTML tags removed
 */
export function sanitizeText(dirty: string): string {
  if (typeof window !== 'undefined' && (window as any).DOMPurify) {
    return (window as any).DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });
  }
  
  return escapeHTML(dirty);
}

/**
 * Basic HTML escape (fallback when DOMPurify is not available)
 * Server-side safe
 * 
 * @param unsafe - Unsafe string
 * @returns HTML-escaped string
 */
export function escapeHTML(unsafe: string): string {
  if (!unsafe) return '';
  
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize URL to prevent javascript: and data: URI XSS
 * 
 * @param url - Untrusted URL string
 * @returns Safe URL or empty string if invalid
 */
export function sanitizeURL(url: string): string {
  if (!url) return '';
  
  const trimmed = url.trim().toLowerCase();
  
  // Block dangerous protocols
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('vbscript:') ||
    trimmed.startsWith('file:')
  ) {
    return '';
  }
  
  // Allow http(s) and relative URLs only
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('./')
  ) {
    return url.trim();
  }
  
  // Default: empty string for safety
  return '';
}

/**
 * Validate and sanitize email address
 * 
 * @param email - Email string
 * @returns Sanitized email or empty string if invalid
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';
  
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (emailRegex.test(trimmed)) {
    return trimmed;
  }
  
  return '';
}

/**
 * Create safe innerHTML setter that uses DOMPurify
 * Use this instead of direct innerHTML assignment
 * 
 * Example:
 * ```typescript
 * const element = document.getElementById('content');
 * setSafeInnerHTML(element, userGeneratedContent);
 * ```
 * 
 * @param element - Target DOM element
 * @param html - HTML content to insert
 */
export function setSafeInnerHTML(element: HTMLElement | null, html: string): void {
  if (!element) return;
  
  const sanitized = sanitizeHTML(html);
  element.innerHTML = sanitized;
}

/**
 * Create safe textContent setter
 * Always use this for plain text to prevent XSS
 * 
 * @param element - Target DOM element
 * @param text - Plain text content
 */
export function setSafeTextContent(element: HTMLElement | null, text: string): void {
  if (!element) return;
  
  // textContent is inherently safe (no HTML parsing)
  // but we sanitize anyway for consistency
  element.textContent = sanitizeText(text);
}

/**
 * Sanitize form data before submission
 * Apply this to all user inputs before sending to server
 * 
 * @param formData - Form data object
 * @returns Sanitized form data
 */
export function sanitizeFormData(formData: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(formData)) {
    if (typeof value === 'string') {
      // Sanitize string values
      sanitized[key] = sanitizeText(value);
    } else if (Array.isArray(value)) {
      // Sanitize array values
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeText(item) : item
      );
    } else {
      // Keep other types as-is (numbers, booleans, etc.)
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

// Client-side helper function for inline sanitization in HTML
// Usage in HTML: <script>const safe = window.sanitizeForDisplay(userInput)</script>
if (typeof window !== 'undefined') {
  (window as any).sanitizeForDisplay = sanitizeHTML;
  (window as any).sanitizeText = sanitizeText;
  (window as any).sanitizeURL = sanitizeURL;
  (window as any).escapeHTML = escapeHTML;
}
