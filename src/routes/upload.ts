import { Hono } from 'hono'
import type { Bindings } from '../types'
import {
  validateFile,
  generateStorageKey,
  processImageOCR,
  processPDFExtraction,
  processImagePDFOCR,
  processOCRSpace,
  logProcessingStep,
  uploadToR2,
  deleteFromR2
} from '../upload-service'
import { getUserFromSession, getStudentFromSession } from '../middleware/auth'

const upload = new Hono<{ Bindings: Bindings }>()

/**
 * POST /api/upload/image - Upload and process image file
 */
upload.post('/image', async (c) => {
  try {
    const user = await getUserFromSession(c)
    const student = await getStudentFromSession(c)
    
    // Either teacher or student must be logged in
    if (!user && !student) {
      return c.json({ error: '로그인이 필요합니다' }, 401)
    }
    
    const db = c.env.DB
    const credentialsJson = c.env.GOOGLE_APPLICATION_CREDENTIALS
    
    // Parse multipart form data
    const formData = await c.req.formData()
    const file = formData.get('file') as File
    const submissionId = formData.get('submission_id') as string | null
    const skipOcrRaw = formData.get('skip_ocr')
    const skipOcr = skipOcrRaw === 'true' // Flag to skip OCR for charts/graphs/maps
    
    // Debug log
    console.log('[DEBUG] /api/upload/image - skip_ocr received:', skipOcrRaw, 'parsed as:', skipOcr)
    
    if (!file) {
      return c.json({ error: '파일이 제공되지 않았습니다' }, 400)
    }
    
    // Get allowed types and max size from environment
    const maxSize = parseInt(c.env.MAX_FILE_SIZE || '10485760') // 10MB default
    const allowedTypes = (c.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/jpg,image/webp').split(',')
    
    // Validate file
    const validation = validateFile(file, allowedTypes, maxSize)
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400)
    }
    
    // Generate storage key
    const storageKey = generateStorageKey(user?.id || student?.id || null, file.name)
    
    // Read file as ArrayBuffer
    const fileBuffer = await file.arrayBuffer()
    
    // Upload to R2 storage
    const r2Bucket = c.env.R2_BUCKET
    const r2Result = await uploadToR2(r2Bucket, storageKey, fileBuffer, file.type)
    
    if (!r2Result.success) {
      return c.json({ error: r2Result.error || 'R2 업로드 실패' }, 500)
    }
    
    // Store file metadata in database
    const result = await db.prepare(
      `INSERT INTO uploaded_files 
       (user_id, student_user_id, submission_id, file_name, file_type, mime_type, file_size, storage_key, storage_url, processing_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      user?.id || null,
      student?.id || null,
      submissionId || null,
      file.name,
      'image',
      file.type,
      file.size,
      storageKey,
      r2Result.url || null,
      'processing'
    ).run()
    
    const uploadedFileId = result.meta.last_row_id as number
    
    // Log upload step
    await logProcessingStep(db, uploadedFileId, 'upload', 'completed', 'R2 업로드 및 메타데이터 저장 완료', null)
    
    // If skip_ocr flag is set, return image URL directly without OCR processing
    // This is useful for charts, graphs, maps, and other visual content
    if (skipOcr) {
      console.log('[DEBUG] Skipping OCR for file:', file.name, '(skip_ocr=true)')
      
      await db.prepare(
        `UPDATE uploaded_files 
         SET processing_status = ?, processed_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind('completed', uploadedFileId).run()
      
      await logProcessingStep(db, uploadedFileId, 'skip_ocr', 'completed', 'OCR 건너뛰기 - 이미지 그대로 사용', null)
      
      const skipResponse = {
        success: true,
        file_id: uploadedFileId,
        file_name: file.name,
        storage_key: storageKey,
        storage_url: r2Result.url,
        image_url: r2Result.url, // For Markdown image insertion
        extracted_text: null,
        skipped_ocr: true,
        processing_time_ms: 0
      }
      
      console.log('[DEBUG] Returning skip_ocr response:', JSON.stringify(skipResponse))
      return c.json(skipResponse)
    }
    
    // Process image with OCR - Try Google Vision API first (higher accuracy)
    let extractedText = null
    const startTime = Date.now()
    
    try {
      // Try Google Vision API first if credentials available
      if (credentialsJson) {
        try {
          const ocrResult = await processImageOCR(
            { name: file.name, buffer: fileBuffer, type: file.type, size: file.size },
            credentialsJson
          )
          
          if (ocrResult.success && ocrResult.extractedText) {
            extractedText = ocrResult.extractedText
            
            // Update database with extracted text
            await db.prepare(
              `UPDATE uploaded_files 
               SET extracted_text = ?, processing_status = ?, processed_at = CURRENT_TIMESTAMP
               WHERE id = ?`
            ).bind(ocrResult.extractedText, 'completed', uploadedFileId).run()
            
            // Log OCR step
            await logProcessingStep(
              db,
              uploadedFileId,
              'ocr_google',
              'completed',
              `Google Vision OCR 완료 (${Date.now() - startTime}ms)`,
              { textLength: ocrResult.extractedText.length }
            )
          }
        } catch (googleError) {
          console.warn('Google Vision OCR failed, falling back to OCR.space:', googleError)
          await logProcessingStep(db, uploadedFileId, 'ocr_google', 'failed', String(googleError), null)
        }
      }
      
      // Fallback to OCR.space if Google Vision didn't work
      if (!extractedText && c.env.OCR_SPACE_API_KEY) {
        try {
          const ocrSpaceResult = await processOCRSpace(
            { name: file.name, buffer: fileBuffer, type: file.type, size: file.size },
            c.env.OCR_SPACE_API_KEY
          )
          
          if (ocrSpaceResult.success && ocrSpaceResult.extractedText) {
            extractedText = ocrSpaceResult.extractedText
            
            // Update database
            await db.prepare(
              `UPDATE uploaded_files 
               SET extracted_text = ?, processing_status = ?, processed_at = CURRENT_TIMESTAMP
               WHERE id = ?`
            ).bind(ocrSpaceResult.extractedText, 'completed', uploadedFileId).run()
            
            // Log OCR step
            await logProcessingStep(
              db,
              uploadedFileId,
              'ocr_space',
              'completed',
              `OCR.space 완료 (${Date.now() - startTime}ms)`,
              { textLength: ocrSpaceResult.extractedText.length }
            )
          }
        } catch (ocrSpaceError) {
          console.error('OCR.space also failed:', ocrSpaceError)
          await logProcessingStep(db, uploadedFileId, 'ocr_space', 'failed', String(ocrSpaceError), null)
        }
      }
      
      // If no OCR worked, mark as completed without text
      if (!extractedText) {
        await db.prepare(
          `UPDATE uploaded_files 
           SET processing_status = ?, processed_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).bind('completed', uploadedFileId).run()
      }
    } catch (processingError) {
      console.error('OCR processing error:', processingError)
      await db.prepare(
        `UPDATE uploaded_files 
         SET processing_status = ?, error_message = ?
         WHERE id = ?`
      ).bind('failed', String(processingError), uploadedFileId).run()
      
      await logProcessingStep(db, uploadedFileId, 'ocr', 'failed', String(processingError), null)
    }
    
    return c.json({
      success: true,
      file_id: uploadedFileId,
      file_name: file.name,
      storage_key: storageKey,
      storage_url: r2Result.url,
      extracted_text: extractedText,
      processing_time_ms: Date.now() - startTime
    })
  } catch (error) {
    console.error('File upload error:', error)
    return c.json({ error: '파일 업로드 실패', details: String(error) }, 500)
  }
})

/**
 * POST /api/upload/pdf - Upload and process PDF file
 */
upload.post('/pdf', async (c) => {
  try {
    const user = await getUserFromSession(c)
    const student = await getStudentFromSession(c)
    
    if (!user && !student) {
      return c.json({ error: '로그인이 필요합니다' }, 401)
    }
    
    const db = c.env.DB
    const formData = await c.req.formData()
    const file = formData.get('file') as File
    const submissionId = formData.get('submission_id') as string | null
    
    if (!file) {
      return c.json({ error: '파일이 제공되지 않았습니다' }, 400)
    }
    
    // Validate PDF file
    const maxSize = parseInt(c.env.MAX_FILE_SIZE || '10485760') // 10MB
    const validation = validateFile(file, ['application/pdf'], maxSize)
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400)
    }
    
    // Generate storage key and upload to R2
    const storageKey = generateStorageKey(user?.id || student?.id || null, file.name)
    const fileBuffer = await file.arrayBuffer()
    const r2Bucket = c.env.R2_BUCKET
    const r2Result = await uploadToR2(r2Bucket, storageKey, fileBuffer, file.type)
    
    if (!r2Result.success) {
      return c.json({ error: r2Result.error || 'R2 업로드 실패' }, 500)
    }
    
    // Store metadata
    const result = await db.prepare(
      `INSERT INTO uploaded_files 
       (user_id, student_user_id, submission_id, file_name, file_type, mime_type, file_size, storage_key, storage_url, processing_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      user?.id || null,
      student?.id || null,
      submissionId || null,
      file.name,
      'pdf',
      file.type,
      file.size,
      storageKey,
      r2Result.url || null,
      'processing'
    ).run()
    
    const uploadedFileId = result.meta.last_row_id as number
    await logProcessingStep(db, uploadedFileId, 'upload', 'completed', 'PDF 업로드 완료', null)
    
    // Extract text from PDF
    const startTime = Date.now()
    let extractedText = null
    let pdfExtractionFailed = false
    
    // Try PDF.js first
    try {
      console.log(`Attempting PDF.js extraction for ${file.name}...`)
      const pdfResult = await processPDFExtraction(
        { name: file.name, buffer: fileBuffer, type: file.type, size: file.size }
      )
      
      if (pdfResult.success && pdfResult.extractedText && pdfResult.extractedText.trim()) {
        extractedText = pdfResult.extractedText
        
        await db.prepare(
          `UPDATE uploaded_files 
           SET extracted_text = ?, processing_status = ?, processed_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).bind(pdfResult.extractedText, 'completed', uploadedFileId).run()
        
        await logProcessingStep(
          db,
          uploadedFileId,
          'pdf_extraction',
          'completed',
          `PDF 텍스트 추출 완료 (${Date.now() - startTime}ms)`,
          pdfResult.processingTimeMs
        )
        
        console.log(`PDF.js extraction succeeded: ${pdfResult.extractedText.length} characters`)
      } else {
        // PDF.js failed or returned no text
        console.warn(`PDF.js extraction failed or returned no text: ${pdfResult.error}`)
        pdfExtractionFailed = true
        await logProcessingStep(db, uploadedFileId, 'pdf_extraction', 'failed', pdfResult.error || 'No text extracted', pdfResult.processingTimeMs)
      }
    } catch (pdfError) {
      console.error('PDF.js error:', pdfError)
      pdfExtractionFailed = true
      await logProcessingStep(db, uploadedFileId, 'pdf_extraction', 'failed', String(pdfError), null)
    }
    
    // If PDF.js failed, try OCR fallback
    if (pdfExtractionFailed && !extractedText) {
      console.log('PDF.js failed, attempting OCR.space fallback...')
      
      if (c.env.OCR_SPACE_API_KEY) {
        try {
          const ocrResult = await processOCRSpace(
            { name: file.name, buffer: fileBuffer, type: file.type, size: file.size },
            c.env.OCR_SPACE_API_KEY
          )
          
          if (ocrResult.success && ocrResult.extractedText && ocrResult.extractedText.trim()) {
            extractedText = ocrResult.extractedText
            
            await db.prepare(
              `UPDATE uploaded_files 
               SET extracted_text = ?, processing_status = ?, processed_at = CURRENT_TIMESTAMP
               WHERE id = ?`
            ).bind(ocrResult.extractedText, 'completed', uploadedFileId).run()
            
            await logProcessingStep(
              db,
              uploadedFileId,
              'ocr_space_fallback',
              'completed',
              `OCR.space 폴백 완료 (${Date.now() - startTime}ms)`,
              ocrResult.processingTimeMs
            )
            
            console.log(`OCR.space extraction succeeded: ${ocrResult.extractedText.length} characters`)
          } else {
            console.error('OCR.space failed:', ocrResult.error)
            await logProcessingStep(db, uploadedFileId, 'ocr_space_fallback', 'failed', ocrResult.error || 'No text extracted', ocrResult.processingTimeMs)
          }
        } catch (ocrError) {
          console.error('OCR.space exception:', ocrError)
          await logProcessingStep(db, uploadedFileId, 'ocr_space_fallback', 'failed', String(ocrError), null)
        }
      } else {
        console.warn('OCR_SPACE_API_KEY not configured, cannot use OCR fallback')
      }
    }
    
    // Final status update if no text was extracted
    if (!extractedText) {
      console.warn(`No text extracted from ${file.name} after all attempts`)
      await db.prepare(
        `UPDATE uploaded_files 
         SET processing_status = ?, error_message = ?, processed_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind('failed', 'Failed to extract text from PDF', uploadedFileId).run()
    }
    
    return c.json({
      success: true,
      file_id: uploadedFileId,
      file_name: file.name,
      storage_key: storageKey,
      storage_url: r2Result.url,
      extracted_text: extractedText,
      processing_time_ms: Date.now() - startTime
    })
  } catch (error) {
    console.error('PDF upload error:', error)
    return c.json({ error: 'PDF 업로드 실패', details: String(error) }, 500)
  }
})

/**
 * GET /api/upload/:id - Get uploaded file details
 */
upload.get('/:id', async (c) => {
  try {
    const fileId = parseInt(c.req.param('id'))
    const user = await getUserFromSession(c)
    const student = await getStudentFromSession(c)
    
    if (!user && !student) {
      return c.json({ error: '로그인이 필요합니다' }, 401)
    }
    
    const db = c.env.DB
    const file = await db.prepare(
      `SELECT * FROM uploaded_files WHERE id = ? AND (user_id = ? OR student_user_id = ?)`
    ).bind(fileId, user?.id || null, student?.id || null).first()
    
    if (!file) {
      return c.json({ error: '파일을 찾을 수 없습니다' }, 404)
    }
    
    return c.json({ file })
  } catch (error) {
    console.error('Error fetching file:', error)
    return c.json({ error: '파일 조회 실패', details: String(error) }, 500)
  }
})

/**
 * DELETE /api/upload/:id - Delete uploaded file
 */
upload.delete('/:id', async (c) => {
  try {
    const fileId = parseInt(c.req.param('id'))
    const user = await getUserFromSession(c)
    const student = await getStudentFromSession(c)
    
    if (!user && !student) {
      return c.json({ error: '로그인이 필요합니다' }, 401)
    }
    
    const db = c.env.DB
    
    // Get file details
    const file = await db.prepare(
      `SELECT * FROM uploaded_files WHERE id = ? AND (user_id = ? OR student_user_id = ?)`
    ).bind(fileId, user?.id || null, student?.id || null).first()
    
    if (!file) {
      return c.json({ error: '파일을 찾을 수 없습니다' }, 404)
    }
    
    // Delete from R2
    const r2Bucket = c.env.R2_BUCKET
    await deleteFromR2(r2Bucket, file.storage_key as string)
    
    // Delete from database
    await db.prepare(`DELETE FROM uploaded_files WHERE id = ?`).bind(fileId).run()
    await db.prepare(`DELETE FROM file_processing_logs WHERE file_id = ?`).bind(fileId).run()
    
    return c.json({ success: true, message: '파일이 삭제되었습니다' })
  } catch (error) {
    console.error('File deletion error:', error)
    return c.json({ error: '파일 삭제 실패', details: String(error) }, 500)
  }
})

export default upload
