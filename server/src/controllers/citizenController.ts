import { Request, Response, NextFunction } from 'express';
import * as citizenService from '../services/citizenService';
import { UpsertCitizenProfileDTO } from '../types/citizen';
export async function saveMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const dto: UpsertCitizenProfileDTO = req.body;
        const savedProfile = await citizenService.saveCitizenProfile(userId, dto);
        res.status(200).json({
            success: true,
            message: 'Citizen profile saved successfully.',
            data: savedProfile,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function getMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const result = await citizenService.getCitizenProfile(userId);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function uploadMyAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        let avatarUrl: string | null = null;
        if (req.file) {
            avatarUrl = `/uploads/avatars/${req.file.filename}`;
        }
        else if (req.body?.avatar_url) {
            avatarUrl = req.body.avatar_url;
        }
        if (!avatarUrl) {
            res.status(400).json({
                success: false,
                message: 'No image file or avatar URL was provided.',
            });
            return;
        }
        await citizenService.setAvatar(userId, avatarUrl);
        res.status(200).json({
            success: true,
            message: 'Profile picture updated successfully.',
            data: {
                avatar_url: avatarUrl,
            },
        });
    }
    catch (error) {
        next(error);
    }
}
export async function removeMyAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        await citizenService.setAvatar(userId, null);
        res.status(200).json({
            success: true,
            message: 'Profile picture removed successfully.',
        });
    }
    catch (error) {
        next(error);
    }
}
export async function getMyDonationHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const history = await citizenService.getDonationHistory(userId);
        res.status(200).json({
            success: true,
            data: history,
        });
    }
    catch (error) {
        next(error);
    }
}
