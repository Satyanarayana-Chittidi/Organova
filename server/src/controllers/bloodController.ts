import { Request, Response, NextFunction } from 'express';
import { setFacilityInventory, adjustFacilityInventory, getFacilityInventory, searchBloodStock, createRequest, getRequestById, getRequisitionQueue, getMyRequests, claimRequest, updateDispatchStatus, commitDonor, releaseDonor, completeDonorDonationService, getActiveEmergencyAlerts, cancelRequest, } from '../services/bloodService';
import { BloodGroup, BloodComponent, BloodUrgency, BloodRequestStatus, SearchStockFilters, BloodRequestFilters, } from '../types/blood';
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
export async function setInventoryHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const item = await setFacilityInventory(userId, req.body);
        res.status(200).json({
            success: true,
            message: 'Blood inventory successfully updated.',
            data: item,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function adjustInventoryHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const item = await adjustFacilityInventory(userId, req.body);
        res.status(200).json({
            success: true,
            message: 'Blood stock successfully adjusted.',
            data: item,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function getMyInventoryHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const inventory = await getFacilityInventory(userId);
        res.status(200).json({
            success: true,
            count: inventory.length,
            data: inventory,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function searchStockHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const rawBloodGroup = req.query.blood_group as string | undefined;
        const bloodGroup = rawBloodGroup ? (rawBloodGroup.replace(/ /g, '+') as BloodGroup) : undefined;
        const filters: SearchStockFilters = {
            blood_group: bloodGroup,
            component: req.query.component as BloodComponent | undefined,
            city: req.query.city as string | undefined,
        };
        const results = await searchBloodStock(filters);
        res.status(200).json({
            success: true,
            count: results.length,
            data: results,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function createRequestHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const request = await createRequest(userId, req.body);
        res.status(201).json({
            success: true,
            message: 'Blood request registered successfully.',
            data: request,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function getMyRequestsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const requests = await getMyRequests(userId);
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
export async function listRequestsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const rawBloodGroup = req.query.blood_group as string | undefined;
        const bloodGroup = rawBloodGroup ? (rawBloodGroup.replace(/ /g, '+') as BloodGroup) : undefined;
        const filters: BloodRequestFilters = {
            blood_group: bloodGroup,
            component: req.query.component as BloodComponent | undefined,
            urgency: req.query.urgency as BloodUrgency | undefined,
            status: req.query.status as BloodRequestStatus | undefined,
        };
        const requests = await getRequisitionQueue(filters);
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
export async function getRequestByIdHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const requestId = parseIdParam(req.params.id);
        const request = await getRequestById(requestId);
        res.status(200).json({
            success: true,
            data: request,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function claimRequestHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const requestId = parseIdParam(req.params.id);
        const approvedRequest = await claimRequest(userId, requestId);
        res.status(200).json({
            success: true,
            message: 'Blood requisition successfully claimed and approved. Stock has been reserved.',
            data: approvedRequest,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function updateDispatchStatusHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const requestId = parseIdParam(req.params.id);
        const { status } = req.body;
        if (!['DISPATCHED', 'COMPLETED'].includes(status)) {
            res.status(400).json({
                success: false,
                message: "Status must be 'DISPATCHED' or 'COMPLETED'.",
            });
            return;
        }
        const updated = await updateDispatchStatus(userId, requestId, status);
        res.status(200).json({
            success: true,
            message: `Requisition status updated to '${status}'.`,
            data: updated,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function cancelRequestHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const isAdmin = req.user!.role === 'ADMIN';
        const requestId = parseIdParam(req.params.id);
        const cancelled = await cancelRequest(userId, requestId, isAdmin);
        res.status(200).json({
            success: true,
            message: 'Requisition successfully cancelled.',
            data: cancelled,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function commitDonorHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const requestId = parseIdParam(req.params.id);
        const committed = await commitDonor(userId, requestId);
        res.status(200).json({
            success: true,
            message: 'You have committed to donate blood for this emergency requisition. Please proceed to the receiving hospital phlebotomy unit.',
            data: committed,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function releaseDonorHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const requestId = parseIdParam(req.params.id);
        const released = await releaseDonor(userId, requestId);
        res.status(200).json({
            success: true,
            message: 'You have released your walk-in commitment. The emergency request is now open for other donors.',
            data: released,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function completeDonorDonationHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const requestId = parseIdParam(req.params.id);
        const completed = await completeDonorDonationService(userId, requestId);
        res.status(200).json({
            success: true,
            message: 'Walk-in donor collection verified and requisition completed.',
            data: completed,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function getActiveAlertsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const role = req.user!.role;
        const alerts = await getActiveEmergencyAlerts(userId, role);
        res.status(200).json({
            success: true,
            count: alerts.length,
            data: alerts,
        });
    }
    catch (error) {
        next(error);
    }
}
