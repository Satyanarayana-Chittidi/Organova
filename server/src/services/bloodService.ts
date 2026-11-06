import { findHubByUserId, findHubById } from '../models/hubModel';
import pool from '../config/database';
import {
  emitEmergencyBloodRequest,
  emitBloodRequestStatusUpdate,
  getIO,
} from '../config/socket';
import {
  upsertInventory,
  adjustInventory,
  getInventoryByHubId,
  searchStockInActiveHubs,
  createBloodRequest,
  findBloodRequestById,
  listBloodRequests,
  listRequestsByRequester,
  claimAndApproveRequest,
  updateRequestStatus,
  commitLivingDonor,
  releaseLivingDonor,
  completeDonorDonation,
  cancelBloodRequest,
} from '../models/bloodModel';
import {
  BloodGroup,
  BloodComponent,
  BloodUrgency,
  BloodInventoryItem,
  BloodRequest,
  SetInventoryDTO,
  AdjustInventoryDTO,
  CreateBloodRequestDTO,
  SearchStockFilters,
  BloodRequestFilters,
} from '../types/blood';
import { MedicalHub } from '../types/hub';

const VALID_BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const VALID_COMPONENTS: BloodComponent[] = ['WHOLE_BLOOD', 'PACKED_RBC', 'PLATELETS', 'PLASMA'];
const VALID_URGENCIES: BloodUrgency[] = ['CRITICAL', 'URGENT', 'ROUTINE'];

async function getVerifiedActiveHub(userId: string): Promise<MedicalHub> {
  const hub = await findHubByUserId(userId);
  if (!hub) {
    const error: any = new Error('Medical facility profile not found for this account.');
    error.statusCode = 404;
    throw error;
  }

  if (hub.verification_status !== 'ACTIVE') {
    const error: any = new Error(
      `Access denied: Facility is not active (current status: '${hub.verification_status}'). Only verified facilities can manage inventory or fulfill requisitions.`
    );
    error.statusCode = 403;
    throw error;
  }

  return hub;
}

export async function setFacilityInventory(
  userId: string,
  dto: SetInventoryDTO
): Promise<BloodInventoryItem> {
  const hub = await getVerifiedActiveHub(userId);

  if (!VALID_BLOOD_GROUPS.includes(dto.blood_group)) {
    const error: any = new Error(`Invalid blood group: '${dto.blood_group}'.`);
    error.statusCode = 400;
    throw error;
  }

  if (!VALID_COMPONENTS.includes(dto.component)) {
    const error: any = new Error(`Invalid blood component: '${dto.component}'.`);
    error.statusCode = 400;
    throw error;
  }

  if (typeof dto.units_available !== 'number' || dto.units_available < 0) {
    const error: any = new Error('units_available must be a non-negative integer.');
    error.statusCode = 400;
    throw error;
  }

  return await upsertInventory(hub.id, dto);
}

export async function adjustFacilityInventory(
  userId: string,
  dto: AdjustInventoryDTO
): Promise<BloodInventoryItem> {
  const hub = await getVerifiedActiveHub(userId);

  if (!VALID_BLOOD_GROUPS.includes(dto.blood_group)) {
    const error: any = new Error(`Invalid blood group: '${dto.blood_group}'.`);
    error.statusCode = 400;
    throw error;
  }

  if (!VALID_COMPONENTS.includes(dto.component)) {
    const error: any = new Error(`Invalid blood component: '${dto.component}'.`);
    error.statusCode = 400;
    throw error;
  }

  if (typeof dto.delta_units !== 'number' || dto.delta_units === 0) {
    const error: any = new Error('delta_units must be a non-zero integer (+N to add, -N to deduct).');
    error.statusCode = 400;
    throw error;
  }

  const updatedItem = await adjustInventory(hub.id, dto.blood_group, dto.component, dto.delta_units);

  try {
    const units = Math.abs(dto.delta_units);
    if (dto.delta_units > 0) {
      const donorUserId = dto.linked_user_id || null;
      await pool.query(
        `INSERT INTO blood_requests (
          requester_user_id, destination_hub_id, target_hub_id, fulfilling_hub_id,
          donor_user_id, blood_group, component, units_requested,
          urgency, status, patient_relationship, patient_name,
          hospital_bed_no, created_at, fulfilled_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ROUTINE', 'COMPLETED', ?, ?, ?, NOW(), NOW())`,
        [
          userId,
          hub.id,
          hub.id,
          hub.id,
          donorUserId,
          dto.blood_group,
          dto.component,
          units,
          donorUserId ? 'VOLUNTARY_DONATION' : 'INVENTORY_INTAKE',
          dto.patient_name?.trim() || (donorUserId ? 'Voluntary Donor' : 'Stock Replenishment'),
          dto.hospital_bed_no?.trim() || null,
        ]
      );
    } else {
      const recipientUserId = dto.linked_user_id || userId;
      await pool.query(
        `INSERT INTO blood_requests (
          requester_user_id, destination_hub_id, target_hub_id, fulfilling_hub_id,
          donor_user_id, blood_group, component, units_requested,
          urgency, status, patient_relationship, patient_name,
          hospital_bed_no, created_at, fulfilled_at
        ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, 'URGENT', 'COMPLETED', ?, ?, ?, NOW(), NOW())`,
        [
          recipientUserId,
          hub.id,
          hub.id,
          hub.id,
          dto.blood_group,
          dto.component,
          units,
          dto.linked_user_id ? 'HOSPITAL_DISPENSE' : 'INVENTORY_DISPENSE',
          dto.patient_name?.trim() || (dto.linked_user_id ? 'Inpatient Recipient' : 'Clinical Dispense'),
          dto.hospital_bed_no?.trim() || null,
        ]
      );
    }
  } catch (auditErr) {
    console.error('[BloodService] Failed to record transaction log into blood_requests:', auditErr);
  }

  return updatedItem;
}

export async function getFacilityInventory(userId: string): Promise<BloodInventoryItem[]> {
  const hub = await getVerifiedActiveHub(userId);
  return await getInventoryByHubId(hub.id);
}

export async function searchBloodStock(filters: SearchStockFilters): Promise<BloodInventoryItem[]> {
  return await searchStockInActiveHubs(filters);
}

export function getCompatibleBloodGroups(recipientGroup: BloodGroup): BloodGroup[] {
  switch (recipientGroup) {
    case 'O-': return ['O-'];
    case 'O+': return ['O+', 'O-'];
    case 'A-': return ['A-', 'O-'];
    case 'A+': return ['A+', 'A-', 'O+', 'O-'];
    case 'B-': return ['B-', 'O-'];
    case 'B+': return ['B+', 'B-', 'O+', 'O-'];
    case 'AB-': return ['AB-', 'A-', 'B-', 'O-'];
    case 'AB+': return ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'];
    default: return [recipientGroup];
  }
}

export function getCanDonateTo(donorGroup: BloodGroup): BloodGroup[] {
  switch (donorGroup) {
    case 'O-': return ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
    case 'O+': return ['O+', 'A+', 'B+', 'AB+'];
    case 'A-': return ['A-', 'A+', 'AB-', 'AB+'];
    case 'A+': return ['A+', 'AB+'];
    case 'B-': return ['B-', 'B+', 'AB-', 'AB+'];
    case 'B+': return ['B+', 'AB+'];
    case 'AB-': return ['AB-', 'AB+'];
    case 'AB+': return ['AB+'];
    default: return [donorGroup];
  }
}

export async function createRequest(
  userId: string,
  dto: CreateBloodRequestDTO
): Promise<BloodRequest> {
  if (!VALID_BLOOD_GROUPS.includes(dto.blood_group)) {
    const error: any = new Error(`Invalid blood group: '${dto.blood_group}'.`);
    error.statusCode = 400;
    throw error;
  }

  if (!VALID_COMPONENTS.includes(dto.component)) {
    const error: any = new Error(`Invalid blood component: '${dto.component}'.`);
    error.statusCode = 400;
    throw error;
  }

  if (!VALID_URGENCIES.includes(dto.urgency)) {
    const error: any = new Error(`Invalid urgency level: '${dto.urgency}'. Must be CRITICAL, URGENT, or ROUTINE.`);
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isInteger(dto.units_requested) || dto.units_requested <= 0) {
    const error: any = new Error('units_requested must be an integer greater than 0.');
    error.statusCode = 400;
    throw error;
  }

  if (!dto.destination_hub_id || !Number.isInteger(Number(dto.destination_hub_id))) {
    const error: any = new Error('A valid receiving hospital on the network must be selected.');
    error.statusCode = 400;
    throw error;
  }

  const destHub = await findHubById(Number(dto.destination_hub_id));
  if (!destHub || destHub.verification_status !== 'ACTIVE') {
    const error: any = new Error('The selected receiving hospital is not a verified active medical facility on our network.');
    error.statusCode = 400;
    throw error;
  }

  if (!dto.delivery_address || dto.delivery_address.trim().length === 0) {
    dto.delivery_address = `${destHub.name}, ${destHub.address_line}, ${destHub.city}`;
  }

  if (dto.target_hub_id) {
    const targetHub = await findHubById(Number(dto.target_hub_id));
    if (!targetHub || targetHub.verification_status !== 'ACTIVE') {
      const error: any = new Error('The selected supplying hospital is not a verified active facility on our network.');
      error.statusCode = 400;
      throw error;
    }

    const request = await createBloodRequest(userId, dto);
    try {
      const io = getIO();
      io.to(`hub:${dto.target_hub_id}`).emit('BLOOD_REQUEST_ALERT', {
        type: 'TARGETED_STOCK_REQUISITION',
        priority: request.urgency,
        message: `Direct Stock Requisition #BR-${request.id}: ${request.units_requested} unit(s) of ${request.blood_group} requested by ${destHub.name}.`,
        requestId: request.id,
        requesterUserId: request.requester_user_id,
        bloodGroup: request.blood_group,
        component: request.component,
        unitsRequested: request.units_requested,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[WEBSOCKET] Failed to emit targeted stock alert:', err);
    }
    return request;
  }

  const compatibleGroups = getCompatibleBloodGroups(dto.blood_group);

  const [invRows]: any = await pool.query(
    `SELECT blood_group, units_available 
     FROM blood_inventory 
     WHERE hub_id = ? AND component = ? AND blood_group IN (?) AND units_available > 0
     ORDER BY 
       CASE WHEN blood_group = ? THEN 1 ELSE 2 END ASC,
       units_available DESC`,
    [destHub.id, dto.component, compatibleGroups, dto.blood_group]
  );

  let bestMatch: { blood_group: BloodGroup; units_available: number } | null = null;
  if (invRows && invRows.length > 0) {
    const exact = invRows.find((r: any) => r.blood_group === dto.blood_group);
    if (exact && exact.units_available >= dto.units_requested) {
      bestMatch = exact;
    } else {
      const sorted = [...invRows].sort((a: any, b: any) => b.units_available - a.units_available);
      bestMatch = sorted[0];
    }
  }

  const availableAtHospital = bestMatch ? bestMatch.units_available : 0;

  if (bestMatch && availableAtHospital >= dto.units_requested) {
    const inHouseDto: CreateBloodRequestDTO = {
      ...dto,
      blood_group: bestMatch.blood_group,
      target_hub_id: destHub.id,
    };
    const request = await createBloodRequest(userId, inHouseDto);

    try {
      const io = getIO();
      io.to(`hub:${destHub.id}`).emit('BLOOD_REQUEST_ALERT', {
        type: 'IN_HOUSE_REQUISITION',
        priority: request.urgency,
        message: `In-House Blood Requisition #BR-${request.id}: ${request.units_requested} unit(s) of compatible ${request.blood_group} ${request.component?.replace(/_/g, ' ')} available in your hospital blood inventory. Please approve in your Facility Portal.`,
        requestId: request.id,
        requesterUserId: request.requester_user_id,
        bloodGroup: request.blood_group,
        component: request.component,
        unitsRequested: request.units_requested,
        destinationHospital: destHub.name,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[WEBSOCKET] Failed to emit targeted in-house alert:', err);
    }

    return Object.assign(request, {
      fulfillmentCase: 'FULL_IN_HOUSE',
      inHouseUnits: dto.units_requested,
      sosUnits: 0,
      matchedBloodGroup: bestMatch.blood_group,
      hospitalName: destHub.name,
      requestId: request.id,
    });
  }

  if (bestMatch && availableAtHospital > 0 && availableAtHospital < dto.units_requested) {
    const remainingUnits = dto.units_requested - availableAtHospital;

    const inHouseDto: CreateBloodRequestDTO = {
      ...dto,
      blood_group: bestMatch.blood_group,
      units_requested: availableAtHospital,
      target_hub_id: destHub.id,
    };
    const inHouseReq = await createBloodRequest(userId, inHouseDto);

    try {
      const io = getIO();
      io.to(`hub:${destHub.id}`).emit('BLOOD_REQUEST_ALERT', {
        type: 'IN_HOUSE_REQUISITION',
        priority: inHouseReq.urgency,
        message: `In-House Blood Requisition #BR-${inHouseReq.id}: ${inHouseReq.units_requested} unit(s) of compatible ${inHouseReq.blood_group} available in your hospital blood inventory. Please approve in your Facility Portal.`,
        requestId: inHouseReq.id,
        requesterUserId: inHouseReq.requester_user_id,
        bloodGroup: inHouseReq.blood_group,
        component: inHouseReq.component,
        unitsRequested: inHouseReq.units_requested,
        destinationHospital: destHub.name,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[WEBSOCKET] Failed to emit in-house partial alert:', err);
    }

    const sosDto: CreateBloodRequestDTO = {
      ...dto,
      units_requested: remainingUnits,
      target_hub_id: null,
    };
    const sosReq = await createBloodRequest(userId, sosDto);

    const [supplyingHubs]: any = await pool.query(
      `SELECT DISTINCT hub_id FROM blood_inventory 
       WHERE component = ? AND blood_group IN (?) AND units_available >= ? AND hub_id != ?`,
      [dto.component, compatibleGroups, remainingUnits, destHub.id]
    );
    const supplyingHubIds = (supplyingHubs || []).map((h: any) => h.hub_id);

    try {
      emitEmergencyBloodRequest({
        requestId: sosReq.id,
        requesterUserId: sosReq.requester_user_id,
        bloodGroup: sosReq.blood_group,
        component: sosReq.component,
        unitsRequested: sosReq.units_requested,
        urgency: sosReq.urgency,
        deliveryAddress: destHub.name
          ? `${destHub.name}, ${destHub.city}`
          : sosReq.delivery_address || '',
        compatibleDonorGroups: compatibleGroups,
        targetHubIds: supplyingHubIds.length > 0 ? supplyingHubIds : undefined,
      });
    } catch (err) {
      console.warn('[WEBSOCKET] Failed to emit emergency blood alert for remaining units:', err);
    }

    return Object.assign(sosReq, {
      fulfillmentCase: 'PARTIAL_IN_HOUSE',
      inHouseUnits: availableAtHospital,
      sosUnits: remainingUnits,
      matchedBloodGroup: bestMatch.blood_group,
      hospitalName: destHub.name,
      inHouseRequestId: inHouseReq.id,
      sosRequestId: sosReq.id,
    });
  }

  const sosDto: CreateBloodRequestDTO = {
    ...dto,
    target_hub_id: null,
  };
  const request = await createBloodRequest(userId, sosDto);

  const [supplyingHubs]: any = await pool.query(
    `SELECT DISTINCT hub_id FROM blood_inventory 
     WHERE component = ? AND blood_group IN (?) AND units_available >= ? AND hub_id != ?`,
    [dto.component, compatibleGroups, dto.units_requested, destHub.id]
  );
  const supplyingHubIds = (supplyingHubs || []).map((h: any) => h.hub_id);

  try {
    emitEmergencyBloodRequest({
      requestId: request.id,
      requesterUserId: request.requester_user_id,
      bloodGroup: request.blood_group,
      component: request.component,
      unitsRequested: request.units_requested,
      urgency: request.urgency,
      deliveryAddress: destHub.name
        ? `${destHub.name}, ${destHub.city}`
        : request.delivery_address || '',
      compatibleDonorGroups: compatibleGroups,
      targetHubIds: supplyingHubIds.length > 0 ? supplyingHubIds : undefined,
    });
  } catch (err) {
    console.warn('[WEBSOCKET] Failed to emit emergency blood alert:', err);
  }

  return Object.assign(request, {
    fulfillmentCase: 'OPEN_SOS',
    inHouseUnits: 0,
    sosUnits: dto.units_requested,
    matchedBloodGroup: dto.blood_group,
    hospitalName: destHub.name,
    requestId: request.id,
    sosRequestId: request.id,
  });
}

export async function getRequestById(requestId: number): Promise<BloodRequest> {
  const request = await findBloodRequestById(requestId);
  if (!request) {
    const error: any = new Error(`Blood request with ID ${requestId} not found.`);
    error.statusCode = 404;
    throw error;
  }
  return request;
}

export async function getRequisitionQueue(filters: BloodRequestFilters): Promise<BloodRequest[]> {
  return await listBloodRequests(filters);
}

export async function getMyRequests(userId: string): Promise<BloodRequest[]> {
  return await listRequestsByRequester(userId);
}

export async function claimRequest(userId: string, requestId: number): Promise<BloodRequest> {
  const hub = await getVerifiedActiveHub(userId);
  const claimed = await claimAndApproveRequest(requestId, hub.id);

  try {
    emitBloodRequestStatusUpdate({
      requestId: claimed.id,
      requesterUserId: claimed.requester_user_id,
      status: claimed.status,
      fulfillingHubName: claimed.fulfilling_hub_name,
    });
  } catch (err) {
    console.warn('[WEBSOCKET] Failed to emit claim status update:', err);
  }

  return claimed;
}

export async function updateDispatchStatus(
  userId: string,
  requestId: number,
  nextStatus: 'DISPATCHED' | 'COMPLETED'
): Promise<BloodRequest> {
  const hub = await getVerifiedActiveHub(userId);
  const updated = await updateRequestStatus(requestId, hub.id, nextStatus);

  try {
    emitBloodRequestStatusUpdate({
      requestId: updated.id,
      requesterUserId: updated.requester_user_id,
      donorUserId: updated.donor_user_id,
      bloodGroup: updated.blood_group,
      status: updated.status,
      fulfillingHubName: updated.fulfilling_hub_name,
    });
  } catch (err) {
    console.warn('[WEBSOCKET] Failed to emit dispatch status update:', err);
  }

  return updated;
}

export async function cancelRequest(
  userId: string,
  requestId: number,
  isAdmin: boolean
): Promise<BloodRequest> {
  const cancelled = await cancelBloodRequest(requestId, userId, isAdmin);

  try {
    emitBloodRequestStatusUpdate({
      requestId: cancelled.id,
      requesterUserId: cancelled.requester_user_id,
      donorUserId: cancelled.donor_user_id,
      bloodGroup: cancelled.blood_group,
      status: cancelled.status,
      fulfillingHubName: cancelled.destination_hub_name || cancelled.fulfilling_hub_name,
    });
  } catch (err) {
    console.warn('[WEBSOCKET] Failed to emit cancel status update:', err);
  }

  return cancelled;
}

export async function commitDonor(userId: string, requestId: number): Promise<BloodRequest> {
  const existing = await findBloodRequestById(requestId);
  if (!existing) {
    const error: any = new Error(`Blood request #${requestId} not found.`);
    error.statusCode = 404;
    throw error;
  }

  if (existing.requester_user_id === userId) {
    const error: any = new Error(
      'You cannot commit as a donor for your own blood requisition.'
    );
    error.statusCode = 400;
    throw error;
  }

  const [activeCommitments]: any = await pool.query(
    `SELECT id FROM blood_requests WHERE donor_user_id = ? AND status = 'DONOR_COMMITTED' AND id != ? LIMIT 1`,
    [userId, requestId]
  );
  if (activeCommitments && activeCommitments.length > 0) {
    const error: any = new Error(
      `You already have an active walk-in commitment (#PASS-BR${activeCommitments[0].id}). You can only commit to one emergency at a time.`
    );
    error.statusCode = 409;
    throw error;
  }

  const updated = await commitLivingDonor(requestId, userId);

  try {
    emitBloodRequestStatusUpdate({
      requestId: updated.id,
      requesterUserId: updated.requester_user_id,
      donorUserId: userId,
      bloodGroup: updated.blood_group,
      status: updated.status,
      fulfillingHubName: updated.destination_hub_name,
    });
  } catch (err) {
    console.warn('[WEBSOCKET] Failed to emit donor commit status update:', err);
  }

  return updated;
}

export async function completeDonorDonationService(
  userId: string,
  requestId: number
): Promise<BloodRequest> {
  const hub = await getVerifiedActiveHub(userId);
  const updated = await completeDonorDonation(requestId, hub.id);

  try {
    emitBloodRequestStatusUpdate({
      requestId: updated.id,
      requesterUserId: updated.requester_user_id,
      donorUserId: updated.donor_user_id,
      bloodGroup: updated.blood_group,
      status: updated.status,
      fulfillingHubName: hub.name,
    });
  } catch (err) {
    console.warn('[WEBSOCKET] Failed to emit complete donor status update:', err);
  }

  return updated;
}

export async function releaseDonor(
  userId: string,
  requestId: number
): Promise<BloodRequest> {
  const updated = await releaseLivingDonor(requestId, userId);

  try {
    emitBloodRequestStatusUpdate({
      requestId: updated.id,
      requesterUserId: updated.requester_user_id,
      donorUserId: userId,
      bloodGroup: updated.blood_group,
      status: updated.status,
      fulfillingHubName: updated.destination_hub_name,
    });
  } catch (err) {
    console.warn('[WEBSOCKET] Failed to emit donor release status update:', err);
  }

  return updated;
}

export interface EmergencyAlertItem {
  id: string;
  type: string;
  priority: string;
  message: string;
  timestamp: string;
  meta: any;
}

export async function getActiveEmergencyAlerts(
  userId: string,
  role: string
): Promise<EmergencyAlertItem[]> {
  const alerts: EmergencyAlertItem[] = [];

  if (role === 'USER') {
    const [committedPasses]: any = await pool.query(
      `SELECT br.id, br.blood_group, br.component, br.units_requested, br.urgency, 
              br.created_at,
              dest_hub.name AS destination_hub_name, dest_hub.city AS destination_hub_city,
              dest_hub.address_line AS destination_hub_address, dest_hub.contact_phone AS destination_hub_phone
       FROM blood_requests br
       JOIN medical_hubs dest_hub ON dest_hub.id = br.destination_hub_id
       WHERE br.status = 'DONOR_COMMITTED' AND br.donor_user_id = ?
       LIMIT 1`,
      [userId]
    );

    if (committedPasses && committedPasses.length > 0) {
      const p = committedPasses[0];
      alerts.push({
        id: `active-pass-${p.id}`,
        type: 'ACTIVE_DONOR_PASS',
        priority: 'CRITICAL',
        message: `Active Walk-In Pass: You are committed to donate ${p.blood_group} at ${p.destination_hub_name}.`,
        timestamp: new Date(p.created_at).toISOString(),
        meta: {
          requestId: p.id,
          bloodGroup: p.blood_group,
          component: p.component,
          unitsRequested: p.units_requested,
          destinationHospital: p.destination_hub_name,
          destinationAddress: p.destination_hub_address,
          destinationCity: p.destination_hub_city,
          destinationPhone: p.destination_hub_phone,
        },
      });
    }

    const [profiles]: any = await pool.query(
      'SELECT blood_group, city FROM citizen_profiles WHERE user_id = ? LIMIT 1',
      [userId]
    );

    if (profiles && profiles.length > 0 && profiles[0].blood_group) {
      const bloodGroup = profiles[0].blood_group as BloodGroup;
      const canDonateTo = getCanDonateTo(bloodGroup);
      const [reqs]: any = await pool.query(
        `SELECT br.id, br.requester_user_id, br.blood_group, br.component, br.units_requested, br.urgency, br.created_at,
                dest_hub.name AS destination_hub_name, dest_hub.city AS destination_hub_city,
                dest_hub.address_line AS destination_hub_address, dest_hub.contact_phone AS destination_hub_phone
         FROM blood_requests br
         JOIN medical_hubs dest_hub ON dest_hub.id = br.destination_hub_id
         WHERE br.status = 'REQUESTED' AND br.target_hub_id IS NULL AND br.blood_group IN (?) AND br.requester_user_id != ?
         ORDER BY 
           CASE br.urgency WHEN 'CRITICAL' THEN 1 WHEN 'URGENT' THEN 2 ELSE 3 END ASC,
           br.created_at DESC
         LIMIT 50`,
        [canDonateTo, userId]
      );

      for (const r of reqs) {
        alerts.push({
          id: `blood-req-${r.id}`,
          type: 'BLOOD_DONOR_SOS',
          priority: r.urgency,
          message: `🚨 Emergency Need: ${r.blood_group} blood requested at ${r.destination_hub_name} (${r.destination_hub_city}). Can you walk in to donate?`,
          timestamp: new Date(r.created_at).toISOString(),
          meta: {
            requestId: r.id,
            requesterUserId: r.requester_user_id,
            bloodGroup: r.blood_group,
            component: r.component,
            unitsRequested: r.units_requested,
            destinationHospital: r.destination_hub_name,
            destinationAddress: r.destination_hub_address,
            destinationCity: r.destination_hub_city,
            destinationPhone: r.destination_hub_phone,
          },
        });
      }
    }
  } else if (role === 'HOSPITAL') {
    const hub = await findHubByUserId(userId);
    if (hub) {
      const [reqs]: any = await pool.query(
        `SELECT br.id, br.blood_group, br.component, br.units_requested, br.urgency, br.created_at,
                dest_hub.name AS destination_hub_name, dest_hub.city AS destination_hub_city
         FROM blood_requests br
         JOIN medical_hubs dest_hub ON dest_hub.id = br.destination_hub_id
         WHERE br.status = 'REQUESTED' AND (br.target_hub_id = ? OR br.target_hub_id IS NULL)
         ORDER BY 
           CASE br.urgency WHEN 'CRITICAL' THEN 1 WHEN 'URGENT' THEN 2 ELSE 3 END ASC,
           br.created_at DESC
         LIMIT 50`,
        [hub.id]
      );

      for (const r of reqs) {
        alerts.push({
          id: `blood-req-${r.id}`,
          type: 'EMERGENCY_BLOOD_ALERT',
          priority: r.urgency,
          message: `Pending Requisition: ${r.units_requested} unit(s) of ${r.blood_group} ${r.component} for ${r.destination_hub_name}.`,
          timestamp: new Date(r.created_at).toISOString(),
          meta: {
            requestId: r.id,
            bloodGroup: r.blood_group,
            component: r.component,
            unitsRequested: r.units_requested,
            destinationHospital: r.destination_hub_name,
          },
        });
      }
    }
  }

  return alerts;
}
