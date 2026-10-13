import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidCalendarDate,
  isValidStudentId,
  isValidStatus,
  sanitizeNotes,
} from '../src/lib/validation/attendance-validation';

describe('Input Validation Tests', () => {
  describe('isValidCalendarDate', () => {
    it('accepts valid calendar dates', () => {
      assert.equal(isValidCalendarDate('2026-07-27'), true);
      assert.equal(isValidCalendarDate('2024-02-29'), true); // leap year
      assert.equal(isValidCalendarDate('2025-12-31'), true);
      assert.equal(isValidCalendarDate('2026-01-01'), true);
    });

    it('rejects invalid months', () => {
      assert.equal(isValidCalendarDate('2026-00-10'), false);
      assert.equal(isValidCalendarDate('2026-13-10'), false);
    });

    it('rejects invalid days for 30-day months', () => {
      assert.equal(isValidCalendarDate('2026-04-31'), false); // April has 30 days
      assert.equal(isValidCalendarDate('2026-06-31'), false); // June has 30 days
      assert.equal(isValidCalendarDate('2026-09-31'), false); // Sept has 30 days
      assert.equal(isValidCalendarDate('2026-11-31'), false); // Nov has 30 days
    });

    it('rejects invalid February dates and non-leap years', () => {
      assert.equal(isValidCalendarDate('2026-02-29'), false); // 2026 is not leap year
      assert.equal(isValidCalendarDate('2026-02-30'), false);
      assert.equal(isValidCalendarDate('2026-02-31'), false);
    });

    it('rejects malformed date strings', () => {
      assert.equal(isValidCalendarDate('27-07-2026'), false);
      assert.equal(isValidCalendarDate('2026/07/27'), false);
      assert.equal(isValidCalendarDate('not-a-date'), false);
      assert.equal(isValidCalendarDate(''), false);
      assert.equal(isValidCalendarDate(null), false);
    });
  });

  describe('isValidStudentId', () => {
    it('accepts valid student IDs', () => {
      assert.equal(isValidStudentId('STU-101'), true);
      assert.equal(isValidStudentId('student_2026_001'), true);
      assert.equal(isValidStudentId('alice@university.edu'), true);
      assert.equal(isValidStudentId('abc-123-def'), true);
    });

    it('rejects empty or whitespace-only student IDs', () => {
      assert.equal(isValidStudentId(''), false);
      assert.equal(isValidStudentId('   '), false);
      assert.equal(isValidStudentId(null), false);
    });

    it('rejects IDs with forbidden characters or path traversal', () => {
      assert.equal(isValidStudentId('../../../etc/passwd'), false);
      assert.equal(isValidStudentId('student<script>'), false);
      assert.equal(isValidStudentId('student id with spaces'), false);
    });
  });

  describe('isValidStatus', () => {
    it('accepts recognized attendance statuses', () => {
      assert.equal(isValidStatus('PRESENT'), true);
      assert.equal(isValidStatus('ABSENT'), true);
      assert.equal(isValidStatus('LATE'), true);
      assert.equal(isValidStatus('EXCUSED'), true);
    });

    it('rejects unknown or invalid statuses', () => {
      assert.equal(isValidStatus('UNKNOWN'), false);
      assert.equal(isValidStatus('present'), false); // case sensitivity
      assert.equal(isValidStatus(''), false);
      assert.equal(isValidStatus(123), false);
    });
  });

  describe('sanitizeNotes', () => {
    it('trims whitespace and handles normal text', () => {
      assert.equal(sanitizeNotes('  Medical leave  '), 'Medical leave');
    });

    it('truncates notes exceeding 500 characters', () => {
      const longNote = 'a'.repeat(600);
      const sanitized = sanitizeNotes(longNote);
      assert.equal(sanitized.length, 500);
    });

    it('returns empty string for non-string inputs', () => {
      assert.equal(sanitizeNotes(null), '');
      assert.equal(sanitizeNotes(undefined), '');
      assert.equal(sanitizeNotes(12345), '');
    });
  });
});
