import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import pool from '../src/config/database';
import { RowDataPacket } from 'mysql2';

const SHARED_PASSWORD_HASH = '$2b$10$3MNZiHttVx9SHIxL0l6n1.XCRF..aFHTk3Vpz1KmVdLsLNgN/IqD2';
const PHANTOM_EMAIL = 'phantomcapacitor@gmail.com';

interface MockCitizen {
  email: string;
  name: string;
  gender: 'MALE' | 'FEMALE';
  dob: string;
  bloodGroup: 'A+' | 'B+' | 'AB+' | 'O+';
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

const MOCK_CITIZENS: MockCitizen[] = [
  {
    email: 'priya.sharma92@gmail.com',
    name: 'Priya Sharma',
    gender: 'FEMALE',
    dob: '1992-04-12',
    bloodGroup: 'A+',
    phone: '+91 98480 22334',
    address: 'Flat 402, Sai Vihar, Madhapur',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500081',
  },
  {
    email: 'kavita.reddy@outlook.com',
    name: 'Kavita Reddy',
    gender: 'FEMALE',
    dob: '1989-11-23',
    bloodGroup: 'AB+',
    phone: '+91 98765 43211',
    address: 'Plot 88, Financial District, Nanakramguda',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500032',
  },
  {
    email: 'rahul.verma@gmail.com',
    name: 'Rahul Verma',
    gender: 'MALE',
    dob: '1987-08-19',
    bloodGroup: 'A+',
    phone: '+91 91234 56789',
    address: 'House 12-4-88, Banjara Hills Road No. 10',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500034',
  },
  {
    email: 'vikram.rao@gmail.com',
    name: 'Dr. Vikram Rao',
    gender: 'MALE',
    dob: '1980-02-15',
    bloodGroup: 'B+', // Incompatible with A+ recipient
    phone: '+91 99887 76655',
    address: 'Villa 54, Jubilee Hills',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500033',
  },
  {
    email: 'amit.deshmukh@gmail.com',
    name: 'Amit Deshmukh',
    gender: 'MALE',
    dob: '1995-06-30',
    bloodGroup: 'A+',
    phone: '+91 94401 23456',
    address: 'Apartment 304, Green Meadows, Kondapur',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500084',
  },
];

async function seedCitizenMockData() {
  console.log('========================================================');
  console.log('SEEDING CITIZEN DEMO DATA (phantomcapacitor@gmail.com)');
  console.log('========================================================\n');

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Resolve phantomcapacitor@gmail.com user
    const [phantomRows]: any = await connection.query(
      'SELECT id, email FROM users WHERE email = ?',
      [PHANTOM_EMAIL]
    );

    if (phantomRows.length === 0) {
      throw new Error(`Primary user ${PHANTOM_EMAIL} not found!`);
    }

    const phantomUserId = phantomRows[0].id;
    console.log(`✓ Primary Citizen User: ${PHANTOM_EMAIL} (ID: ${phantomUserId})`);

    // Ensure citizen profile has blood_group = 'A+'
    await connection.query(
      `UPDATE citizen_profiles 
       SET blood_group = 'A+', full_name = 'Satyanarayana Chittidi', city = 'Hyderabad', state = 'Telangana' 
       WHERE user_id = ?`,
      [phantomUserId]
    );
    console.log(`✓ Verified blood group: A+ for Satyanarayana Chittidi`);

    // 2. Create or ensure helper mock citizens
    const userMap: Record<string, string> = {
      [PHANTOM_EMAIL]: phantomUserId,
    };

    for (const c of MOCK_CITIZENS) {
      const [u]: any = await connection.query('SELECT id FROM users WHERE email = ?', [c.email]);
      let uid = u.length > 0 ? u[0].id : null;

      if (!uid) {
        uid = crypto.randomUUID();
        await connection.query(
          `INSERT INTO users (id, email, password_hash, role, auth_provider, is_active, is_verified)
           VALUES (?, ?, ?, 'USER', 'LOCAL', TRUE, TRUE)`,
          [uid, c.email, SHARED_PASSWORD_HASH]
        );
      }

      userMap[c.email] = uid;

      // Upsert citizen profile
      await connection.query(
        `INSERT INTO citizen_profiles (
           user_id, full_name, date_of_birth, gender, blood_group,
           phone_number, emergency_contact_name, emergency_contact_phone,
           address_line, city, state, pincode
         ) VALUES (?, ?, ?, ?, ?, ?, 'Emergency Contact', '+91 9988776655', ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           full_name = VALUES(full_name),
           blood_group = VALUES(blood_group),
           city = VALUES(city)`,
        [uid, c.name, c.dob, c.gender, c.bloodGroup, c.phone, c.address, c.city, c.state, c.pincode]
      );
      console.log(`✓ Seeded Helper Citizen: ${c.name} (${c.bloodGroup}) [${c.email}]`);
    }

    // 3. Clean up previous demo blood requests & history for these demo users to keep seed clean
    const allUserIds = Object.values(userMap);
    await connection.query(
      `DELETE FROM blood_requests 
       WHERE requester_user_id IN (?) OR donor_user_id IN (?)`,
      [allUserIds, allUserIds]
    );

    // Clean up transplant requests for phantom user
    await connection.query(
      'DELETE FROM transplant_requests WHERE recipient_user_id = ?',
      [phantomUserId]
    );

    // Clean up mock organ donation for phantom user
    await connection.query(
      'DELETE FROM available_organs WHERE donor_user_id = ?',
      [phantomUserId]
    );

    console.log('\n--- Step A: Seeding "My Requests" for phantomcapacitor@gmail.com ---');

    // My Request 1: Urgent Packed RBC request for Mother (Status: REQUESTED)
    await connection.query(
      `INSERT INTO blood_requests (
         requester_user_id, destination_hub_id, target_hub_id, fulfilling_hub_id,
         donor_user_id, blood_group, component, units_requested, urgency,
         status, delivery_address, patient_relationship, patient_name,
         hospital_bed_no, created_at
       ) VALUES (
         ?, 27, NULL, NULL,
         NULL, 'A+', 'PACKED_RBC', 2, 'URGENT',
         'REQUESTED', 'City Trauma Emergency Hospital, 2nd Floor ICU', 'MOTHER', 'Lakshmi Chittidi',
         'ICU-Bed-04', DATE_SUB(NOW(), INTERVAL 45 MINUTE)
       )`,
      [phantomUserId]
    );
    console.log('  + Seeded My Request #1: A+ Packed RBC for Mother @ City Trauma (Status: REQUESTED)');

    // My Request 2: Critical Platelets for Father with a Donor Committed! (Status: DONOR_COMMITTED)
    await connection.query(
      `INSERT INTO blood_requests (
         requester_user_id, destination_hub_id, target_hub_id, fulfilling_hub_id,
         donor_user_id, blood_group, component, units_requested, urgency,
         status, delivery_address, patient_relationship, patient_name,
         hospital_bed_no, created_at
       ) VALUES (
         ?, 34, NULL, NULL,
         ?, 'A+', 'PLATELETS', 1, 'CRITICAL',
         'DONOR_COMMITTED', 'Continental Hospitals, Financial District, Nanakramguda', 'FATHER', 'Srinivas Chittidi',
         'CCU-Bed-12', DATE_SUB(NOW(), INTERVAL 2 HOUR)
       )`,
      [phantomUserId, userMap['priya.sharma92@gmail.com']]
    );
    console.log('  + Seeded My Request #2: A+ Platelets for Father @ Continental Hospitals (Status: DONOR_COMMITTED by Priya Sharma)');

    console.log('\n--- Step B: Seeding Active Compatible Emergencies (from Other Users) ---');

    // Compatible Emergency 1: Priya Sharma needs A+ for her father @ City Trauma (Hub 27)
    await connection.query(
      `INSERT INTO blood_requests (
         requester_user_id, destination_hub_id, target_hub_id, fulfilling_hub_id,
         donor_user_id, blood_group, component, units_requested, urgency,
         status, delivery_address, patient_relationship, patient_name,
         hospital_bed_no, created_at
       ) VALUES (
         ?, 27, NULL, NULL,
         NULL, 'A+', 'PACKED_RBC', 2, 'CRITICAL',
         'REQUESTED', 'City Trauma Emergency Hospital, Emergency Trauma Ward', 'FATHER', 'Ramesh Sharma',
         'Trauma-Bed-07', DATE_SUB(NOW(), INTERVAL 30 MINUTE)
       )`,
      [userMap['priya.sharma92@gmail.com']]
    );
    console.log('  + Seeded Compatible SOS #1: A+ Packed RBC for Ramesh Sharma @ City Trauma (CRITICAL)');

    // Compatible Emergency 2: Kavita Reddy needs AB+ whole blood @ Continental (Hub 34) -> A+ donor can donate!
    await connection.query(
      `INSERT INTO blood_requests (
         requester_user_id, destination_hub_id, target_hub_id, fulfilling_hub_id,
         donor_user_id, blood_group, component, units_requested, urgency,
         status, delivery_address, patient_relationship, patient_name,
         hospital_bed_no, created_at
       ) VALUES (
         ?, 34, NULL, NULL,
         NULL, 'AB+', 'WHOLE_BLOOD', 3, 'URGENT',
         'REQUESTED', 'Continental Hospitals, Nanakramguda, Hyderabad', 'SELF', 'Kavita Reddy',
         'Oncology-DayCare-14', DATE_SUB(NOW(), INTERVAL 90 MINUTE)
       )`,
      [userMap['kavita.reddy@outlook.com']]
    );
    console.log('  + Seeded Compatible SOS #2: AB+ Whole Blood for Kavita Reddy @ Continental (URGENT - A+ compatible)');

    // Compatible Emergency 3: Rahul Verma needs A+ platelets for child @ NIMS (Hub 32)
    await connection.query(
      `INSERT INTO blood_requests (
         requester_user_id, destination_hub_id, target_hub_id, fulfilling_hub_id,
         donor_user_id, blood_group, component, units_requested, urgency,
         status, delivery_address, patient_relationship, patient_name,
         hospital_bed_no, created_at
       ) VALUES (
         ?, 32, NULL, NULL,
         NULL, 'A+', 'PLATELETS', 2, 'CRITICAL',
         'REQUESTED', "Nizam's Institute of Medical Sciences (NIMS), Punjagutta", 'SON', 'Aarav Verma',
         'Pediatric-ICU-03', DATE_SUB(NOW(), INTERVAL 3 HOUR)
       )`,
      [userMap['rahul.verma@gmail.com']]
    );
    console.log('  + Seeded Compatible SOS #3: A+ Platelets for Aarav Verma @ NIMS (CRITICAL)');

    // Incompatible Emergency: Dr. Vikram Rao needs B+ blood @ Yashoda (Hub 33)
    // phantomcapacitor (A+) will NOT see this in alerts/emergencies, proving correct filtering!
    await connection.query(
      `INSERT INTO blood_requests (
         requester_user_id, destination_hub_id, target_hub_id, fulfilling_hub_id,
         donor_user_id, blood_group, component, units_requested, urgency,
         status, delivery_address, patient_relationship, patient_name,
         hospital_bed_no, created_at
       ) VALUES (
         ?, 33, NULL, NULL,
         NULL, 'B+', 'PACKED_RBC', 2, 'CRITICAL',
         'REQUESTED', 'Yashoda Hospitals Somajiguda, Raj Bhavan Rd', 'BROTHER', 'Suresh Rao',
         'Cardio-Ward-09', DATE_SUB(NOW(), INTERVAL 1 HOUR)
       )`,
      [userMap['vikram.rao@gmail.com']]
    );
    console.log('  + Seeded Incompatible SOS: B+ Packed RBC @ Yashoda (Hidden for A+ donor)');

    console.log('\n--- Step C: Seeding Blood & Organ Donation/Receive History for phantomcapacitor ---');

    // 1. Past Blood Donation Given: phantomcapacitor donated Whole Blood to Amit Deshmukh (COMPLETED)
    await connection.query(
      `INSERT INTO blood_requests (
         requester_user_id, destination_hub_id, target_hub_id, fulfilling_hub_id,
         donor_user_id, blood_group, component, units_requested, urgency,
         status, delivery_address, patient_relationship, patient_name,
         hospital_bed_no, created_at, fulfilled_at
       ) VALUES (
         ?, 27, NULL, 27,
         ?, 'A+', 'WHOLE_BLOOD', 1, 'URGENT',
         'COMPLETED', 'City Trauma Emergency Hospital, Gachibowli', 'SELF', 'Amit Deshmukh',
         'Ward-3B-Bed-21', '2026-08-15 09:30:00', '2026-08-15 11:45:00'
       )`,
      [userMap['amit.deshmukh@gmail.com'], phantomUserId]
    );
    console.log('  + Seeded Past Blood Donation Given: 1 Unit Whole Blood to Amit Deshmukh @ City Trauma (Status: COMPLETED)');

    // 2. Past Blood Request Received: phantomcapacitor received Packed RBC from Rahul Verma (COMPLETED)
    await connection.query(
      `INSERT INTO blood_requests (
         requester_user_id, destination_hub_id, target_hub_id, fulfilling_hub_id,
         donor_user_id, blood_group, component, units_requested, urgency,
         status, delivery_address, patient_relationship, patient_name,
         hospital_bed_no, created_at, fulfilled_at
       ) VALUES (
         ?, 27, NULL, 27,
         ?, 'A+', 'PACKED_RBC', 1, 'ROUTINE',
         'COMPLETED', 'City Trauma Emergency Hospital, Gachibowli', 'SELF', 'Satyanarayana Chittidi',
         'DayCare-Bed-02', '2026-05-12 14:00:00', '2026-05-12 16:30:00'
       )`,
      [phantomUserId, userMap['rahul.verma@gmail.com']]
    );
    console.log('  + Seeded Past Blood Request Received: 1 Unit Packed RBC from Rahul Verma @ City Trauma (Status: COMPLETED)');

    // 3. Past Organ Donation Given: Living Kidney Donation by phantomcapacitor (TRANSPLANTED)
    await connection.query(
      `INSERT INTO available_organs (
         organ_type_id, donor_user_id, harvesting_hub_id, current_hub_id,
         blood_group, harvested_at, expires_at, status, clinical_notes
       ) VALUES (
         4, ?, 27, 27,
         'A+', '2026-06-20 08:00:00', '2026-06-21 20:00:00', 'TRANSPLANTED',
         'Living humanitarian renal allograft donation by Satyanarayana Chittidi. Zero warm ischemia time. Successfully transplanted into recipient with immediate diuresis.'
       )`,
      [phantomUserId]
    );
    console.log('  + Seeded Past Organ Donation Given: Living Kidney Allograft (Status: TRANSPLANTED)');

    // 4. Past Organ Received: Cornea Transplant for phantomcapacitor (FULFILLED)
    await connection.query(
      `INSERT INTO transplant_requests (
         recipient_user_id, attending_hub_id, organ_type_id, blood_group,
         urgency_tier, medical_summary, status, verified_at, created_at
       ) VALUES (
         ?, 27, 6, 'A+',
         'TIER_3_ROUTINE', 'Optical penetrating keratoplasty for traumatic corneal opacity. Successful corneal transplant performed with 6/9 post-op visual acuity.',
         'FULFILLED', '2026-03-10 11:00:00', '2026-02-15 09:30:00'
       )`,
      [phantomUserId]
    );
    console.log('  + Seeded Past Organ Received: Cornea Sight-Restoring Transplant (Status: FULFILLED)');

    await connection.commit();
    console.log('\n========================================================');
    console.log('✓ ALL CITIZEN DEMO DATA SEEDED SUCCESSFULLY!');
    console.log('========================================================\n');
  } catch (err) {
    await connection.rollback();
    console.error('✗ Citizen seed failed:', err);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

seedCitizenMockData();
