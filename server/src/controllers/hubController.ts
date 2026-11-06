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
