// ====================================================================
// DONOR PLEDGE & ORGAN CATALOG TYPES
// ====================================================================

export type ConsentType = 'DECEASED_ONLY' | 'LIVING_ALLOWED';
export type PledgeStatus = 'ACTIVE' | 'REVOKED';

export type OrganTypeCode =
  | 'HEART'
  | 'KIDNEY'
  | 'LIVER'
  | 'LUNG'
  | 'PANCREAS'
  | 'CORNEA'
  | 'BONE_MARROW'
  | 'BLOOD';

export type OrganCategory = 'SOLID_ORGAN' | 'TISSUE' | 'CELL_FLUID';

// --------------------------------------------------------------------
// 1. ORGAN TYPE REFERENCE ENTITY
// --------------------------------------------------------------------
export interface OrganType {
  id: number;
  code: OrganTypeCode;
  name: string;
  category: OrganCategory;
  max_viability_hours: number;
  allow_living_donor: boolean;
}

// --------------------------------------------------------------------
// 2. DONOR PLEDGE DATABASE ENTITY
// --------------------------------------------------------------------
export interface DonorPledge {
  id: number;
  user_id: string;
  organ_type_id: number;
  consent_type: ConsentType;
  pledge_date: Date;
  status: PledgeStatus;
  // Enriched fields from JOIN with organ_types
  organ_code?: OrganTypeCode;
  organ_name?: string;
  category?: OrganCategory;
  allow_living_donor?: boolean;
}

// --------------------------------------------------------------------
// 3. DATA TRANSFER OBJECTS (DTOs)
// --------------------------------------------------------------------

// Single organ item inside a pledge submission
export interface PledgeItemDTO {
  organ_code: OrganTypeCode;
  consent_type: ConsentType;
}

// Payload for pledging (can submit one or multiple organs simultaneously)
export interface CreatePledgesDTO {
  pledges: PledgeItemDTO[];
}

// --------------------------------------------------------------------
// 4. DIGITAL DONOR CARD
// Structured representation of the official digital pledge card
// --------------------------------------------------------------------
export interface DonorCardResponse {
  donorRegistryId: string;
  donor_card_id?: string;
  fullName: string;
  full_name?: string;
  bloodGroup: string;
  blood_group?: string;
  gender: string;
  dateOfBirth?: string | Date;
  date_of_birth?: string | Date;
  emergencyContact: {
    name: string;
    phone: string;
  };
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  city: string;
  state: string;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  pledges: {
    organCode: OrganTypeCode;
    organ_code?: OrganTypeCode;
    organName: string;
    organ_name?: string;
    category: OrganCategory;
    consentType: ConsentType;
    consent_type?: ConsentType;
    pledgeDate: Date;
  }[];
  cardGeneratedAt: Date;
}
