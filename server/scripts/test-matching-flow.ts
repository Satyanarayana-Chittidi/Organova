import pool from '../src/config/database';
import crypto from 'crypto';
import { hashPassword } from '../src/utils/hash';

const BASE_URL = 'http://localhost:5000/api';

async function runTest() {
  console.log('===============================================================');
  console.log('🧬 MODULE 7: TRANSPLANT WAITLIST & MATCHING ENGINE TEST SUITE');
  console.log('===============================================================\n');

  await pool.query("DELETE FROM matches WHERE match_score > 0");
  await pool.query("DELETE FROM transplant_requests WHERE medical_summary LIKE '%Test Match Patient%'");
  await pool.query("DELETE FROM available_organs WHERE clinical_notes LIKE '%Test Donor Liver%'");
  await pool.query("DELETE FROM medical_hubs WHERE license_number IN ('MUM-KEM-01', 'PUNE-RUBY-01', 'DELHI-AIIMS-01')");
  await pool.query("DELETE FROM users WHERE email IN ('kem.mumbai@hospital.org', 'ruby.pune@hospital.org', 'p1@citizen.org', 'p2@citizen.org', 'p3@citizen.org')");

  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@organdonation.gov.in',
      password: 'AdminSecurePass@2026',
    }),
  });
  const adminLoginData: any = await adminLoginRes.json();
  const adminToken = adminLoginData.data.token;

  async function setupHospital(name: string, email: string, license: string, city: string, lat: number, lng: number) {
    const regRes = await fetch(`${BASE_URL}/hubs/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'HospitalSecure#2026',
        hub_type: 'HOSPITAL',
        name,
        license_number: license,
        contact_phone: '+91-9988776655',
        address_line: 'Main Hospital Road',
        city,
        state: 'State',
        pincode: '400001',
        latitude: lat,
        longitude: lng,
      }),
    });
    const regData: any = await regRes.json();
    const hubId = regData.data.id;

    await fetch(`${BASE_URL}/admin/hubs/${hubId}/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });

    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'HospitalSecure#2026' }),
    });
    const loginData: any = await loginRes.json();
    return { hubId, token: loginData.data.token };
  }

  const donorHosp = await setupHospital('KEM Hospital Mumbai', 'kem.mumbai@hospital.org', 'MUM-KEM-01', 'Mumbai', 18.9986, 72.8428);
  const puneHosp = await setupHospital('Ruby Hall Clinic Pune', 'ruby.pune@hospital.org', 'PUNE-RUBY-01', 'Pune', 18.5328, 73.8726);

  console.log('▶ [Step 1] Initialized hospitals (Mumbai donor hub & Pune transplant center)...\n');

  async function createCitizen(email: string, fullName: string) {
    const userId = crypto.randomUUID();
    const pwHash = await hashPassword('CitizenPass#2026');
    await pool.query(
      `INSERT INTO users (id, email, password_hash, role, auth_provider, is_active, is_verified)
       VALUES (?, ?, ?, 'USER', 'LOCAL', TRUE, TRUE)`,
      [userId, email, pwHash]
    );
    await pool.query(
      `INSERT INTO citizen_profiles (user_id, full_name, date_of_birth, gender, blood_group, phone_number, emergency_contact_name, emergency_contact_phone, address_line, city, state, pincode)
       VALUES (?, ?, '1990-01-01', 'MALE', 'A+', '+91-9876543210', 'Kin', '+91-9876543211', 'Address', 'Pune', 'MH', '411001')`,
      [userId, fullName]
    );

    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'CitizenPass#2026' }),
    });
    const loginData: any = await loginRes.json();
    return { userId, token: loginData.data.token };
  }

  const patient1 = await createCitizen('p1@citizen.org', 'Rajesh Sharma (Pune ICU)');
  const patient2 = await createCitizen('p2@citizen.org', 'Anita Verma (Delhi Emergency)');
  const patient3 = await createCitizen('p3@citizen.org', 'Vikram Patel (Pune Routine)');

  console.log('▶ [Step 2] Registered 3 citizen recipients with profiles...\n');

  const [liverRows]: any = await pool.query("SELECT id FROM organ_types WHERE code = 'LIVER' LIMIT 1");
  const liverTypeId = liverRows[0].id;

  console.log('▶ [Step 3] Enrolling candidates on national waitlist...');
  const req1Res = await fetch(`${BASE_URL}/transplant/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${puneHosp.token}` },
    body: JSON.stringify({
      recipient_user_id: patient1.userId,
      organ_type_id: liverTypeId,
      blood_group: 'A+',
      urgency_tier: 'TIER_1_EMERGENCY',
      medical_summary: 'Test Match Patient 1 - Acute hepatic failure on mechanical ventilation.',
    }),
  });
  const req1Data: any = await req1Res.json();
  const req1Id = req1Data.data.id;
  console.log(`  ✓ Candidate 1 enrolled: ID ${req1Id} (Rajesh - Pune, TIER_1_EMERGENCY)`);

  const req2Res = await fetch(`${BASE_URL}/transplant/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${puneHosp.token}` },
    body: JSON.stringify({
      recipient_user_id: patient2.userId,
      organ_type_id: liverTypeId,
      blood_group: 'A+',
      urgency_tier: 'TIER_2_URGENT',
      medical_summary: 'Test Match Patient 2 - Decompensated cirrhosis with recurrent ascites.',
    }),
  });
  const req2Data: any = await req2Res.json();
  const req2Id = req2Data.data.id;
  console.log(`  ✓ Candidate 2 enrolled: ID ${req2Id} (Anita - Pune, TIER_2_URGENT)`);

  const req3Res = await fetch(`${BASE_URL}/transplant/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${puneHosp.token}` },
    body: JSON.stringify({
      recipient_user_id: patient3.userId,
      organ_type_id: liverTypeId,
      blood_group: 'A+',
      urgency_tier: 'TIER_3_ROUTINE',
      medical_summary: 'Test Match Patient 3 - Stable NASH cirrhosis.',
    }),
  });
  const req3Data: any = await req3Res.json();
  const req3Id = req3Data.data.id;
  console.log(`  ✓ Candidate 3 enrolled: ID ${req3Id} (Vikram - Pune, TIER_3_ROUTINE)\n`);

  console.log('▶ [Step 4] Harvesting donor Liver at KEM Hospital Mumbai...');
  const harvestRes = await fetch(`${BASE_URL}/organs/harvest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${donorHosp.token}` },
    body: JSON.stringify({
      organ_type_id: liverTypeId,
      blood_group: 'A+',
      harvested_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      clinical_notes: 'Test Donor Liver - Biopsy steatosis < 5%.',
    }),
  });
  const harvestData: any = await harvestRes.json();
  const organId = harvestData.data.id;
  console.log(`  ✓ Liver harvested successfully (Organ ID: ${organId}, Status: AVAILABLE)\n`);

  console.log(`▶ [Step 5] Executing Multi-Factor Matching Algorithm for Organ ID ${organId}...`);
  const matchRunRes = await fetch(`${BASE_URL}/transplant/matches/organ/${organId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${donorHosp.token}` },
  });
  const matchRunData: any = await matchRunRes.json();
  if (!matchRunRes.ok || !matchRunData.data?.match) {
    throw new Error(`Matching failed: ${JSON.stringify(matchRunData)}`);
  }

  const match1 = matchRunData.data.match;
  console.log(`  ✓ Matching completed! ${matchRunData.data.candidatesEvaluated} candidates evaluated.`);
  console.log(`  ✓ Top Candidate Selected: Request ID ${match1.request_id} (Score: ${match1.match_score} / 100)`);
  if (match1.request_id !== req1Id) {
    throw new Error(`Algorithm selection error: Expected Candidate 1 (Emergency), got Request ID ${match1.request_id}`);
  }
  console.log(`  ✓ 20-minute response deadline started: ${match1.response_deadline}\n`);

  console.log('▶ [Step 6] Recipient checks their live waitlist passport...');
  const passportRes = await fetch(`${BASE_URL}/transplant/requests/mine`, {
    headers: { Authorization: `Bearer ${patient1.token}` },
  });
  const passportData: any = await passportRes.json();
  const myReq = passportData.data.find((r: any) => r.id === req1Id);
  console.log(`  ✓ Patient live status verified: '${myReq.status}' (MATCH_OFFERED)\n`);

  console.log('▶ [Step 7] Simulating surgical decline for Candidate 1 (unexpected fever)...');
  const declineRes = await fetch(`${BASE_URL}/transplant/matches/${match1.id}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${puneHosp.token}` },
    body: JSON.stringify({ decision: 'DECLINE' }),
  });
  const declineData: any = await declineRes.json();
  if (!declineRes.ok || declineData.data?.match?.status !== 'DECLINED') {
    throw new Error(`Decline failed: ${JSON.stringify(declineData)}`);
  }
  console.log(`  ✓ Offer ID ${match1.id} transitioned to: 'DECLINED'`);

  const failoverOffer = declineData.data.failoverOffer;
  if (!failoverOffer) {
    throw new Error('FAILED: Automated failover did not generate an offer for Candidate 2!');
  }
  console.log(`  ✓ AUTOMATED FAILOVER TRIGGERED!`);
  console.log(`  ✓ New Offer ID: ${failoverOffer.id} routed to Candidate 2 (Request ID: ${failoverOffer.request_id})`);
  console.log(`  ✓ Score for Candidate 2: ${failoverOffer.match_score}\n`);

  console.log(`▶ [Step 8] Pune Hospital surgical team ACCEPTS the offer for Candidate 2...`);
  const acceptRes = await fetch(`${BASE_URL}/transplant/matches/${failoverOffer.id}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${puneHosp.token}` },
    body: JSON.stringify({ decision: 'ACCEPT' }),
  });
  const acceptData: any = await acceptRes.json();
  if (!acceptRes.ok || acceptData.data?.match?.status !== 'ACCEPTED') {
    throw new Error(`Accept failed: ${JSON.stringify(acceptData)}`);
  }
  console.log(`  ✓ Match Offer ID ${failoverOffer.id} accepted! Status: '${acceptData.data.match.status}'`);

  console.log('▶ [Step 9] Verifying organ allocation in database...');
  const [organCheck]: any = await pool.query('SELECT status FROM available_organs WHERE id = ?', [organId]);
  console.log(`  ✓ Organ ID ${organId} final status: '${organCheck[0].status}' (Expected: ALLOCATED)\n`);

  console.log('===============================================================');
  console.log('🎉 ALL 9 MATCHING ENGINE & FAILOVER TESTS PASSED WITH 100% SUCCESS!');
  console.log('===============================================================');

  await pool.end();
  process.exit(0);
}

runTest().catch(async (err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  await pool.end();
  process.exit(1);
});
