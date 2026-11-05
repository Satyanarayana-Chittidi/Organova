import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/database';
import { MedicalHub, HubType, VerificationStatus, HubQueryFilters, RegisterHubDTO, HubTransactionHistory, UpdateHubProfileDTO, } from '../types/hub';
interface MedicalHubRow extends MedicalHub, RowDataPacket {
}
export async function findHubByUserId(userId: string): Promise<MedicalHub | null> {
    const [rows] = await pool.query<MedicalHubRow[]>('SELECT * FROM medical_hubs WHERE user_id = ? LIMIT 1', [userId]);
    return rows.length > 0 ? rows[0] : null;
}
export async function findHubById(id: number): Promise<MedicalHub | null> {
    const [rows] = await pool.query<MedicalHubRow[]>('SELECT * FROM medical_hubs WHERE id = ? LIMIT 1', [id]);
    return rows.length > 0 ? rows[0] : null;
}
export async function findHubByLicense(licenseNumber: string): Promise<MedicalHub | null> {
    const [rows] = await pool.query<MedicalHubRow[]>('SELECT * FROM medical_hubs WHERE license_number = ? LIMIT 1', [licenseNumber.trim().toUpperCase()]);
    return rows.length > 0 ? rows[0] : null;
}
export async function createHubWithUser(userId: string, dto: RegisterHubDTO, passwordHash: string): Promise<MedicalHub> {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query<ResultSetHeader>(`INSERT INTO users (id, email, password_hash, role, auth_provider, is_active, is_verified)
       VALUES (?, ?, ?, ?, 'LOCAL', TRUE, TRUE)`, [userId, dto.email.toLowerCase().trim(), passwordHash, dto.hub_type]);
        const [hubResult] = await connection.query<ResultSetHeader>(`INSERT INTO medical_hubs (
         user_id, hub_type, name, license_number, contact_phone,
         address_line, city, state, pincode, latitude, longitude,
         verification_status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL')`, [
            userId,
            dto.hub_type,
            dto.name.trim(),
            dto.license_number.trim().toUpperCase(),
            dto.contact_phone.trim(),
            dto.address_line.trim(),
            dto.city.trim(),
            dto.state.trim(),
            dto.pincode.trim(),
            dto.latitude,
            dto.longitude,
        ]);
        await connection.commit();
        const hubId = hubResult.insertId;
        const createdHub = await findHubById(hubId);
        if (!createdHub)
            throw new Error('Failed to retrieve medical hub after transaction.');
        return createdHub;
    }
    catch (error) {
        await connection.rollback();
        throw error;
    }
    finally {
        connection.release();
    }
}
export async function updateHubVerificationStatus(hubId: number, status: VerificationStatus, adminId: string): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(`UPDATE medical_hubs
     SET verification_status = ?, verified_by_admin_id = ?, verified_at = NOW()
     WHERE id = ?`, [status, adminId, hubId]);
    return result.affectedRows > 0;
}
export async function listActiveHubs(filters: HubQueryFilters): Promise<MedicalHub[]> {
    let query = "SELECT * FROM medical_hubs WHERE verification_status = 'ACTIVE'";
    const params: any[] = [];
    if (filters.hub_type) {
        query += ' AND hub_type = ?';
        params.push(filters.hub_type);
    }
    if (filters.city) {
        query += ' AND LOWER(city) = LOWER(?)';
        params.push(filters.city.trim());
    }
    if (filters.search) {
        query += ' AND (LOWER(name) LIKE ? OR LOWER(city) LIKE ?)';
        const searchPattern = `%${filters.search.toLowerCase().trim()}%`;
        params.push(searchPattern, searchPattern);
    }
    query += ' ORDER BY name ASC';
    const [rows] = await pool.query<MedicalHubRow[]>(query, params);
    return rows;
}
export async function listPendingHubs(): Promise<MedicalHub[]> {
    const query = `
    SELECT mh.*, u.email
    FROM medical_hubs mh
    JOIN users u ON u.id = mh.user_id
    WHERE mh.verification_status = 'PENDING_APPROVAL'
    ORDER BY mh.created_at ASC
  `;
    const [rows] = await pool.query<MedicalHubRow[]>(query);
    return rows;
}
export async function getDistinctHubCities(): Promise<string[]> {
    const query = `
    SELECT DISTINCT city
    FROM medical_hubs
    WHERE verification_status = 'ACTIVE'
      AND city IS NOT NULL
      AND TRIM(city) != ''
    ORDER BY city ASC
  `;
    const [rows] = await pool.query<RowDataPacket[]>(query);
    return rows.map((r: any) => r.city);
}
export async function getHubTransactionHistory(hubId: number): Promise<HubTransactionHistory> {
    const hub = await findHubById(hubId);
    if (!hub) {
        const error: any = new Error('Medical facility not found.');
        error.statusCode = 404;
        throw error;
    }
    const [harvests] = await pool.query<RowDataPacket[]>(`
    SELECT
      ao.id,
      ao.organ_type_id,
      ot.name AS organ_name,
      ot.code AS organ_code,
      ot.category AS organ_category,
      ao.blood_group,
      ao.harvested_at,
      ao.expires_at,
      ao.status,
      ao.clinical_notes,
      IFNULL(cp.full_name, 'Deceased Donor') AS donor_name,
      cp.phone_number AS donor_phone,
      (
        SELECT mh.name
        FROM matches tm
        JOIN transplant_requests tr ON tr.id = tm.request_id
        JOIN medical_hubs mh ON mh.id = tr.attending_hub_id
        WHERE tm.organ_id = ao.id
        ORDER BY tm.id DESC LIMIT 1
      ) AS recipient_hospital_name,
      (
        SELECT tm.status
        FROM matches tm
        WHERE tm.organ_id = ao.id
        ORDER BY tm.id DESC LIMIT 1
      ) AS match_status
    FROM available_organs ao
    JOIN organ_types ot ON ot.id = ao.organ_type_id
    LEFT JOIN citizen_profiles cp ON cp.user_id = ao.donor_user_id
    WHERE ao.harvesting_hub_id = ?
    ORDER BY ao.harvested_at DESC
  `, [hubId]);
    const [transplants] = await pool.query<RowDataPacket[]>(`
    SELECT
      tm.id AS match_id,
      tm.organ_id,
      tm.request_id,
      tm.match_score,
      tm.status AS match_status,
      tm.offered_at,
      tm.response_deadline,
      tm.responded_at,
      ot.name AS organ_name,
      ot.code AS organ_code,
      ot.category AS organ_category,
      ao.blood_group,
      ao.harvested_at,
      hh.name AS harvesting_hub_name,
      hh.city AS harvesting_hub_city,
      ah.name AS attending_hub_name,
      IFNULL(cp.full_name, u.email) AS recipient_name,
      tr.urgency_tier,
      tr.status AS request_status
    FROM matches tm
    JOIN available_organs ao ON ao.id = tm.organ_id
    JOIN organ_types ot ON ot.id = ao.organ_type_id
    JOIN medical_hubs hh ON hh.id = ao.harvesting_hub_id
    JOIN transplant_requests tr ON tr.id = tm.request_id
    JOIN medical_hubs ah ON ah.id = tr.attending_hub_id
    JOIN users u ON u.id = tr.recipient_user_id
    LEFT JOIN citizen_profiles cp ON cp.user_id = tr.recipient_user_id
    WHERE tr.attending_hub_id = ? OR ao.harvesting_hub_id = ?
    ORDER BY tm.offered_at DESC
  `, [hubId, hubId]);
    const [waitlist] = await pool.query<RowDataPacket[]>(`
    SELECT
      tr.id,
      tr.recipient_user_id,
      IFNULL(cp.full_name, u.email) AS recipient_name,
      cp.phone_number AS recipient_phone,
      ot.name AS organ_name,
      tr.blood_group,
      tr.urgency_tier,
      tr.status,
      tr.medical_summary,
      tr.created_at,
      DATEDIFF(NOW(), tr.created_at) AS days_waiting
    FROM transplant_requests tr
    JOIN organ_types ot ON ot.id = tr.organ_type_id
    JOIN users u ON u.id = tr.recipient_user_id
    LEFT JOIN citizen_profiles cp ON cp.user_id = tr.recipient_user_id
    WHERE tr.attending_hub_id = ?
    ORDER BY tr.created_at DESC
  `, [hubId]);
    const [blood] = await pool.query<RowDataPacket[]>(`
    SELECT
      br.id,
      br.donor_user_id,
      br.requester_user_id,
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
      dest_hub.name AS destination_hub_name,
      ful_hub.name AS fulfilling_hub_name,
      donor_cp.full_name AS donor_name,
      donor_cp.phone_number AS donor_phone,
      req_cp.full_name AS recipient_name,
      req_cp.phone_number AS recipient_phone
    FROM blood_requests br
    JOIN medical_hubs dest_hub ON dest_hub.id = br.destination_hub_id
    LEFT JOIN medical_hubs ful_hub ON ful_hub.id = br.fulfilling_hub_id
    LEFT JOIN citizen_profiles donor_cp ON donor_cp.user_id = br.donor_user_id
    LEFT JOIN citizen_profiles req_cp ON req_cp.user_id = br.requester_user_id
    WHERE br.destination_hub_id = ? OR br.fulfilling_hub_id = ?
    ORDER BY COALESCE(br.fulfilled_at, br.created_at) DESC
  `, [hubId, hubId]);
    const activeHarvests = harvests.filter(h => h.status === 'AVAILABLE' || h.status === 'MATCHING').length;
    const confirmedTransplants = transplants.filter(t => t.match_status === 'ACCEPTED' || t.match_status === 'COMPLETED').length;
    return {
        facility: hub,
        stats: {
            totalHarvests: harvests.length,
            activeHarvests,
            totalTransplants: confirmedTransplants,
            waitlistPatients: waitlist.length,
            bloodTransactions: blood.length,
        },
        harvests: harvests as any[],
        transplants: transplants as any[],
        waitlist: waitlist as any[],
        bloodTransactions: blood as any[],
    };
}
export async function updateHubProfile(hubId: number, dto: UpdateHubProfileDTO): Promise<MedicalHub> {
    const fields: string[] = [];
    const values: any[] = [];
    if (dto.name) {
        fields.push('name = ?');
        values.push(dto.name.trim());
    }
    if (dto.contact_phone) {
        fields.push('contact_phone = ?');
        values.push(dto.contact_phone.trim());
    }
    if (dto.address_line) {
        fields.push('address_line = ?');
        values.push(dto.address_line.trim());
    }
    if (dto.city) {
        fields.push('city = ?');
        values.push(dto.city.trim());
    }
    if (dto.state) {
        fields.push('state = ?');
        values.push(dto.state.trim());
    }
    if (dto.pincode) {
        fields.push('pincode = ?');
        values.push(dto.pincode.trim());
    }
    if (dto.latitude !== undefined) {
        fields.push('latitude = ?');
        values.push(dto.latitude);
    }
    if (dto.longitude !== undefined) {
        fields.push('longitude = ?');
        values.push(dto.longitude);
    }
    if (fields.length > 0) {
        values.push(hubId);
        await pool.query(`UPDATE medical_hubs SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    const updated = await findHubById(hubId);
    if (!updated)
        throw new Error('Facility not found after update.');
    return updated;
}
