import { NextRequest, NextResponse } from 'next/server';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '@/lib/aws/dynamodb-client';
import { verifyAuthToken } from '@/lib/auth/verify-token';

export async function GET(
  req: NextRequest,
  { params }: { params: { studentId: string } }
) {
  const auth = await verifyAuthToken(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: 401 });
  }

  const { studentId } = params;

  if (!studentId) {
    return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
  }

  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'studentId = :sid',
        ExpressionAttributeValues: { ':sid': studentId },
        ScanIndexForward: true, // oldest to newest
      })
    );

    return NextResponse.json({
      studentId,
      count: result.Count ?? 0,
      records: result.Items ?? [],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[attendance GET]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
