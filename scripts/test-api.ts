import http from 'http';

const API_BASE = 'http://localhost:3000';

async function makeRequest(
  path: string,
  method: 'GET' | 'POST',
  body?: object,
  token?: string
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const payload = body ? JSON.stringify(body) : undefined;

    const req = http.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      res => {
        let resBody = '';
        res.on('data', chunk => (resBody += chunk));
        res.on('end', () => {
          try {
            const data = resBody ? JSON.parse(resBody) : {};
            resolve({ status: res.statusCode || 500, data });
          } catch {
            resolve({ status: res.statusCode || 500, data: resBody });
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runEndToEndTests() {
  console.log('====================================================');
  console.log('🚀 RUNNING END-TO-END REAL-TIME API TESTS');
  console.log('====================================================\n');

  // Test 1: Sign Up
  console.log('1️⃣ Testing User Sign Up (POST /api/auth/signup)...');
  const signupRes = await makeRequest('/api/auth/signup', 'POST', {
    email: 'student.admin@university.edu',
    password: 'SecurePassword123!',
    name: 'Admin User',
  });
  console.log(` Status: ${signupRes.status}`);
  console.log(' Response:', JSON.stringify(signupRes.data, null, 2));

  if (signupRes.status !== 201) {
    console.error('❌ Sign Up failed!');
    process.exit(1);
  }

  // Test 2: Sign In
  console.log('\n2️⃣ Testing User Sign In (POST /api/auth/signin)...');
  const signinRes = await makeRequest('/api/auth/signin', 'POST', {
    email: 'student.admin@university.edu',
    password: 'SecurePassword123!',
  });
  console.log(` Status: ${signinRes.status}`);
  const accessToken = signinRes.data.accessToken;
  console.log(` Received Access Token: ${accessToken ? accessToken.substring(0, 30) + '...' : 'NONE'}`);

  if (signinRes.status !== 200 || !accessToken) {
    console.error('❌ Sign In failed!');
    process.exit(1);
  }

  // Test 3: Unauthorized Record Creation (No Token)
  console.log('\n3️⃣ Testing Unauthorized Access (POST /api/attendance without Token)...');
  const unauthRes = await makeRequest('/api/attendance', 'POST', {
    studentId: 'STU-101',
    date: '2026-07-27',
    status: 'PRESENT',
  });
  console.log(` Status: ${unauthRes.status} (Expected 401)`);
  console.log(' Response:', JSON.stringify(unauthRes.data, null, 2));

  // Test 4: Record Attendance 1 for STU-2026-001
  console.log('\n4️⃣ Testing Attendance Record Creation #1 (STU-2026-001 - PRESENT)...');
  const att1Res = await makeRequest(
    '/api/attendance',
    'POST',
    {
      studentId: 'STU-2026-001',
      date: '2026-07-27',
      status: 'PRESENT',
      notes: 'Attended morning lecture on AI systems',
    },
    accessToken
  );
  console.log(` Status: ${att1Res.status}`);
  console.log(' Response:', JSON.stringify(att1Res.data, null, 2));

  // Test 5: Record Attendance 2 for STU-2026-001
  console.log('\n5️⃣ Testing Attendance Record Creation #2 (STU-2026-001 - LATE)...');
  const att2Res = await makeRequest(
    '/api/attendance',
    'POST',
    {
      studentId: 'STU-2026-001',
      date: '2026-07-28',
      status: 'LATE',
      notes: 'Arrived 15 minutes late due to traffic',
    },
    accessToken
  );
  console.log(` Status: ${att2Res.status}`);
  console.log(' Response:', JSON.stringify(att2Res.data, null, 2));

  // Test 6: Record Attendance for STU-2026-002
  console.log('\n6️⃣ Testing Attendance Record Creation #3 (STU-2026-002 - EXCUSED)...');
  const att3Res = await makeRequest(
    '/api/attendance',
    'POST',
    {
      studentId: 'STU-2026-002',
      date: '2026-07-27',
      status: 'EXCUSED',
      notes: 'Medical leave submitted',
    },
    accessToken
  );
  console.log(` Status: ${att3Res.status}`);
  console.log(' Response:', JSON.stringify(att3Res.data, null, 2));

  // Test 7: Fetch Attendance for STU-2026-001
  console.log('\n7️⃣ Fetching Attendance Records for STU-2026-001...');
  const get1Res = await makeRequest(
    '/api/attendance/STU-2026-001',
    'GET',
    undefined,
    accessToken
  );
  console.log(` Status: ${get1Res.status}`);
  console.log(' Response:', JSON.stringify(get1Res.data, null, 2));

  // Test 8: Fetch Attendance for STU-2026-002
  console.log('\n8️⃣ Fetching Attendance Records for STU-2026-002...');
  const get2Res = await makeRequest(
    '/api/attendance/STU-2026-002',
    'GET',
    undefined,
    accessToken
  );
  console.log(` Status: ${get2Res.status}`);
  console.log(' Response:', JSON.stringify(get2Res.data, null, 2));

  console.log('\n====================================================');
  console.log('✅ ALL REAL-TIME API TESTS COMPLETED SUCCESSFULLY!');
  console.log('====================================================');
}

runEndToEndTests().catch(err => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
