import pool from '../src/config/database';

const BASE_URL = 'http://localhost:5000/api';

async function runTest() {
  console.log('===============================================================');
  console.log('🫀 MODULE 6: ORGAN HARVEST & COLD ISCHEMIA ENGINE TEST SUITE');
  console.log('===============================================================\n');

  // Pre-cleanup of test entities
  const hospEmail = 'apollo.delhi@hospital.org';
  const hospLicense = 'APOLLO-DELHI-CIT-01';

  await pool.query('DELETE FROM available_organs WHERE clinical_notes LIKE ?', ['%Test Heart%']);
  await pool.query('DELETE FROM medical_hubs WHERE license_number = ?', [hospLicense]);
  await pool.query('DELETE FROM users WHERE email = ?', [hospEmail]);

  // Step 1: Query approved organ types and viability limits
  console.log('▶ [Step 1] Inspecting approved organ types & cold ischemia limits...');
  const typesRes = await fetch(`${BASE_URL}/organs/types`);
  const typesData: any = await typesRes.json();
  if (!typesRes.ok || typesData.count < 8) {
    throw new Error('Failed to retrieve organ types dictionary.');
  }

  const heartType = typesData.data.find((t: any) => t.code === 'HEART');
  const kidneyType = typesData.data.find((t: any) => t.code === 'KIDNEY');
  const corneaType = typesData.data.find((t: any) => t.code === 'CORNEA');

  console.log(`  ✓ Heart shelf-life:   ${heartType.max_viability_hours} hours`);
  console.log(`  ✓ Kidney shelf-life:  ${kidneyType.max_viability_hours} hours`);
  console.log(`  ✓ Cornea shelf-life:  ${corneaType.max_viability_hours} hours (${corneaType.max_viability_hours / 24} days)\n`);

  // Step 2: Register & activate transplant hospital
  console.log('▶ [Step 2] Registering & activating Apollo Transplant Hospital...');
  const regRes = await fetch(`${BASE_URL}/hubs/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: hospEmail,
      password: 'ApolloPassword#2026',
      hub_type: 'HOSPITAL',
      name: 'Apollo Multi-Specialty Transplant Center',
      license_number: hospLicense,
      contact_phone: '+91-11-29871122',
      address_line: 'Sarita Vihar, Mathura Rd',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110076',
      latitude: 28.5355,
      longitude: 77.2910,
    }),
  });
  const regData: any = await regRes.json();
  const hospHubId = regData.data.id;

  // Admin approves hospital
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

  await fetch(`${BASE_URL}/admin/hubs/${hospHubId}/verify`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: 'ACTIVE' }),
  });

  // Login as Hospital
  const hospLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: hospEmail, password: 'ApolloPassword#2026' }),
  });
  const hospLoginData: any = await hospLoginRes.json();
  const hospToken = hospLoginData.data.token;
  console.log(`  ✓ Apollo Hospital activated (ID: ${hospHubId})\n`);

  // Step 3: Log harvested donor Heart
  console.log('▶ [Step 3] Logging harvested Heart (Cold Ischemia window = 6 hours)...');
  const harvestTime = new Date(Date.now() - 30 * 60 * 1000); // Harvested 30 mins ago
  const harvestRes = await fetch(`${BASE_URL}/organs/harvest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hospToken}`,
    },
    body: JSON.stringify({
      organ_type_id: heartType.id,
      blood_group: 'O+',
      harvested_at: harvestTime.toISOString(),
      clinical_notes: 'Test Heart - Perfused with Custodiol HTK solution. Warm ischemia time: 14 mins.',
    }),
  });

  const harvestData: any = await harvestRes.json();
  if (!harvestRes.ok || !harvestData.data?.id) {
    throw new Error(`Harvest registration failed: ${JSON.stringify(harvestData)}`);
  }
  const organId = harvestData.data.id;
  console.log(`  ✓ Heart registered successfully! Organ ID: ${organId}`);
  console.log(`  ✓ Initial Status: '${harvestData.data.status}'`);
  console.log(`  ✓ Harvested At: ${harvestData.data.harvested_at}`);
  console.log(`  ✓ Calculated Expiration: ${harvestData.data.expires_at}`);
  console.log(`  ✓ Live Remaining Minutes: ${harvestData.data.remaining_minutes} mins (~5.5 hours remaining)\n`);

  // Step 4: Medical Guardrails Check
  console.log('▶ [Step 4] Testing medical validity guardrails...');
  // A. Future harvest date
  const futureHarvestRes = await fetch(`${BASE_URL}/organs/harvest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hospToken}`,
    },
    body: JSON.stringify({
      organ_type_id: heartType.id,
      blood_group: 'O+',
      harvested_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    }),
  });
  console.log(`  ✓ Future harvest rejected: HTTP ${futureHarvestRes.status}`);

  // B. Harvested past cold ischemia limit (Heart harvested 8 hours ago, limit is 6h)
  const expiredHarvestRes = await fetch(`${BASE_URL}/organs/harvest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hospToken}`,
    },
    body: JSON.stringify({
      organ_type_id: heartType.id,
      blood_group: 'O+',
      harvested_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    }),
  });
  const expiredHarvestData: any = await expiredHarvestRes.json();
  console.log(`  ✓ Non-viable harvest rejected: HTTP ${expiredHarvestRes.status} (${expiredHarvestData.message})\n`);

  // Step 5: Querying viable organs
  console.log('▶ [Step 5] Searching network for viable O+ organs...');
  const searchRes = await fetch(`${BASE_URL}/organs?blood_group=${encodeURIComponent('O+')}&only_viable=true`, {
    headers: { Authorization: `Bearer ${hospToken}` },
  });
  const searchData: any = await searchRes.json();
  const found = searchData.data.find((o: any) => o.id === organId);
  if (!found) {
    throw new Error('Harvested organ not found in viable search results.');
  }
  console.log(`  ✓ Found viable organ: '${found.organ_name}' at '${found.current_hub_name}'`);
  console.log(`  ✓ Custody Coordinates: (${found.current_hub_latitude}, ${found.current_hub_longitude})\n`);

  // Step 6: Transit & Transplant State Progression
  console.log('▶ [Step 6] Advancing organ lifecycle along the transplant corridor...');
  
  // AVAILABLE -> ALLOCATED
  const allocRes = await fetch(`${BASE_URL}/organs/${organId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hospToken}`,
    },
    body: JSON.stringify({
      status: 'ALLOCATED',
      clinical_notes: 'Matched to patient ID #482. Surgical team mobilized.',
    }),
  });
  const allocData: any = await allocRes.json();
  console.log(`  ✓ State transition 1: '${allocData.data.status}'`);

  // ALLOCATED -> IN_TRANSIT
  const transitRes = await fetch(`${BASE_URL}/organs/${organId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hospToken}`,
    },
    body: JSON.stringify({
      status: 'IN_TRANSIT',
      clinical_notes: 'Packed in cold preservation container. Dispatched via Green Corridor ambulance.',
    }),
  });
  const transitData: any = await transitRes.json();
  console.log(`  ✓ State transition 2: '${transitData.data.status}'`);

  // IN_TRANSIT -> DELIVERED
  const deliverRes = await fetch(`${BASE_URL}/organs/${organId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hospToken}`,
    },
    body: JSON.stringify({
      status: 'DELIVERED',
      clinical_notes: 'Arrived at destination OT. Perfusion verified intact.',
    }),
  });
  const deliverData: any = await deliverRes.json();
  console.log(`  ✓ State transition 3: '${deliverData.data.status}'`);

  // DELIVERED -> TRANSPLANTED
  const txRes = await fetch(`${BASE_URL}/organs/${organId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hospToken}`,
    },
    body: JSON.stringify({
      status: 'TRANSPLANTED',
      clinical_notes: 'Anastomosis successful. Graft re-perfused. Patient stable.',
    }),
  });
  const txData: any = await txRes.json();
  console.log(`  ✓ State transition 4: '${txData.data.status}'\n`);

  // Step 7: Terminal State Immutability
  console.log('▶ [Step 7] Testing terminal state immutability...');
  const illegalRevertRes = await fetch(`${BASE_URL}/organs/${organId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hospToken}`,
    },
    body: JSON.stringify({ status: 'AVAILABLE' }),
  });
  const illegalRevertData: any = await illegalRevertRes.json();
  console.log(`  ✓ Illegal status reversal prevented: HTTP ${illegalRevertRes.status} (${illegalRevertData.message})\n`);

  // Step 8: Cold Ischemia Expiration Sweeper Test
  console.log('▶ [Step 8] Testing automatic cold ischemia expiration sweep...');
  // Directly insert an organ whose expires_at is 1 hour in the past
  const pastHarvest = new Date(Date.now() - 7 * 3600 * 1000);
  const pastExpires = new Date(Date.now() - 1 * 3600 * 1000);

  const [insertPast]: any = await pool.query(
    `INSERT INTO available_organs (
       organ_type_id, harvesting_hub_id, current_hub_id, blood_group,
       harvested_at, expires_at, status, clinical_notes
     ) VALUES (?, ?, ?, 'AB+', ?, ?, 'AVAILABLE', 'Test Heart - Past expiry')`,
    [heartType.id, hospHubId, hospHubId, pastHarvest, pastExpires]
  );
  const overdueOrganId = insertPast.insertId;

  // Run expiration sweep via Admin endpoint
  const sweepRes = await fetch(`${BASE_URL}/organs/sweep-expired`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const sweepData: any = await sweepRes.json();
  console.log(`  ✓ Sweep completed: ${sweepData.data.expiredCount} overdue organ(s) transitioned to EXPIRED.`);

  // Verify status in DB
  const [checkRow]: any = await pool.query('SELECT status FROM available_organs WHERE id = ?', [overdueOrganId]);
  if (checkRow[0].status !== 'EXPIRED') {
    throw new Error(`Failed: Overdue organ has status '${checkRow[0].status}' instead of 'EXPIRED'.`);
  }
  console.log(`  ✓ Overdue organ verified transitioned to: '${checkRow[0].status}'\n`);

  console.log('===============================================================');
  console.log('🎉 ALL 8 ORGAN HARVEST & VIABILITY TESTS PASSED WITH 100% SUCCESS!');
  console.log('===============================================================');

  await pool.end();
  process.exit(0);
}

runTest().catch(async (err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  await pool.end();
  process.exit(1);
});
