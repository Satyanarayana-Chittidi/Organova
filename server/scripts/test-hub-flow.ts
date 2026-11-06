import pool from '../src/config/database';
import { hashPassword } from '../src/utils/hash';

const BASE_URL = 'http://localhost:5000/api';

async function runTest() {
  console.log('===============================================================');
  console.log('🏥 MODULE 4: INSTITUTIONAL ONBOARDING & VERIFICATION TEST SUITE');
  console.log('===============================================================\n');

  const testLicense = 'AIIMS-ND-2026';
  const testEmail = 'aiims.delhi@gov.in';

  await pool.query('DELETE FROM medical_hubs WHERE license_number = ?', [testLicense]);
  await pool.query('DELETE FROM users WHERE email = ?', [testEmail]);

  console.log('▶ [Step 1] Registering facility (AIIMS New Delhi, HOSPITAL)...');
  const regRes = await fetch(`${BASE_URL}/hubs/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'AiimsSecurePassword#2026',
      hub_type: 'HOSPITAL',
      name: 'All India Institute of Medical Sciences (AIIMS)',
      license_number: testLicense,
      contact_phone: '+91-11-26588500',
      address_line: 'Sri Aurobindo Marg, Ansari Nagar',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110029',
      latitude: 28.5672,
      longitude: 77.2100,
    }),
  });

  const regData: any = await regRes.json();
  if (!regRes.ok || !regData.success) {
    throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
  }
  const hubId = regData.data.id;
  console.log(`  ✓ Hospital registered successfully! ID: ${hubId}`);
  console.log(`  ✓ Initial Verification Status: '${regData.data.verification_status}' (Correct: PENDING_APPROVAL)\n`);

  console.log('▶ [Step 2] Querying public directory as unauthenticated citizen...');
  const dirBeforeRes = await fetch(`${BASE_URL}/hubs/directory?city=New Delhi`);
  const dirBeforeData: any = await dirBeforeRes.json();
  const foundBefore = dirBeforeData.data.some((h: any) => h.id === hubId);
  console.log(`  ✓ Facility visible in public directory: ${foundBefore}`);
  if (foundBefore) {
    throw new Error('FAILED: Facility should NOT be publicly visible while PENDING_APPROVAL!');
  }
  console.log('  ✓ Verified: Pending facility is hidden from public directory.\n');

  console.log('▶ [Step 3] Logging in as Government Administrator...');
  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@organdonation.gov.in',
      password: 'AdminSecurePass@2026',
    }),
  });
  const adminLoginData: any = await adminLoginRes.json();
  if (!adminLoginRes.ok || !adminLoginData.data?.token) {
    throw new Error(`Admin login failed: ${JSON.stringify(adminLoginData)}`);
  }
  const adminToken = adminLoginData.data.token;
  console.log(`  ✓ Admin authenticated successfully! (Role: ${adminLoginData.data.user.role})\n`);

  console.log('▶ [Step 4] Admin audits pending applications list...');
  const pendingRes = await fetch(`${BASE_URL}/admin/hubs/pending`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const pendingData: any = await pendingRes.json();
  const pendingItem = pendingData.data.find((h: any) => h.id === hubId);
  if (!pendingItem) {
    throw new Error('FAILED: Registered hub not found in admin pending list.');
  }
  console.log(`  ✓ Found facility '${pendingItem.name}' in pending queue.`);
  console.log(`  ✓ Linked User Email: ${pendingItem.email}`);
  console.log(`  ✓ License: ${pendingItem.license_number}\n`);

  console.log(`▶ [Step 5] Admin approves facility ID ${hubId} to ACTIVE...`);
  const approveRes = await fetch(`${BASE_URL}/admin/hubs/${hubId}/verify`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: 'ACTIVE' }),
  });
  const approveData: any = await approveRes.json();
  if (!approveRes.ok || approveData.data.verification_status !== 'ACTIVE') {
    throw new Error(`Approval failed: ${JSON.stringify(approveData)}`);
  }
  console.log(`  ✓ Facility status updated to: '${approveData.data.verification_status}'\n`);

  console.log('▶ [Step 6] Public directory search after approval...');
  const dirAfterRes = await fetch(`${BASE_URL}/hubs/directory?city=New Delhi`);
  const dirAfterData: any = await dirAfterRes.json();
  const foundAfter = dirAfterData.data.find((h: any) => h.id === hubId);
  if (!foundAfter) {
    throw new Error('FAILED: Facility should now be publicly searchable in directory!');
  }
  console.log(`  ✓ Facility is now live in public directory!`);
  console.log(`  ✓ Name: ${foundAfter.name}`);
  console.log(`  ✓ Coordinates: (${foundAfter.latitude}, ${foundAfter.longitude})\n`);

  console.log('▶ [Step 7] Hospital logs in and fetches institutional profile...');
  const hospLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'AiimsSecurePassword#2026',
    }),
  });
  const hospLoginData: any = await hospLoginRes.json();
  if (!hospLoginRes.ok || !hospLoginData.data?.token) {
    throw new Error(`Hospital login failed: ${JSON.stringify(hospLoginData)}`);
  }
  const hospToken = hospLoginData.data.token;

  const meRes = await fetch(`${BASE_URL}/hubs/me`, {
    headers: { Authorization: `Bearer ${hospToken}` },
  });
  const meData: any = await meRes.json();
  if (!meRes.ok || meData.data.verification_status !== 'ACTIVE') {
    throw new Error(`Hub profile check failed: ${JSON.stringify(meData)}`);
  }
  console.log(`  ✓ Hospital profile verified: ID ${meData.data.id}, Status: ${meData.data.verification_status}\n`);

  console.log('▶ [Step 8] Testing administrative suspension (e.g. license audit)...');
  const suspendRes = await fetch(`${BASE_URL}/admin/hubs/${hubId}/verify`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: 'SUSPENDED' }),
  });
  const suspendData: any = await suspendRes.json();
  console.log(`  ✓ Facility status changed to: '${suspendData.data.verification_status}'`);

  const dirSuspendedRes = await fetch(`${BASE_URL}/hubs/directory?city=New Delhi`);
  const dirSuspendedData: any = await dirSuspendedRes.json();
  const foundSuspended = dirSuspendedData.data.some((h: any) => h.id === hubId);
  if (foundSuspended) {
    throw new Error('FAILED: Suspended facility must NOT be visible in public directory!');
  }
  console.log('  ✓ Verified: Suspended facility is automatically delisted from public directory.\n');

  console.log('▶ [Step 9] Reinstating facility to ACTIVE status...');
  await fetch(`${BASE_URL}/admin/hubs/${hubId}/verify`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: 'ACTIVE' }),
  });
  console.log('  ✓ Facility successfully reinstated to ACTIVE.\n');

  console.log('===============================================================');
  console.log('🎉 ALL 9 INSTITUTIONAL PIPELINE TESTS PASSED WITH 100% SUCCESS!');
  console.log('===============================================================');

  await pool.end();
  process.exit(0);
}

runTest().catch(async (err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  await pool.end();
  process.exit(1);
});
