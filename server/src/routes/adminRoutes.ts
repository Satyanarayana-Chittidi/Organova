import { Router } from 'express';
import {
  getPendingHubsHandler,
  verifyHubStatusHandler,
  getPlatformMetricsHandler,
  getAllHubsHandler,
  searchEntitiesHandler,
  getActivityLogsHandler,
} from '../controllers/adminController';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

// All admin routes require valid authentication and the 'ADMIN' role
router.use(authenticate, authorizeRoles('ADMIN'));

// 1. Platform overview & macro pulse metrics
router.get('/metrics', getPlatformMetricsHandler);

// 2. Hub verifications & listings
router.get('/hubs/pending', getPendingHubsHandler);
router.get('/hubs', getAllHubsHandler);
router.patch('/hubs/:id/verify', verifyHubStatusHandler);

// 3. Unified registry search (citizens + hubs)
router.get('/entities/search', searchEntitiesHandler);

// 4. Chronological activity logs
router.get('/logs', getActivityLogsHandler);

export default router;
