import { z } from 'zod';

// ========== Auth Schemas ==========

export const registerSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  sliitIndex: z.string().min(5, 'SLIIT index is required'),
  faculty: z.string().min(1, 'Faculty is required'),
  batchYear: z.number().int().min(2000, 'Invalid batch year'),
  contactNumber: z.string().min(9, 'Contact number must be at least 9 digits'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// ========== User Schemas ==========

export const updateUserSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  contactNumber: z.string().min(9).optional(),
  faculty: z.string().optional(),
  avenue: z.string().optional(),
  profilePhotoUrl: z.string().url().optional().or(z.literal('')),
});

export const approveUserSchema = z.object({
  roleId: z.string().min(1, 'Role ID is required'),
  avenue: z.string().optional(),
});

// ========== Project Schemas ==========

export const createProjectSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  avenue: z.string().min(1, 'Avenue is required'),
  leads: z.array(z.string()).optional().default([]),
  committeeMembers: z.array(z.string()).optional().default([]),
  budget: z.object({
    estimated: z.number().min(0).default(0),
    actual: z.number().min(0).default(0),
  }).optional().default({ estimated: 0, actual: 0 }),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  targetBeneficiaries: z.string().optional(),
  sponsors: z.array(z.object({
    name: z.string(),
    contactInfo: z.string(),
  })).optional().default([]),
  externalLinks: z.array(z.object({
    label: z.string(),
    url: z.string().url(),
  })).optional().default([]),
});

export const updateProjectSchema = createProjectSchema.partial();

export const updateProjectStatusSchema = z.object({
  status: z.enum(['proposed', 'approved', 'ongoing', 'completed', 'reported']),
  comments: z.string().optional(),
});

// ========== Event Schemas ==========

export const createEventSchema = z.object({
  type: z.enum(['meeting', 'project_session', 'social']),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  linkedProjectId: z.string().optional(),
  startTime: z.string().datetime('Invalid start time'),
  endTime: z.string().datetime('Invalid end time'),
  location: z.string().min(1, 'Location is required'),
  description: z.string().optional(),
  avenue: z.string().optional(),
  recurringRule: z.string().optional(),
});

export const updateEventSchema = createEventSchema.partial();

// ========== Minutes Schemas ==========

export const saveDraftSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  agendaItems: z.array(z.string()).optional().default([]),
  discussionNotes: z.string().optional().default(''),
  decisions: z.array(z.string()).optional().default([]),
  actionItems: z.array(z.object({
    task: z.string().min(1),
    assigneeId: z.string().min(1),
    dueDate: z.string().datetime(),
    status: z.enum(['open', 'in-progress', 'done']).optional().default('open'),
  })).optional().default([]),
});

export const updateActionItemStatusSchema = z.object({
  status: z.enum(['open', 'in-progress', 'done']),
});

// ========== Report Schemas ==========

export const generateMonthlyReportSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
});

// ========== Attendance Schemas ==========

export const checkInSchema = z.object({
  qrToken: z.string().min(1, 'QR token is required'),
});

export const manualCheckInSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  userId: z.string().min(1, 'User ID is required'),
});

// ========== Booking Schemas ==========

export const createBookingSchema = z.object({
  venue: z.string().min(1, 'Venue is required'),
  eventId: z.string().optional(),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  startTime: z.string().datetime('Invalid start time'),
  endTime: z.string().datetime('Invalid end time'),
  reason: z.string().optional(),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().optional(),
});

// ========== Pagination & Query Schemas ==========

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional().default('-createdAt'),
});

// Helper to validate and extract with safe defaults
export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

export function validateQuery<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}
