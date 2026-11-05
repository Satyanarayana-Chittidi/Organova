import { BloodGroup } from './blood';
import { OrganCode } from './organ';
export type UrgencyTier = 'TIER_1_EMERGENCY' | 'TIER_2_URGENT' | 'TIER_3_ROUTINE';
export type TransplantRequestStatus = 'PENDING_VERIFICATION' | 'WAITING_LIST' | 'MATCH_OFFERED' | 'ACCEPTED' | 'SURGERY_SCHEDULED' | 'FULFILLED' | 'CANCELLED';
export type MatchStatus = 'PROPOSED' | 'ACCEPTED' | 'DECLINED' | 'COMPLETED';
export interface TransplantRequestEntity {
    id: number;
    recipient_user_id: string;
    attending_hub_id: number;
    organ_type_id: number;
    blood_group: BloodGroup;
    urgency_tier: UrgencyTier;
    medical_summary: string;
    status: TransplantRequestStatus;
    verified_at: Date | null;
    created_at: Date;
    recipient_email?: string;
    recipient_name?: string;
    attending_hub_name?: string;
    attending_hub_city?: string;
    attending_hub_latitude?: number;
    attending_hub_longitude?: number;
    organ_name?: string;
    organ_code?: OrganCode;
    days_waiting?: number;
    active_organ_id?: number;
    active_match_id?: number;
    active_response_deadline?: Date | string;
    active_match_score?: number;
}
export interface MatchEntity {
    id: number;
    organ_id: number;
    request_id: number;
    match_score: number;
    status: MatchStatus;
    offered_at: Date;
    response_deadline: Date;
    responded_at: Date | null;
    organ_code?: OrganCode;
    organ_name?: string;
    organ_blood_group?: BloodGroup;
    harvesting_hub_id?: number;
    harvesting_hub_name?: string;
    recipient_user_id?: string;
    recipient_name?: string;
    recipient_blood_group?: BloodGroup;
    attending_hub_id?: number;
    attending_hub_name?: string;
    remaining_seconds?: number;
    is_expired?: boolean;
}
export interface CandidateScoreBreakdown {
    requestId: number;
    recipientUserId: string;
    attendingHubId: number;
    attendingHubName?: string;
    attendingHubCity?: string;
    recipientName: string;
    bloodGroup: BloodGroup;
    urgencyTier: UrgencyTier;
    distanceKm: number;
    daysWaiting: number;
    urgencyScore: number;
    waitTimeScore: number;
    proximityScore: number;
    hlaAboScore: number;
    totalScore: number;
}
export interface CreateTransplantRequestDTO {
    recipient_user_id?: string;
    patient_name?: string;
    patient_email?: string;
    patient_phone?: string;
    patient_gender?: 'MALE' | 'FEMALE' | 'OTHER';
    patient_dob?: string;
    organ_type_id: number;
    blood_group: BloodGroup;
    urgency_tier: UrgencyTier;
    medical_summary: string;
}
export interface TransplantQueryFilters {
    organ_type_id?: number;
    blood_group?: BloodGroup;
    urgency_tier?: UrgencyTier;
    status?: TransplantRequestStatus;
    attending_hub_id?: number;
}
