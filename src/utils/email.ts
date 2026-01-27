/**
 * Email sending utility using Cloudflare Email Routing
 * 
 * Cloudflare Email Routing allows sending emails directly from Workers
 * without needing external SMTP servers.
 * 
 * Requirements:
 * 1. Email Routing must be enabled in Cloudflare Dashboard
 * 2. Domain must be configured (ai-nonsool.kr)
 * 3. "Send emails using Workers" must be enabled
 * 4. Custom address must be created (admin@ai-nonsool.kr)
 */

export interface EmailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

/**
 * Send email using Cloudflare Email Routing API
 * 
 * Uses MailChannels API which is integrated with Cloudflare Workers
 * No environment variables required
 */
export async function sendEmail(options: EmailOptions, env: any): Promise<boolean> {
  try {
    // Send email through MailChannels API (integrated with Cloudflare)
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: options.to }],
          },
        ],
        from: {
          email: options.from || 'admin@ai-nonsool.kr',
          name: 'AI 논술',
        },
        subject: options.subject,
        content: [
          {
            type: 'text/html',
            value: options.html,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('MailChannels API error:', response.status, errorText)
      return false
    }

    console.log('Email sent successfully via MailChannels')
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

/**
 * Alternative: Send email using Cloudflare's native Email Routing
 * This requires Email Routing to be enabled in Cloudflare Dashboard
 */
export async function sendEmailViaCloudflare(options: EmailOptions): Promise<boolean> {
  try {
    // Note: This is a conceptual implementation
    // Actual implementation depends on Cloudflare's Email API
    // which may vary based on your Cloudflare plan and setup
    
    console.log('Attempting to send email via Cloudflare Email Routing')
    console.log('To:', options.to)
    console.log('Subject:', options.subject)
    console.log('From:', options.from || 'admin@ai-nonsool.kr')
    
    // For now, use MailChannels which is integrated with Cloudflare
    return await sendEmail(options, {})
  } catch (error) {
    console.error('Cloudflare email sending failed:', error)
    return false
  }
}
