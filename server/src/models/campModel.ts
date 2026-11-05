import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { BloodDonationCamp, CreateCampDTO, UpdateCampDTO } from '../types/camp';
type CampRow = BloodDonationCamp & RowDataPacket;
export async function autoCompletePastCamps(): Promise<void> {
    try {
        const [rows] = await pool.query<CampRow[]>(`
      SELECT id, camp_date, end_date, end_time, status
      FROM blood_donation_camps
      WHERE status IN ('UPCOMING', 'ACTIVE')
    `);
        const now = new Date();
        for (const c of rows) {
            const endDateRaw = c.end_date || c.camp_date;
            const dateStr = typeof endDateRaw === 'string'
                ? endDateRaw.split('T')[0]
                : (endDateRaw ? new Date(endDateRaw as any).toISOString().split('T')[0] : '');
            let hours = 23;
            let minutes = 59;
            if (c.end_time) {
                const match = c.end_time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
                if (match) {
                    hours = parseInt(match[1], 10);
                    minutes = parseInt(match[2], 10);
                    const meridiem = match[3]?.toUpperCase();
                    if (meridiem === 'PM' && hours < 12)
                        hours += 12;
                    if (meridiem === 'AM' && hours === 12)
                        hours = 0;
                }
            }
            const endDateTime = new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
            if (endDateTime < now) {
                await pool.query('UPDATE blood_donation_camps SET status = "COMPLETED" WHERE id = ?', [c.id]);
            }
        }
    }
    catch (err) {
        console.warn('[CAMPS] Error in autoCompletePastCamps:', err);
    }
}
export async function createCamp(hubId: number, userId: string, dto: CreateCampDTO): Promise<BloodDonationCamp> {
    const initialStatus = dto.status || 'DRAFT';
    const [result] = await pool.query<ResultSetHeader>(`INSERT INTO blood_donation_camps (
      organizer_hub_id, created_by_user_id, camp_name, description,
      venue_name, address_line, city, state, pincode,
      camp_date, end_date, start_time, end_time,
      contact_phone, contact_email, target_units, status,
      latitude, longitude, map_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        hubId,
        userId,
        dto.camp_name.trim(),
        dto.description ? dto.description.trim() : null,
        dto.venue_name.trim(),
        dto.address_line.trim(),
        dto.city.trim(),
        dto.state ? dto.state.trim() : null,
        dto.pincode ? dto.pincode.trim() : null,
        dto.camp_date,
        dto.end_date || dto.camp_date,
        dto.start_time || '09:00 AM',
        dto.end_time || '05:00 PM',
        dto.contact_phone ? dto.contact_phone.trim() : null,
        dto.contact_email ? dto.contact_email.trim() : null,
        dto.target_units || 100,
        initialStatus,
        dto.latitude || null,
        dto.longitude || null,
        dto.map_url ? dto.map_url.trim() : null,
    ]);
    const camp = await findCampById(result.insertId);
    if (!camp)
        throw new Error('Failed to retrieve newly created camp.');
    return camp;
}
export async function updateCamp(campId: number, dto: UpdateCampDTO): Promise<BloodDonationCamp> {
    const fields: string[] = [];
    const params: any[] = [];
    if (dto.camp_name !== undefined) {
        fields.push('camp_name = ?');
        params.push(dto.camp_name.trim());
    }
    if (dto.description !== undefined) {
        fields.push('description = ?');
        params.push(dto.description ? dto.description.trim() : null);
    }
    if (dto.venue_name !== undefined) {
        fields.push('venue_name = ?');
        params.push(dto.venue_name.trim());
    }
    if (dto.address_line !== undefined) {
        fields.push('address_line = ?');
        params.push(dto.address_line.trim());
    }
    if (dto.city !== undefined) {
        fields.push('city = ?');
        params.push(dto.city.trim());
    }
    if (dto.state !== undefined) {
        fields.push('state = ?');
        params.push(dto.state ? dto.state.trim() : null);
    }
    if (dto.pincode !== undefined) {
        fields.push('pincode = ?');
        params.push(dto.pincode ? dto.pincode.trim() : null);
    }
    if (dto.camp_date !== undefined) {
        fields.push('camp_date = ?');
        params.push(dto.camp_date);
    }
    if (dto.end_date !== undefined) {
        fields.push('end_date = ?');
        params.push(dto.end_date);
    }
    if (dto.start_time !== undefined) {
        fields.push('start_time = ?');
        params.push(dto.start_time.trim());
    }
    if (dto.end_time !== undefined) {
        fields.push('end_time = ?');
        params.push(dto.end_time.trim());
    }
    if (dto.contact_phone !== undefined) {
        fields.push('contact_phone = ?');
        params.push(dto.contact_phone ? dto.contact_phone.trim() : null);
    }
    if (dto.contact_email !== undefined) {
        fields.push('contact_email = ?');
        params.push(dto.contact_email ? dto.contact_email.trim() : null);
    }
    if (dto.target_units !== undefined) {
        fields.push('target_units = ?');
        params.push(dto.target_units);
    }
    if (dto.latitude !== undefined) {
        fields.push('latitude = ?');
        params.push(dto.latitude || null);
    }
    if (dto.longitude !== undefined) {
        fields.push('longitude = ?');
        params.push(dto.longitude || null);
    }
    if (dto.map_url !== undefined) {
        fields.push('map_url = ?');
        params.push(dto.map_url ? dto.map_url.trim() : null);
    }
    if (dto.status !== undefined) {
        fields.push('status = ?');
        params.push(dto.status);
    }
    if (fields.length > 0) {
        params.push(campId);
        await pool.query(`UPDATE blood_donation_camps SET ${fields.join(', ')} WHERE id = ?`, params);
    }
    const camp = await findCampById(campId);
    if (!camp)
        throw new Error('Failed to retrieve updated camp.');
    return camp;
}
export async function findCampById(id: number): Promise<BloodDonationCamp | null> {
    await autoCompletePastCamps();
    const query = `
    SELECT
      c.*,
      mh.name AS organizer_hub_name,
      mh.hub_type AS organizer_hub_type,
      mh.city AS organizer_hub_city,
      mh.contact_phone AS organizer_hub_phone
    FROM blood_donation_camps c
    JOIN medical_hubs mh ON mh.id = c.organizer_hub_id
    WHERE c.id = ?
    LIMIT 1
  `;
    const [rows] = await pool.query<CampRow[]>(query, [id]);
    return rows.length > 0 ? rows[0] : null;
}
export async function listCamps(filters: {
    status?: string;
    city?: string;
} = {}): Promise<BloodDonationCamp[]> {
    await autoCompletePastCamps();
    let query = `
    SELECT
      c.*,
      mh.name AS organizer_hub_name,
      mh.hub_type AS organizer_hub_type,
      mh.city AS organizer_hub_city,
      mh.contact_phone AS organizer_hub_phone
    FROM blood_donation_camps c
    JOIN medical_hubs mh ON mh.id = c.organizer_hub_id
    WHERE c.status != 'DRAFT'
  `;
    const params: any[] = [];
    if (filters.status && filters.status !== 'ALL') {
        query += ` AND c.status = ?`;
        params.push(filters.status);
    }
    else if (!filters.status) {
        query += ` AND c.status IN ('UPCOMING', 'ACTIVE')`;
    }
    if (filters.city && filters.city !== 'ALL') {
        query += ` AND (LOWER(c.city) LIKE LOWER(?) OR LOWER(c.address_line) LIKE LOWER(?))`;
        params.push(`%${filters.city.trim()}%`, `%${filters.city.trim()}%`);
    }
    query += ` ORDER BY c.camp_date ASC, c.created_at DESC`;
    const [rows] = await pool.query<CampRow[]>(query, params);
    return rows;
}
export async function listCampsByHub(hubId: number): Promise<BloodDonationCamp[]> {
    await autoCompletePastCamps();
    const query = `
    SELECT
      c.*,
      mh.name AS organizer_hub_name,
      mh.hub_type AS organizer_hub_type,
      mh.city AS organizer_hub_city,
      mh.contact_phone AS organizer_hub_phone
    FROM blood_donation_camps c
    JOIN medical_hubs mh ON mh.id = c.organizer_hub_id
    WHERE c.organizer_hub_id = ?
    ORDER BY c.created_at DESC, c.camp_date DESC
  `;
    const [rows] = await pool.query<CampRow[]>(query, [hubId]);
    return rows;
}
export async function updateCampStatus(campId: number, status: string): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(`UPDATE blood_donation_camps SET status = ? WHERE id = ?`, [status, campId]);
    return result.affectedRows > 0;
}
