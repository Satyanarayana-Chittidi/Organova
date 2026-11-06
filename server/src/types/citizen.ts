// ====================================================================
// CITIZEN PROFILE TYPES
// ====================================================================

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export type BloodGroup =
  | 'A+'
  | 'A-'
  | 'B+'
  | 'B-'
  | 'AB+'
  | 'AB-'
  | 'O+'
  | 'O-';

// --------------------------------------------------------------------
// 1. DATABASE ENTITY
// Represents the full citizen profile row in MySQL
// --------------------------------------------------------------------
export interface CitizenProfile {
  id: number;
  user_id: string;
  full_name: string;
  date_of_birth: string | Date;
  gender: Gender;
  blood_group: BloodGroup;
  phone_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  address_line: string;
  city: string;
  state: string;
  pincode: string;
  avatar_url?: string | null;
  created_at: Date;
}

// --------------------------------------------------------------------
// 2. DATA TRANSFER OBJECT (DTO)
// Payload submitted by a citizen when completing or updating their profile
// --------------------------------------------------------------------
export interface UpsertCitizenProfileDTO {
  full_name: string;
  date_of_birth: string; // YYYY-MM-DD format
  gender: Gender;
  blood_group: BloodGroup;
  phone_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  address_line: string;
  city: string;
  state: string;
  pincode: string;
  avatar_url?: string | null;
}

// --------------------------------------------------------------------
// 3. DONATION TRANSACTION HISTORY
// --------------------------------------------------------------------
export interface CitizenBloodDonation {
  id: number;
  blood_group: BloodGroup;
  component: string;
  units_requested: number;
  urgency: string;
  status: string;
  created_at: string | Date;
  fulfilled_at?: string | Date | null;
  receiving_hospital_name: string;
  receiving_hospital_city?: string;
  receiving_hospital_address?: string;
  receiving_hospital_phone?: string;
  fulfilling_hospital_name?: string | null;
  fulfilling_hospital_city?: string | null;
  patient_relationship?: string | null;
  patient_name?: string | null;
  hospital_bed_no?: string | null;
}

export interface CitizenBloodRequest {
  id: number;
  blood_group: BloodGroup;
  component: string;
  units_requested: number;
  urgency: string;
  status: string;
  patient_relationship?: string | null;
  patient_name?: string | null;
  hospital_bed_no?: string | null;
  created_at: string | Date;
  fulfilled_at?: string | Date | null;
  destination_hub_name: string;
  destination_hub_city?: string;
  destination_hub_address?: string;
  destination_hub_phone?: string;
  fulfilling_hub_name?: string | null;
  donor_name?: string | null;
  donor_phone?: string | null;
}

export interface CitizenOrganDonation {
  id: number;
  blood_group: BloodGroup;
  harvested_at: string | Date;
  expires_at: string | Date;
  status: string;
  clinical_notes?: string | null;
  organ_name: string;
  organ_code: string;
  organ_category: string;
  harvesting_hub_name: string;
  harvesting_hub_city?: string;
  harvesting_hub_address?: string;
  harvesting_hub_phone?: string;
  recipient_hospital_name?: string | null;
  match_status?: string | null;
}

export interface CitizenOrganRequest {
  id: number;
  organ_name: string;
  organ_code: string;
  blood_group: BloodGroup;
  urgency_tier: string;
  status: string;
  medical_summary?: string | null;
  created_at: string | Date;
  verified_at?: string | Date | null;
  attending_hub_name: string;
  attending_hub_city?: string;
  attending_hub_address?: string;
}

export interface CitizenDonationHistory {
  bloodDonations: CitizenBloodDonation[];
  bloodRequests: CitizenBloodRequest[];
  organDonations: CitizenOrganDonation[];
  organRequests: CitizenOrganRequest[];
  stats: {
    totalBloodDonations: number;
    completedBloodDonations: number;
    totalBloodUnitsDonated: number;
    totalBloodRequested: number;
    totalOrgansDonated: number;
    organsTransplanted: number;
    totalOrgansRequested: number;
    activePledges: number;
    estimatedLivesSaved: number;
  };
}
