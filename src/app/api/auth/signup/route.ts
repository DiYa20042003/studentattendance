import { NextRequest, NextResponse } from 'next/server';
import { SignUpCommand, AdminConfirmSignUpCommand } from '@aws-sdk/client-cognito-identity-provider';
import { cognitoClient, CLIENT_ID, USER_POOL_ID } from '@/lib/aws/cognito-client';
import { AuthSignUpDTO } from '@/lib/types/attendance';

export async function POST(req: NextRequest) {
  try {
    const body: AuthSignUpDTO = await req.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const signUpCommand = new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        ...(name ? [{ Name: 'name', Value: name }] : []),
      ],
    });

    const result = await cognitoClient.send(signUpCommand);

    // Skip email verification in local dev by auto-confirming.
    // In production this block would be removed and the user would verify via email.
    try {
      await cognitoClient.send(
        new AdminConfirmSignUpCommand({ UserPoolId: USER_POOL_ID, Username: email })
      );
    } catch {
      // fine to ignore — might not have admin permissions in some environments
    }

    return NextResponse.json(
      {
        message: 'User registered successfully',
        userSub: result.UserSub,
        userConfirmed: result.UserConfirmed ?? true,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    console.error('[signup]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
