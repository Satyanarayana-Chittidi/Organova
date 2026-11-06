import { Request, Response, NextFunction } from 'express';
import {
  registerHub,
  getHubByUserId,
  getHubById,
  listPublicHubs,
  getAvailableHubCities,
  searchCitizensService,
  masterRegisterCitizenService,
  getHubHistoryService,
  updateHubProfileService,
} from '../services/hubService';
import { HubQueryFilters, HubType } from '../types/hub';

/**
 * POST /api/hubs/register
 * Public onboarding endpoint for Accredited Hospitals.
 * Saves the full institution profile in PENDING_APPROVAL state.
 */
export async function registerHubHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await registerHub(req.body);
    res.status(201).json({
      success: true,
      message: result.message,
      data: result.hub,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/hubs/me
 * Protected endpoint for institutional users to view their own facility profile & status.
 */
export async function getMyHubProfileHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const hub = await getHubByUserId(userId);
    res.status(200).json({
      success: true,
      data: hub,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/hubs/me/history
 * Protected: Medical facility views its full transaction ledger (harvests, transplants, waitlist, blood).
 */
export async function getMyHubHistoryHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const history = await getHubHistoryService(userId);
    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/hubs/me
 * Protected: Updates medical facility profile information.
 */
export async function updateMyHubProfileHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const result = await updateHubProfileService(userId, req.body);
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.hub,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/hubs/directory
 * Public directory search for citizens and coordinators to find verified facilities.
 * Query Parameters:
 *   - city: string
 *   - search: string
 */
export async function getPublicDirectoryHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const filters: HubQueryFilters = {
      hub_type: req.query.hub_type as HubType | undefined,
      city: req.query.city as string | undefined,
      search: req.query.search as string | undefined,
    };

    const hubs = await listPublicHubs(filters);
    res.status(200).json({
      success: true,
      count: hubs.length,
      data: hubs,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/hubs/:id
 * Retrieves details for a specific medical facility by ID.
 * Only returns ACTIVE facilities publicly.
 */
export async function getHubByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const hubId = parseInt(idParam, 10);
    if (isNaN(hubId)) {
      res.status(400).json({ success: false, message: 'Invalid facility ID.' });
      return;
    }

    const hub = await getHubById(hubId);

    // If facility is not yet ACTIVE, hide it from the public unless requested by owner or admin
    if (hub.verification_status !== 'ACTIVE') {
      const isOwner = req.user && req.user.userId === hub.user_id;
      const isAdmin = req.user && req.user.role === 'ADMIN';

      if (!isOwner && !isAdmin) {
        res.status(404).json({
          success: false,
          message: 'Medical facility not found or pending administrative verification.',
        });
        return;
      }
    }

    res.status(200).json({
      success: true,
      data: hub,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/hubs/cities
 * Retrieves all distinct cities where active hospitals exist.
 */
export async function getHubCitiesHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const cities = await getAvailableHubCities();
    res.status(200).json({
      success: true,
      data: cities,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/hubs/citizens/search
 * Protected: Medical hubs search registered citizens to link donor/recipient records.
 */
export async function searchCitizensHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = (req.query.query as string) || '';
    const citizens = await searchCitizensService(query);
    res.status(200).json({
      success: true,
      count: citizens.length,
      data: citizens,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/hubs/citizens/master-register
 * Protected: Hospital Master Control registers a citizen with auto-generated temp password (No OTP).
 */
export async function masterRegisterCitizenHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const callerUserId = req.user!.userId;
    const result = await masterRegisterCitizenService(callerUserId, req.body);
    res.status(201).json({
      success: true,
      message: result.message,
      data: {
        user: result.user,
        temp_password: result.tempPassword,
      },
    });
  } catch (error: any) {
    if (error.statusCode === 409 && error.existingUser) {
      res.status(409).json({
        success: false,
        message: error.message,
        existingUser: error.existingUser,
      });
      return;
    }
    next(error);
  }
}
