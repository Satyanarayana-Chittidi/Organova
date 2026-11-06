// ====================================================================
// BLOOD SUPPLY CHAIN & EMERGENCY REQUISITION TYPES
// ====================================================================

export type BloodGroup =
  | 'A+'
  | 'A-'
  | 'B+'
  | 'B-'
  | 'AB+'
  | 'AB-'
  | 'O+'
  | 'O-';

export type BloodComponent =
  | 'WHOLE_BLOOD'
  | 'PACKED_RBC'
  | 'PLATELETS'
  | 'PLASMA';

export type BloodUrgency =
  | 'CRITICAL'
  | 'URGENT'
  | 'ROUTINE';

export type BloodRequestStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'DONOR_COMMITTED'
  | 'DISPATCHED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';

// --------------------------------------------------------------------
// 1. DATABASE ENTITIES
// --------------------------------------------------------------------

export interface BloodInventoryItem {
  id: number;
  hub_id: number;
  blood_group: BloodGroup;
  component: BloodComponent;
  units_available: number;
  last_updated: Date;
  // Enriched hub details for search queries
  hub_name?: string;
  hub_type?: string;
  contact_phone?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

export interface BloodRequest {
  id: number;
  requester_user_id: string;
  destination_hub_id: number;
  target_hub_id?: number | null;
  fulfilling_hub_id: number | null;
  donor_user_id?: string | null;
  blood_group: BloodGroup;
  component: BloodComponent;
  units_requested: number;
  urgency: BloodUrgency;
  status: BloodRequestStatus;
  delivery_address?: string | null;
  patient_relationship?: string | null;
  patient_name?: string | null;
  hospital_bed_no?: string | null;
  created_at: Date;
  fulfilled_at: Date | null;
  // Enriched details
  requester_email?: string;
  destination_hub_name?: string;
  destination_hub_address?: string;
  destination_hub_city?: string;
  destination_hub_phone?: string;
  target_hub_name?: string;
  target_hub_phone?: string;
  fulfilling_hub_name?: string;
  fulfilling_hub_phone?: string;
  donor_name?: string;
  donor_phone?: string;
}

// --------------------------------------------------------------------
// 2. DATA TRANSFER OBJECTS (DTOs)
// --------------------------------------------------------------------

export interface SetInventoryDTO {
  blood_group: BloodGroup;
  component: BloodComponent;
  units_available: number;
}

export interface AdjustInventoryDTO {
  blood_group: BloodGroup;
  component: BloodComponent;
  delta_units: number; // positive to add stock, negative to consume
  linked_user_id?: string | null;
  linked_user_role?: 'DONOR' | 'RECIPIENT' | null;
  patient_name?: string | null;
  hospital_bed_no?: string | null;
}

export interface CreateBloodRequestDTO {
  destination_hub_id: number;
  target_hub_id?: number | null;
  blood_group: BloodGroup;
  component: BloodComponent;
  units_requested: number;
  urgency: BloodUrgency;
  delivery_address?: string;
  patient_relationship?: string;
  patient_name?: string;
  hospital_bed_no?: string;
}

export interface SearchStockFilters {
  blood_group?: BloodGroup;
  component?: BloodComponent;
  city?: string;
}

export interface BloodRequestFilters {
  blood_group?: BloodGroup;
  component?: BloodComponent;
  urgency?: BloodUrgency;
  status?: BloodRequestStatus;
}
