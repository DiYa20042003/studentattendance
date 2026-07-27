import { NextRequest, NextResponse } from 'next/server';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '@/lib/aws/dynamodb-client';
import { verifyAuthToken } from '@/lib/auth/verify-token';
import { CreateAttendanceDTO, AttendanceRecord } from '@/lib/types/attendance';

const VALID_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;

export async function POST(req: NextRequest) {
  const auth = await verifyAuthToken(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: 401 });
  }

  let body: CreateAttendanceDTO;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { studentId, date, status, notes } = body;

  if (!studentId || typeof studentId !== 'string') {
    return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'date must be in YYYY-MM-DD format' },
      { status: 400 }
    );
  }

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const now = new Date().toISOString();
    const record: AttendanceRecord = {
      studentId,
      date,
      status,
      notes: notes ?? '',
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
