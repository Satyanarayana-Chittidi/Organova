import { Request, Response, NextFunction } from 'express';
import * as pledgeService from '../services/pledgeService';
import { CreatePledgesDTO } from '../types/pledge';

/**
 * Returns the catalog of approved organs and living donation rules.
 * GET /api/donor/organ-types
 */
export async function getOrganCatalog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const catalog = await pledgeService.getOrganTypesCatalog();
    res.status(200).json({
      success: true,
      data: catalog,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Submits or reactivates organ donation pledges.
 * POST /api/donor/pledges
 */
export async function createPledges(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const dto: CreatePledgesDTO = req.body;

    const result = await pledgeService.submitPledges(userId, dto);

    res.status(201).json({
      success: true,
      message: result.message,
      data: result.activePledges,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Fetches the authenticated user's active pledges and donor status.
 * GET /api/donor/pledges
 */
export async function getMyPledges(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const result = await pledgeService.getUserPledges(userId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Revokes a specific organ pledge.
 * PATCH /api/donor/pledges/:id/revoke
 */
export async function revokePledge(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const pledgeId = parseInt(idParam, 10);

    if (isNaN(pledgeId)) {
      res.status(400).json({ success: false, message: 'Invalid pledge ID parameter.' });
      return;
    }

    const result = await pledgeService.revokeUserPledge(userId, pledgeId);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Revokes all active organ donation pledges for the citizen.
 * PATCH /api/donor/pledges/revoke-all
 */
export async function revokeAllMyPledges(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const result = await pledgeService.revokeAllUserPledges(userId);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Generates the official Digital Donor Card data.
 * GET /api/donor/card
 */
export async function getMyDonorCard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const donorCard = await pledgeService.generateDonorCard(userId);

    res.status(200).json({
      success: true,
      data: donorCard,
    });
  } catch (error) {
    next(error);
  }
}
