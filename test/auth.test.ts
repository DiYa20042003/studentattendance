import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { verifyAuthToken, verifyRawToken } from '../src/lib/auth/verify-token';

const TEST_SECRET = 'local-dev-jwt-secret-key-123456789';

describe('Authentication & JWT Verification Tests', () => {
  it('should reject missing Authorization header', async () => {
    const req = new NextRequest('http://localhost:3000/api/attendance');
    const result = await verifyAuthToken(req);
    assert.equal(result.authenticated, false);
    assert.match(result.error || '', /Missing or malformed Authorization header/i);
  });

  it('should reject non-Bearer authorization scheme', async () => {
    const req = new NextRequest('http://localhost:3000/api/attendance', {
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
    });
    const result = await verifyAuthToken(req);
    assert.equal(result.authenticated, false);
    assert.match(result.error || '', /Expected: Bearer/i);
  });

  it('should reject empty Bearer token', async () => {
    const req = new NextRequest('http://localhost:3000/api/attendance', {
      headers: { authorization: 'Bearer   ' },
    });
    const result = await verifyAuthToken(req);
    assert.equal(result.authenticated, false);
    assert.match(result.error || '', /Token is empty/i);
  });

  it('should reject ad-hoc plain strings that previously exploited the length > 5 bypass', async () => {
    // In the old code, any string longer than 5 chars was accepted with sub: token!
    const arbitraryString = 'arbitrary-unauthenticated-string-token';
    const req = new NextRequest('http://localhost:3000/api/attendance', {
      headers: { authorization: `Bearer ${arbitraryString}` },
    });
    const result = await verifyAuthToken(req);
    assert.equal(result.authenticated, false);
    assert.match(result.error || '', /malformed|verification failed/i);
  });

  it('should reject expired signed tokens', async () => {
    const expiredToken = jwt.sign(
      {
        sub: 'user-expired-123',
        username: 'expired@student.edu',
        exp: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
      },
      TEST_SECRET
    );

    const req = new NextRequest('http://localhost:3000/api/attendance', {
      headers: { authorization: `Bearer ${expiredToken}` },
    });
    const result = await verifyAuthToken(req);
    assert.equal(result.authenticated, false);
    assert.match(result.error || '', /jwt expired/i);
  });

  it('should reject tokens with invalid or tampered signatures', async () => {
    const tamperedToken = jwt.sign(
      { sub: 'attacker-sub', username: 'attacker' },
      'wrong-secret-key-attacker'
    );

    const req = new NextRequest('http://localhost:3000/api/attendance', {
      headers: { authorization: `Bearer ${tamperedToken}` },
    });
    const result = await verifyAuthToken(req);
    assert.equal(result.authenticated, false);
    assert.match(result.error || '', /invalid signature/i);
  });

  it('should successfully verify a validly signed token with trusted secret', async () => {
    const validToken = jwt.sign(
      {
        sub: 'student-valid-001',
        email: 'alice@university.edu',
        username: 'alice',
        token_use: 'access',
      },
      TEST_SECRET,
      { expiresIn: '1h' }
    );

    const req = new NextRequest('http://localhost:3000/api/attendance', {
      headers: { authorization: `Bearer ${validToken}` },
    });
    const result = await verifyAuthToken(req);
    assert.equal(result.authenticated, true);
    assert.equal(result.user?.sub, 'student-valid-001');
    assert.equal(result.user?.username, 'alice');
  });
});
