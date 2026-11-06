import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/database';
import {
  OrganType,
  OrganTypeCode,
  DonorPledge,
  ConsentType,
} from '../types/pledge';

interface OrganTypeRow extends OrganType, RowDataPacket {}
interface DonorPledgeRow extends DonorPledge, RowDataPacket {}

/**
 * Retrieves the complete clinical organ reference catalog.
 */
export async function getAllOrganTypes(): Promise<OrganType[]> {
  const [rows] = await pool.query<OrganTypeRow[]>(
    'SELECT * FROM organ_types ORDER BY id ASC'
  );
  return rows;
}

/**
 * Finds a specific organ type by its clinical code (e.g. 'HEART', 'KIDNEY').
 */
export async function findOrganTypeByCode(code: OrganTypeCode): Promise<OrganType | null> {
  const [rows] = await pool.query<OrganTypeRow[]>(
    'SELECT * FROM organ_types WHERE code = ? LIMIT 1',
    [code]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Retrieves all currently ACTIVE pledges for a citizen with joined organ metadata.
 */
export async function getActivePledgesByUserId(userId: string): Promise<DonorPledge[]> {
  const query = `
    SELECT 
      dp.id, dp.user_id, dp.organ_type_id, dp.consent_type, dp.pledge_date, dp.status,
      ot.code AS organ_code, ot.name AS organ_name, ot.category, ot.allow_living_donor
    FROM donor_pledges dp
    JOIN organ_types ot ON ot.id = dp.organ_type_id
    WHERE dp.user_id = ? AND dp.status = 'ACTIVE'
    ORDER BY dp.pledge_date DESC
  `;
  const [rows] = await pool.query<DonorPledgeRow[]>(query, [userId]);
  return rows;
}

/**
 * Upserts a pledge:
 * - If not pledged before: Inserts new ACTIVE row.
 * - If previously REVOKED: Reactivates to ACTIVE with fresh pledge_date = NOW().
 * - If already ACTIVE: Updates consent_type if modified.
 */
export async function upsertPledge(
  userId: string,
  organTypeId: number,
  consentType: ConsentType
): Promise<void> {
  const query = `
    INSERT INTO donor_pledges (user_id, organ_type_id, consent_type, status, pledge_date)
    VALUES (?, ?, ?, 'ACTIVE', NOW())
    ON DUPLICATE KEY UPDATE
      consent_type = VALUES(consent_type),
      status = 'ACTIVE',
      pledge_date = NOW()
  `;
  await pool.query<ResultSetHeader>(query, [userId, organTypeId, consentType]);
}

/**
 * Revokes an existing pledge, changing status to 'REVOKED'.
 */
export async function revokePledge(userId: string, pledgeId: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE donor_pledges SET status = 'REVOKED' WHERE id = ? AND user_id = ?",
    [pledgeId, userId]
  );
  return result.affectedRows > 0;
}

/**
 * Revokes any currently ACTIVE pledges for this user that are NOT in the provided organTypeId list.
 * This guarantees that deselecting an organ in the UI revokes it in the database upon saving.
 */
export async function revokePledgesNotInList(
  userId: string,
  keepOrganTypeIds: number[]
): Promise<number> {
  if (keepOrganTypeIds.length === 0) {
    return revokeAllPledgesByUserId(userId);
  }
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE donor_pledges 
     SET status = 'REVOKED' 
     WHERE user_id = ? AND status = 'ACTIVE' AND organ_type_id NOT IN (?)`,
    [userId, keepOrganTypeIds]
  );
  return result.affectedRows;
}

/**
 * Revokes ALL active pledges for a user, changing their status to 'REVOKED'.
 */
export async function revokeAllPledgesByUserId(userId: string): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE donor_pledges SET status = 'REVOKED' WHERE user_id = ? AND status = 'ACTIVE'",
    [userId]
  );
  return result.affectedRows;
}
