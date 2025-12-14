// File Upload Service
// Handles image OCR (Google Vision) and PDF text extraction (PDF.js)

import * as pdfjsLib from 'pdfjs-dist';
import { getAccessToken, loadServiceAccountCredentials } from './google-auth-service';

// Disable PDF.js Worker for Cloudflare Workers environment
// Cloudflare Workers doesn't support Web Workers or 'document' object
// Use direct processing without Worker to avoid "document is not defined" error
if (typeof globalThis !== 'undefined') {
  // Disable worker by setting to false string
  // This forces PDF.js to use the main thread for processing
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  pdfjsLib.GlobalWorkerOptions.workerPort = null as any;
}

interface UploadedFile {
  name: string;
  type: string;
  size: number;
  buffer: ArrayBuffer;
}

interface ProcessingResult {
  success: boolean;
  extractedText?: string;
  error?: string;
  processingTimeMs?: number;
}

/**
 * Process image file using Google Cloud Vision API with Service Account
 */
export async function processImageOCR(
  file: UploadedFile,
  credentialsJson: string
): Promise<ProcessingResult> {
  const startTime = Date.now();

  try {
    // Load service account credentials from JSON string
    const credentials = await loadServiceAccountCredentials(credentialsJson);
    
    // Get OAuth 2.0 access token
    const accessToken = await getAccessToken(credentials);

    // Convert ArrayBuffer to base64
    const base64Image = arrayBufferToBase64(file.buffer);

    // Call Google Vision API with Bearer token
    const response = await fetch(
      'https://vision.googleapis.com/v1/images:annotate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: base64Image,
              },
              features: [
                {
                  type: 'TEXT_DETECTION',
                  maxResults: 1,
                },
              ],
              imageContext: {
                languageHints: ['ko', 'en'], // Korean and English
              },
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Vision API error: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    const annotations = result.responses[0]?.textAnnotations;

    if (!annotations || annotations.length === 0) {
      return {
        success: false,
        error: 'No text detected in image',
        processingTimeMs: Date.now() - startTime,
      };
    }

    // First annotation contains the full text
    const extractedText = annotations[0].description;

    return {
      success: true,
      extractedText,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: `OCR processing failed: ${String(error)}`,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Process PDF file and extract text using PDF.js
 */
export async function processPDFExtraction(
  file: UploadedFile
): Promise<ProcessingResult> {
  const startTime = Date.now();

  try {
    // Load PDF document without Worker (Cloudflare Workers compatible)
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(file.buffer),
      verbosity: 0, // Suppress warnings in production
      useWorkerFetch: false, // Disable worker fetch for Cloudflare Workers
      isEvalSupported: false, // Disable eval for security
      useSystemFonts: false, // Don't rely on system fonts
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    let fullText = '';

    // Extract text from each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      fullText += `\n\n[Page ${pageNum}]\n${pageText}`;
    }

    if (!fullText.trim()) {
      return {
        success: false,
        error: 'No text found in PDF (may be image-based PDF)',
        processingTimeMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      extractedText: fullText.trim(),
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('PDF extraction error:', errorMsg);
    return {
      success: false,
      error: `PDF processing failed: ${errorMsg}`,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Process image-based PDF using Google Vision API
 * (For PDFs that are scanned images)
 */
export async function processImagePDFOCR(
  file: UploadedFile,
  credentialsJson: string
): Promise<ProcessingResult> {
  const startTime = Date.now();

  try {
    // Load service account credentials from JSON string
    const credentials = await loadServiceAccountCredentials(credentialsJson);
    
    // Get OAuth 2.0 access token
    const accessToken = await getAccessToken(credentials);

    // Convert ArrayBuffer to base64
    const base64Pdf = arrayBufferToBase64(file.buffer);

    // Call Google Vision API with PDF and Bearer token
    const response = await fetch(
      'https://vision.googleapis.com/v1/files:annotate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          requests: [
            {
              inputConfig: {
                content: base64Pdf,
                mimeType: 'application/pdf',
              },
              features: [
                {
                  type: 'DOCUMENT_TEXT_DETECTION',
                },
              ],
              imageContext: {
                languageHints: ['ko', 'en'],
              },
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Vision API error: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    const responses = result.responses;

    if (!responses || responses.length === 0) {
      return {
        success: false,
        error: 'No text detected in PDF',
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Combine text from all pages
    let fullText = '';
    for (const response of responses) {
      if (response.fullTextAnnotation) {
        fullText += response.fullTextAnnotation.text + '\n\n';
      }
    }

    if (!fullText.trim()) {
      return {
        success: false,
        error: 'No text extracted from image-based PDF',
        processingTimeMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      extractedText: fullText.trim(),
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: `Image PDF OCR failed: ${String(error)}`,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Validate uploaded file
 */
export function validateFile(
  file: File,
  allowedTypes: string[],
  maxSize: number
): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`,
    };
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed`,
    };
  }

  return { valid: true };
}

/**
 * Helper: Convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper: Generate unique storage key
 */
export function generateStorageKey(
  userId: number | null,
  fileName: string
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const userPrefix = userId ? `user_${userId}` : 'anonymous';
  return `${userPrefix}/${timestamp}_${random}_${sanitizedName}`;
}

/**
 * Store processing log
 */
export async function logProcessingStep(
  db: any,
  uploadedFileId: number,
  step: string,
  status: string,
  message: string | null,
  processingTimeMs: number | null
) {
  try {
    // D1 doesn't support undefined values, so convert null to appropriate defaults
    const finalMessage = message ?? '';
    const finalProcessingTime = processingTimeMs ?? 0;
    
    await db
      .prepare(
        `INSERT INTO file_processing_log 
         (uploaded_file_id, step, status, message, processing_time_ms) 
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(uploadedFileId, step, status, finalMessage, finalProcessingTime)
      .run();
  } catch (error) {
    console.error('Failed to log processing step:', error);
  }
}

/**
 * Upload file to R2 storage
 */
export async function uploadToR2(
  r2Bucket: R2Bucket,
  storageKey: string,
  fileData: ArrayBuffer,
  contentType: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Upload file to R2
    await r2Bucket.put(storageKey, fileData, {
      httpMetadata: {
        contentType: contentType,
      },
    });

    // R2 files are accessible via custom domain or R2.dev subdomain
    // For now, we'll just return the storage key
    // In production, you would configure a custom domain
    return {
      success: true,
      url: storageKey, // Or construct full URL if custom domain is configured
    };
  } catch (error) {
    return {
      success: false,
      error: `R2 upload failed: ${String(error)}`,
    };
  }
}

/**
 * Delete file from R2 storage
 */
export async function deleteFromR2(
  r2Bucket: R2Bucket,
  storageKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await r2Bucket.delete(storageKey);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `R2 delete failed: ${String(error)}`,
    };
  }
}
