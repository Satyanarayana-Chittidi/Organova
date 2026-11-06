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

export async function saveCitizenProfile(
  userId: string,
  dto: UpsertCitizenProfileDTO
): Promise<CitizenProfile> {
  const user = await findUserById(userId);
  if (!user) {
    const error: any = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  if (user.role !== 'USER') {
    const error: any = new Error('Access denied. Only citizen accounts can create a citizen profile.');
    error.statusCode = 403;
    throw error;
  }

  if (!VALID_BLOOD_GROUPS.includes(dto.blood_group)) {
    const error: any = new Error(
      `Invalid blood group. Permitted values: ${VALID_BLOOD_GROUPS.join(', ')}`
    );
    error.statusCode = 400;
    throw error;
  }

  const dob = new Date(dto.date_of_birth);
  if (isNaN(dob.getTime()) || dob > new Date()) {
    const error: any = new Error('Invalid date of birth. Must be a valid date in the past (YYYY-MM-DD).');
    error.statusCode = 400;
    throw error;
  }

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

  return upsertCitizenProfile(userId, dto);
}

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

export async function getDonationHistory(userId: string): Promise<CitizenDonationHistory> {
  const user = await findUserById(userId);
  if (!user) {
    const error: any = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }
  return getCitizenDonationHistory(userId);
}
