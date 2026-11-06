import pool from '../src/config/database';

const BASE_URL = 'http://localhost:5000/api';

async function runCitizenFlowTests() {
  console.log('===============================================================');
  console.log('🧑‍⚕️ CITIZEN END-TO-END WORKFLOW INTEGRATION TEST SUITE');
  console.log('   Testing: Registration, OTP, Login, Profile, Pledges, Card & Blood');
  console.log('===============================================================\n');

  const timestamp = Date.now();
  const testEmail = `citizen_test_${timestamp}@example.com`;
  const testPassword = 'SecureCitizen#2026';

  let authToken = '';
  let citizenUserId = '';

  try {
    // -------------------------------------------------------------
    // Step 1: Register Citizen Account
    // -------------------------------------------------------------
    console.log(`▶ [Step 1] Registering citizen account: ${testEmail}...`);
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        role: 'USER',
      }),
    });

    const regData: any = await regRes.json();
    if (!regRes.ok || !regData.success) {
      throw new Error(`Registration failed: ${regData.message || JSON.stringify(regData)}`);
    }

    citizenUserId = regData.data.id;
    const otpCode = regData.data.devOtp;
    console.log(`  ✓ Registration initiated! User ID: ${citizenUserId}`);
    console.log(`  ✓ OTP Code Generated for local test: ${otpCode}`);

    // -------------------------------------------------------------
    // Step 2: Verify 6-Digit OTP Code
    // -------------------------------------------------------------
    console.log('\n▶ [Step 2] Verifying 6-digit OTP code...');
    const verifyRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        otp: otpCode,
      }),
    });

    const verifyData: any = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.success) {
      throw new Error(`OTP Verification failed: ${verifyData.message}`);
    }

    authToken = verifyData.data.token;
    console.log(`  ✓ OTP successfully verified! User status: VERIFIED`);
    console.log(`  ✓ JWT Token issued: ${authToken.substring(0, 20)}...`);

    // -------------------------------------------------------------
    // Step 3: Login with Email & Password
    // -------------------------------------------------------------
    console.log('\n▶ [Step 3] Logging in with email & password credentials...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    const loginData: any = await loginRes.json();
    if (!loginRes.ok || !loginData.success) {
      throw new Error(`Login failed: ${loginData.message}`);
    }
    console.log(`  ✓ Login successful! Authenticated as: ${loginData.data.user.email} (Role: ${loginData.data.user.role})`);

    // -------------------------------------------------------------
    // Step 4: Verify Protected Session (/api/auth/me)
    // -------------------------------------------------------------
    console.log('\n▶ [Step 4] Checking active session via /api/auth/me...');
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const meData: any = await meRes.json();
    if (!meRes.ok || !meData.success) {
      throw new Error(`Session check failed: ${meData.message}`);
    }
    console.log(`  ✓ Valid session confirmed! User ID matches: ${meData.data.id === citizenUserId}`);

    // -------------------------------------------------------------
    // Step 5: Save Medical Demographics & Emergency Contacts (PUT /api/citizen/profile)
    // -------------------------------------------------------------
    console.log('\n▶ [Step 5] Saving demographic & medical health profile...');
    const profilePayload = {
      full_name: 'Satyanarayana Chittidi',
      date_of_birth: '1998-05-15',
      gender: 'MALE',
      blood_group: 'O+',
      phone_number: '+91-9876543210',
      emergency_contact_name: 'S. Chittidi (Family Next-of-Kin)',
      emergency_contact_phone: '+91-9988776655',
      address_line: 'Flat 402, Lotus Towers, Main Road',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500081',
    };

    const saveProfileRes = await fetch(`${BASE_URL}/citizen/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(profilePayload),
    });

    const saveProfileData: any = await saveProfileRes.json();
    if (!saveProfileRes.ok || !saveProfileData.success) {
      throw new Error(`Save profile failed: ${saveProfileData.message}`);
    }
    console.log(`  ✓ Profile saved successfully! (${saveProfileData.message})`);

    // -------------------------------------------------------------
    // Step 6: Fetch Saved Profile & Verify Fields
    // -------------------------------------------------------------
    console.log('\n▶ [Step 6] Retrieving saved profile via GET /api/citizen/profile...');
    const getProfileRes = await fetch(`${BASE_URL}/citizen/profile`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const getProfileData: any = await getProfileRes.json();
    if (!getProfileRes.ok || !getProfileData.success) {
      throw new Error(`Get profile failed: ${getProfileData.message}`);
    }

    const savedProfile = getProfileData.data.profile || getProfileData.data;
    if (savedProfile.full_name !== profilePayload.full_name) {
      throw new Error(`Full name mismatch: Expected ${profilePayload.full_name}, got ${savedProfile.full_name}`);
    }
    if (savedProfile.blood_group !== profilePayload.blood_group) {
      throw new Error(`Blood group mismatch: Expected ${profilePayload.blood_group}, got ${savedProfile.blood_group}`);
    }
    console.log(`  ✓ Profile verified: Name='${savedProfile.full_name}', Blood Group='${savedProfile.blood_group}', City='${savedProfile.city}'`);

    // -------------------------------------------------------------
    // Step 6b: Upload Citizen Profile Picture (POST /api/citizen/avatar)
    // -------------------------------------------------------------
    console.log('\n▶ [Step 6b] Uploading citizen profile picture avatar...');
    const dummyImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const formData = new FormData();
    const blob = new Blob([dummyImageBuffer], { type: 'image/png' });
    formData.append('avatar', blob, 'test-avatar.png');

    const avatarRes = await fetch(`${BASE_URL}/citizen/avatar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: formData,
    });
    const avatarData: any = await avatarRes.json();
    if (!avatarRes.ok || !avatarData.success) {
      throw new Error(`Avatar upload failed: ${avatarData.message}`);
    }
    console.log(`  ✓ Avatar uploaded successfully: ${avatarData.data.avatar_url}`);

    // Verify avatar is served statically
    const staticCheckRes = await fetch(`http://localhost:5000${avatarData.data.avatar_url}`);
    if (!staticCheckRes.ok) {
      throw new Error(`Static avatar serving failed with status ${staticCheckRes.status}`);
    }
    console.log(`  ✓ Static image delivery verified: HTTP ${staticCheckRes.status} OK`);

    // -------------------------------------------------------------
    // Step 7: Inspect Approved Organ Catalog
    // -------------------------------------------------------------
    console.log('\n▶ [Step 7] Fetching approved organ catalog (/api/donor/organ-types)...');
    const catalogRes = await fetch(`${BASE_URL}/donor/organ-types`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const catalogData: any = await catalogRes.json();
    if (!catalogRes.ok || !catalogData.success) {
      throw new Error(`Failed to load organ catalog: ${catalogData.message}`);
    }

    const organs = catalogData.data;
    const kidney = organs.find((o: any) => o.code === 'KIDNEY');
    const heart = organs.find((o: any) => o.code === 'HEART');

    console.log(`  ✓ Organ catalog loaded: ${organs.length} approved types.`);
    console.log(`  ✓ Kidney living donation allowed: ${kidney.allow_living_donor}`);
    console.log(`  ✓ Heart living donation allowed: ${heart.allow_living_donor} (Deceased only)`);

    // -------------------------------------------------------------
    // Step 8: Submit Organ Donation Pledges (Living + Deceased)
    // -------------------------------------------------------------
    console.log('\n▶ [Step 8] Pledging organs (Kidney: LIVING, Heart: DECEASED)...');
    const pledgeRes = await fetch(`${BASE_URL}/donor/pledges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        pledges: [
          { organ_type_id: kidney.id, consent_type: 'LIVING' },
          { organ_type_id: heart.id, consent_type: 'DECEASED' },
        ],
      }),
    });

    const pledgeData: any = await pledgeRes.json();
    if (!pledgeRes.ok || !pledgeData.success) {
      throw new Error(`Failed to save pledges: ${pledgeData.message}`);
    }
    console.log(`  ✓ Pledges legally recorded! (${pledgeData.message})`);

    // -------------------------------------------------------------
    // Step 9: Verify Pledges Registry
    // -------------------------------------------------------------
    console.log('\n▶ [Step 9] Fetching citizen pledges from registry (/api/donor/pledges)...');
    const myPledgesRes = await fetch(`${BASE_URL}/donor/pledges`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const myPledgesData: any = await myPledgesRes.json();
    if (!myPledgesRes.ok || !myPledgesData.success) {
      throw new Error(`Failed to fetch pledges: ${myPledgesData.message}`);
    }

    const activePledges = myPledgesData.data.pledges || myPledgesData.data;
    console.log(`  ✓ Registered donor status: isDonor=${myPledgesData.data.isDonor}`);
    console.log(`  ✓ Total active pledges: ${activePledges.length}`);
    activePledges.forEach((p: any) => {
      console.log(`     • ${p.organ_name} (${p.organ_code}) — Consent: ${p.consent_type}`);
    });

    // -------------------------------------------------------------
    // Step 10: Generate Digital Donor Card (/api/donor/card)
    // -------------------------------------------------------------
    console.log('\n▶ [Step 10] Generating official Digital Donor Card...');
    const cardRes = await fetch(`${BASE_URL}/donor/card`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const cardData: any = await cardRes.json();
    if (!cardRes.ok || !cardData.success) {
      throw new Error(`Failed to generate donor card: ${cardData.message}`);
    }

    const card = cardData.data;
    const cardId = card.donorRegistryId || card.donor_card_id;
    console.log(`  ✓ Official Digital Donor Card Generated!`);
    console.log(`  ✓ Registry Card ID: ${cardId}`);
    console.log(`  ✓ Cardholder: ${card.fullName || card.full_name} [Blood Group: ${card.bloodGroup || card.blood_group}]`);
    console.log(`  ✓ Emergency Contact: ${card.emergency_contact_name || card.emergencyContact?.name} (${card.emergency_contact_phone || card.emergencyContact?.phone})`);
    console.log(`  ✓ Pledged Organs on Card: ${card.pledges?.length}`);

    // -------------------------------------------------------------
    // Step 11: Emergency Blood Requisition
    // -------------------------------------------------------------
    console.log('\n▶ [Step 11] Posting emergency blood requisition (2 units of Packed RBC, O+)...');
    const bloodRes = await fetch(`${BASE_URL}/blood/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        blood_group: 'O+',
        component: 'PACKED_RBC',
        units_requested: 2,
        urgency: 'CRITICAL',
        delivery_address: 'Apollo Multi-Specialty Hospital, Emergency Wing, Ward 4',
      }),
    });

    const bloodData: any = await bloodRes.json();
    if (!bloodRes.ok || !bloodData.success) {
      throw new Error(`Blood request failed: ${bloodData.message}`);
    }
    const orderId = bloodData.data?.id;
    console.log(`  ✓ Emergency blood requisition created! Order ID: ${orderId}`);
    console.log(`  ✓ Initial Order Status: ${bloodData.data?.status}`);

    // -------------------------------------------------------------
    // Step 12: Citizen Passport Tracking (/api/blood/requests/mine)
    // -------------------------------------------------------------
    console.log('\n▶ [Step 12] Inspecting requisition in citizen orders passport...');
    const myOrdersRes = await fetch(`${BASE_URL}/blood/requests/mine`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const myOrdersData: any = await myOrdersRes.json();
    if (!myOrdersRes.ok || !myOrdersData.success) {
      throw new Error(`Failed to load citizen orders: ${myOrdersData.message}`);
    }

    const orders = Array.isArray(myOrdersData.data) ? myOrdersData.data : [];
    const myOrder = orders.find((o: any) => o.id === orderId);
    if (!myOrder) {
      throw new Error(`Created order ${orderId} not found in citizen order passport!`);
    }
    console.log(`  ✓ Requisition verified in passport: ${myOrder.blood_group} ${myOrder.component} (${myOrder.units_requested} units) - Status: ${myOrder.status}`);

    console.log('\n===============================================================');
    console.log('🎉 ALL 12 CITIZEN END-TO-END FLOW TESTS PASSED WITH 100% SUCCESS!');
    console.log('===============================================================\n');

  } finally {
    // Clean up test user
    if (citizenUserId) {
      await pool.query('DELETE FROM users WHERE id = ?', [citizenUserId]);
    }
    await pool.end();
  }
}

runCitizenFlowTests().catch((err) => {
  console.error('\n❌ [TEST FAILURE]:', err);
  process.exit(1);
});
