import pool from '../config/database';
import crypto from 'crypto';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface SeedMocksResult {
  organsSeeded: number;
  patientsSeeded: number;
  message: string;
}

export async function seedOrganMocksService(): Promise<SeedMocksResult> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [hubs] = await connection.query<RowDataPacket[]>(
      `SELECT id, name, city, latitude, longitude 
       FROM medical_hubs 
       WHERE hub_type = 'HOSPITAL' AND verification_status = 'ACTIVE'`
    );

    if (hubs.length === 0) {
      throw new Error('No active medical hubs found in database. Please register/verify at least one hospital first.');
    }

    const findHubByCity = (cityKeyword: string) => {
      const match = hubs.find((h) => h.city.toLowerCase().includes(cityKeyword.toLowerCase()));
      return match ? match.id : hubs[0].id;
    };

    const hydHubId = findHubByCity('Hyderabad');
    const delHubId = findHubByCity('Delhi');
    const mumHubId = findHubByCity('Mumbai');
    const punHubId = findHubByCity('Pune');

    const [types] = await connection.query<RowDataPacket[]>('SELECT id, code FROM organ_types');
    const typeMap: Record<string, number> = {};
    for (const t of types) {
      typeMap[t.code] = t.id;
    }

    await connection.query(
      `DELETE m FROM matches m
       JOIN available_organs ao ON ao.id = m.organ_id
       WHERE ao.clinical_notes LIKE '%[TEST - NEVER EXPIRES]%' OR ao.clinical_notes LIKE '%[Demo Graft]%'`
    );

    await connection.query(
      "DELETE FROM available_organs WHERE clinical_notes LIKE '%[TEST - NEVER EXPIRES]%' OR clinical_notes LIKE '%[Demo Graft]%'"
    );

    await connection.query(
      "DELETE FROM transplant_requests WHERE medical_summary LIKE '%[MOCK TEST]%'"
    );

    const mockOrgans = [
      {
        organ_type_id: typeMap['KIDNEY'],
        hub_id: hydHubId,
        blood_group: 'O+',
        notes: 'High-viability deceased donor kidney. Pulsatile hypothermic perfusion preserved. Zero warm ischemia.',
      },
      {
        organ_type_id: typeMap['KIDNEY'],
        hub_id: delHubId,
        blood_group: 'A+',
        notes: 'Donor kidney (A+). Cold ischemia preserved with HTK solution. HLA typing: A*02, B*44.',
      },
      {
        organ_type_id: typeMap['KIDNEY'],
        hub_id: mumHubId,
        blood_group: 'B+',
        notes: 'Donor kidney (B+). Cold perfused with University of Wisconsin (UW) preservation solution.',
      },
      {
        organ_type_id: typeMap['KIDNEY'],
        hub_id: punHubId,
        blood_group: 'AB-',
        notes: 'Rare Rh-negative donor kidney (AB-). Baseline biopsy shows normal glomeruli.',
      },
      {
        organ_type_id: typeMap['LIVER'],
        hub_id: hydHubId,
        blood_group: 'O+',
        notes: 'Full-size orthotopic liver graft (O+). Perfused with Custodiol HTK. Optimal vascular anatomy.',
      },
      {
        organ_type_id: typeMap['LIVER'],
        hub_id: delHubId,
        blood_group: 'B+',
        notes: 'Split liver graft (B+). Macrosteatosis < 5%. Ready for recipient crossmatch.',
      },
      {
        organ_type_id: typeMap['HEART'],
        hub_id: hydHubId,
        blood_group: 'O+',
        notes: 'Donor heart (O+). Left ventricular ejection fraction > 65%. Continuous micro-perfusion maintained.',
      },
      {
        organ_type_id: typeMap['HEART'],
        hub_id: mumHubId,
        blood_group: 'A-',
        notes: 'Adult cardiac graft (A-). Preserved under hypothermic machine perfusion.',
      },
      {
        organ_type_id: typeMap['LUNG'],
        hub_id: delHubId,
        blood_group: 'A+',
        notes: 'Bilateral lung block (A+). Ex-vivo lung perfusion (EVLP) verified with normal compliance.',
      },
      {
        organ_type_id: typeMap['LUNG'],
        hub_id: hydHubId,
        blood_group: 'O-',
        notes: 'Universal donor bilateral lungs (O-). PaO2/FiO2 ratio > 450 mmHg.',
      },
      {
        organ_type_id: typeMap['CORNEA'],
        hub_id: hydHubId,
        blood_group: 'B+',
        notes: 'Clear cornea tissue in Optisol-GS medium. Endothelial cell density > 2900 cells/mm².',
      },
      {
        organ_type_id: typeMap['PANCREAS'],
        hub_id: punHubId,
        blood_group: 'O+',
        notes: 'Whole pancreas allograft with intact duodenal C-loop. Cold ischemia preserved.',
      },
    ];

    let organsCount = 0;
    for (const o of mockOrgans) {
      if (!o.organ_type_id) continue;
      await connection.query(
        `INSERT INTO available_organs (
           organ_type_id, harvesting_hub_id, current_hub_id, blood_group,
           harvested_at, expires_at, status, clinical_notes
         ) VALUES (?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 1 HOUR), '2099-12-31 23:59:59', 'AVAILABLE', ?)`,
        [o.organ_type_id, o.hub_id, o.hub_id, o.blood_group, o.notes]
      );
      organsCount++;
    }

    const mockPatients = [
      {
        email: 'aarav.sharma@patient.organdonation.in',
        name: 'Aarav Sharma',
        gender: 'MALE' as const,
        dob: '1984-06-15',
        blood_group: 'O+',
        hub_id: hydHubId,
        organ_code: 'KIDNEY',
        urgency: 'TIER_1_EMERGENCY',
        days_waiting: 210,
        status: 'WAITING_LIST',
        summary:
          'End-stage renal disease (ESRD) with failed vascular access for hemodialysis. Recurrent refractory hyperkalemia. UNOS Tier 1 Emergency indication.',
      },
      {
        email: 'priya.nair@patient.organdonation.in',
        name: 'Priya Nair',
        gender: 'FEMALE' as const,
        dob: '1991-03-22',
        blood_group: 'O+',
        hub_id: hydHubId,
        organ_code: 'KIDNEY',
        urgency: 'TIER_2_URGENT',
        days_waiting: 90,
        status: 'WAITING_LIST',
        summary:
          'Chronic glomerulonephritis on continuous ambulatory peritoneal dialysis (CAPD) with recurrent peritonitis episodes.',
      },
      {
        email: 'rohan.patel@patient.organdonation.in',
        name: 'Rohan Patel',
        gender: 'MALE' as const,
        dob: '1979-11-08',
        blood_group: 'A+',
        hub_id: delHubId,
        organ_code: 'KIDNEY',
        urgency: 'TIER_1_EMERGENCY',
        days_waiting: 15,
        status: 'WAITING_LIST',
        summary:
          'Rapidly progressive crescentic glomerulonephritis with acute uremic encephalopathy requiring urgent deceased donor renal transplant.',
      },
      {
        email: 'meera.deshmukh@patient.organdonation.in',
        name: 'Meera Deshmukh',
        gender: 'FEMALE' as const,
        dob: '1986-09-14',
        blood_group: 'B+',
        hub_id: mumHubId,
        organ_code: 'KIDNEY',
        urgency: 'TIER_2_URGENT',
        days_waiting: 320,
        status: 'WAITING_LIST',
        summary:
          'Autosomal dominant polycystic kidney disease (ADPKD) with nephromegaly and refractory severe renal anemia.',
      },
      {
        email: 'vikram.malhotra@patient.organdonation.in',
        name: 'Vikram Malhotra',
        gender: 'MALE' as const,
        dob: '1975-01-30',
        blood_group: 'AB+',
        hub_id: punHubId,
        organ_code: 'KIDNEY',
        urgency: 'TIER_3_ROUTINE',
        days_waiting: 45,
        status: 'WAITING_LIST',
        summary:
          'Diabetic nephropathy secondary to long-standing T2D. Stable on maintenance hemodialysis 3x/week. Universal recipient (AB+).',
      },
      {
        email: 'ananya.iyer@patient.organdonation.in',
        name: 'Ananya Iyer',
        gender: 'FEMALE' as const,
        dob: '1995-12-04',
        blood_group: 'O-',
        hub_id: delHubId,
        organ_code: 'KIDNEY',
        urgency: 'TIER_3_ROUTINE',
        days_waiting: 180,
        status: 'WAITING_LIST',
        summary:
          'Reflux nephropathy with bilateral small contracted kidneys. Patient maintains stable dry weight on nocturnal home dialysis.',
      },
      {
        email: 'rajesh.kumar@patient.organdonation.in',
        name: 'Rajesh Kumar',
        gender: 'MALE' as const,
        dob: '1970-07-19',
        blood_group: 'O+',
        hub_id: hydHubId,
        organ_code: 'LIVER',
        urgency: 'TIER_1_EMERGENCY',
        days_waiting: 10,
        status: 'WAITING_LIST',
        summary:
          'Fulminant acute hepatic failure secondary to drug-induced liver injury (DILI). Grade 3 hepatic encephalopathy. MELD score: 39.',
      },
      {
        email: 'sunita.roy@patient.organdonation.in',
        name: 'Sunita Roy',
        gender: 'FEMALE' as const,
        dob: '1982-04-11',
        blood_group: 'B+',
        hub_id: delHubId,
        organ_code: 'LIVER',
        urgency: 'TIER_1_EMERGENCY',
        days_waiting: 60,
        status: 'WAITING_LIST',
        summary:
          'Decompensated cirrhosis with type 1 hepatorenal syndrome and recurrent variceal bleeds. MELD score: 34.',
      },
      {
        email: 'amitabh.sen@patient.organdonation.in',
        name: 'Amitabh Sen',
        gender: 'MALE' as const,
        dob: '1968-08-25',
        blood_group: 'A+',
        hub_id: mumHubId,
        organ_code: 'LIVER',
        urgency: 'TIER_2_URGENT',
        days_waiting: 110,
        status: 'WAITING_LIST',
        summary:
          'Cryptogenic cirrhosis with refractory diuretic-resistant ascites and spontaneous bacterial peritonitis. MELD score: 26.',
      },
      {
        email: 'deepak.verma@patient.organdonation.in',
        name: 'Deepak Verma',
        gender: 'MALE' as const,
        dob: '1988-10-02',
        blood_group: 'O+',
        hub_id: hydHubId,
        organ_code: 'HEART',
        urgency: 'TIER_1_EMERGENCY',
        days_waiting: 25,
        status: 'WAITING_LIST',
        summary:
          'Ischemic cardiomyopathy NYHA Class IV on dual inotrope support (milrinone + noradrenaline) in cardiac ICU. Status 1A candidate.',
      },
      {
        email: 'kavita.reddy@patient.organdonation.in',
        name: 'Kavita Reddy',
        gender: 'FEMALE' as const,
        dob: '1992-05-18',
        blood_group: 'A-',
        hub_id: mumHubId,
        organ_code: 'HEART',
        urgency: 'TIER_1_EMERGENCY',
        days_waiting: 40,
        status: 'WAITING_LIST',
        summary:
          'Dilated cardiomyopathy with LVAD driveline bacteremia and severe right ventricular failure. UNOS Status 1A.',
      },
      {
        email: 'harish.pillai@patient.organdonation.in',
        name: 'Harish Pillai',
        gender: 'MALE' as const,
        dob: '1974-12-12',
        blood_group: 'O+',
        hub_id: delHubId,
        organ_code: 'HEART',
        urgency: 'TIER_2_URGENT',
        days_waiting: 95,
        status: 'WAITING_LIST',
        summary:
          'Post-viral myocarditis with LVEF 18%, recurrent non-sustained ventricular tachycardias on automatic implantable cardioverter-defibrillator.',
      },
      {
        email: 'nisha.gupta@patient.organdonation.in',
        name: 'Nisha Gupta',
        gender: 'FEMALE' as const,
        dob: '1980-02-14',
        blood_group: 'A+',
        hub_id: delHubId,
        organ_code: 'LUNG',
        urgency: 'TIER_1_EMERGENCY',
        days_waiting: 30,
        status: 'WAITING_LIST',
        summary:
          'Idiopathic pulmonary fibrosis (IPF) with acute exacerbation on veno-venous ECMO bridge. High urgent bilateral lung priority.',
      },
      {
        email: 'manoj.joshi@patient.organdonation.in',
        name: 'Manoj Joshi',
        gender: 'MALE' as const,
        dob: '1998-07-07',
        blood_group: 'O-',
        hub_id: hydHubId,
        organ_code: 'LUNG',
        urgency: 'TIER_2_URGENT',
        days_waiting: 140,
        status: 'WAITING_LIST',
        summary:
          'Cystic fibrosis with end-stage bronchiectasis, recurrent Pseudomonas respiratory failure, FEV1 22% of predicted.',
      },
      {
        email: 'lakshmi.narayanan@patient.organdonation.in',
        name: 'Lakshmi Narayanan',
        gender: 'FEMALE' as const,
        dob: '1965-03-09',
        blood_group: 'B+',
        hub_id: hydHubId,
        organ_code: 'CORNEA',
        urgency: 'TIER_2_URGENT',
        days_waiting: 75,
        status: 'WAITING_LIST',
        summary:
          'Severe bilateral corneal stromal dystrophy with central optical scarring. Visual acuity reduced to hand motion.',
      },
      {
        email: 'sanjay.singhania@patient.organdonation.in',
        name: 'Sanjay Singhania',
        gender: 'MALE' as const,
        dob: '1960-11-20',
        blood_group: 'O+',
        hub_id: mumHubId,
        organ_code: 'CORNEA',
        urgency: 'TIER_3_ROUTINE',
        days_waiting: 200,
        status: 'WAITING_LIST',
        summary:
          'Pseudophakic bullous keratopathy with corneal decompensation following complicated cataract extraction.',
      },
      {
        email: 'gaurav.bhatt@patient.organdonation.in',
        name: 'Gaurav Bhatt',
        gender: 'MALE' as const,
        dob: '1989-09-03',
        blood_group: 'O+',
        hub_id: punHubId,
        organ_code: 'PANCREAS',
        urgency: 'TIER_2_URGENT',
        days_waiting: 80,
        status: 'WAITING_LIST',
        summary:
          'Type 1 diabetes mellitus with severe hypoglycemic unawareness and frequent life-threatening neuroglycopenic seizures.',
      },
    ];

    let patientsCount = 0;
    for (const p of mockPatients) {
      const organTypeId = typeMap[p.organ_code];
      if (!organTypeId) continue;

      let userId: string;
      const [existingUser] = await connection.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE email = ? LIMIT 1',
        [p.email]
      );

      if (existingUser.length > 0) {
        userId = existingUser[0].id;
      } else {
        userId = crypto.randomUUID();
        await connection.query(
          `INSERT INTO users (id, email, password_hash, role, auth_provider, is_active, is_verified)
           VALUES (?, ?, NULL, 'USER', 'LOCAL', TRUE, TRUE)`,
          [userId, p.email]
        );
      }

      await connection.query(
        `INSERT INTO citizen_profiles (
           user_id, full_name, date_of_birth, gender, blood_group,
           phone_number, emergency_contact_name, emergency_contact_phone,
           address_line, city, state, pincode
         ) VALUES (?, ?, ?, ?, ?, '9876543210', 'Primary Guardian', '9876543211', 'Transplant Inpatient Ward', 'Regional Center', 'State', '500001')
         ON DUPLICATE KEY UPDATE
           full_name = VALUES(full_name),
           blood_group = VALUES(blood_group)`,
        [userId, p.name, p.dob, p.gender, p.blood_group]
      );

      await connection.query(
        `INSERT INTO transplant_requests (
           recipient_user_id, attending_hub_id, organ_type_id, blood_group,
           urgency_tier, medical_summary, status, verified_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), DATE_SUB(NOW(), INTERVAL ? DAY))`,
        [
          userId,
          p.hub_id,
          organTypeId,
          p.blood_group,
          p.urgency,
          p.summary,
          p.status,
          p.days_waiting,
        ]
      );
      patientsCount++;
    }

    await connection.commit();

    return {
      organsSeeded: organsCount,
      patientsSeeded: patientsCount,
      message: `Successfully seeded ${organsCount} never-expiring test organs and ${patientsCount} clinical test waitlist candidates.`,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
