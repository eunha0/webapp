/**
 * Google Vision API utility functions
 * Provides common functions for calling Vision API to reduce code duplication
 */

import { getAccessToken, loadServiceAccountCredentials } from '../google-auth-service'

/**
 * Convert ArrayBuffer to base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

interface VisionAPIRequest {
  image: {
    content: string
  }
  features: Array<{
    type: string
    maxResults?: number
  }>
  imageContext?: {
    languageHints?: string[]
  }
}

interface VisionAPIResponse {
  responses: Array<{
    textAnnotations?: Array<{
      description: string
      locale?: string
    }>
    fullTextAnnotation?: {
      text: string
    }
    error?: {
      code: number
      message: string
    }
  }>
}

/**
 * Call Google Vision API with authenticated request
 * This is a common function to eliminate duplicate Vision API call code
 * 
 * @param endpoint - Vision API endpoint (e.g., 'images:annotate', 'files:annotate')
 * @param requestBody - Request body for Vision API
 * @param credentialsJson - Service account credentials JSON string
 * @returns Promise<VisionAPIResponse>
 */
export async function callVisionAPI(
  endpoint: string,
  requestBody: { requests: VisionAPIRequest[] },
  credentialsJson: string
): Promise<VisionAPIResponse> {
  // Load service account credentials
  const credentials = await loadServiceAccountCredentials(credentialsJson)
  
  // Get OAuth 2.0 access token
  const accessToken = await getAccessToken(credentials)
  
  // Call Vision API
  const response = await fetch(
    `https://vision.googleapis.com/v1/${endpoint}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody)
    }
  )
  
  // Handle API errors
  if (!response.ok) {
    const errorText = await response.text()
    console.error(`Vision API error response (${endpoint}):`, errorText)
    throw new Error(`Vision API error (${response.status}): ${errorText}`)
  }
  
  // Parse and return response
  const result = await response.json()
  return result
}

/**
 * Extract text from Vision API response
 * Handles both textAnnotations and fullTextAnnotation formats
 * 
 * @param response - Vision API response
 * @returns Extracted text or null if no text found
 */
export function extractTextFromVisionResponse(response: VisionAPIResponse): string | null {
  if (!response.responses || response.responses.length === 0) {
    return null
  }
  
  const firstResponse = response.responses[0]
  
  // Check for errors in response
  if (firstResponse.error) {
    console.error('Vision API returned error:', firstResponse.error)
    return null
  }
  
  // Try fullTextAnnotation first (DOCUMENT_TEXT_DETECTION)
  if (firstResponse.fullTextAnnotation?.text) {
    return firstResponse.fullTextAnnotation.text
  }
  
  // Fallback to textAnnotations (TEXT_DETECTION)
  if (firstResponse.textAnnotations && firstResponse.textAnnotations.length > 0) {
    return firstResponse.textAnnotations[0].description
  }
  
  return null
}

/**
 * Create Vision API request for text detection (for images)
 */
export function createTextDetectionRequest(base64Content: string): { requests: VisionAPIRequest[] } {
  return {
    requests: [
      {
        image: {
          content: base64Content
        },
        features: [
          {
            type: 'TEXT_DETECTION',
            maxResults: 1
          }
        ],
        imageContext: {
          languageHints: ['ko', 'en'] // Korean and English
        }
      }
    ]
  }
}

/**
 * Create Vision API request for document text detection (for PDFs/documents)
 */
export function createDocumentTextDetectionRequest(base64Content: string): { requests: VisionAPIRequest[] } {
  return {
    requests: [
      {
        image: {
          content: base64Content
        },
        features: [
          {
            type: 'DOCUMENT_TEXT_DETECTION',
            maxResults: 1
          }
        ],
        imageContext: {
          languageHints: ['ko', 'en'] // Korean and English
        }
      }
    ]
  }
}
