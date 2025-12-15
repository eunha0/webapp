// File Upload Service
// Handles image OCR (Google Vision and OCR.space) and PDF text extraction

import * as pdfjsLib from 'pdfjs-dist';
import {
  arrayBufferToBase64,
  callVisionAPI,
  extractTextFromVisionResponse,
  createTextDetectionRequest,
  createDocumentTextDetectionRequest
} from './utils/vision-api';

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
 * Refactored to use common callVisionAPI function
 */
export async function processImageOCR(
  file: UploadedFile,
  credentialsJson: string
): Promise<ProcessingResult> {
  const startTime = Date.now();

  try {
    // Convert ArrayBuffer to base64
    const base64Image = arrayBufferToBase64(file.buffer);

    // Create Vision API request for text detection
    const requestBody = createTextDetectionRequest(base64Image);

    // Call Vision API using common function
    const result = await callVisionAPI('images:annotate', requestBody, credentialsJson);

    // Extract text from response
    const extractedText = extractTextFromVisionResponse(result);

    if (!extractedText) {
      return {
        success: false,
        error: 'No text detected in image',
        processingTimeMs: Date.now() - startTime,
      };
    }

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
 * Refactored to use common callVisionAPI function
 * 
 * Note: Google Vision API's images:annotate endpoint can handle PDF files directly
 * It processes the first page of the PDF (or can be configured for multi-page)
 */
export async function processImagePDFOCR(
  file: UploadedFile,
  credentialsJson: string
): Promise<ProcessingResult> {
  const startTime = Date.now();

  try {
    // Convert ArrayBuffer to base64
    const base64Pdf = arrayBufferToBase64(file.buffer);

    // Create Vision API request for document text detection
    const requestBody = createDocumentTextDetectionRequest(base64Pdf);

    // Call Vision API using common function
    const result = await callVisionAPI('images:annotate', requestBody, credentialsJson);
    console.log('Vision API response:', JSON.stringify(result).substring(0, 500));

    // Extract text from response using common function
    const fullText = extractTextFromVisionResponse(result);

    if (!fullText || !fullText.trim()) {
      return {
        success: false,
        error: 'No text extracted from PDF',
        processingTimeMs: Date.now() - startTime,
      };
    }

    console.log(`Successfully extracted ${fullText.length} characters from PDF`);

    return {
      success: true,
      extractedText: fullText.trim(),
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('PDF OCR error:', errorMsg);
    return {
      success: false,
      error: `PDF OCR failed: ${errorMsg}`,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Process PDF using OCR.space API
 * OCR.space supports PDF files natively and is simpler than Google Vision
 */
export async function processOCRSpace(
  file: UploadedFile,
  apiKey: string
): Promise<ProcessingResult> {
  const startTime = Date.now();

  try {
    console.log(`Processing file with OCR.space: ${file.name} (${file.size} bytes)`);

    // Convert ArrayBuffer to base64
    const base64File = arrayBufferToBase64(file.buffer);

    // Determine file extension from filename
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    
    // OCR.space API using FormData (better compatibility)
    const formData = new FormData();
    
    // Create a blob from buffer with proper type
    const blob = new Blob([file.buffer], { type: file.type });
    formData.append('file', blob, file.name);
    // OCR.space language codes: kor=Korean, eng=English
    // For Engine 2, use 'kor' for Korean
    formData.append('language', 'kor');
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2');
    formData.append('filetype', fileExtension);
    
    // Call OCR.space API with FormData
    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        'apikey': apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OCR.space API error response:', errorText);
      throw new Error(`OCR.space API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log('OCR.space response:', JSON.stringify(result).substring(0, 500));

    // Check for API errors
    if (result.IsErroredOnProcessing) {
      const errorMsg = result.ErrorMessage?.[0] || 'Unknown OCR.space error';
      console.error('OCR.space processing error:', errorMsg);
      return {
        success: false,
        error: `OCR.space error: ${errorMsg}`,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Extract text from all pages
    let fullText = '';
    if (result.ParsedResults && result.ParsedResults.length > 0) {
      for (const page of result.ParsedResults) {
        if (page.ParsedText) {
          fullText += page.ParsedText + '\n\n';
        }
      }
    }

    if (!fullText || !fullText.trim()) {
      return {
        success: false,
        error: 'No text extracted from file',
        processingTimeMs: Date.now() - startTime,
      };
    }

    console.log(`Successfully extracted ${fullText.length} characters with OCR.space`);

    return {
      success: true,
      extractedText: fullText.trim(),
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('OCR.space error:', errorMsg);
    return {
      success: false,
      error: `OCR.space failed: ${errorMsg}`,
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

// arrayBufferToBase64 function removed - now imported from utils/vision-api.ts

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
