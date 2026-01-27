/**
 * Email sending utility using Daum Smartwork SMTP
 * 
 * Daum Smartwork SMTP Configuration:
 * - SMTP Server: smtp.daum.net
 * - Port: 465 (SSL) or 587 (TLS)
 * - Authentication: Required
 */

import nodemailer from 'nodemailer'

export interface EmailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

/**
 * Send email using Daum Smartwork SMTP
 * 
 * Environment variables required:
 * - SMTP_HOST: smtp.daum.net
 * - SMTP_PORT: 465 or 587
 * - SMTP_USER: admin@ai-nonsool.kr
 * - SMTP_PASS: your-password
 */
export async function sendEmail(options: EmailOptions, env: any): Promise<boolean> {
  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST || 'smtp.daum.net',
      port: parseInt(env.SMTP_PORT || '465'),
      secure: parseInt(env.SMTP_PORT || '465') === 465, // true for 465, false for 587
      auth: {
        user: env.SMTP_USER || 'admin@ai-nonsool.kr',
        pass: env.SMTP_PASS
      },
      // For debugging
      debug: true,
      logger: true
    })

    // Send email
    const info = await transporter.sendMail({
      from: options.from || `"AI 논술" <${env.SMTP_USER || 'admin@ai-nonsool.kr'}>`,
      to: options.to,
      subject: options.subject,
      html: options.html
    })

    console.log('Email sent successfully:', info.messageId)
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
 * Verify SMTP connection
 */
export async function verifyEmailConnection(env: any): Promise<boolean> {
  try {
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST || 'smtp.daum.net',
      port: parseInt(env.SMTP_PORT || '465'),
      secure: parseInt(env.SMTP_PORT || '465') === 465,
      auth: {
        user: env.SMTP_USER || 'admin@ai-nonsool.kr',
        pass: env.SMTP_PASS
      }
    })

    await transporter.verify()
    console.log('SMTP connection verified successfully')
    return true
  } catch (error) {
    console.error('SMTP connection verification failed:', error)
    return false
  }
}
