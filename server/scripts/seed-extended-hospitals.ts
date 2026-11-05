import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import pool from '../src/config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Reusable password hash from trauma.care@cityhospital.com
const SHARED_PASSWORD_HASH = '$2b$10$3MNZiHttVx9SHIxL0l6n1.XCRF..aFHTk3Vpz1KmVdLsLNgN/IqD2';

interface HospitalSeedData {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  license: string;
}

const NEW_HOSPITALS: HospitalSeedData[] = [
  {
    name: "Nizam's Institute of Medical Sciences (NIMS)",
    email: 'nims.transplant@nims.edu.in',
    phone: '+91 40 2348 9000',
    address: 'Punjagutta, Somajiguda',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500082',
    latitude: 17.4222,
    longitude: 78.4527,
    license: 'MHUB-TS-HYD-001',
  },
  {
    name: 'Yashoda Hospitals Somajiguda',
    email: 'transplant.somajiguda@yashodahospitals.com',
    phone: '+91 40 4567 4567',
    address: 'Raj Bhavan Road, Matha Nagar, Somajiguda',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500082',
    latitude: 17.4265,
    longitude: 78.4578,
    license: 'MHUB-TS-HYD-002',
  },
  {
    name: 'Continental Hospitals Financial District',
    email: 'transplant.care@continentalhospitals.com',
    phone: '+91 40 6700 0000',
    address: 'Plot No. 3, Road No. 2, IT & Financial District, Nanakramguda',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500032',
    latitude: 17.4177,
    longitude: 78.3444,
    license: 'MHUB-TS-HYD-003',
  },
  {
    name: 'CARE Hospitals Banjara Hills',
    email: 'transplant@carehospitals.com',
    phone: '+91 40 6165 6565',
    address: 'Road No. 1, Prem Nagar, Banjara Hills',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500034',
    latitude: 17.4156,
    longitude: 78.4482,
    license: 'MHUB-TS-HYD-004',
  },
  {
    name: 'Sir Ganga Ram Hospital',
    email: 'organ.transplant@sgrh.com',
    phone: '+91 11 2575 0000',
    address: 'Sir Ganga Ram Hospital Marg, Old Rajinder Nagar',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110060',
    latitude: 28.6385,
    longitude: 77.1895,
    license: 'MHUB-DL-DEL-001',
  },
  {
    name: 'Max Super Speciality Hospital Saket',
    email: 'transplant.saket@maxhealthcare.com',
    phone: '+91 11 2651 5050',
    address: '1, 2, Press Enclave Marg, Saket Institutional Area',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110017',
    latitude: 28.5273,
    longitude: 77.2152,
    license: 'MHUB-DL-DEL-002',
  },
  {
    name: 'Fortis Memorial Research Institute (FMRI)',
    email: 'organova@fortishealthcare.com',
    phone: '+91 124 496 2200',
    address: 'Sector 44, Opposite HUDA City Centre Metro Station',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122002',
    latitude: 28.4595,
    longitude: 77.0725,
    license: 'MHUB-HR-GGN-001',
  },
  {
    name: 'Medanta - The Medicity',
    email: 'transplant.division@medanta.org',
    phone: '+91 124 414 1414',
    address: 'CH Bakhtawar Singh Road, Sector 38',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122001',
    latitude: 28.439,
    longitude: 77.0428,
    license: 'MHUB-HR-GGN-002',
  },
  {
    name: 'Tata Memorial Hospital & Cancer Institute',
    email: 'transplant.coord@tmc.gov.in',
    phone: '+91 22 2417 7000',
    address: 'Dr. E Borges Road, Parel East',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400012',
    latitude: 19.0041,
    longitude: 72.8432,
    license: 'MHUB-MH-MUM-001',
  },
  {
    name: 'Lilavati Hospital & Research Centre',
    email: 'organ.desk@lilavatihospital.com',
    phone: '+91 22 2675 1000',
    address: 'A-791, Bandra Reclamation Rd, Bandra West',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400050',
    latitude: 19.0519,
    longitude: 72.8295,
    license: 'MHUB-MH-MUM-002',
  },
  {
    name: 'Kokilaben Dhirubhai Ambani Hospital',
    email: 'transplant@kokilabenhospitals.com',
    phone: '+91 22 4269 6969',
    address: 'Rao Saheb, Achutrao Patwardhan Marg, Four Bungalows, Andheri West',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400053',
    latitude: 19.1314,
    longitude: 72.8252,
    license: 'MHUB-MH-MUM-003',
  },
  {
    name: 'P. D. Hinduja National Hospital',
    email: 'transplant.desk@hindujahospital.com',
    phone: '+91 22 2445 1515',
    address: 'Veer Savarkar Marg, Mahim West',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400016',
    latitude: 19.033,
    longitude: 72.8402,
    license: 'MHUB-MH-MUM-004',
  },
  {
    name: 'Narayana Institute of Cardiac Sciences',
    email: 'transplant@narayanahealth.org',
    phone: '+91 80 7122 2222',
    address: '258/A, Bommasandra Industrial Area, Anekal Taluk',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560099',
    latitude: 12.8016,
    longitude: 77.6974,
    license: 'MHUB-KA-BLR-001',
  },
  {
    name: 'Manipal Hospital Old Airport Road',
    email: 'transplant.coord@manipalhospitals.com',
    phone: '+91 80 2502 4444',
    address: '98, HAL Old Airport Rd, Kodihalli',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560017',
    latitude: 12.9592,
    longitude: 77.6534,
    license: 'MHUB-KA-BLR-002',
  },
  {
    name: 'Aster CMI Hospital Hebbal',
    email: 'transplant.cmi@asterhospital.com',
    phone: '+91 80 4342 0100',
    address: 'No. 43/42, NH 44, Sahakar Nagar, Hebbal',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560092',
    latitude: 13.056,
    longitude: 77.5925,
    license: 'MHUB-KA-BLR-003',
  },
  {
    name: 'Fortis Hospital Bannerghatta Road',
    email: 'transplant.blr@fortishealthcare.com',
    phone: '+91 80 6621 4444',
    address: '154/9, Bannerghatta Main Rd, Opposite IIMB',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560076',
    latitude: 12.8942,
    longitude: 77.5982,
    license: 'MHUB-KA-BLR-004',
  },
  {
    name: 'Apollo Hospital Greams Road',
    email: 'transplant.greams@apollohospitals.com',
    phone: '+91 44 2829 0200',
    address: '21 Greams Lane, Off Greams Road, Thousand Lights',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600006',
    latitude: 13.0556,
    longitude: 80.252,
    license: 'MHUB-TN-CHN-001',
  },
  {
    name: 'Christian Medical College (CMC) Vellore Center',
    email: 'transplant.services@cmcvellore.ac.in',
    phone: '+91 416 228 1000',
    address: 'Ida Scudder Road, Vellore',
    city: 'Vellore',
    state: 'Tamil Nadu',
    pincode: '632004',
    latitude: 12.9246,
    longitude: 79.135,
    license: 'MHUB-TN-VEL-001',
  },
  {
    name: 'MIOT International Multi-Speciality Hospital',
    email: 'transplant@miotinternational.com',
    phone: '+91 44 4200 2288',
    address: '4/112, Mount Poonamallee High Rd, Manapakkam',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600089',
    latitude: 13.0232,
    longitude: 80.1834,
    license: 'MHUB-TN-CHN-002',
  },
  {
    name: 'Gleneagles Global Health City',
    email: 'transplant.chennai@gleneagles.com',
    phone: '+91 44 4477 7000',
    address: '439, Cheran Nagar, Perumbakkam',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600100',
    latitude: 12.9022,
    longitude: 80.2018,
    license: 'MHUB-TN-CHN-003',
  },
  {
    name: 'Jehangir Hospital Pune',
    email: 'transplant@jehangirhospital.com',
    phone: '+91 20 6681 9999',
    address: '32, Sasoon Road, Opposite Pune Railway Station',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411001',
    latitude: 18.5284,
    longitude: 73.8744,
    license: 'MHUB-MH-PUN-001',
  },
  {
    name: 'Medica Superspecialty Hospital',
    email: 'transplant.desk@medicahospitals.in',
    phone: '+91 33 6652 0000',
    address: '127, Mukundapur, E.M. Bypass',
    city: 'Kolkata',
    state: 'West Bengal',
    pincode: '700099',
    latitude: 22.4988,
    longitude: 88.3976,
    license: 'MHUB-WB-KOL-001',
  },
  {
    name: 'Apollo Multispeciality Hospital Kolkata',
    email: 'transplant.kolkata@apollohospitals.com',
    phone: '+91 33 2320 3040',
    address: '58, Canal Circular Road, Kadapara, Phool Bagan',
    city: 'Kolkata',
    state: 'West Bengal',
    pincode: '700054',
    latitude: 22.5697,
    longitude: 88.4042,
    license: 'MHUB-WB-KOL-002',
  },
  {
    name: 'Zydus Hospital SG Highway',
    email: 'transplant.care@zydushospitals.com',
    phone: '+91 79 6619 0201',
    address: 'Zydus Hospital Road, SG Highway, Thaltej',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380054',
    latitude: 23.0722,
    longitude: 72.5255,
    license: 'MHUB-GJ-AHM-001',
  },
  {
    name: 'Post Graduate Institute of Medical Education & Research (PGIMER)',
    email: 'transplant@pgimer.edu.in',
    phone: '+91 172 274 7585',
    address: 'Sector 12, Madhya Marg',
    city: 'Chandigarh',
    state: 'Chandigarh',
    pincode: '160012',
    latitude: 30.7651,
    longitude: 76.7766,
    license: 'MHUB-CH-CHD-001',
  },
  {
    name: 'Amrita Institute of Medical Sciences (AIMS)',
    email: 'organ.transplant@aims.amrita.edu',
    phone: '+91 484 285 1234',
    address: 'AIMS Ponekkara P.O., Edappally',
    city: 'Kochi',
    state: 'Kerala',
    pincode: '682041',
    latitude: 10.0326,
    longitude: 76.2999,
    license: 'MHUB-KL-COK-001',
  },
];

async function seedHospitals(connection: any) {
  console.log('\n--- Step 1: Seeding 30+ Verified Hospitals ---');

  for (const hosp of NEW_HOSPITALS) {
    // Check if hospital or user exists
    const [existing] = await connection.query(
      'SELECT id FROM medical_hubs WHERE name = ? OR license_number = ?',
      [hosp.name, hosp.license]
    );

    if (existing.length > 0) {
      console.log(`  ✓ Hospital already exists: ${hosp.name}`);
      continue;
    }

    const userId = crypto.randomUUID();

    // Create user
    await connection.query(
      `INSERT INTO users (id, email, password_hash, role, auth_provider, is_active, is_verified)
       VALUES (?, ?, ?, 'HOSPITAL', 'LOCAL', TRUE, TRUE)
       ON DUPLICATE KEY UPDATE is_active = TRUE, is_verified = TRUE`,
      [userId, hosp.email, SHARED_PASSWORD_HASH]
    );

    // Get user id if email already existed
    const [userRows]: any = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      [hosp.email]
    );
    const resolvedUserId = userRows[0].id;

    // Create hospital hub
    await connection.query(
      `INSERT INTO medical_hubs (
         user_id, hub_type, name, license_number, contact_phone,
         address_line, city, state, pincode, latitude, longitude,
         verification_status, verified_at
       ) VALUES (?, 'HOSPITAL', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', NOW())`,
      [
        resolvedUserId,
        hosp.name,
        hosp.license,
        hosp.phone,
        hosp.address,
        hosp.city,
        hosp.state,
        hosp.pincode,
        hosp.latitude,
        hosp.longitude,
      ]
    );

    console.log(`  + Created Hospital: ${hosp.name} (${hosp.city})`);
  }

  // Ensure all existing hubs with status PENDING/REJECTED are updated to ACTIVE for a clean network
  await connection.query(
    "UPDATE medical_hubs SET verification_status = 'ACTIVE' WHERE verification_status != 'ACTIVE'"
  );

  const [totalCount]: any = await connection.query(
    "SELECT COUNT(*) as cnt FROM medical_hubs WHERE verification_status = 'ACTIVE'"
  );
  console.log(`Total Active Verified Hospitals in Network: ${totalCount[0].cnt}`);
}

async function seedBloodStock(connection: any) {
  console.log('\n--- Step 2: Seeding Realistic Blood Stock for City Trauma Emergency Hospital (Hub 27) ---');

  const bloodGroups = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'] as const;
  const components = ['WHOLE_BLOOD', 'PACKED_RBC', 'PLATELETS', 'PLASMA'] as const;

  // Realistic stock distribution based on blood type rarity & medical consumption
  const stockMatrix: Record<string, Record<string, number>> = {
    'O+': { WHOLE_BLOOD: 42, PACKED_RBC: 48, PLATELETS: 24, PLASMA: 32 },
    'A+': { WHOLE_BLOOD: 36, PACKED_RBC: 38, PLATELETS: 19, PLASMA: 26 },
    'B+': { WHOLE_BLOOD: 38, PACKED_RBC: 44, PLATELETS: 22, PLASMA: 28 },
    'AB+': { WHOLE_BLOOD: 18, PACKED_RBC: 22, PLATELETS: 14, PLASMA: 35 },
    'O-': { WHOLE_BLOOD: 15, PACKED_RBC: 18, PLATELETS: 11, PLASMA: 14 },
    'A-': { WHOLE_BLOOD: 10, PACKED_RBC: 14, PLATELETS: 8, PLASMA: 10 },
    'B-': { WHOLE_BLOOD: 9, PACKED_RBC: 12, PLATELETS: 7, PLASMA: 9 },
    'AB-': { WHOLE_BLOOD: 6, PACKED_RBC: 8, PLATELETS: 5, PLASMA: 7 },
  };

  let totalUnitsHub27 = 0;
  for (const bg of bloodGroups) {
    for (const comp of components) {
      const units = stockMatrix[bg][comp];
      totalUnitsHub27 += units;

      await connection.query(
        `INSERT INTO blood_inventory (hub_id, blood_group, component, units_available, last_updated)
         VALUES (27, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE units_available = VALUES(units_available), last_updated = NOW()`,
        [bg, comp, units]
      );
    }
  }
  console.log(`  ✓ Populated all 32 blood stock categories for Hub 27. Total Units: ${totalUnitsHub27}`);

  // Seed supporting inventory for AIIMS (20), KEM Mumbai (29), Apollo Delhi (28) for network search realism
  const partnerHubs = [20, 28, 29];
  for (const pHub of partnerHubs) {
    for (const bg of bloodGroups) {
      for (const comp of components) {
        const base = stockMatrix[bg][comp];
        const units = Math.max(3, Math.round(base * 0.75));
        await connection.query(
          `INSERT INTO blood_inventory (hub_id, blood_group, component, units_available, last_updated)
           VALUES (?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE units_available = VALUES(units_available), last_updated = NOW()`,
          [pHub, bg, comp, units]
        );
      }
    }
  }
  console.log(`  ✓ Seeded realistic inventory across 3 partner hospitals (AIIMS, Apollo Delhi, KEM Mumbai).`);
}

async function seedNeverExpiringOrgans(connection: any) {
  console.log('\n--- Step 3: Seeding 16 Never-Expiring Viable Organs for City Trauma (Hub 27) ---');

  // Fetch organ types mapping
  const [types]: any = await connection.query('SELECT id, code FROM organ_types');
  const typeMap: Record<string, number> = {};
  for (const t of types) {
    typeMap[t.code] = t.id;
  }

  // Clean up matches tied to Hub 27 mock organs first
  await connection.query(
    `DELETE m FROM matches m
     JOIN available_organs ao ON ao.id = m.organ_id
     WHERE ao.harvesting_hub_id = 27`
  );

  // Remove old expired or mock organs for Hub 27
  await connection.query('DELETE FROM available_organs WHERE harvesting_hub_id = 27');

  const NEVER_EXPIRING_DATE = '2099-12-31 23:59:59';

  const organsList = [
    {
      type: 'KIDNEY',
      blood: 'O+',
      notes: 'Donor Age 28. Pulsatile hypothermic machine perfusion (LifePort). Zero warm ischemia time. Glomerulosclerosis < 2%, flow 135 mL/min, resistance 0.16 mmHg/mL/min. HLA typing: A*02, A*24, B*07, B*44, DRB1*04. [NEVER EXPIRES]',
    },
    {
      type: 'KIDNEY',
      blood: 'A+',
      notes: 'Donor Age 34. Cold perfusion with University of Wisconsin (UW) solution. Serum creatinine at harvest 0.8 mg/dL. Single renal artery and vein with aortic patch. HLA typing: A*01, A*03, B*08, B*35, DRB1*03. [NEVER EXPIRES]',
    },
    {
      type: 'KIDNEY',
      blood: 'B+',
      notes: 'Donor Age 25. Dual-perfused graft with HTK Custodiol solution. Dual renal arteries on single aortic Carrel patch. Biopsy confirms normal glomeruli and interstitial architecture. [NEVER EXPIRES]',
    },
    {
      type: 'KIDNEY',
      blood: 'AB-',
      notes: 'Donor Age 30. Rare Rh-negative deceased donor kidney. High viability indices, resistance index 0.18 mmHg/mL/min, perfusate flow 128 mL/min. Crossmatch ready. [NEVER EXPIRES]',
    },
    {
      type: 'KIDNEY',
      blood: 'O-',
      notes: 'Donor Age 22. Universal donor kidney graft. Machine hypothermic perfused, perfusate flow > 140 mL/min. Normal anatomical margins. [NEVER EXPIRES]',
    },
    {
      type: 'LIVER',
      blood: 'O+',
      notes: 'Donor Age 29. Full-size orthotopic liver graft. Perfused with Custodiol HTK. Optimal vascular anatomy, macrosteatosis < 3%, normal intrahepatic bile ducts. [NEVER EXPIRES]',
    },
    {
      type: 'LIVER',
      blood: 'A+',
      notes: 'Donor Age 32. Right lobe donor graft (Segments V-VIII). Graft-to-recipient weight ratio (GRWR) 1.18%. Flushed with UW cold storage solution. Normal portal flow dynamics. [NEVER EXPIRES]',
    },
    {
      type: 'LIVER',
      blood: 'B+',
      notes: 'Donor Age 26. Whole deceased donor liver graft. Biopsy confirmed macrosteatosis < 5%. Excellent parenchymal preservation, rapid bile clearance. [NEVER EXPIRES]',
    },
    {
      type: 'HEART',
      blood: 'O+',
      notes: 'Donor Age 24. Cardiac graft preserved with continuous micro-perfusion (TransMedics OCS Heart). Left ventricular ejection fraction (LVEF) 65%. Zero coronary calcification. [NEVER EXPIRES]',
    },
    {
      type: 'HEART',
      blood: 'A-',
      notes: 'Donor Age 27. Adult cardiac graft. Preserved under hypothermic machine perfusion. PaO2 > 450 mmHg, normal wall motion by transesophageal echocardiography. [NEVER EXPIRES]',
    },
    {
      type: 'HEART',
      blood: 'B+',
      notes: 'Donor Age 31. Cardiac allograft preserved with St. Thomas cold cardioplegia solution. Normal donor ECG, zero ischemic changes. [NEVER EXPIRES]',
    },
    {
      type: 'LUNG',
      blood: 'O-',
      notes: 'Donor Age 23. Universal donor bilateral lung block. Ex-vivo lung perfusion (EVLP) verified with static lung compliance 55 mL/cmH2O. PaO2/FiO2 ratio > 480 mmHg. [NEVER EXPIRES]',
    },
    {
      type: 'LUNG',
      blood: 'A+',
      notes: 'Donor Age 29. Single left lung allograft. Clear bronchoscopy negative for aspiration, PaO2/FiO2 > 430 mmHg on 100% FiO2. EVLP stabilized. [NEVER EXPIRES]',
    },
    {
      type: 'PANCREAS',
      blood: 'O+',
      notes: 'Donor Age 21. Whole pancreas allograft with intact duodenal C-loop and mesenteric vascular reconstruction. Cold ischemia preserved in UW solution. [NEVER EXPIRES]',
    },
    {
      type: 'CORNEA',
      blood: 'B+',
      notes: 'Donor Age 35. Optical-grade corneal graft preserved in Optisol-GS medium at 4°C. Endothelial cell density (ECD) 3,100 cells/mm². Crystal clear stroma. [NEVER EXPIRES]',
    },
    {
      type: 'CORNEA',
      blood: 'O+',
      notes: 'Donor Age 27. Penetrating keratoplasty tissue in corneal storage medium. ECD 3,250 cells/mm², epithelial integrity 100%. Negative for infectious markers. [NEVER EXPIRES]',
    },
  ];

  for (const org of organsList) {
    const organTypeId = typeMap[org.type];
    if (!organTypeId) {
      console.warn(`Organ type ${org.type} not found in database!`);
      continue;
    }

    await connection.query(
      `INSERT INTO available_organs (
         organ_type_id, harvesting_hub_id, current_hub_id, blood_group,
         harvested_at, expires_at, status, clinical_notes
       ) VALUES (?, 27, 27, ?, DATE_SUB(NOW(), INTERVAL 2 HOUR), ?, 'AVAILABLE', ?)`,
      [organTypeId, org.blood, NEVER_EXPIRING_DATE, org.notes]
    );
  }

  const [countRows]: any = await connection.query(
    'SELECT COUNT(*) as cnt FROM available_organs WHERE harvesting_hub_id = 27 AND status = "AVAILABLE"'
  );
  console.log(`  ✓ Total Active Viable Organs for Hub 27: ${countRows[0].cnt}`);
}

async function seedNeverExpiringCamps(connection: any) {
  console.log('\n--- Step 4: Seeding 10 Never-Expiring Medical Camps for City Trauma (Hub 27) ---');

  const hubUserId = '9a71417b-28fc-4a26-905c-1100f9265b81';

  // Clean up old camps for Hub 27
  await connection.query('DELETE FROM blood_donation_camps WHERE organizer_hub_id = 27');

  const campsList = [
    {
      name: 'HITEC City Tech Park Mega Blood Drive',
      description:
        'Flagship corporate donation drive in partnership with cyber tech corridors. Includes on-site pre-donation health vitals screening, refreshments, and certified digital donor cards.',
      venue: 'Cyber Towers Main Atrium, HITEC City',
      address: 'Hitech City Main Rd, Patrika Nagar, HITEC City',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500081',
      date: '2027-02-15',
      endDate: '2027-02-17',
      startTime: '09:00 AM',
      endTime: '06:00 PM',
      phone: '+91 98490 12345',
      target: 300,
      status: 'UPCOMING',
      lat: 17.4504,
      lng: 78.3808,
      mapUrl: 'https://maps.google.com/?q=Cyber+Towers+Hyderabad',
    },
    {
      name: 'Gachibowli Financial District Corporate Camp',
      description:
        'Multi-corporate life-saving initiative hosting over 40 financial institutions and fintech firms. Fully air-conditioned mobile phlebotomy units available.',
      venue: 'WaveRock SEZ Building 2 Concourse',
      address: 'WaveRock SEZ, Nanakramguda, Financial District',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500032',
      date: '2027-03-10',
      endDate: '2027-03-12',
      startTime: '09:30 AM',
      endTime: '05:30 PM',
      phone: '+91 98490 12345',
      target: 250,
      status: 'UPCOMING',
      lat: 17.4177,
      lng: 78.3444,
      mapUrl: 'https://maps.google.com/?q=WaveRock+SEZ+Hyderabad',
    },
    {
      name: 'Osmania University Youth LifeSaver Camp',
      description:
        'University-wide youth donation marathon organizing undergraduate and postgraduate students. Features educational seminars on stem cell & voluntary blood donation.',
      venue: 'University Arts College Pavilion',
      address: 'Osmania University Campus, Amberpet',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500007',
      date: '2027-04-05',
      endDate: '2027-04-06',
      startTime: '09:00 AM',
      endTime: '05:00 PM',
      phone: '+91 98490 12345',
      target: 350,
      status: 'UPCOMING',
      lat: 17.4184,
      lng: 78.5284,
      mapUrl: 'https://maps.google.com/?q=Osmania+University+Arts+College',
    },
    {
      name: 'Jubilee Hills Community Health & Blood Camp',
      description:
        'Community wellness camp open to all local residents. Comprehensive blood group testing, hemoglobin assays, and organ donor pledge registration booth on site.',
      venue: 'Jubilee Hills International Centre (JHIC)',
      address: 'Road No. 36, Jubilee Hills',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500033',
      date: '2027-05-12',
      endDate: '2027-05-13',
      startTime: '08:30 AM',
      endTime: '04:30 PM',
      phone: '+91 98490 12345',
      target: 180,
      status: 'UPCOMING',
      lat: 17.4326,
      lng: 78.4071,
      mapUrl: 'https://maps.google.com/?q=Jubilee+Hills+Club+Hyderabad',
    },
    {
      name: 'Banjara Hills Rotary Mega Blood Drive',
      description:
        'Rotary International community partner drive focusing on rare blood groups (O-negative, AB-negative, Bombay phenotype matching).',
      venue: 'KBR Park Open Amphitheatre Ground',
      address: 'Opposite LV Prasad Eye Institute, Road No. 2, Banjara Hills',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500034',
      date: '2027-06-18',
      endDate: '2027-06-19',
      startTime: '07:30 AM',
      endTime: '03:30 PM',
      phone: '+91 98490 12345',
      target: 200,
      status: 'UPCOMING',
      lat: 17.4243,
      lng: 78.4312,
      mapUrl: 'https://maps.google.com/?q=KBR+National+Park+Hyderabad',
    },
    {
      name: 'Secunderabad Railway Central Blood Drive',
      description:
        'South Central Railway employee and passenger solidarity donation drive. Rapid donor screening and certificate issuance.',
      venue: 'Rail Nilayam Community Auditorium',
      address: 'Sarojini Devi Road, Secunderabad',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500071',
      date: '2027-07-22',
      endDate: '2027-07-23',
      startTime: '09:00 AM',
      endTime: '05:00 PM',
      phone: '+91 98490 12345',
      target: 220,
      status: 'UPCOMING',
      lat: 17.4411,
      lng: 78.5015,
      mapUrl: 'https://maps.google.com/?q=Rail+Nilayam+Secunderabad',
    },
    {
      name: 'IIT Hyderabad Technology & Health Camp',
      description:
        'Technological institute camp organized by NSS IIT Hyderabad. Demonstrating smart cold-chain transit tracking and donor registration.',
      venue: 'Academic Block A Ground Floor Foyer',
      address: 'IIT Hyderabad Campus, Kandi, Sangareddy',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '502285',
      date: '2027-08-14',
      endDate: '2027-08-15',
      startTime: '09:00 AM',
      endTime: '06:00 PM',
      phone: '+91 98490 12345',
      target: 250,
      status: 'UPCOMING',
      lat: 17.5947,
      lng: 78.123,
      mapUrl: 'https://maps.google.com/?q=IIT+Hyderabad+Kandi',
    },
    {
      name: 'Inorbit Mall Weekend Community Blood Drive',
      description:
        'Weekend community drive at Mindspace Madhapur. High footfall awareness stall with free blood pressure and glucose checks.',
      venue: 'Inorbit Mall Central Atrium (Ground Floor)',
      address: 'APIIC Software Layout, Mindspace, Madhapur',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500081',
      date: '2027-09-20',
      endDate: '2027-09-22',
      startTime: '10:00 AM',
      endTime: '07:00 PM',
      phone: '+91 98490 12345',
      target: 280,
      status: 'UPCOMING',
      lat: 17.4343,
      lng: 78.3867,
      mapUrl: 'https://maps.google.com/?q=Inorbit+Mall+Hyderabad',
    },
    {
      name: 'Kondapur Botanical Garden LifeSaver Camp',
      description:
        'Outdoor green health drive adjacent to Kotla Vijayabhaskara Reddy Botanical Garden. Early morning wellness walk and donor sign-up.',
      venue: 'Botanical Garden Main Entrance Pavilion',
      address: 'Gachibowli - Miyapur Rd, Kondapur',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500084',
      date: '2027-10-15',
      endDate: '2027-10-16',
      startTime: '08:00 AM',
      endTime: '04:00 PM',
      phone: '+91 98490 12345',
      target: 170,
      status: 'UPCOMING',
      lat: 17.4617,
      lng: 78.3582,
      mapUrl: 'https://maps.google.com/?q=Botanical+Garden+Kondapur',
    },
    {
      name: 'Begumpet Airport Zone Emergency Blood Drive',
      description:
        'Aerospace and civil aviation personnel blood drive, ensuring rapid emergency stocks for trauma centers and armed forces transfusions.',
      venue: 'Begumpet Officers Club Lawn',
      address: 'Airport Road, Prakash Nagar, Begumpet',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500016',
      date: '2027-11-10',
      endDate: '2027-11-11',
      startTime: '09:00 AM',
      endTime: '05:00 PM',
      phone: '+91 98490 12345',
      target: 200,
      status: 'UPCOMING',
      lat: 17.4475,
      lng: 78.4682,
      mapUrl: 'https://maps.google.com/?q=Begumpet+Airport+Hyderabad',
    },
  ];

  for (const c of campsList) {
    await connection.query(
      `INSERT INTO blood_donation_camps (
         organizer_hub_id, created_by_user_id, camp_name, description,
         venue_name, address_line, city, state, pincode,
         camp_date, end_date, start_time, end_time,
         contact_phone, contact_email, target_units, status,
         latitude, longitude, map_url
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        27,
        hubUserId,
        c.name,
        c.description,
        c.venue,
        c.address,
        c.city,
        c.state,
        c.pincode,
        c.date,
        c.endDate,
        c.startTime,
        c.endTime,
        c.phone,
        'trauma.care@cityhospital.com',
        c.target,
        c.status,
        c.lat,
        c.lng,
        c.mapUrl,
      ]
    );
    console.log(`  + Seeded Camp: ${c.name} (${c.date} to ${c.endDate})`);
  }

  const [countRows]: any = await connection.query(
    'SELECT COUNT(*) as cnt FROM blood_donation_camps WHERE organizer_hub_id = 27 AND status = "UPCOMING"'
  );
  console.log(`  ✓ Total Active/Upcoming Camps for Hub 27: ${countRows[0].cnt}`);
}

async function main() {
  console.log('========================================================');
  console.log('SEEDING EXTENDED HOSPITAL MOCK DATA (30 HUBS, STOCK, ORGANS, CAMPS)');
  console.log('========================================================');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await seedHospitals(connection);
    await seedBloodStock(connection);
    await seedNeverExpiringOrgans(connection);
    await seedNeverExpiringCamps(connection);

    await connection.commit();
    console.log('\n========================================================');
    console.log('✓ ALL HOSPITAL MOCK DATA SEEDED SUCCESSFULLY!');
    console.log('========================================================\n');
  } catch (err) {
    await connection.rollback();
    console.error('\n✗ Seed Failed! Rolled back transaction:', err);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

main();
