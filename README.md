# Student Attendance API

A simple REST API for tracking student attendance, built on Next.js 14 App Router. Authentication is handled through Cognito and records are stored in DynamoDB.

I put this together as a take-home project. The core idea was to keep it minimal — one table, a couple of auth endpoints, two attendance endpoints, and no unnecessary abstractions. Everything runs locally without needing real AWS credentials.

---

## Project Structure

```
src/
  app/
    api/
      auth/
        signup/route.ts     # POST /api/auth/signup
        signin/route.ts     # POST /api/auth/signin
      attendance/
        route.ts            # POST /api/attendance
        [studentId]/
          route.ts          # GET /api/attendance/:studentId
  lib/
    auth/
      verify-token.ts       # JWT extraction + expiry check
    aws/
      cognito-client.ts
      dynamodb-client.ts
    types/
      attendance.ts
scripts/
  init-local-aws.ts         # Creates the DynamoDB table locally
  local-services.ts         # Spins up mock Cognito + DynamoDB servers (no Docker needed)
  test-api.ts               # End-to-end test against the running server
```

---

## Why this key schema?

DynamoDB table: `StudentAttendance`

| Key        | Attribute   | Reason                                                                 |
|------------|-------------|------------------------------------------------------------------------|
| Partition  | `studentId` | Groups all records for one student together in the same partition      |
| Sort       | `date`      | Enforces one record per student per day; keeps results in date order   |

Using `studentId` as the partition key made the most sense here. The main read pattern is "give me all attendance for student X", and a partition key query on DynamoDB is exactly what that maps to — no scan, no GSI needed. The sort key being `date` means a duplicate submission for the same day just overwrites the old record (upsert via PutItem), which is the right behaviour for an attendance system.

I considered putting `date` as the partition key and `studentId` as sort, but that would make per-student queries require a GSI or a full scan, which is worse. The current layout keeps it simple.

---

## Security & Architecture Features

**Cryptographic JWT verification** — Tokens are cryptographically verified using either AWS Cognito JWKS (`jwks-rsa`) in production or trusted `JWT_SECRET`/emulator keys in local development and testing. Ad-hoc unverified decode bypasses are strictly eliminated. Expired, malformed, or tampered tokens are rejected.

**Server-Side Role & Subject-Level Authorization (IDOR Protection)** — Access control is enforced on the server. Privileged roles (`admin`, `teacher`, `staff`, or `cognito:groups`) can record and query attendance for any student. Non-privileged student users can only query and record attendance for their own matching identity (`sub`, `username`, or `custom:studentId`), blocking cross-student access and insecure direct object reference (IDOR) attempts.

**Semantic Input Validation** — Route handlers validate calendar dates semantically (rejecting non-existent calendar dates like Feb 31 or invalid leap years), restrict status values to `['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']`, validate student ID formats, and sanitize notes.

**Single table, no GSIs** — The task only needed two read patterns (list by student, post for a student) so I didn't add any secondary indexes. If you needed to query "all absences on a given date across all students" you'd need a GSI on `date`.

**No frontend requirement** — the task said Postman/curl is fine. I added a basic UI page anyway just to make manual testing easier.

---

## Running locally

### Option 1: Without Docker (recommended for quick setup)

Start the mock AWS services (in-process Node.js servers for Cognito and DynamoDB):

```bash
npm run services
```

Then in a separate terminal, create the DynamoDB table:

```bash
npm run setup:local
```

Start the dev server:

```bash
npm run dev
```

### Option 2: With Docker

```bash
docker-compose up -d
npm run setup:local
npm run dev
```

### Environment

Copy `.env.example` to `.env.local` — the defaults already point to localhost, so nothing needs changing for local development.

```bash
cp .env.example .env.local
```

---

## API Endpoints

### POST /api/auth/signup

Registers a new user in Cognito. In local mode the account is auto-confirmed.

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "jane@example.com", "password": "Password123!", "name": "Jane Doe"}'
```

Response:
```json
{
  "message": "User registered successfully",
  "userSub": "abc-123-...",
  "userConfirmed": true
}
```

---

### POST /api/auth/signin

Returns a JWT access token. Pass this as `Authorization: Bearer <token>` on protected routes.

```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "jane@example.com", "password": "Password123!"}'
```

Response:
```json
{
  "message": "Sign in successful",
  "accessToken": "eyJhbGciOi...",
  "idToken": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi...",
  "expiresIn": 7200,
  "tokenType": "Bearer"
}
```

---

### POST /api/attendance

Creates or updates an attendance record for a student on a given date. Requires auth.

Sending a second request for the same `studentId` + `date` will overwrite the first (upsert).

```bash
curl -X POST http://localhost:3000/api/attendance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -d '{
    "studentId": "STD-2026-001",
    "date": "2026-07-27",
    "status": "PRESENT",
    "notes": "showed up on time"
  }'
```

Valid status values: `PRESENT`, `ABSENT`, `LATE`, `EXCUSED`

Response:
```json
{
  "message": "Attendance record saved successfully",
  "data": {
    "studentId": "STD-2026-001",
    "date": "2026-07-27",
    "status": "PRESENT",
    "notes": "showed up on time",
    "createdAt": "2026-07-27T10:15:00.000Z",
    "updatedAt": "2026-07-27T10:15:00.000Z"
  }
}
```

---

### GET /api/attendance/:studentId

Returns all attendance records for a student, sorted by date ascending. Requires auth.

```bash
curl http://localhost:3000/api/attendance/STD-2026-001 \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

Response:
```json
{
  "studentId": "STD-2026-001",
  "count": 2,
  "records": [
    {
      "studentId": "STD-2026-001",
      "date": "2026-07-26",
      "status": "LATE",
      "notes": "15 mins late"
    },
    {
      "studentId": "STD-2026-001",
      "date": "2026-07-27",
      "status": "PRESENT",
      "notes": "showed up on time"
    }
  ]
}
```

---

## Running the automated test suite

Run the unit and security regression suite covering cryptographic authentication, token verification, role-based access control, IDOR defense, and semantic calendar date validation:

```bash
npm test
```

For live end-to-end testing against mock AWS services:

```bash
# Terminal 1: Start mock services
npm run services

# Terminal 2: Initialize table and start dev server
npm run setup:local
npm run dev

# Terminal 3: Run end-to-end integration script
npx tsx scripts/test-api.ts
```

---

## Environment variables

| Variable               | Description                            | Default for local          |
|------------------------|----------------------------------------|----------------------------|
| `AWS_REGION`           | AWS region                             | `us-east-1`                |
| `AWS_ACCESS_KEY_ID`    | AWS access key (fake value for local)  | `local`                    |
| `AWS_SECRET_ACCESS_KEY`| AWS secret (fake value for local)      | `local`                    |
| `JWT_SECRET`           | HMAC secret for local/test validation  | `local-dev-jwt-secret-key-123456789` |
| `COGNITO_JWKS_URI`     | Custom JWKS URI for Cognito public key | Optional (auto-computed)   |
| `DYNAMODB_TABLE_NAME`  | DynamoDB table name                    | `StudentAttendance`        |
| `DYNAMODB_ENDPOINT`    | DynamoDB endpoint (local override)     | `http://localhost:8000`    |
| `COGNITO_ENDPOINT`     | Cognito endpoint (local override)      | `http://localhost:9229`    |
| `COGNITO_USER_POOL_ID` | Cognito user pool ID                   | `us-east-1_localpool`      |
| `COGNITO_CLIENT_ID`    | Cognito app client ID                  | `localappclient12345`      |

---

## npm scripts

| Script              | What it does                                                 |
|---------------------|--------------------------------------------------------------|
| `npm test`          | Run automated test suite (Node test runner via tsx)          |
| `npm run dev`       | Start Next.js development server on port 3000                |
| `npm run services`  | Run local Cognito (port 9229) + DynamoDB (port 8000) servers |
| `npm run setup:local` | Create the StudentAttendance table in local DynamoDB       |
| `npm run build`     | Build for production                                         |
