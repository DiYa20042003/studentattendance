import { NextRequest, NextResponse } from 'next/server';
import { InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';
import { cognitoClient, CLIENT_ID } from '@/lib/aws/cognito-client';
import { AuthSignInDTO } from '@/lib/types/attendance';

export async function POST(req: NextRequest) {
  try {
    const body: AuthSignInDTO = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const response = await cognitoClient.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      })
    );

    const tokens = response.AuthenticationResult;
    if (!tokens) {
      return NextResponse.json(
        { error: 'Authentication failed — check credentials or complete any required challenges' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      message: 'Sign in successful',
      accessToken: tokens.AccessToken,
      idToken: tokens.IdToken,
      refreshToken: tokens.RefreshToken,
      expiresIn: tokens.ExpiresIn,
      tokenType: tokens.TokenType ?? 'Bearer',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    console.error('[signin]', message);
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
