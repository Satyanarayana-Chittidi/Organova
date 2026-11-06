import { findUserById } from '../models/userModel';
import {
  findCitizenProfileByUserId,
  upsertCitizenProfile,
  updateCitizenAvatar,
  getCitizenDonationHistory,
} from '../models/citizenModel';
import {
  CitizenProfile,
  UpsertCitizenProfileDTO,
  BloodGroup,
  CitizenDonationHistory,
} from '../types/citizen';

const VALID_BLOOD_GROUPS: BloodGroup[] = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
];

/**
 * Validates medical and demographic data before saving/updating a citizen profile.
 */
export async function saveCitizenProfile(
  userId: string,
  dto: UpsertCitizenProfileDTO
): Promise<CitizenProfile> {
  // 1. Verify user exists
  const user = await findUserById(userId);
  if (!user) {
    const error: any = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  // 2. Ensure only standard citizen accounts ('USER') can create this profile
  if (user.role !== 'USER') {
    const error: any = new Error('Access denied. Only citizen accounts can create a citizen profile.');
    error.statusCode = 403;
    throw error;
  }

  // 3. Validate Blood Group serology
  if (!VALID_BLOOD_GROUPS.includes(dto.blood_group)) {
    const error: any = new Error(
      `Invalid blood group. Permitted values: ${VALID_BLOOD_GROUPS.join(', ')}`
    );
    error.statusCode = 400;
    throw error;
  }

  // 4. Validate Date of Birth (must be a valid date in the past)
  const dob = new Date(dto.date_of_birth);
  if (isNaN(dob.getTime()) || dob > new Date()) {
    const error: any = new Error('Invalid date of birth. Must be a valid date in the past (YYYY-MM-DD).');
    error.statusCode = 400;
    throw error;
  }

  // 5. Validate Required Fields
  if (!dto.full_name?.trim() || !dto.phone_number?.trim()) {
    const error: any = new Error('Full name and primary phone number are mandatory.');
    error.statusCode = 400;
    throw error;
  }

  if (!dto.emergency_contact_name?.trim() || !dto.emergency_contact_phone?.trim()) {
    const error: any = new Error('Emergency next-of-kin contact name and phone are mandatory.');
    error.statusCode = 400;
    throw error;
  }

  if (!dto.address_line?.trim() || !dto.city?.trim() || !dto.state?.trim() || !dto.pincode?.trim()) {
    const error: any = new Error('Complete residential address (Street, City, State, Pincode) is mandatory.');
    error.statusCode = 400;
    throw error;
  }

  // 6. Persist to MySQL via Model
  return upsertCitizenProfile(userId, dto);
}

/**
 * Retrieves the citizen profile and checks if progressive onboarding is completed.
 */
export async function getCitizenProfile(userId: string): Promise<{
  isProfileComplete: boolean;
  profile: CitizenProfile | null;
}> {
  const profile = await findCitizenProfileByUserId(userId);
  return {
    isProfileComplete: !!profile,
    profile,
  };
}

/**
 * Updates avatar image URL for a citizen.
 */
export async function setAvatar(
  userId: string,
  avatarUrl: string | null
): Promise<void> {
  const user = await findUserById(userId);
  if (!user) {
    const error: any = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }
  await updateCitizenAvatar(userId, avatarUrl);
}

/**
 * Retrieves the comprehensive lifetime donation history for the authenticated citizen.
 */
export async function getDonationHistory(userId: string): Promise<CitizenDonationHistory> {
  const user = await findUserById(userId);
  if (!user) {
    const error: any = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }
  return getCitizenDonationHistory(userId);
}
