import { Request, Response, NextFunction } from 'express';
import { addPatientToWaitlist, getWaitlistQueue, getRecipientRequests, getRequestDetails, runMatchingForOrgan, allocateMatchForOrgan, respondToMatch, sweepTimedOutMatches, } from '../services/matchingService';
import { seedOrganMocksService } from '../services/seedMockService';
import { findMatchById, getActiveProposedMatches } from '../models/transplantModel';
import { TransplantQueryFilters, UrgencyTier, TransplantRequestStatus, } from '../types/transplant';
import { BloodGroup } from '../types/blood';
function parseIdParam(param: string | string[] | undefined): number {
    const raw = Array.isArray(param) ? param[0] : param;
    const id = parseInt(raw || '', 10);
    if (isNaN(id)) {
        const error: any = new Error('Invalid ID parameter in URL path.');
        error.statusCode = 400;
        throw error;
    }
    return id;
}
export async function addPatientHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const request = await addPatientToWaitlist(userId, req.body);
        res.status(201).json({
            success: true,
            message: 'Patient registered on the transplant waitlist successfully.',
            data: request,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function getWaitlistQueueHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        await sweepTimedOutMatches();
        const rawBloodGroup = req.query.blood_group as string | undefined;
        const bloodGroup = rawBloodGroup ? (rawBloodGroup.replace(/ /g, '+') as BloodGroup) : undefined;
        const filters: TransplantQueryFilters = {
            organ_type_id: req.query.organ_type_id ? parseInt(req.query.organ_type_id as string, 10) : undefined,
            blood_group: bloodGroup,
            urgency_tier: req.query.urgency_tier as UrgencyTier | undefined,
            status: req.query.status as TransplantRequestStatus | undefined,
            attending_hub_id: req.query.attending_hub_id ? parseInt(req.query.attending_hub_id as string, 10) : undefined,
        };
        const queue = await getWaitlistQueue(filters);
        res.status(200).json({
            success: true,
            count: queue.length,
            data: queue,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function getMyWaitlistRequestsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const requests = await getRecipientRequests(userId);
        res.status(200).json({
            success: true,
            count: requests.length,
            data: requests,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function getRequestDetailsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const requestId = parseIdParam(req.params.id);
        const request = await getRequestDetails(requestId);
        res.status(200).json({
            success: true,
            data: request,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function runMatchingHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        await sweepTimedOutMatches();
        const organId = parseIdParam(req.params.organId);
        const result = await runMatchingForOrgan(organId);
        res.status(200).json({
            success: true,
            message: result.message,
            data: {
                match: result.match,
                candidatesEvaluated: result.candidatesEvaluated,
                leaderboard: result.leaderboard,
                declinedCandidates: result.declinedCandidates || [],
            },
        });
    }
    catch (error) {
        next(error);
    }
}
export async function allocateOrganHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        await sweepTimedOutMatches();
        const organId = parseIdParam(req.params.organId);
        const requestId = req.body.request_id ? parseInt(req.body.request_id, 10) : undefined;
        const userId = req.user!.userId;
        const userRole = req.user!.role;
        const result = await allocateMatchForOrgan(organId, requestId, userId, userRole);
        res.status(200).json({
            success: true,
            message: result.message,
            data: {
                match: result.match,
            },
        });
    }
    catch (error) {
        next(error);
    }
}
export async function respondToMatchHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const matchId = parseIdParam(req.params.id);
        const { decision } = req.body;
        if (!['ACCEPT', 'DECLINE'].includes(decision)) {
            res.status(400).json({
                success: false,
                message: "Decision is required and must be either 'ACCEPT' or 'DECLINE'.",
            });
            return;
        }
        const userRole = req.user!.role;
        const result = await respondToMatch(userId, userRole, matchId, decision);
        res.status(200).json({
            success: true,
            message: result.message,
            data: {
                match: result.match,
                failoverOffer: result.failoverOffer,
            },
        });
    }
    catch (error) {
        next(error);
    }
}
export async function getActiveMatchesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        await sweepTimedOutMatches();
        const matches = await getActiveProposedMatches();
        res.status(200).json({
            success: true,
            count: matches.length,
            data: matches,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function getMatchDetailsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const matchId = parseIdParam(req.params.id);
        const match = await findMatchById(matchId);
        if (!match) {
            res.status(404).json({ success: false, message: 'Match offer not found.' });
            return;
        }
        res.status(200).json({
            success: true,
            data: match,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function sweepTimeoutsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const result = await sweepTimedOutMatches();
        res.status(200).json({
            success: true,
            message: `Match offer timeout sweep completed. Timed out: ${result.timedOutCount}, Failovers dispatched: ${result.failoverCount}.`,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function seedMocksHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const result = await seedOrganMocksService();
        res.status(200).json({
            success: true,
            message: result.message,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
}
