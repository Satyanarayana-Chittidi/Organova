import { findCitizenProfileByUserId } from '../models/citizenModel';
import {
  getAllOrganTypes,
  findOrganTypeByCode,
  getActivePledgesByUserId,
  upsertPledge,
  revokePledge,
  revokePledgesNotInList,
  revokeAllPledgesByUserId,
} from '../models/pledgeModel';
import {
  OrganType,
  DonorPledge,
  CreatePledgesDTO,
  DonorCardResponse,
  ConsentType,
} from '../types/pledge';

/**
 * Returns the reference catalog of all approved organ and donation types.
 */
export async function getOrganTypesCatalog(): Promise<OrganType[]> {
  return getAllOrganTypes();
}

/**
 * Submits citizen pledges with medical and clinical validation.
 * Enforces that living donation is only permitted on clinically valid organs.
 * Deselected organs are automatically revoked in the database.
 */
export async function submitPledges(
  userId: string,
  dto: CreatePledgesDTO
): Promise<{ message: string; activePledges: DonorPledge[] }> {
  // 1. Verify citizen profile exists (donor card requires name, blood group, emergency contact)
  const profile = await findCitizenProfileByUserId(userId);
  if (!profile) {
    const error: any = new Error(
      'Incomplete Profile: Please complete your Citizen & Medical Profile before pledging organs.'
    );
    error.statusCode = 400;
    throw error;
  }

  // If user unchecks everything and submits, revoke all pledges cleanly
  if (!dto.pledges || dto.pledges.length === 0) {
    await revokeAllPledgesByUserId(userId);
    return {
      message: 'All organ donation pledges have been revoked.',
      activePledges: [],
    };
  }

  const submittedOrganTypeIds: number[] = [];

  // 2. Validate and execute each pledge
  for (const item of dto.pledges) {
    let organType: OrganType | null = null;
    if (item.organ_code) {
      organType = await findOrganTypeByCode(item.organ_code);
    } else if ((item as any).organ_type_id) {
      const allTypes = await getAllOrganTypes();
      organType = allTypes.find((t) => t.id === Number((item as any).organ_type_id)) || null;
    }

    if (!organType) {
      const error: any = new Error(`Unrecognized organ: ${(item as any).organ_type_id || item.organ_code}`);
      error.statusCode = 400;
      throw error;
    }

    // Normalize consent type
    let normalizedConsent: ConsentType = 'DECEASED_ONLY';
    const cType = String(item.consent_type).toUpperCase();
    if (cType === 'LIVING' || cType === 'LIVING_ALLOWED') {
      normalizedConsent = 'LIVING_ALLOWED';
    } else {
      normalizedConsent = 'DECEASED_ONLY';
    }

    // Clinical Guardrail: Check living donation eligibility
    if (normalizedConsent === 'LIVING_ALLOWED' && !organType.allow_living_donor) {
      const error: any = new Error(
        `Clinical Violation: Living donation is not permissible for ${organType.name}. Only post-mortem (deceased) donation is allowed.`
      );
      error.statusCode = 400;
      throw error;
    }

    // Save or reactivate pledge
    await upsertPledge(userId, organType.id, normalizedConsent);
    submittedOrganTypeIds.push(organType.id);
  }

  // 3. Revoke any previously active pledges that were deselected
  await revokePledgesNotInList(userId, submittedOrganTypeIds);

  const activePledges = await getActivePledgesByUserId(userId);

  return {
    message: 'Organ donation pledges recorded successfully. Thank you for your commitment to saving lives.',
    activePledges,
  };
}

/**
 * Retrieves all active pledges for the authenticated citizen.
 */
export async function getUserPledges(userId: string): Promise<{
  isDonor: boolean;
  totalPledges: number;
  pledges: DonorPledge[];
}> {
  const pledges = await getActivePledgesByUserId(userId);
  return {
    isDonor: pledges.length > 0,
    totalPledges: pledges.length,
    pledges,
  };
}

/**
 * Revokes a specific pledge.
 */
export async function revokeUserPledge(
  userId: string,
  pledgeId: number
): Promise<{ message: string }> {
  const success = await revokePledge(userId, pledgeId);
  if (!success) {
    const error: any = new Error('Pledge not found or already revoked.');
    error.statusCode = 404;
    throw error;
  }
  return { message: 'Pledge has been revoked successfully.' };
}

/**
 * Revokes all active pledges for the authenticated citizen.
 */
export async function revokeAllUserPledges(
  userId: string
): Promise<{ message: string }> {
  await revokeAllPledgesByUserId(userId);
  return { message: 'All organ donation pledges have been successfully revoked.' };
}

/**
 * Generates the Digital Donor Card combining citizen details and active pledges.
 */
export async function generateDonorCard(userId: string): Promise<DonorCardResponse> {
  const profile = await findCitizenProfileByUserId(userId);
  if (!profile) {
    const error: any = new Error('Citizen profile not found.');
    error.statusCode = 404;
    error.code = 'PROFILE_NOT_FOUND';
    throw error;
  }

  const pledges = await getActivePledgesByUserId(userId);
  if (pledges.length === 0) {
    const error: any = new Error(
      'No active pledges found. Please pledge at least one organ to generate your Digital Donor Card.'
    );
    error.statusCode = 400;
    error.code = 'NO_PLEDGES';
    throw error;
  }

  return {
    donorRegistryId: `ODP-${userId.substring(0, 8).toUpperCase()}`,
    donor_card_id: `ODP-${userId.substring(0, 8).toUpperCase()}`,
    fullName: profile.full_name,
    full_name: profile.full_name,
    bloodGroup: profile.blood_group,
    blood_group: profile.blood_group,
    gender: profile.gender,
    dateOfBirth: profile.date_of_birth,
    date_of_birth: profile.date_of_birth,
    emergencyContact: {
      name: profile.emergency_contact_name,
      phone: profile.emergency_contact_phone,
    },
    emergency_contact_name: profile.emergency_contact_name,
    emergency_contact_phone: profile.emergency_contact_phone,
    city: profile.city,
    state: profile.state,
    avatar_url: profile.avatar_url || null,
    avatarUrl: profile.avatar_url || null,
    pledges: pledges.map((p) => ({
      organCode: p.organ_code!,
      organ_code: p.organ_code!,
      organName: p.organ_name!,
      organ_name: p.organ_name!,
      category: p.category!,
      consentType: p.consent_type,
      consent_type: p.consent_type,
      pledgeDate: p.pledge_date,
    })),
    cardGeneratedAt: new Date(),
  };
}
