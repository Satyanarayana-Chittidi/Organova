import crypto from 'crypto';
import { hashPassword } from '../utils/hash';
import { findUserByEmail } from '../models/userModel';
import {
  searchRegisteredCitizens,
  masterRegisterCitizen,
  MasterRegisterCitizenDTO,
  RegisteredCitizenSearchResult,
} from '../models/citizenModel';
import {
  findHubById,
  findHubByUserId,
  findHubByLicense,
  createHubWithUser,
  updateHubVerificationStatus,
  listActiveHubs,
  listPendingHubs,
  getDistinctHubCities,
  getHubTransactionHistory,
  updateHubProfile,
} from '../models/hubModel';
import {
  RegisterHubDTO,
  HubQueryFilters,
  MedicalHub,
  VerificationStatus,
  HubType,
  HubTransactionHistory,
  UpdateHubProfileDTO,
} from '../types/hub';

/**
 * Validates registration DTO for medical institutions.
 */
function validateRegistrationInput(dto: RegisterHubDTO): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!dto.email || !emailRegex.test(dto.email.trim())) {
    const error: any = new Error('A valid institutional email address is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!dto.password || dto.password.length < 6) {
    const error: any = new Error('Password must be at least 6 characters long.');
    error.statusCode = 400;
    throw error;
  }

  // All registered medical facilities are consolidated under HOSPITAL
  dto.hub_type = 'HOSPITAL';

  if (!dto.name || dto.name.trim().length === 0) {
    const error: any = new Error('Facility name is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!dto.license_number || dto.license_number.trim().length === 0) {
    const error: any = new Error('Medical license / accreditation number is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!dto.contact_phone || dto.contact_phone.trim().length === 0) {
    const error: any = new Error('Official contact phone number is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!dto.address_line || !dto.city || !dto.state || !dto.pincode) {
    const error: any = new Error('Complete facility address (address line, city, state, pincode) is required.');
    error.statusCode = 400;
    throw error;
  }

  if (
    typeof dto.latitude !== 'number' ||
    typeof dto.longitude !== 'number' ||
    dto.latitude < -90 ||
    dto.latitude > 90 ||
    dto.longitude < -180 ||
    dto.longitude > 180
  ) {
    const error: any = new Error('Valid geographic coordinates (latitude between -90 and 90, longitude between -180 and 180) are required.');
    error.statusCode = 400;
    throw error;
  }
}

/**
 * Registers a new hospital facility
 * in an initial PENDING_APPROVAL state.
 */
export async function registerHub(dto: RegisterHubDTO): Promise<{
  message: string;
  hub: MedicalHub;
}> {
  validateRegistrationInput(dto);

  const normalizedEmail = dto.email.toLowerCase().trim();
  const normalizedLicense = dto.license_number.trim().toUpperCase();

  // 1. Ensure email is not already registered
  const existingUser = await findUserByEmail(normalizedEmail);
  if (existingUser) {
    const error: any = new Error('An account with this email address already exists.');
    error.statusCode = 409;
    throw error;
  }

  // 2. Ensure facility license is unique
  const existingHub = await findHubByLicense(normalizedLicense);
  if (existingHub) {
    const error: any = new Error(
      `A facility with license number '${normalizedLicense}' is already registered.`
    );
    error.statusCode = 409;
    throw error;
  }

  // 3. Hash institutional account password
  const passwordHash = await hashPassword(dto.password);
  const userId = crypto.randomUUID();

  // 4. Atomically persist user & medical hub profile
  const hub = await createHubWithUser(
    userId,
    {
      ...dto,
      email: normalizedEmail,
      license_number: normalizedLicense,
    },
    passwordHash
  );

  return {
    message: 'Institutional registration submitted successfully. Your facility dossier is pending administrative verification.',
    hub,
  };
}

/**
 * Retrieves the institutional profile for the currently authenticated facility user.
 */
export async function getHubByUserId(userId: string): Promise<MedicalHub> {
  const hub = await findHubByUserId(userId);
  if (!hub) {
    const error: any = new Error('Medical facility profile not found for this account.');
    error.statusCode = 404;
    throw error;
  }
  return hub;
}

/**
 * Retrieves a single medical facility by its primary key ID.
 */
export async function getHubById(id: number): Promise<MedicalHub> {
  const hub = await findHubById(id);
  if (!hub) {
    const error: any = new Error(`Medical facility with ID ${id} not found.`);
    error.statusCode = 404;
    throw error;
  }
  return hub;
}

/**
 * Public directory search: Returns only ACTIVE (admin-verified) facilities.
 */
export async function listPublicHubs(filters: HubQueryFilters): Promise<MedicalHub[]> {
  return await listActiveHubs(filters);
}

/**
 * Admin workflow: Lists all facilities pending verification.
 */
export async function listPendingHubsForAdmin(): Promise<MedicalHub[]> {
  return await listPendingHubs();
}

/**
 * Admin workflow: Audits and updates a facility's verification status
 * (e.g. ACTIVE, REJECTED, SUSPENDED).
 */
export async function verifyHubStatus(
  hubId: number,
  status: 'ACTIVE' | 'REJECTED' | 'SUSPENDED',
  adminId: string
): Promise<{ message: string; hub: MedicalHub }> {
  const validStatuses = ['ACTIVE', 'REJECTED', 'SUSPENDED'];
  if (!validStatuses.includes(status)) {
    const error: any = new Error("Invalid status. Must be 'ACTIVE', 'REJECTED', or 'SUSPENDED'.");
    error.statusCode = 400;
    throw error;
  }

  const hub = await findHubById(hubId);
  if (!hub) {
    const error: any = new Error(`Medical facility with ID ${hubId} not found.`);
    error.statusCode = 404;
    throw error;
  }

  await updateHubVerificationStatus(hubId, status, adminId);
  const updatedHub = await findHubById(hubId);

  return {
    message: `Facility '${hub.name}' status updated to ${status}.`,
    hub: updatedHub!,
  };
}

/**
 * Returns distinct cities where active hospitals are registered.
 */
export async function getAvailableHubCities(): Promise<string[]> {
  return await getDistinctHubCities();
}

/**
 * Searches registered citizen accounts by name, email, or phone.
 * Restricts access to verified medical facilities.
 */
export async function searchCitizensService(
  query: string
): Promise<RegisteredCitizenSearchResult[]> {
  return await searchRegisteredCitizens(query);
}

/**
 * Hospital Master Control: Creates a citizen account with pre-verified status and auto-generated temp password.
 */
export async function masterRegisterCitizenService(
  callerUserId: string,
  dto: MasterRegisterCitizenDTO
): Promise<{ user: any; tempPassword: string; message: string }> {
  const hub = await findHubByUserId(callerUserId);
  if (!hub) {
    const error: any = new Error('Medical facility profile not found.');
    error.statusCode = 404;
    throw error;
  }

  if (hub.verification_status !== 'ACTIVE') {
    const error: any = new Error('Only active, verified medical facilities can register citizens via Master Control.');
    error.statusCode = 403;
    throw error;
  }

  if (!dto.full_name || !dto.email || !dto.date_of_birth || !dto.blood_group) {
    const error: any = new Error('Full Name, Email, Date of Birth, and Blood Group are required.');
    error.statusCode = 400;
    throw error;
  }

  const result = await masterRegisterCitizen(hub, dto);
  return {
    message: `Citizen account for ${dto.full_name} created successfully.`,
    user: result.user,
    tempPassword: result.tempPassword,
  };
}

/**
 * Retrieves the full operational and clinical ledger history for the calling facility.
 */
export async function getHubHistoryService(userId: string): Promise<HubTransactionHistory> {
  const hub = await findHubByUserId(userId);
  if (!hub) {
    const error: any = new Error('Medical facility profile not found.');
    error.statusCode = 404;
    throw error;
  }
  return await getHubTransactionHistory(hub.id);
}

/**
 * Updates facility profile details.
 */
export async function updateHubProfileService(
  userId: string,
  dto: UpdateHubProfileDTO
): Promise<{ message: string; hub: MedicalHub }> {
  const hub = await findHubByUserId(userId);
  if (!hub) {
    const error: any = new Error('Medical facility profile not found.');
    error.statusCode = 404;
    throw error;
  }

  const updated = await updateHubProfile(hub.id, dto);
  return {
    message: 'Facility profile updated successfully.',
    hub: updated,
  };
}
