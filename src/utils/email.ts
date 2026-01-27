/**
 * Email sending utility using Resend API
 * 
 * Resend is a modern email service that works perfectly with Cloudflare Workers
 * and provides excellent deliverability.
 * 
 * Requirements:
 * 1. RESEND_API_KEY environment variable must be set
 * 2. Domain verification in Resend dashboard (or use onboarding@resend.dev for testing)
 * 
 * Setup:
 * 1. Sign up at https://resend.com
 * 2. Get your API key from https://resend.com/api-keys
 * 3. Add RESEND_API_KEY to Cloudflare Pages secrets:
 *    npx wrangler pages secret put RESEND_API_KEY --project-name ai-nonsool-kr
 * 4. Add to .dev.vars for local development:
 *    RESEND_API_KEY=re_xxxxx
 */

export interface EmailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

/**
 * Send email using Resend API
 * 
 * @param options Email options
 * @param env Environment variables (must contain RESEND_API_KEY)
 * @returns true if email sent successfully, false otherwise
 */
export async function sendEmail(options: EmailOptions, env: any): Promise<boolean> {
  try {
    // Check if API key is configured
    if (!env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured')
      console.error('Please add RESEND_API_KEY to Cloudflare Pages secrets')
      console.error('Command: npx wrangler pages secret put RESEND_API_KEY --project-name ai-nonsool-kr')
      return false
    }

    // Send email through Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: options.from || 'AI 논술 <onboarding@resend.dev>',
        to: [options.to],
        subject: options.subject,
        html: options.html,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Resend API error:', response.status, JSON.stringify(errorData))
      return false
    }

    const result = await response.json()
    console.log('Email sent successfully via Resend:', result.id)
    return true
  } catch (error) {
    console.error('Failed to send email:', error)
    
    // Log detailed error for debugging
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    return false
  }
}
