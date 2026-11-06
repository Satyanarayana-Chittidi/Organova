import { Request, Response, NextFunction } from 'express';
import {
  listPendingHubsForAdmin,
  verifyHubStatus,
} from '../services/hubService';
import {
  getAdminPlatformMetrics,
  getAdminHubsList,
  searchAdminEntities,
  getAdminActivityLogs,
} from '../services/adminService';

export async function getPendingHubsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const hubs = await listPendingHubsForAdmin();
    res.status(200).json({
      success: true,
      count: hubs.length,
      data: hubs,
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyHubStatusHandler(
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

    const { status } = req.body;
    if (!status || !['ACTIVE', 'REJECTED', 'SUSPENDED'].includes(status)) {
      res.status(400).json({
        success: false,
        message: "Status is required and must be 'ACTIVE', 'REJECTED', or 'SUSPENDED'.",
      });
      return;
    }

    const adminId = req.user!.userId;
    const result = await verifyHubStatus(hubId, status, adminId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.hub,
    });
  } catch (error) {
    next(error);
  }
}

export async function getPlatformMetricsHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const metrics = await getAdminPlatformMetrics();
    res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAllHubsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const status = req.query.status as string | undefined;
    const hubs = await getAdminHubsList(status);
    res.status(200).json({
      success: true,
      count: hubs.length,
      data: hubs,
    });
  } catch (error) {
    next(error);
  }
}

export async function searchEntitiesHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const q = (req.query.q as string) || '';
    if (!q.trim()) {
      res.status(200).json({ success: true, data: { citizens: [], hubs: [] } });
      return;
    }

    const results = await searchAdminEntities(q);
    res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    next(error);
  }
}

export async function getActivityLogsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const limit = parseInt((req.query.limit as string) || '50', 10);
    const logs = await getAdminActivityLogs(isNaN(limit) ? 50 : limit);
    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
}
