import { Request, Response, NextFunction } from 'express';
import {
  setFacilityInventory,
  adjustFacilityInventory,
  getFacilityInventory,
  searchBloodStock,
  createRequest,
  getRequestById,
  getRequisitionQueue,
  getMyRequests,
  claimRequest,
  updateDispatchStatus,
  commitDonor,
  releaseDonor,
  completeDonorDonationService,
  getActiveEmergencyAlerts,
  cancelRequest,
} from '../services/bloodService';
import {
  BloodGroup,
  BloodComponent,
  BloodUrgency,
  BloodRequestStatus,
  SearchStockFilters,
  BloodRequestFilters,
} from '../types/blood';

// Helper to safely extract integer ID from request params
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

// ====================================================================
// 1. INVENTORY CONTROLLER HANDLERS
// ====================================================================

/**
 * PUT /api/blood/inventory
 * Sets the exact available unit count for a blood group and component.
 */
export async function setInventoryHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const item = await setFacilityInventory(userId, req.body);
    res.status(200).json({
      success: true,
      message: 'Blood inventory successfully updated.',
      data: item,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/blood/inventory/adjust
 * Adjusts inventory (+N to add units, -N to deduct units).
 */
export async function adjustInventoryHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const item = await adjustFacilityInventory(userId, req.body);
    res.status(200).json({
      success: true,
      message: 'Blood stock successfully adjusted.',
      data: item,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/blood/inventory/me
 * Retrieves full stock breakdown for the calling hospital.
 */
export async function getMyInventoryHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const inventory = await getFacilityInventory(userId);
    res.status(200).json({
      success: true,
      count: inventory.length,
      data: inventory,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/blood/inventory/search
 * Public search endpoint: Discovers active facilities holding blood stock.
 */
export async function searchStockHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
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
  } catch (error) {
    next(error);
  }
}

// ====================================================================
// 2. REQUISITION CONTROLLER HANDLERS
// ====================================================================

/**
 * POST /api/blood/requests
 * Creates a new emergency or routine blood requisition.
 */
export async function createRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const request = await createRequest(userId, req.body);
    res.status(201).json({
      success: true,
      message: 'Blood request registered successfully.',
      data: request,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/blood/requests/mine
 * Returns all blood requests submitted by the logged-in user or hospital.
 */
export async function getMyRequestsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const requests = await getMyRequests(userId);
    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/blood/requests
 * Clinical dashboard: Lists requisitions ordered by urgency (CRITICAL > URGENT > ROUTINE).
 */
export async function listRequestsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
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
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/blood/requests/:id
 * Fetches details for a single request.
 */
export async function getRequestByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const requestId = parseIdParam(req.params.id);
    const request = await getRequestById(requestId);
    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/blood/requests/:id/claim
 * Claims and approves a pending requisition by an active Hospital.
 */
export async function claimRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const requestId = parseIdParam(req.params.id);
    const approvedRequest = await claimRequest(userId, requestId);

    res.status(200).json({
      success: true,
      message: 'Blood requisition successfully claimed and approved. Stock has been reserved.',
      data: approvedRequest,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/blood/requests/:id/status
 * Advances the fulfillment status (DISPATCHED, COMPLETED).
 */
export async function updateDispatchStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
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
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/blood/requests/:id/cancel
 * Cancels a requisition with automatic inventory refund if previously approved.
 */
export async function cancelRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
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
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/blood/requests/:id/commit-donor
 * Allows a matching living citizen donor to commit to a walk-in emergency donation.
 * ACID transactional row-lock ensures concurrency safety.
 */
export async function commitDonorHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const requestId = parseIdParam(req.params.id);

    const committed = await commitDonor(userId, requestId);
    res.status(200).json({
      success: true,
      message: 'You have committed to donate blood for this emergency requisition. Please proceed to the receiving hospital phlebotomy unit.',
      data: committed,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/blood/requests/:id/release-donor
 * Living citizen donor releases their walk-in commitment if unable to reach hospital in time.
 * Resets status to 'REQUESTED' for other donors.
 */
export async function releaseDonorHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const requestId = parseIdParam(req.params.id);

    const released = await releaseDonor(userId, requestId);
    res.status(200).json({
      success: true,
      message: 'You have released your walk-in commitment. The emergency request is now open for other donors.',
      data: released,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/blood/requests/:id/complete-donor
 * Attending receiving hospital verifies walk-in donor arrival and successful phlebotomy draw.
 */
export async function completeDonorDonationHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const requestId = parseIdParam(req.params.id);

    const completed = await completeDonorDonationService(userId, requestId);
    res.status(200).json({
      success: true,
      message: 'Walk-in donor collection verified and requisition completed.',
      data: completed,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/blood/requests/alerts
 * Returns active persistent alerts for the authenticated user (matching donors & hospitals).
 */
export async function getActiveAlertsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const alerts = await getActiveEmergencyAlerts(userId, role);

    res.status(200).json({
      success: true,
      count: alerts.length,
      data: alerts,
    });
  } catch (error) {
    next(error);
  }
}
