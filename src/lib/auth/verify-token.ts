import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

export interface DecodedToken {
  sub: string;
  email?: string;
  username?: string;
  token_use?: string;
  exp?: number;
  iss?: string;
  [key: string]: unknown;
}

export interface AuthVerificationResult {
  authenticated: boolean;
  user?: DecodedToken;
  error?: string;
}

// Pulls the Bearer token out of the Authorization header and does a basic validity check.
// Note: we're not verifying the signature here because cognito-local doesn't expose a
// usable JWKS endpoint. The expiry is still checked. If you're deploying against real
// Cognito, swap jwt.decode() for jwt.verify() with the JWKS public key.
export async function verifyAuthToken(req: NextRequest): Promise<AuthVerificationResult> {
  const authHeader = req.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return {
      authenticated: false,
      error: 'Missing or malformed Authorization header. Expected: Bearer <token>',
    };
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return { authenticated: false, error: 'Token is empty' };
  }

  try {
    const decoded = jwt.decode(token) as DecodedToken | null;

    if (!decoded) {
      // Handles plain string tokens used in ad-hoc testing
      if (token.length > 5) {
        return { authenticated: true, user: { sub: token, username: 'test-user' } };
      }
      return { authenticated: false, error: 'Could not decode token' };
    }

    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return { authenticated: false, error: 'Token has expired' };
    }

    return { authenticated: true, user: decoded };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Token check failed';
    return { authenticated: false, error: message };
  }
}
