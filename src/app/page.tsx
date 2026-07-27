'use client';

import { useState, useEffect } from 'react';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'tester' | 'suite' | 'curl'>('tester');

  // Auth State
  const [email, setEmail] = useState('student.admin@university.edu');
  const [password, setPassword] = useState('Password123!');
  const [name, setName] = useState('Admin User');
  const [authToken, setAuthToken] = useState('');
  const [authStatus, setAuthStatus] = useState<{ type: 'success' | 'error' | ''; msg: string }>({ type: '', msg: '' });

  // Record Form State
  const [studentId, setStudentId] = useState('STU-2026-001');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>('PRESENT');
  const [notes, setNotes] = useState('Attended morning lecture');
  const [postStatus, setPostStatus] = useState<{ type: 'success' | 'error' | ''; msg: string }>({ type: '', msg: '' });

  // Query State
  const [queryStudentId, setQueryStudentId] = useState('STU-2026-001');
  const [queryResults, setQueryResults] = useState<any>(null);
  const [queryLoading, setQueryLoading] = useState(false);

  // E2E Test Suite State
  const [suiteRunning, setSuiteRunning] = useState(false);
  const [suiteLogs, setSuiteLogs] = useState<Array<{ step: string; status: number; ok: boolean; data: any }>>([]);

  // Perform Auto Sign-in on Mount for seamless experience
  useEffect(() => {
    handleSignIn();
  }, []);

  async function handleSignUp() {
    setAuthStatus({ type: '', msg: 'Signing up user...' });
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (res.ok) {
        setAuthStatus({ type: 'success', msg: `User created! Sub: ${data.userSub || 'Confirmed'}. You can now sign in.` });
      } else {
        setAuthStatus({ type: 'error', msg: data.error || 'Signup failed' });
      }
    } catch (err: any) {
      setAuthStatus({ type: 'error', msg: err.message });
    }
  }

  async function handleSignIn() {
    setAuthStatus({ type: '', msg: 'Authenticating...' });
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.accessToken) {
        setAuthToken(data.accessToken);
        setAuthStatus({ type: 'success', msg: 'Authenticated successfully! JWT Token acquired.' });
      } else {
        // If user doesn't exist yet, auto sign up then sign in
        if (res.status === 401 || res.status === 500) {
          await handleSignUp();
          const retryRes = await fetch('/api/auth/signin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          const retryData = await retryRes.json();
          if (retryRes.ok && retryData.accessToken) {
            setAuthToken(retryData.accessToken);
            setAuthStatus({ type: 'success', msg: 'Auto-registered & Authenticated successfully!' });
            return;
          }
        }
        setAuthStatus({ type: 'error', msg: data.error || 'Authentication failed' });
      }
    } catch (err: any) {
      setAuthStatus({ type: 'error', msg: err.message });
    }
  }

  async function handleAddAttendance() {
    if (!authToken) {
      setPostStatus({ type: 'error', msg: 'Please sign in first to obtain JWT token.' });
      return;
    }
    setPostStatus({ type: '', msg: 'Saving record...' });
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ studentId, date, status, notes }),
      });
      const data = await res.json();
      if (res.ok) {
        setPostStatus({ type: 'success', msg: `Attendance recorded for ${studentId} on ${date}` });
        if (queryStudentId === studentId) {
          handleQueryAttendance();
        }
      } else {
        setPostStatus({ type: 'error', msg: data.error || 'Failed to save record' });
      }
    } catch (err: any) {
      setPostStatus({ type: 'error', msg: err.message });
    }
  }

  async function handleQueryAttendance() {
    if (!authToken) {
      setQueryResults({ error: 'Please sign in first to obtain JWT token.' });
      return;
    }
    setQueryLoading(true);
    try {
      const res = await fetch(`/api/attendance/${encodeURIComponent(queryStudentId)}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      setQueryResults(data);
    } catch (err: any) {
      setQueryResults({ error: err.message });
    } finally {
      setQueryLoading(false);
    }
  }

  async function runFullSuite() {
    setSuiteRunning(true);
    setSuiteLogs([]);
    const logs: Array<{ step: string; status: number; ok: boolean; data: any }> = [];

    // Step 1: Sign Up
    const s1 = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo.student@university.edu', password: 'Password123!', name: 'Demo Student' }),
    });
    const d1 = await s1.json();
    logs.push({ step: '1. POST /api/auth/signup (User Registration)', status: s1.status, ok: s1.ok, data: d1 });
    setSuiteLogs([...logs]);

    // Step 2: Sign In
    const s2 = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo.student@university.edu', password: 'Password123!' }),
    });
    const d2 = await s2.json();
    logs.push({ step: '2. POST /api/auth/signin (JWT Issue)', status: s2.status, ok: s2.ok, data: { ...d2, accessToken: d2.accessToken ? d2.accessToken.substring(0, 25) + '...' : undefined } });
    setSuiteLogs([...logs]);

    const token = d2.accessToken || authToken;

    // Step 3: Unauthorized Access Test
    const s3 = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: 'STU-100', date: '2026-07-27', status: 'PRESENT' }),
    });
    const d3 = await s3.json();
    logs.push({ step: '3. POST /api/attendance (Unauthorized Check - Expect 401)', status: s3.status, ok: s3.status === 401, data: d3 });
    setSuiteLogs([...logs]);

    // Step 4: Record Present
    const s4 = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ studentId: 'STU-999', date: '2026-07-27', status: 'PRESENT', notes: 'E2E Test Present' }),
    });
    const d4 = await s4.json();
    logs.push({ step: '4. POST /api/attendance (Record STU-999 Present)', status: s4.status, ok: s4.ok, data: d4 });
    setSuiteLogs([...logs]);

    // Step 5: Record Late
    const s5 = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ studentId: 'STU-999', date: '2026-07-28', status: 'LATE', notes: 'E2E Test Late' }),
    });
    const d5 = await s5.json();
    logs.push({ step: '5. POST /api/attendance (Record STU-999 Late)', status: s5.status, ok: s5.ok, data: d5 });
    setSuiteLogs([...logs]);

    // Step 6: Query STU-999
    const s6 = await fetch('/api/attendance/STU-999', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d6 = await s6.json();
    logs.push({ step: '6. GET /api/attendance/STU-999 (Fetch DynamoDB Log)', status: s6.status, ok: s6.ok, data: d6 });
    setSuiteLogs([...logs]);

    setSuiteRunning(false);
  }

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'PRESENT':
        return { bg: '#064e3b', border: '#10b981', color: '#6ee7b7' };
      case 'LATE':
        return { bg: '#78350f', border: '#f59e0b', color: '#fde68a' };
      case 'EXCUSED':
        return { bg: '#1e3a8a', border: '#3b82f6', color: '#93c5fd' };
      default:
        return { bg: '#7f1d1d', border: '#ef4444', color: '#fca5a5' };
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Top Banner Header */}
      <header
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '2rem' }}>🎓</span>
              <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, background: 'linear-gradient(90deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Student Attendance Real-Time API
              </h1>
            </div>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.95rem' }}>
              Next.js 14 App Router API • Amazon DynamoDB • AWS Cognito Authentication
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '0.5rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
              <span style={{ color: '#cbd5e1' }}>Cognito Auth: <strong style={{ color: '#10b981' }}>Active (9229)</strong></span>
            </div>
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '0.5rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }}></span>
              <span style={{ color: '#cbd5e1' }}>DynamoDB: <strong style={{ color: '#38bdf8' }}>Active (8000)</strong></span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.75rem' }}>
        <button
          onClick={() => setActiveTab('tester')}
          style={{
            background: activeTab === 'tester' ? '#2563eb' : 'transparent',
            color: activeTab === 'tester' ? '#ffffff' : '#94a3b8',
            border: 'none',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.95rem',
            transition: 'all 0.2s',
          }}
        >
          ⚡ Live Interactive Tester
        </button>
        <button
          onClick={() => setActiveTab('suite')}
          style={{
            background: activeTab === 'suite' ? '#2563eb' : 'transparent',
            color: activeTab === 'suite' ? '#ffffff' : '#94a3b8',
            border: 'none',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.95rem',
            transition: 'all 0.2s',
          }}
        >
          🧪 Automated E2E Suite
        </button>
        <button
          onClick={() => setActiveTab('curl')}
          style={{
            background: activeTab === 'curl' ? '#2563eb' : 'transparent',
            color: activeTab === 'curl' ? '#ffffff' : '#94a3b8',
            border: 'none',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.95rem',
            transition: 'all 0.2s',
          }}
        >
          📄 cURL Code Snippets
        </button>
      </div>

      {/* TAB 1: LIVE INTERACTIVE TESTER */}
      {activeTab === 'tester' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
          {/* Card 1: Auth Manager */}
          <div
            style={{
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
            }}
          >
            <h3 style={{ margin: '0 0 1rem 0', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
              🔑 1. AWS Cognito Authentication
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', padding: '0.5rem 0.75rem', color: '#f8fafc', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', padding: '0.5rem 0.75rem', color: '#f8fafc', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  onClick={handleSignIn}
                  style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.6rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Sign In (Get Token)
                </button>
                <button
                  onClick={handleSignUp}
                  style={{ flex: 1, background: '#334155', color: '#f8fafc', border: 'none', borderRadius: '6px', padding: '0.6rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Register User
                </button>
              </div>

              {authStatus.msg && (
                <div style={{ padding: '0.6rem', borderRadius: '6px', fontSize: '0.82rem', background: authStatus.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: authStatus.type === 'error' ? '#fca5a5' : '#6ee7b7', border: `1px solid ${authStatus.type === 'error' ? '#ef4444' : '#10b981'}` }}>
                  {authStatus.msg}
                </div>
              )}

              {authToken && (
                <div style={{ marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Active Bearer JWT Token:</span>
                  <div style={{ background: '#020617', border: '1px dashed #38bdf8', padding: '0.5rem', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.72rem', wordBreak: 'break-all', color: '#38bdf8', maxHeight: '60px', overflowY: 'auto' }}>
                    {authToken}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Record Attendance Form */}
          <div
            style={{
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
            }}
          >
            <h3 style={{ margin: '0 0 1rem 0', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
              📝 2. Record Attendance (POST)
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Student ID</label>
                  <input
                    type="text"
                    value={studentId}
                    onChange={e => setStudentId(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', padding: '0.5rem 0.75rem', color: '#f8fafc', fontSize: '0.9rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Date (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', padding: '0.5rem 0.75rem', color: '#f8fafc', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as any)}
                  style={{ width: '100%', boxSizing: 'border-box', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', padding: '0.5rem 0.75rem', color: '#f8fafc', fontSize: '0.9rem' }}
                >
                  <option value="PRESENT">PRESENT</option>
                  <option value="LATE">LATE</option>
                  <option value="ABSENT">ABSENT</option>
                  <option value="EXCUSED">EXCUSED</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Attended lecture"
                  style={{ width: '100%', boxSizing: 'border-box', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', padding: '0.5rem 0.75rem', color: '#f8fafc', fontSize: '0.9rem' }}
                />
              </div>

              <button
                onClick={handleAddAttendance}
                style={{ background: '#10b981', color: '#090d16', border: 'none', borderRadius: '6px', padding: '0.65rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.25rem' }}
              >
                Submit Attendance Record
              </button>

              {postStatus.msg && (
                <div style={{ padding: '0.6rem', borderRadius: '6px', fontSize: '0.82rem', background: postStatus.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: postStatus.type === 'error' ? '#fca5a5' : '#6ee7b7', border: `1px solid ${postStatus.type === 'error' ? '#ef4444' : '#10b981'}` }}>
                  {postStatus.msg}
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Query & View Student Logs */}
          <div
            style={{
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
              gridColumn: '1 / -1',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ margin: 0, color: '#818cf8', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                🔍 3. Query Student Records (GET /api/attendance/:studentId)
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={queryStudentId}
                  onChange={e => setQueryStudentId(e.target.value)}
                  placeholder="Enter Student ID"
                  style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', padding: '0.4rem 0.75rem', color: '#f8fafc', fontSize: '0.9rem' }}
                />
                <button
                  onClick={handleQueryAttendance}
                  style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.4rem 1rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {queryLoading ? 'Searching...' : 'Fetch Records'}
                </button>
              </div>
            </div>

            {queryResults ? (
              queryResults.error ? (
                <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: '1px solid #ef4444', borderRadius: '8px' }}>
                  {queryResults.error}
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                    Found <strong>{queryResults.count}</strong> record(s) in DynamoDB for Student ID: <code style={{ color: '#38bdf8' }}>{queryResults.studentId}</code>
                  </div>

                  {queryResults.records?.length === 0 ? (
                    <p style={{ color: '#64748b', fontStyle: 'italic' }}>No attendance records found for this student.</p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                      {queryResults.records?.map((rec: any, idx: number) => {
                        const style = getStatusBadge(rec.status);
                        return (
                          <div
                            key={idx}
                            style={{
                              background: '#1e293b',
                              border: '1px solid #334155',
                              borderRadius: '8px',
                              padding: '1rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.5rem',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>{rec.date}</span>
                              <span
                                style={{
                                  background: style.bg,
                                  border: `1px solid ${style.border}`,
                                  color: style.color,
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '4px',
                                }}
                              >
                                {rec.status}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>{rec.notes || 'No notes provided'}</p>
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Updated: {new Date(rec.updatedAt).toLocaleTimeString()}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )
            ) : (
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Click "Fetch Records" to view live DynamoDB data for any student ID.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: AUTOMATED E2E SUITE */}
      {activeTab === 'suite' && (
        <div
          style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '1.2rem' }}>🧪 Live End-to-End API Test Suite</h3>
              <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>Runs all auth, validation, write, and query scenarios sequentially against the local API handlers.</p>
            </div>
            <button
              onClick={runFullSuite}
              disabled={suiteRunning}
              style={{
                background: suiteRunning ? '#475569' : 'linear-gradient(135deg, #2563eb, #7c3aed)',
                color: '#fff',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: suiteRunning ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
              }}
            >
              {suiteRunning ? 'Running Tests...' : '🚀 Execute E2E Test Suite'}
            </button>
          </div>

          {suiteLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b', border: '2px dashed #1e293b', borderRadius: '12px' }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>🎯</span>
              Click <strong>"Execute E2E Test Suite"</strong> to trigger real-time request flows and inspect API responses live.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {suiteLogs.map((log, index) => (
                <div
                  key={index}
                  style={{
                    background: '#1e293b',
                    border: `1px solid ${log.ok ? '#10b981' : '#ef4444'}`,
                    borderRadius: '8px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 700, color: log.ok ? '#6ee7b7' : '#fca5a5', fontSize: '0.95rem' }}>{log.step}</span>
                    <span style={{ background: log.ok ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: log.ok ? '#10b981' : '#ef4444', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700 }}>
                      HTTP {log.status} {log.ok ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                  <pre style={{ margin: 0, background: '#020617', padding: '0.75rem', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#94a3b8', overflowX: 'auto' }}>
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CURL COMMANDS */}
      {activeTab === 'curl' && (
        <div
          style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#38bdf8' }}>1. Register Cognito User</h3>
            <pre style={{ margin: 0, background: '#020617', padding: '1rem', borderRadius: '8px', fontFamily: 'monospace', color: '#38bdf8', fontSize: '0.85rem' }}>
{`curl -X POST http://localhost:3000/api/auth/signup \\
  -H "Content-Type: application/json" \\
  -d '{"email":"student@university.edu", "password":"Password123!", "name":"John Doe"}'`}
            </pre>
          </div>

          <div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#38bdf8' }}>2. Authenticate & Get Bearer Token</h3>
            <pre style={{ margin: 0, background: '#020617', padding: '1rem', borderRadius: '8px', fontFamily: 'monospace', color: '#38bdf8', fontSize: '0.85rem' }}>
{`curl -X POST http://localhost:3000/api/auth/signin \\
  -H "Content-Type: application/json" \\
  -d '{"email":"student@university.edu", "password":"Password123!"}'`}
            </pre>
          </div>

          <div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#10b981' }}>3. Submit Student Attendance Record</h3>
            <pre style={{ margin: 0, background: '#020617', padding: '1rem', borderRadius: '8px', fontFamily: 'monospace', color: '#10b981', fontSize: '0.85rem' }}>
{`curl -X POST http://localhost:3000/api/attendance \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${authToken || '<YOUR_JWT_TOKEN>'}" \\
  -d '{"studentId":"STU-2026-001", "date":"2026-07-27", "status":"PRESENT", "notes":"Attended class"}'`}
            </pre>
          </div>

          <div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#818cf8' }}>4. Query Attendance Records by Student ID</h3>
            <pre style={{ margin: 0, background: '#020617', padding: '1rem', borderRadius: '8px', fontFamily: 'monospace', color: '#818cf8', fontSize: '0.85rem' }}>
{`curl -X GET http://localhost:3000/api/attendance/STU-2026-001 \\
  -H "Authorization: Bearer ${authToken || '<YOUR_JWT_TOKEN>'}"`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
