import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/database';
import {
  OrganTypeEntity,
  AvailableOrganEntity,
  OrganStatus,
  OrganQueryFilters,
} from '../types/organ';

interface OrganTypeRow extends OrganTypeEntity, RowDataPacket {}
interface AvailableOrganRow extends AvailableOrganEntity, RowDataPacket {}

// Base select query enriched with organ type, facility coordinates, and viability countdown
const ENRICHED_ORGAN_SELECT = `
  SELECT 
    ao.*,
    ot.name AS organ_name,
    ot.code AS organ_code,
    ot.category AS organ_category,
    ot.max_viability_hours,
    hh.name AS harvesting_hub_name,
    hh.city AS harvesting_hub_city,
    ch.name AS current_hub_name,
    ch.city AS current_hub_city,
    ch.latitude AS current_hub_latitude,
    ch.longitude AS current_hub_longitude,
    u.email AS donor_email,
    TIMESTAMPDIFF(MINUTE, NOW(), ao.expires_at) AS remaining_minutes,
    (ao.expires_at > NOW() AND ao.status = 'AVAILABLE') AS is_viable
  FROM available_organs ao
  JOIN organ_types ot ON ot.id = ao.organ_type_id
  JOIN medical_hubs hh ON hh.id = ao.harvesting_hub_id
  JOIN medical_hubs ch ON ch.id = ao.current_hub_id
  LEFT JOIN users u ON u.id = ao.donor_user_id
`;

/**
 * Retrieves all medically approved organ types with their shelf-life hours.
 */
export async function listAllOrganTypes(): Promise<OrganTypeEntity[]> {
  const [rows] = await pool.query<OrganTypeRow[]>(
    'SELECT * FROM organ_types ORDER BY category ASC, name ASC'
  );
  return rows;
}

/**
 * Finds an organ type by its primary key ID.
 */
export async function findOrganTypeById(id: number): Promise<OrganTypeEntity | null> {
  const [rows] = await pool.query<OrganTypeRow[]>(
    'SELECT * FROM organ_types WHERE id = ? LIMIT 1',
    [id]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Inserts a newly harvested organ with its cold ischemia expiration window.
 */
export async function insertHarvestedOrgan(data: {
  organ_type_id: number;
  donor_user_id: string | null;
  harvesting_hub_id: number;
  current_hub_id: number;
  blood_group: string;
  harvested_at: Date;
  expires_at: Date;
  clinical_notes?: string;
}): Promise<AvailableOrganEntity> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO available_organs (
       organ_type_id, donor_user_id, harvesting_hub_id, current_hub_id,
       blood_group, harvested_at, expires_at, status, clinical_notes
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', ?)`,
    [
      data.organ_type_id,
      data.donor_user_id,
      data.harvesting_hub_id,
      data.current_hub_id,
      data.blood_group,
      data.harvested_at,
      data.expires_at,
      data.clinical_notes || null,
    ]
  );

  const organ = await findOrganById(result.insertId);
  if (!organ) throw new Error('Failed to retrieve newly logged organ.');
  return organ;
}

/**
 * Retrieves a single organ record by its primary key ID with enriched medical details.
 */
export async function findOrganById(id: number): Promise<AvailableOrganEntity | null> {
  const query = `${ENRICHED_ORGAN_SELECT} WHERE ao.id = ? LIMIT 1`;
  const [rows] = await pool.query<AvailableOrganRow[]>(query, [id]);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Lists available organs with optional medical and geographic filters.
 * Sorted by shortest remaining viability window first (highest clinical urgency).
 */
export async function listOrgans(filters: OrganQueryFilters): Promise<AvailableOrganEntity[]> {
  let query = `${ENRICHED_ORGAN_SELECT} WHERE 1=1`;
  const params: any[] = [];

  if (filters.organ_type_id) {
    query += ' AND ao.organ_type_id = ?';
    params.push(filters.organ_type_id);
  }

  if (filters.blood_group) {
    query += ' AND ao.blood_group = ?';
    params.push(filters.blood_group);
  }

  if (filters.status) {
    query += ' AND ao.status = ?';
    params.push(filters.status);
  }

  if (filters.only_viable) {
    query += " AND ao.status IN ('AVAILABLE', 'MATCHING') AND ao.expires_at > NOW()";
  }

  if (filters.city) {
    query += ' AND (LOWER(hh.city) = LOWER(?) OR LOWER(ch.city) = LOWER(?))';
    params.push(filters.city.trim(), filters.city.trim());
  }

  query += ' ORDER BY ao.expires_at ASC';

  const [rows] = await pool.query<AvailableOrganRow[]>(query, params);
  return rows;
}

/**
 * Updates an organ's status, physical custody hub, and clinical log notes.
 */
export async function updateOrganStatus(
  organId: number,
  status: OrganStatus,
  currentHubId?: number,
  notes?: string
): Promise<AvailableOrganEntity> {
  let updateSql = 'UPDATE available_organs SET status = ?';
  const params: any[] = [status];

  if (currentHubId !== undefined) {
    updateSql += ', current_hub_id = ?';
    params.push(currentHubId);
  }

  if (notes !== undefined) {
    updateSql += ', clinical_notes = CONCAT(IFNULL(clinical_notes, ""), ?)';
    params.push(`\n[${new Date().toISOString()}] ${notes}`);
  }

  updateSql += ' WHERE id = ?';
  params.push(organId);

  await pool.query<ResultSetHeader>(updateSql, params);

  const updated = await findOrganById(organId);
  return updated!;
}

/**
 * Automated batch job: Marks organs as EXPIRED if their cold ischemia window
 * has elapsed and they are still in AVAILABLE status.
 */
export async function expireOverdueOrgans(): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE available_organs 
     SET status = 'EXPIRED' 
     WHERE status = 'AVAILABLE' AND expires_at <= NOW()`
  );
  return result.affectedRows;
}
