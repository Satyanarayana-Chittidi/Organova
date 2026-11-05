export type HubType = 'HOSPITAL';
export type VerificationStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';
export interface MedicalHub {
    id: number;
    user_id: string;
    hub_type: HubType;
    name: string;
    license_number: string;
    contact_phone: string;
    address_line: string;
    city: string;
    state: string;
    pincode: string;
    latitude: number;
    longitude: number;
    verification_status: VerificationStatus;
    verified_by_admin_id: string | null;
    verified_at: Date | null;
    created_at: Date;
    email?: string;
}
export interface RegisterHubDTO {
    email: string;
    password: string;
    hub_type: HubType;
    name: string;
    license_number: string;
    contact_phone: string;
    address_line: string;
    city: string;
    state: string;
    pincode: string;
    latitude: number;
    longitude: number;
}
export interface VerifyHubDTO {
    status: 'ACTIVE' | 'REJECTED' | 'SUSPENDED';
}
export interface HubQueryFilters {
    hub_type?: HubType;
    city?: string;
    search?: string;
}
export interface UpdateHubProfileDTO {
    name?: string;
    contact_phone?: string;
    address_line?: string;
    city?: string;
    state?: string;
    pincode?: string;
    latitude?: number;
    longitude?: number;
}
export interface HubTransactionHistory {
    facility: MedicalHub;
    stats: {
        totalHarvests: number;
        activeHarvests: number;
        totalTransplants: number;
        waitlistPatients: number;
        bloodTransactions: number;
    };
    harvests: Array<{
        id: number;
        organ_type_id: number;
        organ_name: string;
        organ_code: string;
        organ_category: string;
        blood_group: string;
        harvested_at: string;
        expires_at: string;
        status: string;
        clinical_notes?: string | null;
        donor_name: string;
        donor_phone?: string | null;
        recipient_hospital_name?: string | null;
        match_status?: string | null;
    }>;
    transplants: Array<{
        match_id: number;
        organ_id: number;
        request_id: number;
        match_score: number;
        match_status: string;
        offered_at: string;
        response_deadline: string;
        responded_at?: string | null;
        organ_name: string;
        organ_code: string;
        organ_category: string;
        blood_group: string;
        harvested_at: string;
        harvesting_hub_name: string;
        harvesting_hub_city?: string | null;
        attending_hub_name?: string | null;
        recipient_name: string;
        urgency_tier: string;
        request_status: string;
    }>;
    waitlist: Array<{
        id: number;
        recipient_user_id: string;
        recipient_name: string;
        recipient_phone?: string | null;
        organ_name: string;
        blood_group: string;
        urgency_tier: string;
        status: string;
        medical_summary: string;
        created_at: string;
        days_waiting: number;
    }>;
    bloodTransactions: Array<{
        id: number;
        blood_group: string;
        component: string;
        units_requested: number;
        urgency: string;
        status: string;
        patient_relationship?: string | null;
        patient_name?: string | null;
        hospital_bed_no?: string | null;
        created_at: string;
        fulfilled_at?: string | null;
        destination_hub_name: string;
        fulfilling_hub_name?: string | null;
        donor_user_id?: string | null;
        requester_user_id?: string | null;
        donor_name?: string | null;
        donor_phone?: string | null;
        recipient_name?: string | null;
        recipient_phone?: string | null;
    }>;
}
