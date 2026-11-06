import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/database';
import {
  BloodInventoryItem,
  BloodRequest,
  BloodGroup,
  BloodComponent,
  BloodUrgency,
  BloodRequestStatus,
  SetInventoryDTO,
  CreateBloodRequestDTO,
  SearchStockFilters,
  BloodRequestFilters,
} from '../types/blood';

interface BloodInventoryRow extends BloodInventoryItem, RowDataPacket {}
interface BloodRequestRow extends BloodRequest, RowDataPacket {}

// ====================================================================
// 1. INVENTORY OPERATIONS
// ====================================================================

/**
 * Sets an exact stock count for a specific blood group & component.
 * Uses ON DUPLICATE KEY UPDATE to atomically insert or overwrite.
 */
export async function upsertInventory(
  hubId: number,
  dto: SetInventoryDTO
): Promise<BloodInventoryItem> {
  await pool.query<ResultSetHeader>(
    `INSERT INTO blood_inventory (hub_id, blood_group, component, units_available, last_updated)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE 
       units_available = VALUES(units_available),
       last_updated = NOW()`,
    [hubId, dto.blood_group, dto.component, Math.max(0, dto.units_available)]
  );

  const [rows] = await pool.query<BloodInventoryRow[]>(
    `SELECT * FROM blood_inventory 
     WHERE hub_id = ? AND blood_group = ? AND component = ? LIMIT 1`,
    [hubId, dto.blood_group, dto.component]
  );

  return rows[0];
}

/**
 * Adjusts inventory stock by a delta (+N for additions, -N for consumption).
 * Guarantees stock cannot drop below zero.
 */
export async function adjustInventory(
  hubId: number,
  bloodGroup: BloodGroup,
  component: BloodComponent,
  deltaUnits: number
): Promise<BloodInventoryItem> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Lock the row for update
    const [rows] = await connection.query<BloodInventoryRow[]>(
      `SELECT * FROM blood_inventory 
       WHERE hub_id = ? AND blood_group = ? AND component = ? 
       FOR UPDATE`,
      [hubId, bloodGroup, component]
    );

    const currentUnits = rows.length > 0 ? rows[0].units_available : 0;
    const newUnits = currentUnits + deltaUnits;

    if (newUnits < 0) {
      throw new Error(
        `Cannot deduct ${Math.abs(deltaUnits)} units. Current inventory has only ${currentUnits} units.`
      );
    }

    await connection.query<ResultSetHeader>(
      `INSERT INTO blood_inventory (hub_id, blood_group, component, units_available, last_updated)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE 
         units_available = ?,
         last_updated = NOW()`,
      [hubId, bloodGroup, component, newUnits, newUnits]
    );

    await connection.commit();

    const [updatedRows] = await pool.query<BloodInventoryRow[]>(
      `SELECT * FROM blood_inventory 
       WHERE hub_id = ? AND blood_group = ? AND component = ? LIMIT 1`,
      [hubId, bloodGroup, component]
    );

    return updatedRows[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Retrieves the full inventory list for a specific medical hub.
 */
export async function getInventoryByHubId(hubId: number): Promise<BloodInventoryItem[]> {
  const [rows] = await pool.query<BloodInventoryRow[]>(
    `SELECT * FROM blood_inventory 
     WHERE hub_id = ? 
     ORDER BY blood_group ASC, component ASC`,
    [hubId]
  );
  return rows;
}

/**
 * Public & Clinical Search: Finds verified ACTIVE facilities that currently
 * possess available blood stock matching requested criteria.
 */
export async function searchStockInActiveHubs(
  filters: SearchStockFilters
): Promise<BloodInventoryItem[]> {
  let query = `
    SELECT 
      bi.id,
      bi.hub_id,
      bi.blood_group,
      bi.component,
      bi.units_available,
      bi.last_updated,
      mh.name AS hub_name,
      mh.hub_type,
      mh.contact_phone,
      mh.city,
      mh.latitude,
      mh.longitude
    FROM blood_inventory bi
    JOIN medical_hubs mh ON mh.id = bi.hub_id
    WHERE mh.verification_status = 'ACTIVE'
      AND bi.units_available > 0
  `;

  const params: any[] = [];

  if (filters.blood_group) {
    query += ' AND bi.blood_group = ?';
    params.push(filters.blood_group);
  }

  if (filters.component) {
    query += ' AND bi.component = ?';
    params.push(filters.component);
  }

  if (filters.city && filters.city.trim().length > 0) {
    const term = `%${filters.city.trim()}%`;
    query += ' AND (LOWER(mh.city) LIKE LOWER(?) OR LOWER(mh.name) LIKE LOWER(?))';
    params.push(term, term);
  }

  query += ' ORDER BY bi.units_available DESC, mh.name ASC';

  const [rows] = await pool.query<BloodInventoryRow[]>(query, params);
  return rows;
}

// ====================================================================
// 2. EMERGENCY BLOOD REQUEST OPERATIONS
// ====================================================================

/**
 * Creates an emergency blood requisition.
 */
export async function createBloodRequest(
  requesterUserId: string,
  dto: CreateBloodRequestDTO
): Promise<BloodRequest> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO blood_requests (
       requester_user_id, destination_hub_id, target_hub_id, 
       blood_group, component, units_requested, 
       urgency, status, delivery_address,
       patient_relationship, patient_name, hospital_bed_no
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 'REQUESTED', ?, ?, ?, ?)`,
    [
      requesterUserId,
      dto.destination_hub_id,
      dto.target_hub_id || null,
      dto.blood_group,
      dto.component,
      dto.units_requested,
      dto.urgency,
      dto.delivery_address ? dto.delivery_address.trim() : null,
      dto.patient_relationship ? dto.patient_relationship.trim() : 'SELF',
      dto.patient_name ? dto.patient_name.trim() : null,
      dto.hospital_bed_no ? dto.hospital_bed_no.trim() : null,
    ]
  );

  const request = await findBloodRequestById(result.insertId);
  if (!request) throw new Error('Failed to retrieve newly created blood request.');
  return request;
}

/**
 * Finds a blood request by its primary key ID, enriched with requester, destination hospital, target hospital, fulfilling facility & donor info.
 */
export async function findBloodRequestById(id: number): Promise<BloodRequest | null> {
  const query = `
    SELECT 
      br.*,
      u.email AS requester_email,
      dest_hub.name AS destination_hub_name,
      dest_hub.address_line AS destination_hub_address,
      dest_hub.city AS destination_hub_city,
      dest_hub.contact_phone AS destination_hub_phone,
      target_hub.name AS target_hub_name,
      target_hub.contact_phone AS target_hub_phone,
      mh.name AS fulfilling_hub_name,
      mh.contact_phone AS fulfilling_hub_phone,
      cp.full_name AS donor_name,
      cp.phone_number AS donor_phone
    FROM blood_requests br
    JOIN users u ON u.id = br.requester_user_id
    JOIN medical_hubs dest_hub ON dest_hub.id = br.destination_hub_id
    LEFT JOIN medical_hubs target_hub ON target_hub.id = br.target_hub_id
    LEFT JOIN medical_hubs mh ON mh.id = br.fulfilling_hub_id
    LEFT JOIN citizen_profiles cp ON cp.user_id = br.donor_user_id
    WHERE br.id = ? LIMIT 1
  `;
  const [rows] = await pool.query<BloodRequestRow[]>(query, [id]);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Lists blood requests with optional filters, ordered by clinical urgency
 * (CRITICAL > URGENT > ROUTINE) and timestamp.
 */
export async function listBloodRequests(filters: BloodRequestFilters): Promise<BloodRequest[]> {
  let query = `
    SELECT 
      br.*,
      u.email AS requester_email,
      dest_hub.name AS destination_hub_name,
      dest_hub.address_line AS destination_hub_address,
      dest_hub.city AS destination_hub_city,
      dest_hub.contact_phone AS destination_hub_phone,
      target_hub.name AS target_hub_name,
      target_hub.contact_phone AS target_hub_phone,
      mh.name AS fulfilling_hub_name,
      mh.contact_phone AS fulfilling_hub_phone,
      cp.full_name AS donor_name,
      cp.phone_number AS donor_phone
    FROM blood_requests br
    JOIN users u ON u.id = br.requester_user_id
    JOIN medical_hubs dest_hub ON dest_hub.id = br.destination_hub_id
    LEFT JOIN medical_hubs target_hub ON target_hub.id = br.target_hub_id
    LEFT JOIN medical_hubs mh ON mh.id = br.fulfilling_hub_id
    LEFT JOIN citizen_profiles cp ON cp.user_id = br.donor_user_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filters.status) {
    query += ' AND br.status = ?';
    params.push(filters.status);
  }

  if (filters.urgency) {
    query += ' AND br.urgency = ?';
    params.push(filters.urgency);
  }

  if (filters.blood_group) {
    query += ' AND br.blood_group = ?';
    params.push(filters.blood_group);
  }

  if (filters.component) {
    query += ' AND br.component = ?';
    params.push(filters.component);
  }

  query += `
    ORDER BY 
      CASE br.urgency
        WHEN 'CRITICAL' THEN 1
        WHEN 'URGENT' THEN 2
        WHEN 'ROUTINE' THEN 3
        ELSE 4
      END ASC,
      br.created_at ASC
  `;

  const [rows] = await pool.query<BloodRequestRow[]>(query, params);
  return rows;
}

/**
 * Lists all requests created by a specific user or hospital.
 */
export async function listRequestsByRequester(userId: string): Promise<BloodRequest[]> {
  const query = `
    SELECT 
      br.*,
      u.email AS requester_email,
      dest_hub.name AS destination_hub_name,
      dest_hub.address_line AS destination_hub_address,
      dest_hub.city AS destination_hub_city,
      dest_hub.contact_phone AS destination_hub_phone,
      target_hub.name AS target_hub_name,
      target_hub.contact_phone AS target_hub_phone,
      mh.name AS fulfilling_hub_name,
      mh.contact_phone AS fulfilling_hub_phone,
      cp.full_name AS donor_name,
      cp.phone_number AS donor_phone
    FROM blood_requests br
    JOIN users u ON u.id = br.requester_user_id
    JOIN medical_hubs dest_hub ON dest_hub.id = br.destination_hub_id
    LEFT JOIN medical_hubs target_hub ON target_hub.id = br.target_hub_id
    LEFT JOIN medical_hubs mh ON mh.id = br.fulfilling_hub_id
    LEFT JOIN citizen_profiles cp ON cp.user_id = br.donor_user_id
    WHERE br.requester_user_id = ?
    ORDER BY br.created_at DESC
  `;
  const [rows] = await pool.query<BloodRequestRow[]>(query, [userId]);
  return rows;
}

/**
 * ACID TRANSACTION: Claim & Approve Blood Request.
 * Locks the request row and inventory row.
 * Validates that the request is still pending and the hub has sufficient stock.
 * Atomically decrements the stock and marks the request as APPROVED.
 */
export async function claimAndApproveRequest(
  requestId: number,
  fulfillingHubId: number
): Promise<BloodRequest> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Lock and inspect the requisition row
    const [reqRows] = await connection.query<BloodRequestRow[]>(
      'SELECT * FROM blood_requests WHERE id = ? FOR UPDATE',
      [requestId]
    );

    if (reqRows.length === 0) {
      const error: any = new Error(`Blood request with ID ${requestId} not found.`);
      error.statusCode = 404;
      throw error;
    }

    const request = reqRows[0];
    if (request.status !== 'REQUESTED') {
      const error: any = new Error(
        `This request cannot be claimed. Current status is already '${request.status}'.`
      );
      error.statusCode = 409;
      throw error;
    }

    // Direct requisition guard: Only the targeted hospital may claim this order
    if (request.target_hub_id && request.target_hub_id !== fulfillingHubId) {
      const error: any = new Error(
        'This requisition is directed to a specific hospital and cannot be claimed by another facility.'
      );
      error.statusCode = 403;
      throw error;
    }

    // 2. Lock and inspect the facility's inventory row
    const [invRows] = await connection.query<BloodInventoryRow[]>(
      `SELECT * FROM blood_inventory 
       WHERE hub_id = ? AND blood_group = ? AND component = ? 
       FOR UPDATE`,
      [fulfillingHubId, request.blood_group, request.component]
    );

    const availableUnits = invRows.length > 0 ? invRows[0].units_available : 0;
    if (availableUnits < request.units_requested) {
      const error: any = new Error(
        `Insufficient inventory to fulfill request. Facility possesses ${availableUnits} unit(s), but request requires ${request.units_requested} unit(s).`
      );
      error.statusCode = 400;
      throw error;
    }

    // 3. Atomically decrement inventory units
    await connection.query<ResultSetHeader>(
      `UPDATE blood_inventory 
       SET units_available = units_available - ?, last_updated = NOW()
       WHERE hub_id = ? AND blood_group = ? AND component = ?`,
      [request.units_requested, fulfillingHubId, request.blood_group, request.component]
    );

    // 4. Update request status to APPROVED with fulfilling facility ID
    await connection.query<ResultSetHeader>(
      `UPDATE blood_requests 
       SET status = 'APPROVED', fulfilling_hub_id = ? 
       WHERE id = ?`,
      [fulfillingHubId, requestId]
    );

    await connection.commit();

    const updated = await findBloodRequestById(requestId);
    return updated!;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Updates status of an approved request along the dispatch pipeline (DISPATCHED, COMPLETED).
 * If status is COMPLETED, fulfilled_at timestamp is set to NOW().
 */
export async function updateRequestStatus(
  requestId: number,
  hubId: number,
  nextStatus: 'DISPATCHED' | 'COMPLETED'
): Promise<BloodRequest> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query<BloodRequestRow[]>(
      'SELECT * FROM blood_requests WHERE id = ? FOR UPDATE',
      [requestId]
    );

    if (rows.length === 0) {
      const error: any = new Error(`Blood request with ID ${requestId} not found.`);
      error.statusCode = 404;
      throw error;
    }

    const request = rows[0];

    // Enforce that only the assigned fulfilling hub can advance the status
    if (request.fulfilling_hub_id !== hubId) {
      const error: any = new Error('Only the fulfilling medical facility can update order dispatch status.');
      error.statusCode = 403;
      throw error;
    }

    // State machine progression check
    if (nextStatus === 'DISPATCHED' && request.status !== 'APPROVED') {
      const error: any = new Error(
        `Invalid status transition: Can only dispatch requests that are 'APPROVED'. Current status: '${request.status}'.`
      );
      error.statusCode = 400;
      throw error;
    }

    if (nextStatus === 'COMPLETED' && request.status !== 'DISPATCHED') {
      const error: any = new Error(
        `Invalid status transition: Can only complete requests that are 'DISPATCHED'. Current status: '${request.status}'.`
      );
      error.statusCode = 400;
      throw error;
    }

    const fulfilledClause = nextStatus === 'COMPLETED' ? ', fulfilled_at = NOW()' : '';

    await connection.query<ResultSetHeader>(
      `UPDATE blood_requests 
       SET status = ? ${fulfilledClause}
       WHERE id = ?`,
      [nextStatus, requestId]
    );

    await connection.commit();

    const updated = await findBloodRequestById(requestId);
    return updated!;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * ACID TRANSACTION: Concurrency-Safe Living Donor Commitment.
 * Locks the request row to prevent race conditions if multiple donors tap 'I can donate' simultaneously.
 * Only the first committing transaction succeeds; subsequent callers receive 409 Conflict.
 */
export async function commitLivingDonor(
  requestId: number,
  donorUserId: string
): Promise<BloodRequest> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Lock and inspect the requisition row
    const [reqRows] = await connection.query<BloodRequestRow[]>(
      'SELECT * FROM blood_requests WHERE id = ? FOR UPDATE',
      [requestId]
    );

    if (reqRows.length === 0) {
      const error: any = new Error(`Blood request #${requestId} not found.`);
      error.statusCode = 404;
      throw error;
    }

    const request = reqRows[0];

    // Concurrency Guard: If already claimed or donor committed, reject cleanly
    if (request.status !== 'REQUESTED' || request.donor_user_id) {
      const error: any = new Error(
        'Another donor has just stepped forward to fulfill this request. Thank you for your readiness to save a life!'
      );
      error.statusCode = 409;
      throw error;
    }

    // Safety Guard: Citizens cannot donate to their own blood requisition
    if (request.requester_user_id === donorUserId) {
      const error: any = new Error(
        'You cannot commit as a donor for your own blood requisition.'
      );
      error.statusCode = 400;
      throw error;
    }

    // 1-to-1 Guard: A donor can only have one active walk-in commitment at a time
    const [activeDonorRows] = await connection.query<BloodRequestRow[]>(
      `SELECT id, blood_group FROM blood_requests 
       WHERE donor_user_id = ? AND status = 'DONOR_COMMITTED' AND id != ?
       LIMIT 1`,
      [donorUserId, requestId]
    );

    if (activeDonorRows.length > 0) {
      const error: any = new Error(
        `You already have an active walk-in commitment (#PASS-BR${activeDonorRows[0].id}). You can only commit to one emergency at a time. Please fulfill or release your active pass before accepting another.`
      );
      error.statusCode = 409;
      throw error;
    }

    // 2. Commit the donor atomically
    await connection.query<ResultSetHeader>(
      `UPDATE blood_requests 
       SET status = 'DONOR_COMMITTED', donor_user_id = ? 
       WHERE id = ?`,
      [donorUserId, requestId]
    );

    await connection.commit();

    const updated = await findBloodRequestById(requestId);
    return updated!;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * ACID TRANSACTION: Releases a committed donor slot if a donor encounters an emergency on the way.
 * Unlocks the requisition back to 'REQUESTED' so another donor can fulfill it.
 */
export async function releaseLivingDonor(
  requestId: number,
  donorUserId: string
): Promise<BloodRequest> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [reqRows] = await connection.query<BloodRequestRow[]>(
      'SELECT * FROM blood_requests WHERE id = ? FOR UPDATE',
      [requestId]
    );

    if (reqRows.length === 0) {
      const error: any = new Error(`Blood request #${requestId} not found.`);
      error.statusCode = 404;
      throw error;
    }

    const request = reqRows[0];
    if (request.donor_user_id !== donorUserId) {
      const error: any = new Error('You are not the designated donor for this blood requisition.');
      error.statusCode = 403;
      throw error;
    }

    if (request.status !== 'DONOR_COMMITTED') {
      const error: any = new Error(
        `Cannot release blood request with status '${request.status}'.`
      );
      error.statusCode = 400;
      throw error;
    }

    // Reset status back to REQUESTED and clear donor
    await connection.query<ResultSetHeader>(
      `UPDATE blood_requests 
       SET status = 'REQUESTED', donor_user_id = NULL 
       WHERE id = ?`,
      [requestId]
    );

    await connection.commit();

    const updated = await findBloodRequestById(requestId);
    return updated!;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Hospital Phlebotomy Verification: Hospital marks walk-in donor donation as completed.
 */
export async function completeDonorDonation(
  requestId: number,
  hubId: number
): Promise<BloodRequest> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query<BloodRequestRow[]>(
      'SELECT * FROM blood_requests WHERE id = ? FOR UPDATE',
      [requestId]
    );

    if (rows.length === 0) {
      const error: any = new Error(`Blood request #${requestId} not found.`);
      error.statusCode = 404;
      throw error;
    }

    const request = rows[0];
    if (
      request.destination_hub_id !== hubId &&
      request.target_hub_id !== hubId &&
      request.fulfilling_hub_id !== hubId
    ) {
      const error: any = new Error(
        'Only the receiving or assigned medical facility can verify and complete this walk-in donor donation.'
      );
      error.statusCode = 403;
      throw error;
    }

    if (request.status !== 'DONOR_COMMITTED') {
      const error: any = new Error(
        `Can only complete donor requisitions that are 'DONOR_COMMITTED'. Current status: '${request.status}'.`
      );
      error.statusCode = 400;
      throw error;
    }

    await connection.query<ResultSetHeader>(
      `UPDATE blood_requests 
       SET status = 'COMPLETED', fulfilling_hub_id = ?, fulfilled_at = NOW() 
       WHERE id = ?`,
      [hubId, requestId]
    );

    await connection.commit();

    const updated = await findBloodRequestById(requestId);
    return updated!;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * ACID TRANSACTION: Cancels a blood request.
 * If the request was already APPROVED, the reserved inventory is automatically
 * refunded back into the fulfilling facility's stock.
 */
export async function cancelBloodRequest(
  requestId: number,
  requesterUserId: string,
  isAdmin: boolean
): Promise<BloodRequest> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query<BloodRequestRow[]>(
      'SELECT * FROM blood_requests WHERE id = ? FOR UPDATE',
      [requestId]
    );

    if (rows.length === 0) {
      const error: any = new Error(`Blood request with ID ${requestId} not found.`);
      error.statusCode = 404;
      throw error;
    }

    const request = rows[0];

    // Permission check: only the requester or an administrator can cancel
    if (!isAdmin && request.requester_user_id !== requesterUserId) {
      const error: any = new Error('You do not have permission to cancel this blood request.');
      error.statusCode = 403;
      throw error;
    }

    // Terminal state checks
    if (request.status === 'COMPLETED') {
      const error: any = new Error('Completed requisitions cannot be cancelled.');
      error.statusCode = 400;
      throw error;
    }

    if (request.status === 'CANCELLED') {
      const error: any = new Error('This request has already been cancelled.');
      error.statusCode = 400;
      throw error;
    }

    // If units were deducted under APPROVED or DISPATCHED, replenish the inventory!
    if (
      (request.status === 'APPROVED' || request.status === 'DISPATCHED') &&
      request.fulfilling_hub_id
    ) {
      await connection.query<ResultSetHeader>(
        `UPDATE blood_inventory 
         SET units_available = units_available + ?, last_updated = NOW()
         WHERE hub_id = ? AND blood_group = ? AND component = ?`,
        [
          request.units_requested,
          request.fulfilling_hub_id,
          request.blood_group,
          request.component,
        ]
      );
    }

    await connection.query<ResultSetHeader>(
      `UPDATE blood_requests SET status = 'CANCELLED' WHERE id = ?`,
      [requestId]
    );

    await connection.commit();

    const updated = await findBloodRequestById(requestId);
    return updated!;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
