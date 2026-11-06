import { Request, Response, NextFunction } from 'express';
import {
  getOrganTypes,
  harvestOrgan,
  getOrganById,
  getOrgans,
  changeOrganStatus,
  runExpirationSweep,
} from '../services/organService';
import { OrganStatus, OrganQueryFilters } from '../types/organ';
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

export async function getOrganTypesHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const types = await getOrganTypes();
    res.status(200).json({
      success: true,
      count: types.length,
      data: types,
    });
  } catch (error) {
    next(error);
  }
}

export async function harvestOrganHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const organ = await harvestOrgan(userId, req.body);
    res.status(201).json({
      success: true,
      message: `Organ successfully registered with cold ischemia timer (${organ.max_viability_hours}h viability window).`,
      data: organ,
    });
  } catch (error) {
    next(error);
  }
}

export async function getOrganByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const organId = parseIdParam(req.params.id);
    const organ = await getOrganById(organId);
    res.status(200).json({
      success: true,
      data: organ,
    });
  } catch (error) {
    next(error);
  }
}

export async function listOrgansHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawBloodGroup = req.query.blood_group as string | undefined;
    const bloodGroup = rawBloodGroup ? (rawBloodGroup.replace(/ /g, '+') as BloodGroup) : undefined;

    const filters: OrganQueryFilters = {
      organ_type_id: req.query.organ_type_id ? parseInt(req.query.organ_type_id as string, 10) : undefined,
      blood_group: bloodGroup,
      status: req.query.status as OrganStatus | undefined,
      only_viable: req.query.only_viable === 'true',
      city: req.query.city as string | undefined,
    };

    const organs = await getOrgans(filters);
    res.status(200).json({
      success: true,
      count: organs.length,
      data: organs,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateOrganStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const organId = parseIdParam(req.params.id);
    const updated = await changeOrganStatus(userId, organId, req.body);

    res.status(200).json({
      success: true,
      message: `Organ status updated to '${updated.status}'.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function sweepExpiredOrgansHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await runExpirationSweep();
    res.status(200).json({
      success: true,
      message: `Cold ischemia expiration sweep completed. Expired count: ${result.expiredCount}.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
