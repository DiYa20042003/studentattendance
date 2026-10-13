import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeStudentAccess,
  isStaffOrAdmin,
  DecodedToken,
} from '../src/lib/auth/verify-token';

describe('Authorization & IDOR Protection Tests', () => {
  const studentUser: DecodedToken = {
    sub: 'sub-alice-101',
    email: 'alice@student.university.edu',
    username: 'alice101',
    'custom:studentId': 'STU-101',
  };

  const bobUser: DecodedToken = {
    sub: 'sub-bob-102',
    email: 'bob@student.university.edu',
    username: 'bob102',
    'custom:studentId': 'STU-102',
  };

  const adminUser: DecodedToken = {
    sub: 'sub-admin-001',
    email: 'admin.staff@university.edu',
    username: 'admin_staff',
    'cognito:groups': ['admin'],
  };

  const teacherUser: DecodedToken = {
    sub: 'sub-prof-202',
    email: 'prof.smith@university.edu',
    username: 'prof_smith',
    'custom:role': 'teacher',
  };

  describe('isStaffOrAdmin check', () => {
    it('identifies admin from cognito:groups', () => {
      assert.equal(isStaffOrAdmin(adminUser), true);
    });

    it('identifies teacher from custom:role', () => {
      assert.equal(isStaffOrAdmin(teacherUser), true);
    });

    it('identifies student as non-staff/non-admin', () => {
      assert.equal(isStaffOrAdmin(studentUser), false);
      assert.equal(isStaffOrAdmin(bobUser), false);
    });
  });

  describe('Student-level authorization (Read)', () => {
    it('allows student to view their own attendance by sub', () => {
      const res = authorizeStudentAccess(studentUser, 'sub-alice-101', 'read');
      assert.equal(res.authorized, true);
    });

    it('allows student to view their own attendance by custom:studentId', () => {
      const res = authorizeStudentAccess(studentUser, 'STU-101', 'read');
      assert.equal(res.authorized, true);
    });

    it('allows student to view their own attendance by username', () => {
      const res = authorizeStudentAccess(studentUser, 'alice101', 'read');
      assert.equal(res.authorized, true);
    });

    it('BLOCKS student from viewing another student attendance (IDOR attempt)', () => {
      const res = authorizeStudentAccess(studentUser, 'STU-102', 'read');
      assert.equal(res.authorized, false);
      assert.match(res.reason || '', /only access your own/i);
    });

    it('allows admin/staff to view any student attendance', () => {
      assert.equal(authorizeStudentAccess(adminUser, 'STU-101', 'read').authorized, true);
      assert.equal(authorizeStudentAccess(adminUser, 'STU-102', 'read').authorized, true);
      assert.equal(authorizeStudentAccess(teacherUser, 'STU-101', 'read').authorized, true);
    });
  });

  describe('Student-level authorization (Write)', () => {
    it('allows student to record their own attendance', () => {
      const res = authorizeStudentAccess(studentUser, 'STU-101', 'write');
      assert.equal(res.authorized, true);
    });

    it('BLOCKS student from creating or updating another student attendance', () => {
      const res = authorizeStudentAccess(studentUser, 'STU-102', 'write');
      assert.equal(res.authorized, false);
      assert.match(res.reason || '', /not authorized.*other students/i);
    });

    it('allows admin/teacher to record attendance for any student', () => {
      assert.equal(authorizeStudentAccess(adminUser, 'STU-101', 'write').authorized, true);
      assert.equal(authorizeStudentAccess(adminUser, 'STU-102', 'write').authorized, true);
      assert.equal(authorizeStudentAccess(teacherUser, 'STU-101', 'write').authorized, true);
    });
  });
});
