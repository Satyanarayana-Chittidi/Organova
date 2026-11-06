// ====================================================================
// ORGAN HARVEST & COLD ISCHEMIA VIABILITY TYPES
// ====================================================================

import { BloodGroup } from './blood';

export type OrganCode =
  | 'HEART'
  | 'KIDNEY'
  | 'LIVER'
  | 'LUNG'
  | 'PANCREAS'
  | 'CORNEA'
  | 'BONE_MARROW'
  | 'BLOOD';

export type OrganCategory = 'SOLID_ORGAN' | 'TISSUE' | 'CELL_FLUID';

export type OrganStatus =
  | 'AVAILABLE'
  | 'MATCHING'
  | 'ALLOCATED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'TRANSPLANTED'
  | 'EXPIRED';

// --------------------------------------------------------------------
// 1. DATABASE ENTITIES
// --------------------------------------------------------------------

export interface OrganTypeEntity {
  id: number;
  code: OrganCode;
  name: string;
  category: OrganCategory;
  max_viability_hours: number;
  allow_living_donor: boolean;
}

export interface AvailableOrganEntity {
  id: number;
  organ_type_id: number;
  donor_user_id: string | null;
  harvesting_hub_id: number;
  current_hub_id: number;
  blood_group: BloodGroup;
  harvested_at: Date;
  expires_at: Date;
  status: OrganStatus;
  clinical_notes: string | null;
  created_at: Date;

  // Enriched clinical and facility fields from joins
  organ_name?: string;
  organ_code?: OrganCode;
  organ_category?: OrganCategory;
  max_viability_hours?: number;
  harvesting_hub_name?: string;
  harvesting_hub_city?: string;
  current_hub_name?: string;
  current_hub_city?: string;
  current_hub_latitude?: number;
  current_hub_longitude?: number;
  donor_email?: string;
  remaining_minutes?: number;
  is_viable?: boolean;
}

// --------------------------------------------------------------------
// 2. DATA TRANSFER OBJECTS (DTOs)
// --------------------------------------------------------------------

export interface HarvestOrganDTO {
  organ_type_id: number;
  donor_user_id?: string;
  blood_group: BloodGroup;
  harvested_at: string; // ISO 8601 string
  clinical_notes?: string;
  never_expires?: boolean;
}

export interface UpdateOrganStatusDTO {
  status: OrganStatus;
  current_hub_id?: number;
  clinical_notes?: string;
}

export interface OrganQueryFilters {
  organ_type_id?: number;
  blood_group?: BloodGroup;
  status?: OrganStatus;
  only_viable?: boolean;
  city?: string;
}
