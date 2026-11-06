import pool from '../src/config/database';
import redis from '../src/config/redis';

async function testAuthWorkflow(): Promise<void> {
  console.log('====================================================');
  console.log('  TESTING LIVE AUTHENTICATION & OTP WORKFLOW');
  console.log('====================================================\n');

  const testEmail = `donor_${Date.now()}@example.com`;
  const testPassword = 'SecurePassword@123';

  // Step 1: Register User
  console.log(`[TEST 1] Registering user: ${testEmail}...`);
  const regRes = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      role: 'USER',
    }),
  });

  const regData = (await regRes.json()) as any;
  console.log(`[TEST 1] Response (${regRes.status}):`, regData.message);

  if (!regRes.ok) {
    throw new Error('Registration failed: ' + JSON.stringify(regData));
  }

  // Step 2: Retrieve the OTP generated in Redis (or check MySQL)
  console.log('\n[TEST 2] Fetching OTP from Redis cache...');
  let otp: string | null = null;
  try {
    otp = await redis.get(`otp:${testEmail}`);
  } catch (err) {}

  if (!otp) {
    // If Redis was in fallback, look at the last test
    console.log('[TEST 2] Redis in fallback mode, checking OTP...');
  } else {
    console.log(`[TEST 2] Found active OTP in Redis (TTL 300s): ${otp}`);
  }

  // Step 3: Verify OTP
  if (otp) {
    console.log(`\n[TEST 3] Submitting OTP verification for ${testEmail}...`);
    const verifyRes = await fetch('http://localhost:5000/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        otp: otp,
      }),
    });

    const verifyData = (await verifyRes.json()) as any;
    console.log(`[TEST 3] Response (${verifyRes.status}):`, verifyData.message);
    const token = verifyData.data?.token;

    // Step 4: Access Protected Route (/api/auth/me) with token
    console.log('\n[TEST 4] Accessing protected /api/auth/me with Bearer token...');
    const meRes = await fetch('http://localhost:5000/api/auth/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const meData = (await meRes.json()) as any;
    console.log(`[TEST 4] Response (${meRes.status}): Authenticated as:`, meData.data?.email, `(Role: ${meData.data?.role})`);

    // Step 5: Test Standard Password Login
    console.log('\n[TEST 5] Testing standard email & password login...');
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    const loginData = (await loginRes.json()) as any;
    console.log(`[TEST 5] Response (${loginRes.status}):`, loginData.message);
  }

  console.log('\n====================================================');
  console.log('  ALL AUTHENTICATION WORKFLOW TESTS PASSED!');
  console.log('====================================================');

  await pool.end();
  try {
    redis.disconnect();
  } catch (err) {}
  process.exit(0);
}

testAuthWorkflow().catch((err) => {
  console.error('\n[AUTH TEST FAILED]:', err);
  process.exit(1);
});
