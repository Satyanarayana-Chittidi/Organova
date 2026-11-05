import { Request, Response, NextFunction } from 'express';
import { createCampService, updateCampService, getCampsService, getCampByIdService, getMyHubCampsService, updateCampStatusService, } from '../services/campService';
export async function createCampHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const userRole = req.user!.role;
        const camp = await createCampService(userId, userRole, req.body);
        res.status(201).json({
            success: true,
            message: 'Blood donation camp created successfully.',
            data: camp,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function updateCampHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const userRole = req.user!.role;
        const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const campId = parseInt(rawId, 10);
        if (isNaN(campId)) {
            res.status(400).json({ success: false, message: 'Invalid camp ID.' });
            return;
        }
        const camp = await updateCampService(userId, userRole, campId, req.body);
        res.status(200).json({
            success: true,
            message: 'Blood donation camp details updated successfully.',
            data: camp,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function listCampsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { status, city } = req.query;
        const camps = await getCampsService({
            status: status as string | undefined,
            city: city as string | undefined,
        });
        res.status(200).json({
            success: true,
            count: camps.length,
            data: camps,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function getCampByIdHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const id = parseInt(rawId, 10);
        if (isNaN(id)) {
            res.status(400).json({ success: false, message: 'Invalid camp ID.' });
            return;
        }
        const camp = await getCampByIdService(id);
        res.status(200).json({
            success: true,
            data: camp,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function getMyHubCampsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const camps = await getMyHubCampsService(userId);
        res.status(200).json({
            success: true,
            count: camps.length,
            data: camps,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function updateCampStatusHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const userRole = req.user!.role;
        const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const campId = parseInt(rawId, 10);
        const { status } = req.body;
        if (isNaN(campId)) {
            res.status(400).json({ success: false, message: 'Invalid camp ID.' });
            return;
        }
        await updateCampStatusService(userId, userRole, campId, status);
        res.status(200).json({
            success: true,
            message: `Camp status successfully updated to '${status}'.`,
        });
    }
    catch (error) {
        next(error);
    }
}
