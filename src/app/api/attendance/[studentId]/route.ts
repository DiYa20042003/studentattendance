import { NextRequest, NextResponse } from 'next/server';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '@/lib/aws/dynamodb-client';
import { verifyAuthToken, authorizeStudentAccess } from '@/lib/auth/verify-token';
import { isValidStudentId } from '@/lib/validation/attendance-validation';

export async function GET(
  req: NextRequest,
  { params }: { params: { studentId: string } }
) {
  const auth = await verifyAuthToken(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: 401 });
  }

  const { studentId } = params;

  if (!isValidStudentId(studentId)) {
    return NextResponse.json(
      { error: 'studentId is required and must be between 1 and 64 valid characters' },
      { status: 400 }
    );
  }

  // Enforce server-side authorization: students can only access their own records; admins/staff can query any student
  const authz = authorizeStudentAccess(auth.user, studentId, 'read');
  if (!authz.authorized) {
    return NextResponse.json(
      { error: authz.reason ?? 'Forbidden: Access denied' },
      { status: 403 }
    );
  }

  // Optional pagination / limit control with bounded max
  const searchParams = req.nextUrl?.searchParams;
  const rawLimit = searchParams?.get('limit');
  let parsedLimit = 50;
  if (rawLimit) {
    const num = parseInt(rawLimit, 10);
    if (!isNaN(num) && num > 0) {
      parsedLimit = Math.min(num, 100);
    }
  }

  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'studentId = :sid',
        ExpressionAttributeValues: { ':sid': studentId.trim() },
        ScanIndexForward: true, // oldest to newest
        Limit: parsedLimit,
      })
    );

    return NextResponse.json({
      studentId: studentId.trim(),
      count: result.Count ?? 0,
      records: result.Items ?? [],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[attendance GET]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
