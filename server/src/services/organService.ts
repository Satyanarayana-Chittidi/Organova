import { findHubByUserId, findHubById } from '../models/hubModel';
import { findUserById } from '../models/userModel';
import {
  listAllOrganTypes,
  findOrganTypeById,
  insertHarvestedOrgan,
  findOrganById,
  listOrgans,
  updateOrganStatus,
  expireOverdueOrgans,
} from '../models/organModel';
import {
  OrganTypeEntity,
  AvailableOrganEntity,
  HarvestOrganDTO,
  UpdateOrganStatusDTO,
  OrganQueryFilters,
  OrganStatus,
} from '../types/organ';
import { BloodGroup } from '../types/blood';
import { MedicalHub } from '../types/hub';

const VALID_BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Allowed state transitions in organ lifecycle
const ALLOWED_TRANSITIONS: Record<OrganStatus, OrganStatus[]> = {
  AVAILABLE: ['MATCHING', 'ALLOCATED', 'IN_TRANSIT', 'EXPIRED'],
  MATCHING: ['AVAILABLE', 'ALLOCATED', 'EXPIRED'],
  ALLOCATED: ['AVAILABLE', 'IN_TRANSIT', 'EXPIRED'],
  IN_TRANSIT: ['DELIVERED', 'EXPIRED'],
  DELIVERED: ['TRANSPLANTED', 'EXPIRED'],
  TRANSPLANTED: [], // Terminal state
  EXPIRED: [],      // Terminal state
};

/**
 * Validates that the caller is an active, verified Hospital.
 */
async function getVerifiedActiveHub(userId: string): Promise<MedicalHub> {
  const hub = await findHubByUserId(userId);
  if (!hub) {
    const error: any = new Error('Medical facility profile not found for this account.');
    error.statusCode = 404;
    throw error;
  }

  if (hub.verification_status !== 'ACTIVE') {
    const error: any = new Error(
      `Access denied: Facility is not active (current status: '${hub.verification_status}'). Only verified facilities can log or manage harvested organs.`
    );
    error.statusCode = 403;
    throw error;
  }

  return hub;
}

/**
 * Fetches all supported organ types with medical viability windows.
 */
export async function getOrganTypes(): Promise<OrganTypeEntity[]> {
  return await listAllOrganTypes();
}

/**
 * Logs a harvested organ into the platform and calculates its cold ischemia expiration.
 */
export async function harvestOrgan(
  userId: string,
  dto: HarvestOrganDTO
): Promise<AvailableOrganEntity> {
  const hub = await getVerifiedActiveHub(userId);

  // 1. Validate organ type
  const organType = await findOrganTypeById(dto.organ_type_id);
  if (!organType) {
    const error: any = new Error(`Invalid organ_type_id: ${dto.organ_type_id}.`);
    error.statusCode = 400;
    throw error;
  }

  // 2. Validate blood group
  if (!VALID_BLOOD_GROUPS.includes(dto.blood_group)) {
    const error: any = new Error(`Invalid blood group: '${dto.blood_group}'.`);
    error.statusCode = 400;
    throw error;
  }

  // 3. Validate harvest timestamp
  const harvestTime = new Date(dto.harvested_at);
  if (isNaN(harvestTime.getTime())) {
    const error: any = new Error('Invalid harvested_at date string.');
    error.statusCode = 400;
    throw error;
  }

  // Cannot be in the future (with 1-minute clock drift tolerance)
  if (harvestTime.getTime() > Date.now() + 60 * 1000) {
    const error: any = new Error('Harvest timestamp cannot be in the future.');
    error.statusCode = 400;
    throw error;
  }

  // 4. Calculate cold ischemia expiration: harvestTime + max_viability_hours (or year 2099 if never_expires is set)
  let expiresAt: Date;
  if (dto.never_expires) {
    expiresAt = new Date('2099-12-31T23:59:59.000Z');
  } else {
    const viabilityMs = organType.max_viability_hours * 60 * 60 * 1000;
    expiresAt = new Date(harvestTime.getTime() + viabilityMs);

    if (expiresAt.getTime() <= Date.now()) {
      const error: any = new Error(
        `Medical viability window for ${organType.name} (${organType.max_viability_hours} hours) has already elapsed. This organ cannot be listed as available.`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  // 5. Check donor user if supplied
  let donorUserId: string | null = null;
  if (dto.donor_user_id) {
    const donor = await findUserById(dto.donor_user_id);
    if (!donor) {
      const error: any = new Error(`Donor user with ID '${dto.donor_user_id}' not found.`);
      error.statusCode = 404;
      throw error;
    }
    donorUserId = donor.id;
  }

  // 6. Insert organ record
  return await insertHarvestedOrgan({
    organ_type_id: organType.id,
    donor_user_id: donorUserId,
    harvesting_hub_id: hub.id,
    current_hub_id: hub.id,
    blood_group: dto.blood_group,
    harvested_at: harvestTime,
    expires_at: expiresAt,
    clinical_notes: dto.clinical_notes,
  });
}

/**
 * Retrieves details for a specific organ by ID.
 */
export async function getOrganById(organId: number): Promise<AvailableOrganEntity> {
  const organ = await findOrganById(organId);
  if (!organ) {
    const error: any = new Error(`Organ with ID ${organId} not found.`);
    error.statusCode = 404;
    throw error;
  }
  return organ;
}

/**
 * Lists organs across the platform with filtering.
 */
export async function getOrgans(filters: OrganQueryFilters): Promise<AvailableOrganEntity[]> {
  // Pre-run automatic expiration for overdue records
  await expireOverdueOrgans();
  return await listOrgans(filters);
}

/**
 * Updates an organ's status, location/custody hub, and clinical logs.
 */
export async function changeOrganStatus(
  userId: string,
  organId: number,
  dto: UpdateOrganStatusDTO
): Promise<AvailableOrganEntity> {
  const hub = await getVerifiedActiveHub(userId);

  const organ = await findOrganById(organId);
  if (!organ) {
    const error: any = new Error(`Organ with ID ${organId} not found.`);
    error.statusCode = 404;
    throw error;
  }

  // State machine transition validation
  const allowedNext = ALLOWED_TRANSITIONS[organ.status];
  if (!allowedNext || !allowedNext.includes(dto.status)) {
    const error: any = new Error(
      `Invalid status transition: Cannot transition organ from '${organ.status}' to '${dto.status}'. Allowed transitions: [${allowedNext.join(', ')}].`
    );
    error.statusCode = 400;
    throw error;
  }

  // If changing custody hub, ensure target hub exists
  if (dto.current_hub_id !== undefined) {
    const targetHub = await findHubById(dto.current_hub_id);
    if (!targetHub) {
      const error: any = new Error(`Target facility with ID ${dto.current_hub_id} not found.`);
      error.statusCode = 404;
      throw error;
    }
  }

  return await updateOrganStatus(
    organId,
    dto.status,
    dto.current_hub_id,
    dto.clinical_notes
  );
}

/**
 * Scheduled or manual maintenance job: updates status to EXPIRED for overdue organs.
 */
export async function runExpirationSweep(): Promise<{ expiredCount: number }> {
  const expiredCount = await expireOverdueOrgans();
  return { expiredCount };
}
