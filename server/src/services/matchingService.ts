import crypto from 'crypto';
import pool from '../config/database';
import { findUserByEmail } from '../models/userModel';
import { calculateHaversineDistanceKm } from '../utils/geo';
import { findOrganById } from '../models/organModel';
import { findHubByUserId } from '../models/hubModel';
import {
  emitMatchOfferProposed,
  emitMatchOfferAccepted,
} from '../config/socket';
import {
  createTransplantRequest,
  findTransplantRequestById,
  listTransplantRequests,
  listRequestsByRecipient,
  getActiveWaitlistForOrgan,
  getDeclinedRequestIdsForOrgan,
  getDeclinedMatchesForOrgan,
  findMatchById,
  findActiveMatchForOrgan,
  createMatchOffer,
  acceptMatch,
  declineMatch,
  findExpiredProposedMatches,
} from '../models/transplantModel';
import {
  TransplantRequestEntity,
  MatchEntity,
  CreateTransplantRequestDTO,
  TransplantQueryFilters,
  CandidateScoreBreakdown,
} from '../types/transplant';
import { BloodGroup } from '../types/blood';
import { MedicalHub } from '../types/hub';

// ====================================================================
// 1. MEDICAL COMPATIBILITY & SCORING ALGORITHM
// ====================================================================

/**
 * Validates ABO blood compatibility for solid organ transplantation.
 */
export function isBloodCompatible(donorBlood: BloodGroup, recipientBlood: BloodGroup): boolean {
  const donorType = donorBlood.replace(/[+-]/g, '');
  const recipientType = recipientBlood.replace(/[+-]/g, '');

  if (donorType === 'O') return true; // Universal donor
  if (donorType === 'A' && (recipientType === 'A' || recipientType === 'AB')) return true;
  if (donorType === 'B' && (recipientType === 'B' || recipientType === 'AB')) return true;
  if (donorType === 'AB' && recipientType === 'AB') return true;

  return false;
}

/**
 * Computes multi-factor score for an organ-recipient pair:
 * S = 0.35 * Urgency + 0.25 * WaitTime + 0.20 * Proximity + 0.20 * HLA/ABO
 */
export function calculateMatchScore(
  organ: any,
  candidate: TransplantRequestEntity
): CandidateScoreBreakdown {
  // 1. Clinical Urgency Score (Weight: 0.35)
  let urgencyRaw = 25;
  if (candidate.urgency_tier === 'TIER_1_EMERGENCY') urgencyRaw = 100;
  else if (candidate.urgency_tier === 'TIER_2_URGENT') urgencyRaw = 60;

  // 2. Wait Time Score (Weight: 0.25)
  const days = candidate.days_waiting || 0;
  const waitTimeRaw = Math.min(100, Math.round(days * 0.5));

  // 3. Geographic Proximity Score (Weight: 0.20)
  let distanceKm = 0;
  if (
    organ.current_hub_latitude &&
    organ.current_hub_longitude &&
    candidate.attending_hub_latitude &&
    candidate.attending_hub_longitude
  ) {
    distanceKm = calculateHaversineDistanceKm(
      organ.current_hub_latitude,
      organ.current_hub_longitude,
      candidate.attending_hub_latitude,
      candidate.attending_hub_longitude
    );
  }

  let proximityRaw = 10;
  if (distanceKm <= 50) proximityRaw = 100;
  else if (distanceKm <= 200) proximityRaw = 80;
  else if (distanceKm <= 500) proximityRaw = 50;
  else if (distanceKm <= 1000) proximityRaw = 25;

  // 4. ABO / Histocompatibility Score (Weight: 0.20)
  const isExactMatch = organ.blood_group === candidate.blood_group;
  const hlaAboRaw = isExactMatch ? 100 : 70;

  // Weighted total: S in [0, 100]
  const total =
    0.35 * urgencyRaw +
    0.25 * waitTimeRaw +
    0.20 * proximityRaw +
    0.20 * hlaAboRaw;

  return {
    requestId: candidate.id,
    recipientUserId: candidate.recipient_user_id,
    attendingHubId: candidate.attending_hub_id,
    attendingHubName: candidate.attending_hub_name || 'Medical Facility',
    attendingHubCity: candidate.attending_hub_city || '',
    recipientName: candidate.recipient_name || 'Anonymous Patient',
    bloodGroup: candidate.blood_group,
    urgencyTier: candidate.urgency_tier,
    distanceKm,
    daysWaiting: days,
    urgencyScore: Math.round(urgencyRaw * 0.35 * 10) / 10,
    waitTimeScore: Math.round(waitTimeRaw * 0.25 * 10) / 10,
    proximityScore: Math.round(proximityRaw * 0.20 * 10) / 10,
    hlaAboScore: Math.round(hlaAboRaw * 0.20 * 10) / 10,
    totalScore: Math.round(total * 100) / 100,
  };
}

// ====================================================================
// 2. WAITLIST MANAGEMENT
// ====================================================================

/**
 * Attending Hospital registers a patient onto the transplant waitlist.
 */
export async function addPatientToWaitlist(
  userId: string,
  dto: CreateTransplantRequestDTO
): Promise<TransplantRequestEntity> {
  const hub = await findHubByUserId(userId);
  if (!hub) {
    const error: any = new Error('Medical facility profile not found for this account.');
    error.statusCode = 404;
    throw error;
  }

  if (hub.verification_status !== 'ACTIVE') {
    const error: any = new Error('Only verified, active medical facilities can register waitlist candidates.');
    error.statusCode = 403;
    throw error;
  }

  let recipientUserId = dto.recipient_user_id;

  // If no recipient_user_id was provided, resolve by email or create a user & profile on behalf of the patient
  if (!recipientUserId) {
    const email = dto.patient_email
      ? dto.patient_email.toLowerCase().trim()
      : `patient_${Date.now()}_${Math.floor(Math.random() * 1000)}@hospital.local`;

    const existingUser = await findUserByEmail(email);
    if (!existingUser) {
      const newUserId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO users (id, email, password_hash, role, auth_provider, is_active, is_verified)
         VALUES (?, ?, NULL, 'USER', 'LOCAL', TRUE, TRUE)`,
        [newUserId, email]
      );
      recipientUserId = newUserId;
    } else {
      recipientUserId = existingUser.id;
    }

    if (dto.patient_name) {
      const citizenDob = dto.patient_dob || '1990-01-01';
      const citizenGender = dto.patient_gender || 'OTHER';
      const citizenPhone = dto.patient_phone || '9999999999';

      await pool.query(
        `INSERT INTO citizen_profiles (
           user_id, full_name, date_of_birth, gender, blood_group,
           phone_number, emergency_contact_name, emergency_contact_phone,
           address_line, city, state, pincode
         ) VALUES (?, ?, ?, ?, ?, ?, 'Hospital Attendant', ?, 'Inpatient Care', ?, ?, '000000')
         ON DUPLICATE KEY UPDATE
           full_name = VALUES(full_name),
           blood_group = VALUES(blood_group)`,
        [
          recipientUserId,
          dto.patient_name.trim(),
          citizenDob,
          citizenGender,
          dto.blood_group,
          citizenPhone,
          citizenPhone,
          hub.city,
          hub.state || 'State',
        ]
      );
    }
  }

  return await createTransplantRequest(hub.id, {
    ...dto,
    recipient_user_id: recipientUserId,
  });
}

export async function getWaitlistQueue(
  filters: TransplantQueryFilters
): Promise<TransplantRequestEntity[]> {
  return await listTransplantRequests(filters);
}

export async function getRecipientRequests(
  userId: string
): Promise<TransplantRequestEntity[]> {
  return await listRequestsByRecipient(userId);
}

export async function getRequestDetails(
  requestId: number
): Promise<TransplantRequestEntity> {
  const request = await findTransplantRequestById(requestId);
  if (!request) {
    const error: any = new Error(`Transplant request with ID ${requestId} not found.`);
    error.statusCode = 404;
    throw error;
  }
  return request;
}

// ====================================================================
// 3. MATCHING ENGINE & 20-MINUTE OFFER PROTOCOL
// ====================================================================

/**
 * Evaluates an available organ, scores all compatible waitlist candidates,
 * and generates the ranked candidate leaderboard without prematurely starting the response clock.
 * If an active proposal already exists for this organ, returns it.
 */
export async function runMatchingForOrgan(
  organId: number
): Promise<{
  message: string;
  match: MatchEntity | null;
  candidatesEvaluated: number;
  leaderboard?: CandidateScoreBreakdown[];
  declinedCandidates?: any[];
}> {
  // 1. Inspect organ status & viability
  const organ = await findOrganById(organId);
  if (!organ) {
    const error: any = new Error(`Organ with ID ${organId} not found.`);
    error.statusCode = 404;
    throw error;
  }

  // 2. Fetch candidates on WAITING_LIST for this organ type
  const candidates = await getActiveWaitlistForOrgan(organ.organ_type_id);
  const declinedIds = await getDeclinedRequestIdsForOrgan(organId);
  const declinedMatches = await getDeclinedMatchesForOrgan(organId);
  const eligible = candidates.filter((c) => !declinedIds.includes(c.id));
  const compatible = eligible.filter((c) => isBloodCompatible(organ.blood_group, c.blood_group));

  const scored = compatible.map((candidate) => calculateMatchScore(organ, candidate));
  scored.sort((a, b) => b.totalScore - a.totalScore); // Highest score first

  // If already matching, return existing proposal with its active countdown
  if (organ.status === 'MATCHING') {
    const activeMatch = await findActiveMatchForOrgan(organId);
    if (activeMatch) {
      return {
        message: 'An active 20-minute match offer is currently pending response for this organ.',
        match: activeMatch,
        candidatesEvaluated: scored.length,
        leaderboard: scored,
        declinedCandidates: declinedMatches,
      };
    }
  }

  if (organ.status !== 'AVAILABLE') {
    const error: any = new Error(
      `Cannot run matching. Organ is in '${organ.status}' status (must be 'AVAILABLE').`
    );
    error.statusCode = 400;
    throw error;
  }

  if (new Date(organ.expires_at).getTime() <= Date.now()) {
    const error: any = new Error('Cannot match organ: cold ischemia viability window has elapsed.');
    error.statusCode = 400;
    throw error;
  }

  if (compatible.length === 0) {
    const message =
      declinedMatches.length > 0
        ? `No further eligible candidates. ${declinedMatches.length} candidate(s) previously declined this organ and remain active on the waitlist for future donors.`
        : 'No compatible candidates found on the waitlist for this organ.';

    return {
      message,
      match: null,
      candidatesEvaluated: candidates.length,
      leaderboard: [],
      declinedCandidates: declinedMatches,
    };
  }

  return {
    message: `Matching algorithm completed. ${scored.length} compatible candidate(s) evaluated and ranked. Click 'Allocate Organ' to dispatch the official 20-minute offer.`,
    match: null,
    candidatesEvaluated: scored.length,
    leaderboard: scored,
    declinedCandidates: declinedMatches,
  };
}

/**
 * Hospital allocates an available organ to a candidate on the leaderboard.
 * This triggers the official 20-minute response deadline and notifies the patient and attending hospital.
 */
export async function allocateMatchForOrgan(
  organId: number,
  targetRequestId?: number,
  userId?: string,
  userRole?: string
): Promise<{
  message: string;
  match: MatchEntity;
}> {
  // 1. Inspect organ status & viability
  const organ = await findOrganById(organId);
  if (!organ) {
    const error: any = new Error(`Organ with ID ${organId} not found.`);
    error.statusCode = 404;
    throw error;
  }

  if (organ.status !== 'AVAILABLE') {
    if (organ.status === 'MATCHING') {
      const activeMatch = await findActiveMatchForOrgan(organId);
      if (activeMatch) {
        return {
          message: 'An active match offer is already proposed for this organ.',
          match: activeMatch,
        };
      }
    }
    const error: any = new Error(
      `Cannot allocate organ. Current status is '${organ.status}' (must be 'AVAILABLE').`
    );
    error.statusCode = 400;
    throw error;
  }

  if (new Date(organ.expires_at).getTime() <= Date.now()) {
    const error: any = new Error('Cannot allocate organ: cold ischemia viability window has elapsed.');
    error.statusCode = 400;
    throw error;
  }

  // 2. Fetch candidates & compute scores
  const candidates = await getActiveWaitlistForOrgan(organ.organ_type_id);
  const declinedIds = await getDeclinedRequestIdsForOrgan(organId);
  const eligible = candidates.filter((c) => !declinedIds.includes(c.id));
  const compatible = eligible.filter((c) => isBloodCompatible(organ.blood_group, c.blood_group));

  if (compatible.length === 0) {
    const error: any = new Error('No eligible compatible candidates found on the waitlist for this organ.');
    error.statusCode = 400;
    throw error;
  }

  const scored = compatible.map((candidate) => calculateMatchScore(organ, candidate));
  scored.sort((a, b) => b.totalScore - a.totalScore);

  let selectedCandidate = scored[0];
  if (targetRequestId) {
    const found = scored.find((c) => c.requestId === targetRequestId);
    if (!found) {
      const error: any = new Error(`Selected candidate (#${targetRequestId}) is not compatible or eligible for this organ.`);
      error.statusCode = 400;
      throw error;
    }
    selectedCandidate = found;
  }

  // Scope Enforcement: If user is HOSPITAL, verify they only allocate to candidates linked to their facility
  if (userRole === 'HOSPITAL' && userId) {
    const hub = await findHubByUserId(userId);
    if (!hub) {
      const error: any = new Error('Medical facility profile not found for this account.');
      error.statusCode = 404;
      throw error;
    }

    if (!targetRequestId) {
      // Find the highest-scoring candidate enrolled at this hospital
      const myCandidate = scored.find((c) => c.attendingHubId === hub.id);
      if (!myCandidate) {
        const error: any = new Error(
          `Permission Denied: Your hospital (${hub.name}) does not have an eligible candidate on the waitlist for this organ.`
        );
        error.statusCode = 403;
        throw error;
      }
      selectedCandidate = myCandidate;
    } else if (selectedCandidate.attendingHubId !== hub.id) {
      const error: any = new Error(
        `Permission Denied: Your hospital (${hub.name}) can only allocate organs to candidates registered under your own facility. Candidate #${selectedCandidate.requestId} is registered under ${selectedCandidate.attendingHubName || 'another facility'}.`
      );
      error.statusCode = 403;
      throw error;
    }
  }

  // 3. Official allocation: Propose match offer with 20-minute response deadline
  const match = await createMatchOffer(organ.id, selectedCandidate.requestId, selectedCandidate.totalScore, 20);

  // 4. Dispatch real-time WebSocket notifications to attending hospital and patient
  try {
    emitMatchOfferProposed({
      matchId: match.id,
      organName: organ.organ_name || 'Organ',
      bloodGroup: organ.blood_group,
      score: selectedCandidate.totalScore,
      recipientUserId: selectedCandidate.recipientUserId,
      attendingHubId: selectedCandidate.attendingHubId,
      responseDeadline: new Date(match.response_deadline).toISOString(),
    });
  } catch (err) {
    console.warn('[WEBSOCKET] Failed to emit match proposal event:', err);
  }

  return {
    message: `Organ successfully allocated to ${selectedCandidate.recipientName} (Score: ${selectedCandidate.totalScore}). 20-minute response deadline started and patient notified.`,
    match,
  };
}

/**
 * Patient (via portal) or Attending Hospital surgical coordinator responds to a match offer (ACCEPT or DECLINE).
 * Either party accepting converts the offer to ACCEPTED and allocates the organ.
 * If DECLINED, the candidate safely returns to WAITING_LIST and the engine re-evaluates the pool.
 */
export async function respondToMatch(
  userId: string,
  userRole: string,
  matchId: number,
  decision: 'ACCEPT' | 'DECLINE'
): Promise<{
  message: string;
  match: MatchEntity;
  failoverOffer?: MatchEntity | null;
}> {
  const match = await findMatchById(matchId);
  if (!match) {
    const error: any = new Error(`Match with ID ${matchId} not found.`);
    error.statusCode = 404;
    throw error;
  }

  // Authorization validation:
  // If Citizen ('USER'): verify they are the recipient of this match offer
  if (userRole === 'USER') {
    if (match.recipient_user_id && match.recipient_user_id !== userId) {
      const error: any = new Error('Unauthorized. You can only respond to match offers addressed to your profile.');
      error.statusCode = 403;
      throw error;
    }
  }

  // If Hospital ('HOSPITAL'): verify they are the attending facility for this candidate
  if (userRole === 'HOSPITAL') {
    const hub = await findHubByUserId(userId);
    if (!hub) {
      const error: any = new Error('Medical facility profile not found for this account.');
      error.statusCode = 404;
      throw error;
    }
    if (match.attending_hub_id && match.attending_hub_id !== hub.id) {
      const error: any = new Error(
        `Permission Denied: Only the attending medical facility (${match.attending_hub_name || 'attending hospital'}) or recipient patient can accept or decline this offer.`
      );
      error.statusCode = 403;
      throw error;
    }
  }

  if (decision === 'ACCEPT') {
    const accepted = await acceptMatch(matchId);

    // Dispatch real-time WebSocket notification to donor harvesting hub
    try {
      if (accepted.organ_id) {
        const organ = await findOrganById(accepted.organ_id);
        if (organ) {
          emitMatchOfferAccepted({
            matchId: accepted.id,
            organId: organ.id,
            organName: organ.organ_name || 'Organ',
            donorHubId: organ.harvesting_hub_id,
            attendingHubId: match.attending_hub_id || organ.harvesting_hub_id,
          });
        }
      }
    } catch (err) {
      console.warn('[WEBSOCKET] Failed to emit match accepted event:', err);
    }

    const responderLabel = userRole === 'USER' ? 'Patient' : 'Hospital Coordinator';
    return {
      message: `Match offer accepted successfully by ${responderLabel}! Organ has been allocated and confirmed for surgery.`,
      match: accepted,
    };
  } else {
    // Decline offer
    const declined = await declineMatch(matchId);

    // Re-evaluate matching pool for failover candidate
    let failoverResult = null;
    try {
      const nextRun = await runMatchingForOrgan(match.organ_id);
      failoverResult = nextRun.match;
    } catch (err) {
      console.warn('[FAILOVER] Could not immediately re-match organ:', err);
    }

    return {
      message: 'Match offer declined. Candidate returned to active waitlist (WAITING_LIST).',
      match: declined,
      failoverOffer: failoverResult,
    };
  }
}

/**
 * Scheduled / Cron sweeper: Finds expired match offers (exceeded 20 mins)
 * and automatically triggers failover to the next candidate.
 */
export async function sweepTimedOutMatches(): Promise<{
  timedOutCount: number;
  failoverCount: number;
}> {
  const expired = await findExpiredProposedMatches();
  let failoverCount = 0;

  for (const m of expired) {
    await declineMatch(m.id);
    try {
      const nextRun = await runMatchingForOrgan(m.organ_id);
      if (nextRun.match) failoverCount++;
    } catch (err) {}
  }

  return { timedOutCount: expired.length, failoverCount };
}
