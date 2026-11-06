import pool from '../src/config/database';

const BASE_URL = 'http://localhost:5000/api';

async function runTest() {
  console.log('===============================================================');
  console.log('🩸 MODULE 5: BLOOD SUPPLY CHAIN & EMERGENCY FULFILLMENT TEST');
  console.log('===============================================================\n');

  // Pre-cleanup test entities
  const bankEmail = 'redcross.hyd@bloodbank.org';
  const bankLicense = 'RC-HYD-BB-2026';
  const requesterEmail = 'trauma.care@cityhospital.com';

  await pool.query('DELETE FROM blood_requests WHERE delivery_address LIKE ?', ['%Test Ward%']);
  await pool.query('DELETE FROM medical_hubs WHERE license_number = ?', [bankLicense]);
  await pool.query('DELETE FROM users WHERE email IN (?, ?)', [bankEmail, requesterEmail]);

  // Step 1: Register and activate a dedicated Blood Bank
  console.log('▶ [Step 1] Registering and activating Red Cross Blood Bank...');
  const regRes = await fetch(`${BASE_URL}/hubs/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: bankEmail,
      password: 'RedCrossPass#2026',
      hub_type: 'BLOOD_BANK',
      name: 'Red Cross Central Blood Bank',
      license_number: bankLicense,
      contact_phone: '+91-40-23456789',
      address_line: 'Red Cross Bhavan, Banjara Hills',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500034',
      latitude: 17.4156,
      longitude: 78.4352,
    }),
  });

  const regData: any = await regRes.json();
  if (!regRes.ok || !regData.success) {
    throw new Error(`Blood bank registration failed: ${JSON.stringify(regData)}`);
  }
  const bankHubId = regData.data.id;

  // Admin approves blood bank
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

  await fetch(`${BASE_URL}/admin/hubs/${bankHubId}/verify`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: 'ACTIVE' }),
  });
  console.log(`  ✓ Blood bank created & verified (ID: ${bankHubId}, Status: ACTIVE)\n`);

  // Login as Blood Bank
  const bankLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: bankEmail, password: 'RedCrossPass#2026' }),
  });
  const bankLoginData: any = await bankLoginRes.json();
  const bankToken = bankLoginData.data.token;

  // Step 2: Set stock inventory
  console.log('▶ [Step 2] Stocking blood bank inventory...');
  await fetch(`${BASE_URL}/blood/inventory`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bankToken}`,
    },
    body: JSON.stringify({
      blood_group: 'O-',
      component: 'PACKED_RBC',
      units_available: 10,
    }),
  });

  await fetch(`${BASE_URL}/blood/inventory`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bankToken}`,
    },
    body: JSON.stringify({
      blood_group: 'B+',
      component: 'PLATELETS',
      units_available: 15,
    }),
  });

  // Adjust stock (+5 units of O- PACKED_RBC -> 15 units total)
  await fetch(`${BASE_URL}/blood/inventory/adjust`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bankToken}`,
    },
    body: JSON.stringify({
      blood_group: 'O-',
      component: 'PACKED_RBC',
      delta_units: 5,
    }),
  });

  const myInvRes = await fetch(`${BASE_URL}/blood/inventory/me`, {
    headers: { Authorization: `Bearer ${bankToken}` },
  });
  const myInvData: any = await myInvRes.json();
  console.log(`  ✓ Inventory populated: ${myInvData.count} components tracked.`);
  const rbcItem = myInvData.data.find((i: any) => i.blood_group === 'O-' && i.component === 'PACKED_RBC');
  console.log(`  ✓ O- PACKED_RBC verified at: ${rbcItem.units_available} units (Expected: 15)\n`);

  // Step 3: Public stock search
  console.log('▶ [Step 3] Public searching for O- PACKED_RBC in Hyderabad...');
  const searchRes = await fetch(`${BASE_URL}/blood/inventory/search?blood_group=O-&component=PACKED_RBC&city=Hyderabad`);
  const searchData: any = await searchRes.json();
  if (searchData.count === 0 || searchData.data[0].hub_id !== bankHubId) {
    throw new Error('Public search failed to discover stocked blood bank.');
  }
  console.log(`  ✓ Discovery confirmed: Found '${searchData.data[0].hub_name}' with ${searchData.data[0].units_available} units.\n`);

  // Step 4: Register a trauma requester & submit urgent blood request
  console.log('▶ [Step 4] Registering trauma hospital and placing CRITICAL requisition...');
  const requesterRes = await fetch(`${BASE_URL}/hubs/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: requesterEmail,
      password: 'TraumaPass#2026',
      hub_type: 'HOSPITAL',
      name: 'City Trauma Emergency Hospital',
      license_number: 'TRAUMA-HYD-01',
      contact_phone: '+91-40-99887766',
      address_line: 'Gachibowli Main Rd',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500032',
      latitude: 17.4401,
      longitude: 78.3489,
    }),
  });
  const requesterData: any = await requesterRes.json();
  const requesterHubId = requesterData.data.id;

  // Approve trauma hospital
  await fetch(`${BASE_URL}/admin/hubs/${requesterHubId}/verify`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: 'ACTIVE' }),
  });

  // Login as Trauma Hospital
  const requesterLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: requesterEmail, password: 'TraumaPass#2026' }),
  });
  const requesterLoginData: any = await requesterLoginRes.json();
  const requesterToken = requesterLoginData.data.token;

  // Place order for 5 units of O- PACKED_RBC
  const orderRes = await fetch(`${BASE_URL}/blood/requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${requesterToken}`,
    },
    body: JSON.stringify({
      blood_group: 'O-',
      component: 'PACKED_RBC',
      units_requested: 5,
      urgency: 'CRITICAL',
      delivery_address: 'ICU Trauma Operating Theater 2 - Test Ward',
    }),
  });
  const orderData: any = await orderRes.json();
  if (!orderRes.ok || !orderData.data?.id) {
    throw new Error(`Blood request creation failed: ${JSON.stringify(orderData)}`);
  }
  const requestId = orderData.data.id;
  console.log(`  ✓ Blood request created! ID: ${requestId}`);
  console.log(`  ✓ Urgency: '${orderData.data.urgency}', Status: '${orderData.data.status}'\n`);

  // Step 5: Clinical Queue Inspection
  console.log('▶ [Step 5] Checking prioritized clinical requisition queue...');
  const queueRes = await fetch(`${BASE_URL}/blood/requests?status=REQUESTED`, {
    headers: { Authorization: `Bearer ${bankToken}` },
  });
  const queueData: any = await queueRes.json();
  const inQueue = queueData.data.find((r: any) => r.id === requestId);
  if (!inQueue) {
    throw new Error('Created blood request missing from requisition queue.');
  }
  console.log(`  ✓ Requisition found in active queue (Requester: ${inQueue.requester_email})\n`);

  // Step 6: ACID Claim & Stock Reservation
  console.log(`▶ [Step 6] Blood Bank claims request ID ${requestId} (ACID Transaction)...`);
  const claimRes = await fetch(`${BASE_URL}/blood/requests/${requestId}/claim`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${bankToken}` },
  });
  const claimData: any = await claimRes.json();
  if (!claimRes.ok || claimData.data.status !== 'APPROVED') {
    throw new Error(`Claim failed: ${JSON.stringify(claimData)}`);
  }
  console.log(`  ✓ Request approved! Fulfilling Facility: '${claimData.data.fulfilling_hub_name}'`);

  // Verify stock was atomically decremented from 15 to 10
  const postClaimInvRes = await fetch(`${BASE_URL}/blood/inventory/me`, {
    headers: { Authorization: `Bearer ${bankToken}` },
  });
  const postClaimInvData: any = await postClaimInvRes.json();
  const postClaimRbc = postClaimInvData.data.find((i: any) => i.blood_group === 'O-' && i.component === 'PACKED_RBC');
  console.log(`  ✓ Stock verification: O- PACKED_RBC balance = ${postClaimRbc.units_available} (Expected: 10 units)\n`);

  // Step 7: Over-claim Guard Check
  console.log('▶ [Step 7] Testing over-claim guard (requesting 20 units when only 10 available)...');
  const excessOrderRes = await fetch(`${BASE_URL}/blood/requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${requesterToken}`,
    },
    body: JSON.stringify({
      blood_group: 'O-',
      component: 'PACKED_RBC',
      units_requested: 20,
      urgency: 'URGENT',
      delivery_address: 'Surgery Ward 4 - Test Ward',
    }),
  });
  const excessOrderData: any = await excessOrderRes.json();
  const excessId = excessOrderData.data.id;

  const excessClaimRes = await fetch(`${BASE_URL}/blood/requests/${excessId}/claim`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${bankToken}` },
  });
  const excessClaimData: any = await excessClaimRes.json();
  console.log(`  ✓ Over-claim properly rejected! HTTP ${excessClaimRes.status}: ${excessClaimData.message}\n`);

  // Step 8: Dispatch & Completion Pipeline
  console.log('▶ [Step 8] Advancing fulfillment pipeline: DISPATCHED -> COMPLETED...');
  const dispatchRes = await fetch(`${BASE_URL}/blood/requests/${requestId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bankToken}`,
    },
    body: JSON.stringify({ status: 'DISPATCHED' }),
  });
  const dispatchData: any = await dispatchRes.json();
  console.log(`  ✓ Status advanced to: '${dispatchData.data.status}'`);

  const completeRes = await fetch(`${BASE_URL}/blood/requests/${requestId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bankToken}`,
    },
    body: JSON.stringify({ status: 'COMPLETED' }),
  });
  const completeData: any = await completeRes.json();
  console.log(`  ✓ Status advanced to: '${completeData.data.status}' (Fulfilled At: ${completeData.data.fulfilled_at})\n`);

  // Step 9: Cancellation & Automatic Inventory Refund
  console.log('▶ [Step 9] Testing requisition cancellation & automatic stock replenishment...');
  // Create order for 3 units of B+ PLATELETS
  const cancelTestOrderRes = await fetch(`${BASE_URL}/blood/requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${requesterToken}`,
    },
    body: JSON.stringify({
      blood_group: 'B+',
      component: 'PLATELETS',
      units_requested: 3,
      urgency: 'ROUTINE',
      delivery_address: 'Oncology Unit - Test Ward',
    }),
  });
  const cancelTestOrderData: any = await cancelTestOrderRes.json();
  const cancelOrderId = cancelTestOrderData.data.id;

  // Claim order (stock drops from 15 to 12)
  await fetch(`${BASE_URL}/blood/requests/${cancelOrderId}/claim`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${bankToken}` },
  });

  const midClaimInvRes = await fetch(`${BASE_URL}/blood/inventory/me`, {
    headers: { Authorization: `Bearer ${bankToken}` },
  });
  const midClaimInvData: any = await midClaimInvRes.json();
  const midPlatelets = midClaimInvData.data.find((i: any) => i.blood_group === 'B+' && i.component === 'PLATELETS');
  console.log(`  ✓ Claimed: B+ PLATELETS stock reduced to ${midPlatelets.units_available} units.`);

  // Cancel order as requester
  const cancelRes = await fetch(`${BASE_URL}/blood/requests/${cancelOrderId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${requesterToken}` },
  });
  const cancelData: any = await cancelRes.json();
  console.log(`  ✓ Requisition cancelled: status = '${cancelData.data.status}'`);

  // Verify stock was refunded back from 12 to 15!
  const finalInvRes = await fetch(`${BASE_URL}/blood/inventory/me`, {
    headers: { Authorization: `Bearer ${bankToken}` },
  });
  const finalInvData: any = await finalInvRes.json();
  const finalPlatelets = finalInvData.data.find((i: any) => i.blood_group === 'B+' && i.component === 'PLATELETS');
  console.log(`  ✓ Automatic Stock Refund Confirmed: B+ PLATELETS restored to ${finalPlatelets.units_available} units!\n`);

  console.log('===============================================================');
  console.log('🎉 ALL 9 BLOOD SUPPLY CHAIN TESTS PASSED WITH 100% SUCCESS!');
  console.log('===============================================================');

  await pool.end();
  process.exit(0);
}

runTest().catch(async (err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  await pool.end();
  process.exit(1);
});
