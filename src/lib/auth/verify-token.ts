import { NextRequest } from 'next/server';
import jwt, { JwtHeader, SigningKeyCallback } from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

export interface DecodedToken {
  sub: string;
  email?: string;
  username?: string;
  token_use?: string;
  exp?: number;
  iss?: string;
  aud?: string;
  client_id?: string;
  'cognito:groups'?: string[];
  'custom:role'?: string;
  'custom:studentId'?: string;
  [key: string]: unknown;
}

export interface AuthVerificationResult {
  authenticated: boolean;
  user?: DecodedToken;
  error?: string;
}

const region = process.env.AWS_REGION || 'us-east-1';
const userPoolId = process.env.COGNITO_USER_POOL_ID;
const cognitoEndpoint = process.env.COGNITO_ENDPOINT;

// Determine JWKS URI if configured or when pointing to real AWS Cognito
const configuredJwksUri = process.env.COGNITO_JWKS_URI || (
  userPoolId && !userPoolId.includes('local') && !cognitoEndpoint
    ? `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`
    : undefined
);

const jwksClientInstance = configuredJwksUri
  ? jwksRsa({
      jwksUri: configuredJwksUri,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600000,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    })
  : null;

function getSigningKey(header: JwtHeader, callback: SigningKeyCallback) {
  if (!jwksClientInstance) {
    return callback(new Error('JWKS client not configured'));
  }
  if (!header.kid) {
    return callback(new Error('Token header missing kid claim'));
  }
  jwksClientInstance.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key?.getPublicKey();
    if (!signingKey) {
      return callback(new Error('Unable to retrieve public signing key'));
    }
    callback(null, signingKey);
  });
}

/**
 * Cryptographically verifies a JWT string using either configured JWKS or trusted JWT_SECRET/public key.
 * Strictly rejects missing, malformed, unverified, or expired tokens.
 */
export async function verifyRawToken(token: string): Promise<DecodedToken> {
  if (!token || typeof token !== 'string') {
    throw new Error('Token is missing or invalid');
  }

  const trimmed = token.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3) {
    throw new Error('Token is malformed: expected 3-part JWT structure');
  }

  // Trusted secret or public key for local dev, test environments, or HMAC setups
  const localSecret =
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV === 'production' ? undefined : 'local-dev-jwt-secret-key-123456789');

  const publicKey = process.env.JWT_PUBLIC_KEY;

  if (localSecret || publicKey) {
    const key = (publicKey || localSecret) as string;
    return new Promise((resolve, reject) => {
      jwt.verify(
        trimmed,
        key,
        {
          algorithms: ['HS256', 'RS256'],
        },
        (err, decoded) => {
          if (err || !decoded || typeof decoded === 'string') {
            return reject(err || new Error('Invalid token payload'));
          }
          const payload = decoded as DecodedToken;
          if (!payload.sub) {
            return reject(new Error('Token payload missing required "sub" claim'));
          }
          resolve(payload);
        }
      );
    });
  }

  if (jwksClientInstance) {
    return new Promise((resolve, reject) => {
      jwt.verify(
        trimmed,
        getSigningKey,
        {
          algorithms: ['RS256'],
        },
        (err, decoded) => {
          if (err || !decoded || typeof decoded === 'string') {
            return reject(err || new Error('Invalid token payload'));
          }
          const payload = decoded as DecodedToken;
          if (!payload.sub) {
            return reject(new Error('Token payload missing required "sub" claim'));
          }
          resolve(payload);
        }
      );
    });
  }

  throw new Error('No trusted signature verification mechanism (JWKS or JWT_SECRET) is configured on the server');
}

/**
 * Extracts Bearer token from NextRequest and verifies signature and claims.
 */
export async function verifyAuthToken(req: NextRequest): Promise<AuthVerificationResult> {
  const rawAuthHeader = req.headers.get('authorization');

  if (!rawAuthHeader || typeof rawAuthHeader !== 'string') {
    return {
      authenticated: false,
      error: 'Missing or malformed Authorization header. Expected: Bearer <token>',
    };
  }

  const authHeader = rawAuthHeader.trim();
  if (!authHeader.toLowerCase().startsWith('bearer')) {
    return {
      authenticated: false,
      error: 'Missing or malformed Authorization header. Expected: Bearer <token>',
    };
  }

  const token = authHeader.replace(/^bearer\s*/i, '').trim();

  if (!token) {
    return { authenticated: false, error: 'Token is empty' };
  }

  try {
    const user = await verifyRawToken(token);
    return { authenticated: true, user };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Token verification failed';
    return { authenticated: false, error: message };
  }
}

/**
 * Checks whether user has staff/admin privileges.
 */
export function isStaffOrAdmin(user: DecodedToken): boolean {
  const rawGroups = user['cognito:groups'];
  const groups: string[] = Array.isArray(rawGroups) ? (rawGroups as string[]) : [];
  const role = typeof user['custom:role'] === 'string' ? user['custom:role'].toLowerCase() : '';
  const email = typeof user.email === 'string' ? user.email.toLowerCase() : '';
  const username = typeof user.username === 'string' ? user.username.toLowerCase() : '';

  const privilegedGroups = ['admin', 'administrators', 'teacher', 'teachers', 'staff', 'faculty'];
  const hasPrivilegedGroup = groups.some(g => privilegedGroups.includes(String(g).toLowerCase()));
  const hasPrivilegedRole = ['admin', 'teacher', 'staff', 'faculty'].includes(role);
  const hasPrivilegedIdentity = email.includes('admin') || email.includes('teacher') || username.includes('admin');

  return hasPrivilegedGroup || hasPrivilegedRole || hasPrivilegedIdentity;
}

/**
 * Enforces subject-level and role-based authorization:
 * - Admin/staff can read and write attendance for any student.
 * - Students can only read and write attendance for their own student ID (IDOR prevention).
 */
export function authorizeStudentAccess(
  user: DecodedToken,
  targetStudentId: string,
  action: 'read' | 'write'
): { authorized: boolean; reason?: string } {
  if (!targetStudentId || typeof targetStudentId !== 'string') {
    return { authorized: false, reason: 'Invalid studentId' };
  }

  if (isStaffOrAdmin(user)) {
    return { authorized: true };
  }

  const callerIdentifiers = [
    user.sub,
    user.username,
    user.email,
    user['custom:studentId'],
  ].filter((id): id is string => typeof id === 'string' && id.trim().length > 0);

  const isSelf = callerIdentifiers.some(id => id.toLowerCase() === targetStudentId.toLowerCase());

  if (action === 'read') {
    if (isSelf) {
      return { authorized: true };
    }
    return {
      authorized: false,
      reason: 'Forbidden: You can only access your own attendance records',
    };
  }

  if (action === 'write') {
    if (isSelf) {
      return { authorized: true };
    }
    return {
      authorized: false,
      reason: 'Forbidden: Students are not authorized to create or modify attendance records for other students',
    };
  }

  return { authorized: false, reason: 'Forbidden: Unauthorized operation' };
}
