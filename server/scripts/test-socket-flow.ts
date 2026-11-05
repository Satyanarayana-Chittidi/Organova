import { io as ioClient, Socket } from 'socket.io-client';
import pool from '../src/config/database';
import crypto from 'crypto';
import { hashPassword } from '../src/utils/hash';
const SERVER_URL = 'http://localhost:5000';
const BASE_URL = `${SERVER_URL}/api`;
async function runTest() {
    console.log('===============================================================');
    console.log('⚡ MODULE 8: REAL-TIME WEBSOCKET & ALERT ENGINE TEST SUITE');
    console.log('===============================================================\n');
    await pool.query("DELETE FROM matches WHERE match_score > 0");
    await pool.query("DELETE FROM transplant_requests WHERE medical_summary LIKE '%Socket Test%'");
    await pool.query("DELETE FROM available_organs WHERE clinical_notes LIKE '%Socket Test%'");
    await pool.query("DELETE FROM medical_hubs WHERE license_number = 'SOCKET-HOSP-01'");
    await pool.query("DELETE FROM users WHERE email IN ('socket.hosp@hospital.org', 'socket.patient@citizen.org')");
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@organdonation.gov.in', password: 'AdminSecurePass@2026' }),
    });
    const adminLoginData: any = await adminLoginRes.json();
    const adminToken = adminLoginData.data.token;
    const hospRegRes = await fetch(`${BASE_URL}/hubs/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'socket.hosp@hospital.org',
            password: 'SocketPass#2026',
            hub_type: 'HOSPITAL',
            name: 'City Trauma & Transplant Center',
            license_number: 'SOCKET-HOSP-01',
            contact_phone: '+91-9988112233',
            address_line: 'Health City Rd',
            city: 'Hyderabad',
            state: 'Telangana',
            pincode: '500081',
            latitude: 17.4485,
            longitude: 78.3741,
        }),
    });
    const hospRegData: any = await hospRegRes.json();
    const hubId = hospRegData.data.id;
    await fetch(`${BASE_URL}/admin/hubs/${hubId}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'ACTIVE' }),
    });
    const hospLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'socket.hosp@hospital.org', password: 'SocketPass#2026' }),
    });
    const hospLoginData: any = await hospLoginRes.json();
    const hospToken = hospLoginData.data.token;
    const patientUserId = crypto.randomUUID();
    const pwHash = await hashPassword('CitizenPass#2026');
    await pool.query(`INSERT INTO users (id, email, password_hash, role, auth_provider, is_active, is_verified)
     VALUES (?, 'socket.patient@citizen.org', ?, 'USER', 'LOCAL', TRUE, TRUE)`, [patientUserId, pwHash]);
    await pool.query(`INSERT INTO citizen_profiles (user_id, full_name, date_of_birth, gender, blood_group, phone_number, emergency_contact_name, emergency_contact_phone, address_line, city, state, pincode)
     VALUES (?, 'Rohan Kumar', '1995-05-15', 'MALE', 'O-', '+91-9876543210', 'Kin', '+91-9876543211', 'Address', 'Hyderabad', 'TS', '500081')`, [patientUserId]);
    const patientLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'socket.patient@citizen.org', password: 'CitizenPass#2026' }),
    });
    const patientLoginData: any = await patientLoginRes.json();
    const patientToken = patientLoginData.data.token;
    console.log('▶ [Step 1] Initialized hospital and citizen recipient credentials...\n');
    console.log('▶ [Step 2] Establishing authenticated WebSocket handshakes...');
    const hospSocket: Socket = ioClient(SERVER_URL, {
        auth: { token: hospToken },
        transports: ['websocket'],
    });
    const patientSocket: Socket = ioClient(SERVER_URL, {
        auth: { token: patientToken },
        transports: ['websocket'],
    });
    await Promise.all([
        new Promise<void>((resolve, reject) => {
            hospSocket.on('connect', () => {
                console.log(`  ✓ Hospital WebSocket connected! (Socket ID: ${hospSocket.id})`);
                resolve();
            });
            hospSocket.on('connect_error', reject);
        }),
        new Promise<void>((resolve, reject) => {
            patientSocket.on('connect', () => {
                console.log(`  ✓ Patient WebSocket connected! (Socket ID: ${patientSocket.id})`);
                resolve();
            });
            patientSocket.on('connect_error', reject);
        }),
    ]);
    console.log('');
    console.log('▶ [Step 3] Testing real-time emergency blood broadcast...');
    const bloodAlertPromise = new Promise<any>((resolve) => {
        hospSocket.on('BLOOD_REQUEST_ALERT', (eventData) => {
            resolve(eventData);
        });
    });
    const bloodReqRes = await fetch(`${BASE_URL}/blood/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${patientToken}` },
        body: JSON.stringify({
            blood_group: 'O-',
            component: 'PACKED_RBC',
            units_requested: 2,
            urgency: 'CRITICAL',
            delivery_address: 'Emergency Trauma Ward 1',
        }),
    });
    const bloodReqData: any = await bloodReqRes.json();
    const bloodRequestId = bloodReqData.data.id;
    const receivedBloodAlert = await bloodAlertPromise;
    console.log(`  ✓ Instant alert received by Hospital socket!`);
    console.log(`  ✓ Alert Priority: '${receivedBloodAlert.priority}'`);
    console.log(`  ✓ Message: "${receivedBloodAlert.message}"\n`);
    console.log('▶ [Step 4] Testing blood order status update pushed to patient socket...');
    await fetch(`${BASE_URL}/blood/inventory`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hospToken}` },
        body: JSON.stringify({ blood_group: 'O-', component: 'PACKED_RBC', units_available: 10 }),
    });
    const patientStatusPromise = new Promise<any>((resolve) => {
        patientSocket.on('BLOOD_ORDER_STATUS_CHANGED', (eventData) => {
            resolve(eventData);
        });
    });
    await fetch(`${BASE_URL}/blood/requests/${bloodRequestId}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${hospToken}` },
    });
    const receivedStatusAlert = await patientStatusPromise;
    console.log(`  ✓ Live status update received by Patient socket!`);
    console.log(`  ✓ Status: '${receivedStatusAlert.status}', Fulfilling Hub: '${receivedStatusAlert.fulfillingHubName}'\n`);
    console.log('▶ [Step 5] Testing real-time organ match proposal alerts...');
    const [kidneyRow]: any = await pool.query("SELECT id FROM organ_types WHERE code = 'KIDNEY' LIMIT 1");
    const kidneyTypeId = kidneyRow[0].id;
    const waitlistRes = await fetch(`${BASE_URL}/transplant/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hospToken}` },
        body: JSON.stringify({
            recipient_user_id: patientUserId,
            organ_type_id: kidneyTypeId,
            blood_group: 'O-',
            urgency_tier: 'TIER_1_EMERGENCY',
            medical_summary: 'Socket Test - Chronic kidney disease stage 5.',
        }),
    });
    const waitlistData: any = await waitlistRes.json();
    const waitlistId = waitlistData.data.id;
    const harvestRes = await fetch(`${BASE_URL}/organs/harvest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hospToken}` },
        body: JSON.stringify({
            organ_type_id: kidneyTypeId,
            blood_group: 'O-',
            harvested_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            clinical_notes: 'Socket Test Donor Kidney',
        }),
    });
    const harvestData: any = await harvestRes.json();
    const organId = harvestData.data.id;
    const hospMatchPromise = new Promise<any>((resolve) => {
        hospSocket.on('MATCH_OFFER_RECEIVED', (data) => resolve(data));
    });
    const patientMatchPromise = new Promise<any>((resolve) => {
        patientSocket.on('RECIPIENT_MATCH_ALERT', (data) => resolve(data));
    });
    await fetch(`${BASE_URL}/transplant/matches/organ/${organId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${hospToken}` },
    });
    const [hospMatchAlert, patientMatchAlert] = await Promise.all([
        hospMatchPromise,
        patientMatchPromise,
    ]);
    console.log(`  ✓ Attending Hospital Socket received match proposal:`);
    console.log(`    - Message: "${hospMatchAlert.message}"`);
    console.log(`    - Match Score: ${hospMatchAlert.score} / 100`);
    console.log(`    - Response Deadline: ${hospMatchAlert.responseDeadline}`);
    console.log(`  ✓ Patient Socket received match alert:`);
    console.log(`    - Message: "${patientMatchAlert.message}"\n`);
    hospSocket.disconnect();
    patientSocket.disconnect();
    console.log('===============================================================');
    console.log('🎉 ALL 5 REAL-TIME WEBSOCKET ALERT TESTS PASSED WITH 100% SUCCESS!');
    console.log('===============================================================');
    await pool.end();
    process.exit(0);
}
runTest().catch(async (err) => {
    console.error('\n❌ TEST RUN FAILED:', err);
    await pool.end();
    process.exit(1);
});
