/**
 * Validation Schemas using Zod
 * 
 * OWASP Input Validation Guidelines:
 * - Validate all user inputs at the entry point
 * - Use whitelist approach (define what is allowed)
 * - Validate data type, length, format, and range
 * - Sanitize data before use
 */

import { z } from 'zod';

// ============================================
// Common Validation Patterns
// ============================================

/**
 * Email validation
 * - RFC 5322 compliant
 * - Max length: 254 characters
 */
export const emailSchema = z
  .string()
  .email('유효한 이메일 주소를 입력해주세요')
  .max(254, '이메일은 254자를 초과할 수 없습니다')
  .toLowerCase()
  .trim();

/**
 * Password validation (OWASP compliant)
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character
 */
export const passwordSchema = z
  .string()
  .min(12, '패스워드는 최소 12자 이상이어야 합니다')
  .max(128, '패스워드는 128자를 초과할 수 없습니다')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+=\-[\]{}|\\:;"'<>,./~`])/,
    '패스워드는 대문자, 소문자, 숫자, 특수문자를 각각 최소 1개씩 포함해야 합니다'
  );

/**
 * Name validation
 * - Korean, English, spaces only
 * - 2-50 characters
 */
export const nameSchema = z
  .string()
  .min(2, '이름은 최소 2자 이상이어야 합니다')
  .max(50, '이름은 50자를 초과할 수 없습니다')
  .regex(/^[가-힣a-zA-Z\s]+$/, '이름은 한글, 영문, 공백만 사용할 수 있습니다')
  .trim();

/**
 * Grade level validation (학년)
 */
export const gradeLevelSchema = z
  .string()
  .regex(/^(초등|중등|고등)$/, '학년 수준은 초등, 중등, 고등 중 하나여야 합니다');

/**
 * Text content validation (general purpose)
 * - Prevents XSS by limiting character set
 * - Max 10,000 characters
 */
export const textContentSchema = z
  .string()
  .max(10000, '내용은 10,000자를 초과할 수 없습니다')
  .trim();

/**
 * Essay content validation (longer content)
 * - Max 50,000 characters for essays
 */
export const essayContentSchema = z
  .string()
  .min(1, '에세이 내용을 입력해주세요')
  .max(50000, '에세이는 50,000자를 초과할 수 없습니다')
  .trim();

/**
 * UUID validation
 */
export const uuidSchema = z
  .string()
  .uuid('유효한 UUID 형식이 아닙니다');

/**
 * Access code validation (6 characters, alphanumeric)
 */
export const accessCodeSchema = z
  .string()
  .length(6, '접근 코드는 정확히 6자리여야 합니다')
  .regex(/^[A-Z0-9]+$/, '접근 코드는 대문자 영문과 숫자만 사용할 수 있습니다');

/**
 * Assignment title validation
 */
export const assignmentTitleSchema = z
  .string()
  .min(2, '과제 제목은 최소 2자 이상이어야 합니다')
  .max(200, '과제 제목은 200자를 초과할 수 없습니다')
  .trim();

/**
 * Assignment description validation
 */
export const assignmentDescriptionSchema = z
  .string()
  .max(2000, '과제 설명은 2,000자를 초과할 수 없습니다')
  .trim()
  .optional();

/**
 * Reference material validation
 */
export const referenceMaterialSchema = z
  .string()
  .max(5000, '제시문은 5,000자를 초과할 수 없습니다')
  .trim();

/**
 * File name validation
 * - Alphanumeric, Korean, dash, underscore, dot only
 * - Max 255 characters
 */
export const fileNameSchema = z
  .string()
  .max(255, '파일명은 255자를 초과할 수 없습니다')
  .regex(
    /^[가-힣a-zA-Z0-9\s._-]+$/,
    '파일명에 허용되지 않는 문자가 포함되어 있습니다'
  );

/**
 * Pagination validation
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

// ============================================
// Authentication Schemas
// ============================================

/**
 * User signup validation
 */
export const userSignupSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema
});

/**
 * User login validation
 */
export const userLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, '패스워드를 입력해주세요')
});

/**
 * Student signup validation
 */
export const studentSignupSchema = z.object({
  name: nameSchema,
  accessCode: accessCodeSchema,
  password: passwordSchema
});

/**
 * Student login validation
 */
export const studentLoginSchema = z.object({
  name: nameSchema,
  accessCode: accessCodeSchema,
  password: z.string().min(1, '패스워드를 입력해주세요')
});

// ============================================
// Assignment Schemas
// ============================================

/**
 * Create assignment validation
 */
export const createAssignmentSchema = z.object({
  title: assignmentTitleSchema,
  description: assignmentDescriptionSchema,
  grade_level: gradeLevelSchema,
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD여야 합니다').optional(),
  prompts: z.array(referenceMaterialSchema).min(1, '최소 1개 이상의 제시문이 필요합니다').max(10, '제시문은 최대 10개까지 추가할 수 있습니다')
});

/**
 * Update assignment validation
 */
export const updateAssignmentSchema = z.object({
  id: uuidSchema,
  title: assignmentTitleSchema.optional(),
  description: assignmentDescriptionSchema,
  grade_level: gradeLevelSchema.optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD여야 합니다').optional()
});

// ============================================
// Essay Grading Schemas
// ============================================

/**
 * Essay grading request validation
 */
export const gradeEssaySchema = z.object({
  essayText: essayContentSchema,
  rubric: textContentSchema.optional(),
  gradeLevel: gradeLevelSchema.optional(),
  assignmentId: uuidSchema.optional(),
  sessionId: uuidSchema.optional()
});

/**
 * Hybrid grading request validation
 */
export const hybridGradingSchema = z.object({
  essayText: essayContentSchema,
  rubric: textContentSchema.optional(),
  gradeLevel: gradeLevelSchema.optional()
});

// ============================================
// File Upload Schemas
// ============================================

/**
 * File upload validation
 */
export const fileUploadSchema = z.object({
  fileName: fileNameSchema,
  fileSize: z.number().int().positive().max(10 * 1024 * 1024, '파일 크기는 10MB를 초과할 수 없습니다'),
  fileType: z.enum(['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'], {
    errorMap: () => ({ message: '지원하지 않는 파일 형식입니다. JPG, PNG, PDF만 업로드 가능합니다' })
  })
});

// ============================================
// Session Management Schemas
// ============================================

/**
 * Session ID validation
 */
export const sessionIdSchema = z.object({
  sessionId: uuidSchema
});

/**
 * Essay ID validation
 */
export const essayIdSchema = z.object({
  essayId: uuidSchema
});

// ============================================
// Type Exports
// ============================================

export type UserSignup = z.infer<typeof userSignupSchema>;
export type UserLogin = z.infer<typeof userLoginSchema>;
export type StudentSignup = z.infer<typeof studentSignupSchema>;
export type StudentLogin = z.infer<typeof studentLoginSchema>;
export type CreateAssignment = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignment = z.infer<typeof updateAssignmentSchema>;
export type GradeEssay = z.infer<typeof gradeEssaySchema>;
export type HybridGrading = z.infer<typeof hybridGradingSchema>;
export type FileUpload = z.infer<typeof fileUploadSchema>;
export type SessionId = z.infer<typeof sessionIdSchema>;
export type EssayId = z.infer<typeof essayIdSchema>;

// ============================================
// Validation Helper Function
// ============================================

/**
 * Generic validation function with detailed error messages
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validation result with success flag and data or errors
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string[]> } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {};
      
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(err.message);
      });
      
      return { success: false, errors };
    }
    
    return {
      success: false,
      errors: { _general: ['검증 중 오류가 발생했습니다'] }
    };
  }
}

/**
 * Async validation wrapper for middleware
 */
export async function validateAsync<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<T> {
  return schema.parseAsync(data);
}
