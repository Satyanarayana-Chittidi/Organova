import crypto from 'crypto';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/database';
import { hashPassword } from '../utils/hash';
import { findUserByEmail } from './userModel';
import { MedicalHub } from '../types/hub';
import {
  CitizenProfile,
  UpsertCitizenProfileDTO,
  CitizenDonationHistory,
  CitizenBloodDonation,
  CitizenBloodRequest,
  CitizenOrganDonation,
  CitizenOrganRequest,
} from '../types/citizen';

// Interface extending CitizenProfile with mysql2's RowDataPacket
interface CitizenProfileRow extends CitizenProfile, RowDataPacket {}

/**
 * Finds a citizen profile by its linked user_id foreign key.
 */
export async function findCitizenProfileByUserId(userId: string): Promise<CitizenProfile | null> {
  const [rows] = await pool.query<CitizenProfileRow[]>(
    'SELECT * FROM citizen_profiles WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Inserts a new citizen profile, or updates the existing profile if one already exists.
 * Employs MySQL's atomic 'ON DUPLICATE KEY UPDATE' to prevent race conditions.
 */
export async function upsertCitizenProfile(
  userId: string,
  dto: UpsertCitizenProfileDTO
): Promise<CitizenProfile> {
  const avatarUrl = dto.avatar_url !== undefined ? dto.avatar_url : null;
  const query = `
    INSERT INTO citizen_profiles (
      user_id, full_name, date_of_birth, gender, blood_group,
      phone_number, emergency_contact_name, emergency_contact_phone,
      address_line, city, state, pincode, avatar_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      full_name = VALUES(full_name),
      date_of_birth = VALUES(date_of_birth),
      gender = VALUES(gender),
      blood_group = VALUES(blood_group),
      phone_number = VALUES(phone_number),
      emergency_contact_name = VALUES(emergency_contact_name),
      emergency_contact_phone = VALUES(emergency_contact_phone),
      address_line = VALUES(address_line),
      city = VALUES(city),
      state = VALUES(state),
      pincode = VALUES(pincode),
      avatar_url = COALESCE(VALUES(avatar_url), avatar_url)
  `;

  await pool.query<ResultSetHeader>(query, [
    userId,
    dto.full_name.trim(),
    dto.date_of_birth,
    dto.gender,
    dto.blood_group,
    dto.phone_number.trim(),
    dto.emergency_contact_name.trim(),
    dto.emergency_contact_phone.trim(),
    dto.address_line.trim(),
    dto.city.trim(),
    dto.state.trim(),
    dto.pincode.trim(),
    avatarUrl,
  ]);

  if (avatarUrl) {
    await pool.query<ResultSetHeader>(
      'UPDATE users SET avatar_url = ? WHERE id = ?',
      [avatarUrl, userId]
    );
  }

  const profile = await findCitizenProfileByUserId(userId);
  if (!profile) {
    throw new Error('Failed to retrieve citizen profile after save.');
  }
  return profile;
}

/**
 * Updates avatar URL for a citizen across citizen_profiles and users tables.
 */
export async function updateCitizenAvatar(
  userId: string,
  avatarUrl: string | null
): Promise<void> {
  await pool.query<ResultSetHeader>(
    'UPDATE citizen_profiles SET avatar_url = ? WHERE user_id = ?',
    [avatarUrl, userId]
  );
  await pool.query<ResultSetHeader>(
    'UPDATE users SET avatar_url = ? WHERE id = ?',
    [avatarUrl, userId]
  );
}

/**
 * Retrieves the comprehensive donation and harvest history for a citizen donor.
 * Combines blood donation orders (committed & completed) and harvested organs.
 */
export async function getCitizenDonationHistory(userId: string): Promise<CitizenDonationHistory> {
  // 1. Blood donation transactions where user is the donor
  const bloodQuery = `
    SELECT 
      br.id,
      br.blood_group,
      br.component,
      br.units_requested,
      br.urgency,
      br.status,
      br.patient_relationship,
      br.patient_name,
      br.hospital_bed_no,
      br.created_at,
      br.fulfilled_at,
      dh.name AS receiving_hospital_name,
      dh.city AS receiving_hospital_city,
      dh.address_line AS receiving_hospital_address,
      dh.contact_phone AS receiving_hospital_phone,
      fh.name AS fulfilling_hospital_name,
      fh.city AS fulfilling_hospital_city
    FROM blood_requests br
    JOIN medical_hubs dh ON dh.id = br.destination_hub_id
    LEFT JOIN medical_hubs fh ON fh.id = br.fulfilling_hub_id
    WHERE br.donor_user_id = ?
    ORDER BY COALESCE(br.fulfilled_at, br.created_at) DESC
  `;
  const [bloodRows] = await pool.query<(CitizenBloodDonation & RowDataPacket)[]>(bloodQuery, [userId]);

  // 2. Blood requests created/received by this user
  const bloodRequestsQuery = `
    SELECT 
      br.id,
      br.blood_group,
      br.component,
      br.units_requested,
      br.urgency,
      br.status,
      br.patient_relationship,
      br.patient_name,
      br.hospital_bed_no,
      br.created_at,
      br.fulfilled_at,
      dh.name AS destination_hub_name,
      dh.city AS destination_hub_city,
      dh.address_line AS destination_hub_address,
      dh.contact_phone AS destination_hub_phone,
      fh.name AS fulfilling_hub_name,
      cp.full_name AS donor_name,
      cp.phone_number AS donor_phone
    FROM blood_requests br
    JOIN medical_hubs dh ON dh.id = br.destination_hub_id
    LEFT JOIN medical_hubs fh ON fh.id = br.fulfilling_hub_id
    LEFT JOIN citizen_profiles cp ON cp.user_id = br.donor_user_id
    WHERE br.requester_user_id = ?
    ORDER BY br.created_at DESC
  `;
  const [bloodRequestRows] = await pool.query<(CitizenBloodRequest & RowDataPacket)[]>(bloodRequestsQuery, [userId]);

  // 3. Harvested organ transactions where user is the logged donor
  const organQuery = `
    SELECT 
      ao.id,
      ao.blood_group,
      ao.harvested_at,
      ao.expires_at,
      ao.status,
      ao.clinical_notes,
      ot.name AS organ_name,
      ot.code AS organ_code,
      ot.category AS organ_category,
      hh.name AS harvesting_hub_name,
      hh.city AS harvesting_hub_city,
      hh.address_line AS harvesting_hub_address,
      hh.contact_phone AS harvesting_hub_phone,
      (
        SELECT th.name 
        FROM matches m 
        JOIN transplant_requests tr ON tr.id = m.request_id 
        JOIN medical_hubs th ON th.id = tr.attending_hub_id 
        WHERE m.organ_id = ao.id 
        ORDER BY m.id DESC LIMIT 1
      ) AS recipient_hospital_name,
      (
        SELECT m.status 
        FROM matches m 
        WHERE m.organ_id = ao.id 
        ORDER BY m.id DESC LIMIT 1
      ) AS match_status
    FROM available_organs ao
    JOIN organ_types ot ON ot.id = ao.organ_type_id
    JOIN medical_hubs hh ON hh.id = ao.harvesting_hub_id
    WHERE ao.donor_user_id = ?
    ORDER BY ao.harvested_at DESC
  `;
  const [organRows] = await pool.query<(CitizenOrganDonation & RowDataPacket)[]>(organQuery, [userId]);

  // 4. Organ transplant waitlist/received requests where user is the recipient
  const organRequestsQuery = `
    SELECT 
      tr.id,
      ot.name AS organ_name,
      ot.code AS organ_code,
      tr.blood_group,
      tr.urgency_tier,
      CASE 
        WHEN tr.status = 'MATCH_OFFERED' AND (SELECT id FROM matches WHERE request_id = tr.id AND status = 'PROPOSED' LIMIT 1) IS NULL 
        THEN 'WAITING_LIST' 
        ELSE tr.status 
      END AS status,
      tr.medical_summary,
      tr.created_at,
      tr.verified_at,
      ah.name AS attending_hub_name,
      ah.city AS attending_hub_city,
      ah.address_line AS attending_hub_address
    FROM transplant_requests tr
    JOIN organ_types ot ON ot.id = tr.organ_type_id
    JOIN medical_hubs ah ON ah.id = tr.attending_hub_id
    WHERE tr.recipient_user_id = ?
    ORDER BY tr.created_at DESC
  `;
  const [organRequestRows] = await pool.query<(CitizenOrganRequest & RowDataPacket)[]>(organRequestsQuery, [userId]);

  // 5. Count registered pledges
  const [pledgeRows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) as count FROM donor_pledges WHERE user_id = ?',
    [userId]
  );
  const activePledges = Number(pledgeRows[0]?.count || 0);

  // 6. Calculate summary stats
  const totalBloodDonations = bloodRows.length;
  const completedBloodRows = bloodRows.filter((b) => b.status === 'COMPLETED');
  const completedBloodDonations = completedBloodRows.length;
  const totalBloodUnitsDonated = completedBloodRows.reduce(
    (sum, b) => sum + (Number(b.units_requested) || 1),
    0
  );
  const totalBloodRequested = bloodRequestRows.length;

  const totalOrgansDonated = organRows.length;
  const organsTransplanted = organRows.filter(
    (o) => o.status === 'TRANSPLANTED' || o.match_status === 'COMPLETED'
  ).length;
  const totalOrgansRequested = organRequestRows.length;

  // Standard clinical advocacy metrics: 1 unit of blood can save up to 3 lives, each organ up to 1 life
  const estimatedLivesSaved = totalBloodUnitsDonated * 3 + totalOrgansDonated;

  return {
    bloodDonations: bloodRows,
    bloodRequests: bloodRequestRows,
    organDonations: organRows,
    organRequests: organRequestRows,
    stats: {
      totalBloodDonations,
      completedBloodDonations,
      totalBloodUnitsDonated,
      totalBloodRequested,
      totalOrgansDonated,
      organsTransplanted,
      totalOrgansRequested,
      activePledges,
      estimatedLivesSaved,
    },
  };
}

// ====================================================================
// 4. HOSPITAL MASTER CONTROL CITIZEN OPERATIONS
// ====================================================================

export interface RegisteredCitizenSearchResult {
  id: string;
  email: string;
  full_name: string;
  blood_group: string;
  phone_number: string;
  date_of_birth: string;
  gender: string;
  city: string;
  state: string;
}

/**
 * Searches registered citizen accounts by Name, Email, or Phone.
 */
export async function searchRegisteredCitizens(
  query: string
): Promise<RegisteredCitizenSearchResult[]> {
  const cleanQuery = (query || '').trim();
  let sql = `
    SELECT 
      u.id,
      u.email,
      COALESCE(cp.full_name, u.email) AS full_name,
      COALESCE(cp.blood_group, 'O+') AS blood_group,
      COALESCE(cp.phone_number, '') AS phone_number,
      IFNULL(DATE_FORMAT(cp.date_of_birth, '%Y-%m-%d'), '') AS date_of_birth,
      COALESCE(cp.gender, 'OTHER') AS gender,
      COALESCE(cp.city, '') AS city,
      COALESCE(cp.state, '') AS state
    FROM users u
    LEFT JOIN citizen_profiles cp ON cp.user_id = u.id
    WHERE u.role = 'USER'
  `;
  const params: any[] = [];
  if (cleanQuery) {
    sql += ` AND (
      LOWER(u.email) LIKE LOWER(?) OR
      LOWER(cp.full_name) LIKE LOWER(?) OR
      cp.phone_number LIKE ?
    )`;
    const pattern = `%${cleanQuery}%`;
    params.push(pattern, pattern, pattern);
  }
  sql += ' ORDER BY cp.full_name ASC LIMIT 25';
  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows as RegisteredCitizenSearchResult[];
}

/**
 * Generates temporary password: first 4 letters of first name (lowercase) + birth year.
 * E.g., "Ramesh Patel", "1985-04-12" -> "rame1985".
 */
export function generateTemporaryPassword(fullName: string, dateOfBirth: string): string {
  const cleanName = (fullName || '').trim();
  const firstName = cleanName.split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, '').toLowerCase() || 'user';
  const prefix = firstName.length >= 4 ? firstName.slice(0, 4) : firstName;

  let year = '2000';
  if (dateOfBirth) {
    const parts = dateOfBirth.split(/[-/]/);
    if (parts[0] && parts[0].length === 4) {
      year = parts[0];
    } else {
      const parsed = new Date(dateOfBirth).getFullYear();
      if (!isNaN(parsed)) year = String(parsed);
    }
  }

  return `${prefix}${year}`;
}

export interface MasterRegisterCitizenDTO {
  full_name: string;
  email: string;
  date_of_birth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  blood_group: string;
  phone_number?: string;
  address_line?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

/**
 * Hospital Master Control: Registers a citizen account with pre-verified status (no OTP).
 * Used when enrolling transplant candidates or logging harvested organs.
 */
export async function masterRegisterCitizen(
  facilityHub: MedicalHub,
  dto: MasterRegisterCitizenDTO
): Promise<{ user: any; tempPassword: string }> {
  const normalizedEmail = dto.email.toLowerCase().trim();

  // 1. Check if user already exists
  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    const profile = await findCitizenProfileByUserId(existing.id);
    const error: any = new Error(
      `An account with email "${normalizedEmail}" already exists on the platform. You can link this citizen directly.`
    );
    error.statusCode = 409;
    error.existingUser = {
      id: existing.id,
      email: existing.email,
      full_name: profile?.full_name || existing.email,
      blood_group: profile?.blood_group || 'O+',
      phone_number: profile?.phone_number || '',
      date_of_birth: profile?.date_of_birth || '',
      gender: profile?.gender || 'OTHER',
    };
    throw error;
  }

  // 2. Generate temporary password
  const tempPassword = generateTemporaryPassword(dto.full_name, dto.date_of_birth);
  const passwordHash = await hashPassword(tempPassword);
  const newUserId = crypto.randomUUID();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 3. Create user record with verified status (No OTP required for Master Control)
    await connection.query(
      `INSERT INTO users (id, email, password_hash, role, auth_provider, is_active, is_verified)
       VALUES (?, ?, ?, 'USER', 'LOCAL', TRUE, TRUE)`,
      [newUserId, normalizedEmail, passwordHash]
    );

    // 4. Create citizen profile record
    await connection.query(
      `INSERT INTO citizen_profiles (
         user_id, full_name, date_of_birth, gender, blood_group,
         phone_number, emergency_contact_name, emergency_contact_phone,
         address_line, city, state, pincode
       ) VALUES (?, ?, ?, ?, ?, ?, 'Hospital Attendant', ?, ?, ?, ?, ?)`,
      [
        newUserId,
        dto.full_name.trim(),
        dto.date_of_birth,
        dto.gender || 'OTHER',
        dto.blood_group,
        dto.phone_number?.trim() || '9999999999',
        dto.phone_number?.trim() || '9999999999',
        dto.address_line?.trim() || 'Registered via Hospital Master Control',
        dto.city?.trim() || facilityHub.city,
        dto.state?.trim() || facilityHub.state || 'State',
        dto.pincode?.trim() || facilityHub.pincode || '000000',
      ]
    );

    await connection.commit();

    return {
      user: {
        id: newUserId,
        email: normalizedEmail,
        full_name: dto.full_name.trim(),
        blood_group: dto.blood_group,
        date_of_birth: dto.date_of_birth,
        gender: dto.gender || 'OTHER',
        phone_number: dto.phone_number?.trim() || '',
      },
      tempPassword,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
