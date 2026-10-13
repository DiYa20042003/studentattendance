import { AttendanceStatus } from '@/lib/types/attendance';

export const VALID_STATUSES: readonly AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;

/**
 * Validates studentId format: non-empty string between 1 and 64 characters,
 * alphanumeric plus hyphens, underscores, dots, or at-signs.
 */
export function isValidStudentId(studentId: unknown): studentId is string {
  if (typeof studentId !== 'string') return false;
  const trimmed = studentId.trim();
  if (trimmed.length < 1 || trimmed.length > 64) return false;
  return /^[a-zA-Z0-9@._-]+$/.test(trimmed);
}

/**
 * Validates that dateStr is a real, semantic calendar date in YYYY-MM-DD format.
 * Prevents invalid dates like 2026-02-31, 2026-13-40, leap-year errors, etc.
 */
export function isValidCalendarDate(dateStr: unknown): dateStr is string {
  if (typeof dateStr !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;

  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;

  // Construct UTC date and verify each component matches
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  return (
    dateObj.getUTCFullYear() === year &&
    dateObj.getUTCMonth() === month - 1 &&
    dateObj.getUTCDate() === day
  );
}

/**
 * Validates attendance status.
 */
export function isValidStatus(status: unknown): status is AttendanceStatus {
  return typeof status === 'string' && (VALID_STATUSES as readonly string[]).includes(status);
}

/**
 * Sanitizes optional notes: strings capped at 500 characters.
 */
export function sanitizeNotes(notes: unknown): string {
  if (typeof notes !== 'string') return '';
  return notes.trim().slice(0, 500);
}
