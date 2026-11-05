import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/database';
import { TransplantRequestEntity, MatchEntity, TransplantQueryFilters, CreateTransplantRequestDTO, MatchStatus, } from '../types/transplant';
interface TransplantRequestRow extends TransplantRequestEntity, RowDataPacket {
}
interface MatchRow extends MatchEntity, RowDataPacket {
}
const ENRICHED_REQUEST_SELECT = `
  SELECT
    tr.id,
    tr.recipient_user_id,
    tr.attending_hub_id,
    tr.organ_type_id,
    tr.blood_group,
    tr.urgency_tier,
    tr.medical_summary,
    CASE
      WHEN tr.status = 'MATCH_OFFERED' AND (SELECT id FROM matches WHERE request_id = tr.id AND status = 'PROPOSED' LIMIT 1) IS NULL
      THEN 'WAITING_LIST'
      ELSE tr.status
    END AS status,
    tr.verified_at,
    tr.created_at,
    u.email AS recipient_email,
    IFNULL(cp.full_name, u.email) AS recipient_name,
    mh.name AS attending_hub_name,
    mh.city AS attending_hub_city,
    mh.latitude AS attending_hub_latitude,
    mh.longitude AS attending_hub_longitude,
    ot.name AS organ_name,
    ot.code AS organ_code,
    DATEDIFF(NOW(), tr.created_at) AS days_waiting,
    (SELECT organ_id FROM matches WHERE request_id = tr.id AND status = 'PROPOSED' LIMIT 1) AS active_organ_id,
    (SELECT id FROM matches WHERE request_id = tr.id AND status = 'PROPOSED' LIMIT 1) AS active_match_id,
    (SELECT response_deadline FROM matches WHERE request_id = tr.id AND status = 'PROPOSED' LIMIT 1) AS active_response_deadline,
    (SELECT match_score FROM matches WHERE request_id = tr.id AND status = 'PROPOSED' LIMIT 1) AS active_match_score
  FROM transplant_requests tr
  JOIN users u ON u.id = tr.recipient_user_id
  LEFT JOIN citizen_profiles cp ON cp.user_id = tr.recipient_user_id
  JOIN medical_hubs mh ON mh.id = tr.attending_hub_id
  JOIN organ_types ot ON ot.id = tr.organ_type_id
`;
const ENRICHED_MATCH_SELECT = `
  SELECT
    m.*,
    ot.code AS organ_code,
    ot.name AS organ_name,
    ao.blood_group AS organ_blood_group,
    hh.name AS harvesting_hub_name,
    IFNULL(cp.full_name, u.email) AS recipient_name,
    tr.blood_group AS recipient_blood_group,
    tr.recipient_user_id,
    tr.attending_hub_id,
    ao.harvesting_hub_id,
    mh.name AS attending_hub_name,
    TIMESTAMPDIFF(SECOND, NOW(), m.response_deadline) AS remaining_seconds,
    (m.response_deadline <= NOW()) AS is_expired
  FROM matches m
  JOIN available_organs ao ON ao.id = m.organ_id
  JOIN organ_types ot ON ot.id = ao.organ_type_id
  JOIN medical_hubs hh ON hh.id = ao.harvesting_hub_id
  JOIN transplant_requests tr ON tr.id = m.request_id
  JOIN users u ON u.id = tr.recipient_user_id
  LEFT JOIN citizen_profiles cp ON cp.user_id = tr.recipient_user_id
  JOIN medical_hubs mh ON mh.id = tr.attending_hub_id
`;
export async function createTransplantRequest(attendingHubId: number, dto: CreateTransplantRequestDTO): Promise<TransplantRequestEntity> {
    const [result] = await pool.query<ResultSetHeader>(`INSERT INTO transplant_requests (
       recipient_user_id, attending_hub_id, organ_type_id, blood_group,
       urgency_tier, medical_summary, status, verified_at
     ) VALUES (?, ?, ?, ?, ?, ?, 'WAITING_LIST', NOW())`, [
        dto.recipient_user_id,
        attendingHubId,
        dto.organ_type_id,
        dto.blood_group,
        dto.urgency_tier,
        dto.medical_summary.trim(),
    ]);
    const created = await findTransplantRequestById(result.insertId);
    if (!created)
        throw new Error('Failed to retrieve newly created transplant request.');
    return created;
}
export async function findTransplantRequestById(id: number): Promise<TransplantRequestEntity | null> {
    const query = `${ENRICHED_REQUEST_SELECT} WHERE tr.id = ? LIMIT 1`;
    const [rows] = await pool.query<TransplantRequestRow[]>(query, [id]);
    return rows.length > 0 ? rows[0] : null;
}
export async function listTransplantRequests(filters: TransplantQueryFilters): Promise<TransplantRequestEntity[]> {
    let query = `${ENRICHED_REQUEST_SELECT} WHERE 1=1`;
    const params: any[] = [];
    if (filters.organ_type_id) {
        query += ' AND tr.organ_type_id = ?';
        params.push(filters.organ_type_id);
    }
    if (filters.blood_group) {
        query += ' AND tr.blood_group = ?';
        params.push(filters.blood_group);
    }
    if (filters.urgency_tier) {
        query += ' AND tr.urgency_tier = ?';
        params.push(filters.urgency_tier);
    }
    if (filters.status) {
        query += ' AND tr.status = ?';
        params.push(filters.status);
    }
    if (filters.attending_hub_id) {
        query += ' AND tr.attending_hub_id = ?';
        params.push(filters.attending_hub_id);
    }
    query += `
    ORDER BY
      CASE tr.urgency_tier
        WHEN 'TIER_1_EMERGENCY' THEN 1
        WHEN 'TIER_2_URGENT' THEN 2
        WHEN 'TIER_3_ROUTINE' THEN 3
        ELSE 4
      END ASC,
      tr.created_at ASC
  `;
    const [rows] = await pool.query<TransplantRequestRow[]>(query, params);
    return rows;
}
export async function listRequestsByRecipient(userId: string): Promise<TransplantRequestEntity[]> {
    const query = `${ENRICHED_REQUEST_SELECT} WHERE tr.recipient_user_id = ? ORDER BY tr.created_at DESC`;
    const [rows] = await pool.query<TransplantRequestRow[]>(query, [userId]);
    return rows;
}
export async function getActiveWaitlistForOrgan(organTypeId: number): Promise<TransplantRequestEntity[]> {
    const query = `${ENRICHED_REQUEST_SELECT} WHERE tr.organ_type_id = ? AND tr.status = 'WAITING_LIST'`;
    const [rows] = await pool.query<TransplantRequestRow[]>(query, [organTypeId]);
    return rows;
}
export async function findMatchById(id: number): Promise<MatchEntity | null> {
    const query = `${ENRICHED_MATCH_SELECT} WHERE m.id = ? LIMIT 1`;
    const [rows] = await pool.query<MatchRow[]>(query, [id]);
    return rows.length > 0 ? rows[0] : null;
}
export async function findActiveMatchForOrgan(organId: number): Promise<MatchEntity | null> {
    const query = `${ENRICHED_MATCH_SELECT} WHERE m.organ_id = ? AND m.status = 'PROPOSED' LIMIT 1`;
    const [rows] = await pool.query<MatchRow[]>(query, [organId]);
    return rows.length > 0 ? rows[0] : null;
}
export async function getActiveProposedMatches(): Promise<MatchEntity[]> {
    const query = `${ENRICHED_MATCH_SELECT} WHERE m.status = 'PROPOSED' AND m.response_deadline > NOW() ORDER BY m.response_deadline ASC`;
    const [rows] = await pool.query<MatchRow[]>(query);
    return rows;
}
export async function getDeclinedRequestIdsForOrgan(organId: number): Promise<number[]> {
    const [rows] = await pool.query<RowDataPacket[]>("SELECT request_id FROM matches WHERE organ_id = ? AND status = 'DECLINED'", [organId]);
    return rows.map((r) => r.request_id);
}
export async function getDeclinedMatchesForOrgan(organId: number): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT m.id AS match_id, m.request_id, m.match_score, m.responded_at,
            tr.blood_group, tr.urgency_tier, tr.status AS request_status,
            IFNULL(cp.full_name, u.email) AS recipient_name,
            h.name AS attending_hub_name
     FROM matches m
     JOIN transplant_requests tr ON m.request_id = tr.id
     JOIN users u ON tr.recipient_user_id = u.id
     LEFT JOIN citizen_profiles cp ON cp.user_id = tr.recipient_user_id
     JOIN medical_hubs h ON tr.attending_hub_id = h.id
     WHERE m.organ_id = ? AND m.status = 'DECLINED'
     ORDER BY m.responded_at DESC`, [organId]);
    return rows;
}
export async function createMatchOffer(organId: number, requestId: number, matchScore: number, deadlineMinutes = 20): Promise<MatchEntity> {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [matchResult] = await connection.query<ResultSetHeader>(`INSERT INTO matches (
         organ_id, request_id, match_score, status, offered_at, response_deadline
       ) VALUES (?, ?, ?, 'PROPOSED', NOW(), DATE_ADD(NOW(), INTERVAL ? MINUTE))`, [organId, requestId, matchScore, deadlineMinutes]);
        await connection.query<ResultSetHeader>("UPDATE available_organs SET status = 'MATCHING' WHERE id = ?", [organId]);
        await connection.query<ResultSetHeader>("UPDATE transplant_requests SET status = 'MATCH_OFFERED' WHERE id = ?", [requestId]);
        await connection.commit();
        const created = await findMatchById(matchResult.insertId);
        return created!;
    }
    catch (error) {
        await connection.rollback();
        throw error;
    }
    finally {
        connection.release();
    }
}
export async function acceptMatch(matchId: number): Promise<MatchEntity> {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.query<MatchRow[]>('SELECT * FROM matches WHERE id = ? FOR UPDATE', [matchId]);
        if (rows.length === 0) {
            const error: any = new Error(`Match with ID ${matchId} not found.`);
            error.statusCode = 404;
            throw error;
        }
        const match = rows[0];
        if (match.status !== 'PROPOSED') {
            const error: any = new Error(`Cannot accept match. Current status is already '${match.status}'.`);
            error.statusCode = 409;
            throw error;
        }
        if (new Date(match.response_deadline).getTime() < Date.now()) {
            const error: any = new Error('The 20-minute response deadline for this offer has elapsed.');
            error.statusCode = 400;
            throw error;
        }
        await connection.query<ResultSetHeader>("UPDATE matches SET status = 'ACCEPTED', responded_at = NOW() WHERE id = ?", [matchId]);
        await connection.query<ResultSetHeader>("UPDATE transplant_requests SET status = 'ACCEPTED' WHERE id = ?", [match.request_id]);
        await connection.query<ResultSetHeader>("UPDATE available_organs SET status = 'ALLOCATED' WHERE id = ?", [match.organ_id]);
        await connection.commit();
        const updated = await findMatchById(matchId);
        return updated!;
    }
    catch (error) {
        await connection.rollback();
        throw error;
    }
    finally {
        connection.release();
    }
}
export async function declineMatch(matchId: number): Promise<MatchEntity> {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.query<MatchRow[]>('SELECT * FROM matches WHERE id = ? FOR UPDATE', [matchId]);
        if (rows.length === 0) {
            const error: any = new Error(`Match with ID ${matchId} not found.`);
            error.statusCode = 404;
            throw error;
        }
        const match = rows[0];
        if (match.status !== 'PROPOSED') {
            const error: any = new Error(`Cannot decline match. Current status is already '${match.status}'.`);
            error.statusCode = 409;
            throw error;
        }
        await connection.query<ResultSetHeader>("UPDATE matches SET status = 'DECLINED', responded_at = NOW() WHERE id = ?", [matchId]);
        await connection.query<ResultSetHeader>("UPDATE transplant_requests SET status = 'WAITING_LIST' WHERE id = ?", [match.request_id]);
        await connection.query<ResultSetHeader>("UPDATE available_organs SET status = 'AVAILABLE' WHERE id = ?", [match.organ_id]);
        await connection.commit();
        const updated = await findMatchById(matchId);
        return updated!;
    }
    catch (error) {
        await connection.rollback();
        throw error;
    }
    finally {
        connection.release();
    }
}
export async function findExpiredProposedMatches(): Promise<MatchEntity[]> {
    const query = `${ENRICHED_MATCH_SELECT} WHERE m.status = 'PROPOSED' AND m.response_deadline <= NOW()`;
    const [rows] = await pool.query<MatchRow[]>(query);
    return rows;
}
