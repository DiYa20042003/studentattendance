import { NextRequest, NextResponse } from 'next/server';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '@/lib/aws/dynamodb-client';
import { verifyAuthToken, authorizeStudentAccess } from '@/lib/auth/verify-token';
import { CreateAttendanceDTO, AttendanceRecord } from '@/lib/types/attendance';
import {
  isValidCalendarDate,
  isValidStatus,
  isValidStudentId,
  sanitizeNotes,
  VALID_STATUSES,
} from '@/lib/validation/attendance-validation';

export async function POST(req: NextRequest) {
  const auth = await verifyAuthToken(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: 401 });
  }

  let body: Partial<CreateAttendanceDTO>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { studentId, date, status, notes } = body;

  if (!isValidStudentId(studentId)) {
    return NextResponse.json(
      { error: 'studentId is required and must be between 1 and 64 valid characters' },
      { status: 400 }
    );
  }

  if (!isValidCalendarDate(date)) {
    return NextResponse.json(
      { error: 'date must be a valid calendar date in YYYY-MM-DD format' },
      { status: 400 }
    );
  }

  if (!isValidStatus(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  // Enforce server-side authorization: students can only record for themselves; admins/staff can record for anyone
  const authz = authorizeStudentAccess(auth.user, studentId, 'write');
  if (!authz.authorized) {
    return NextResponse.json(
      { error: authz.reason ?? 'Forbidden: Access denied' },
      { status: 403 }
    );
  }

  try {
    const now = new Date().toISOString();
    const record: AttendanceRecord = {
      studentId: studentId.trim(),
      date,
      status,
      notes: sanitizeNotes(notes),
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: record }));

    return NextResponse.json({ message: 'Attendance record saved successfully', data: record });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[attendance POST]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
