import { RowDataPacket } from 'mysql2';
import pool from '../config/database';

export interface AdminPlatformMetrics {
  activeHubsCount: number;
  blood: {
    availableUnits: number;
    transfusedUnits: number;
    donatedUnits: number;
    donorCount: number;
  };
  organs: {
    activeOrgansCount: number;
    activeBreakdown: { name: string; code: string; count: number }[];
    totalHarvested: number;
    totalTransplanted: number;
  };
}

export async function getAdminPlatformMetrics(): Promise<AdminPlatformMetrics> {
  // 1. Active hubs count
  const [hubRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM medical_hubs WHERE verification_status = 'ACTIVE'"
  );
  const activeHubsCount = Number(hubRows[0]?.count || 0);

  // 2. Blood metrics
  const [bloodStockRows] = await pool.query<RowDataPacket[]>(
    'SELECT COALESCE(SUM(units_available), 0) AS total_available FROM blood_inventory'
  );
  const availableUnits = Number(bloodStockRows[0]?.total_available || 0);

  const [transfusedRows] = await pool.query<RowDataPacket[]>(
    "SELECT COALESCE(SUM(units_requested), 0) AS total_transfused FROM blood_requests WHERE status = 'COMPLETED'"
  );
  const transfusedUnits = Number(transfusedRows[0]?.total_transfused || 0);

  const [donatedRows] = await pool.query<RowDataPacket[]>(
    `SELECT 
       COALESCE(SUM(units_requested), 0) AS donated_units, 
       COUNT(DISTINCT donor_user_id) AS donor_count 
     FROM blood_requests 
     WHERE donor_user_id IS NOT NULL AND status IN ('DONOR_COMMITTED', 'COMPLETED')`
  );
  const donatedUnits = Number(donatedRows[0]?.donated_units || 0);
  const donorCount = Number(donatedRows[0]?.donor_count || 0);

  // 3. Organ metrics (excluding blood)
  const [activeOrganCountRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count 
     FROM available_organs ao
     JOIN organ_types ot ON ot.id = ao.organ_type_id
     WHERE ao.status IN ('AVAILABLE', 'MATCHING') AND ao.expires_at > NOW() AND ot.code != 'BLOOD'`
  );
  const activeOrgansCount = Number(activeOrganCountRows[0]?.count || 0);

  const [breakdownRows] = await pool.query<RowDataPacket[]>(
    `SELECT 
       ot.name, 
       ot.code, 
       COUNT(ao.id) AS count 
     FROM organ_types ot 
     LEFT JOIN available_organs ao 
       ON ao.organ_type_id = ot.id 
       AND ao.status IN ('AVAILABLE', 'MATCHING') 
       AND ao.expires_at > NOW() 
     WHERE ot.code != 'BLOOD'
     GROUP BY ot.id, ot.name, ot.code 
     ORDER BY count DESC, ot.name ASC`
  );
  const activeBreakdown = breakdownRows.map((r) => ({
    name: String(r.name),
    code: String(r.code),
    count: Number(r.count || 0),
  }));

  const [totalHarvestedRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count 
     FROM available_organs ao
     JOIN organ_types ot ON ot.id = ao.organ_type_id
     WHERE ot.code != 'BLOOD'`
  );
  const totalHarvested = Number(totalHarvestedRows[0]?.count || 0);

  const [totalTransplantedRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count 
     FROM available_organs ao
     JOIN organ_types ot ON ot.id = ao.organ_type_id
     WHERE ao.status IN ('TRANSPLANTED', 'DELIVERED') AND ot.code != 'BLOOD'`
  );
  const totalTransplanted = Number(totalTransplantedRows[0]?.count || 0);

  return {
    activeHubsCount,
    blood: {
      availableUnits,
      transfusedUnits,
      donatedUnits,
      donorCount,
    },
    organs: {
      activeOrgansCount,
      activeBreakdown,
      totalHarvested,
      totalTransplanted,
    },
  };
}

export async function getAdminHubsList(status?: string): Promise<any[]> {
  let query = `
    SELECT 
      mh.*,
      u.email,
      u.is_active AS user_is_active,
      (SELECT COUNT(*) FROM available_organs ao WHERE ao.current_hub_id = mh.id AND ao.status IN ('AVAILABLE', 'MATCHING') AND ao.expires_at > NOW()) AS active_organs,
      (SELECT COALESCE(SUM(bi.units_available), 0) FROM blood_inventory bi WHERE bi.hub_id = mh.id) AS blood_units
    FROM medical_hubs mh
    JOIN users u ON u.id = mh.user_id
  `;
  const params: any[] = [];
  if (status && status !== 'ALL') {
    query += ' WHERE mh.verification_status = ?';
    params.push(status);
  }
  query += ' ORDER BY mh.created_at DESC';

  const [rows] = await pool.query<RowDataPacket[]>(query, params);
  return rows;
}

export async function searchAdminEntities(queryStr: string): Promise<{ citizens: any[]; hubs: any[] }> {
  const q = `%${queryStr.trim()}%`;

  // Search citizens
  const [citizens] = await pool.query<RowDataPacket[]>(
    `SELECT 
       cp.id,
       cp.user_id,
       cp.full_name,
       cp.blood_group,
       cp.phone_number,
       cp.city,
       cp.state,
       u.email,
       u.created_at,
       (SELECT COUNT(*) FROM donor_pledges dp WHERE dp.user_id = cp.user_id AND dp.status = 'ACTIVE') AS active_pledges
     FROM citizen_profiles cp
     JOIN users u ON u.id = cp.user_id
     WHERE cp.full_name LIKE ? 
        OR u.email LIKE ? 
        OR cp.phone_number LIKE ? 
        OR cp.blood_group LIKE ?
     LIMIT 25`,
    [q, q, q, q]
  );

  // Search hubs
  const [hubs] = await pool.query<RowDataPacket[]>(
    `SELECT 
       mh.*,
       u.email
     FROM medical_hubs mh
     JOIN users u ON u.id = mh.user_id
     WHERE mh.name LIKE ? 
        OR mh.license_number LIKE ? 
        OR mh.city LIKE ? 
        OR mh.contact_phone LIKE ?
     LIMIT 25`,
    [q, q, q, q]
  );

  return { citizens, hubs };
}

export async function getAdminActivityLogs(limit: number = 50): Promise<any[]> {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 5), 200);

  // 1. Harvest logs (with hospital name, city, organ name)
  const [harvests] = await pool.query<RowDataPacket[]>(
    `SELECT 
       ao.id,
       'ORGAN_HARVEST' AS type,
       CONCAT('Organ Harvested: ', ot.name, ' (', ao.blood_group, ')') AS title,
       CONCAT('Harvested at ', mh.name, ', ', mh.city, ' • Status: ', ao.status) AS description,
       ao.status,
       ao.harvested_at AS timestamp,
       JSON_OBJECT(
         'organId', ao.id,
         'organName', ot.name,
         'bloodGroup', ao.blood_group,
         'harvestingHospital', mh.name,
         'hospitalCity', mh.city,
         'status', ao.status,
         'expiresAt', ao.expires_at
       ) AS meta
     FROM available_organs ao
     JOIN organ_types ot ON ot.id = ao.organ_type_id
     JOIN medical_hubs mh ON mh.id = ao.harvesting_hub_id
     WHERE ot.code != 'BLOOD'
     ORDER BY ao.harvested_at DESC
     LIMIT ?`,
    [safeLimit]
  );

  // 2. Match logs (with candidate name, attending/harvesting hospital & city)
  const [matches] = await pool.query<RowDataPacket[]>(
    `SELECT 
       m.id,
       'ORGAN_MATCH' AS type,
       CASE 
         WHEN m.status = 'ACCEPTED' THEN CONCAT('Match Accepted by ', COALESCE(cp.full_name, 'Patient'))
         WHEN m.status = 'DECLINED' THEN CONCAT('Match Declined by ', COALESCE(cp.full_name, 'Patient'))
         WHEN m.status IN ('COMPLETED', 'TRANSPLANTED') THEN CONCAT('Transplant Completed for ', COALESCE(cp.full_name, 'Patient'))
         ELSE CONCAT('Match ', m.status, ' for ', COALESCE(cp.full_name, 'Patient'))
       END AS title,
       CONCAT(
         ot.name, ' (', ao.blood_group, ') • Score: ', m.match_score, '% • Harvested at ', 
         mh_harvest.name, ' (', mh_harvest.city, ') • Attending: ', 
         mh_attend.name, ' (', mh_attend.city, ')'
       ) AS description,
       m.status,
       m.offered_at AS timestamp,
       JSON_OBJECT(
         'matchId', m.id,
         'candidateName', COALESCE(cp.full_name, 'Unknown'),
         'candidatePhone', COALESCE(cp.phone_number, 'N/A'),
         'organName', ot.name,
         'bloodGroup', ao.blood_group,
         'compatibilityScore', CONCAT(m.match_score, '%'),
         'harvestingHospital', mh_harvest.name,
         'harvestingCity', mh_harvest.city,
         'attendingHospital', mh_attend.name,
         'attendingCity', mh_attend.city,
         'status', m.status,
         'offeredAt', m.offered_at
       ) AS meta
     FROM matches m
     JOIN available_organs ao ON ao.id = m.organ_id
     JOIN organ_types ot ON ot.id = ao.organ_type_id
     JOIN medical_hubs mh_harvest ON mh_harvest.id = ao.harvesting_hub_id
     JOIN transplant_requests tr ON tr.id = m.request_id
     JOIN citizen_profiles cp ON cp.user_id = tr.recipient_user_id
     JOIN medical_hubs mh_attend ON mh_attend.id = tr.attending_hub_id
     ORDER BY m.offered_at DESC
     LIMIT ?`,
    [safeLimit]
  );

  // 3. Facility Verification logs
  const [verifications] = await pool.query<RowDataPacket[]>(
    `SELECT 
       mh.id,
       'FACILITY_VERIFICATION' AS type,
       CONCAT('Facility Audit: ', mh.name) AS title,
       CONCAT('Status updated to ', mh.verification_status, ' • License: ', mh.license_number, ' • Location: ', mh.city, ', ', mh.state) AS description,
       mh.verification_status AS status,
       COALESCE(mh.verified_at, mh.created_at) AS timestamp,
       JSON_OBJECT(
         'hubId', mh.id,
         'facilityName', mh.name,
         'facilityType', mh.hub_type,
         'licenseNumber', mh.license_number,
         'city', mh.city,
         'state', mh.state,
         'contactPhone', mh.contact_phone,
         'status', mh.verification_status,
         'auditDate', COALESCE(mh.verified_at, mh.created_at)
       ) AS meta
     FROM medical_hubs mh
     WHERE mh.verified_at IS NOT NULL
     ORDER BY mh.verified_at DESC
     LIMIT ?`,
    [safeLimit]
  );

  // 4. Blood Request logs (with receiving hospital and fulfilling hospital)
  const [bloodLogs] = await pool.query<RowDataPacket[]>(
    `SELECT 
       br.id,
       'BLOOD_REQUEST' AS type,
       CONCAT('Blood Order #BR-', br.id, ': ', br.blood_group, ' ', COALESCE(br.component, 'WHOLE_BLOOD')) AS title,
       CONCAT(
         br.units_requested, ' Unit(s) • Receiving Hospital: ', COALESCE(dest_hub.name, 'Direct Delivery'), 
         CASE WHEN ful_hub.name IS NOT NULL THEN CONCAT(' • Fulfilling: ', ful_hub.name) ELSE '' END,
         ' • Status: ', br.status
       ) AS description,
       br.status,
       br.created_at AS timestamp,
       JSON_OBJECT(
         'orderId', CONCAT('BR-', br.id),
         'bloodGroup', br.blood_group,
         'component', COALESCE(br.component, 'WHOLE_BLOOD'),
         'unitsRequested', br.units_requested,
         'urgencyTier', br.urgency,
         'receivingHospital', COALESCE(dest_hub.name, 'Direct Emergency Delivery'),
         'receivingCity', COALESCE(dest_hub.city, 'N/A'),
         'fulfillingHospital', COALESCE(ful_hub.name, 'Pending Hub Assignment'),
         'patientName', COALESCE(br.patient_name, req_cp.full_name, 'Patient on File'),
         'requesterContact', COALESCE(req_cp.phone_number, 'N/A'),
         'status', br.status,
         'orderDate', br.created_at
       ) AS meta
     FROM blood_requests br
     LEFT JOIN medical_hubs dest_hub ON dest_hub.id = br.destination_hub_id
     LEFT JOIN medical_hubs ful_hub ON ful_hub.id = br.fulfilling_hub_id
     LEFT JOIN citizen_profiles req_cp ON req_cp.user_id = br.requester_user_id
     ORDER BY br.created_at DESC
     LIMIT ?`,
    [safeLimit]
  );

  // Merge and sort descending
  const combined = [...harvests, ...matches, ...verifications, ...bloodLogs];
  combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return combined.slice(0, safeLimit);
}
