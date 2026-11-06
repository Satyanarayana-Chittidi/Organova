import { Router } from 'express';
import {
  setInventoryHandler,
  adjustInventoryHandler,
  getMyInventoryHandler,
  searchStockHandler,
  createRequestHandler,
  getMyRequestsHandler,
  listRequestsHandler,
  getRequestByIdHandler,
  claimRequestHandler,
  updateDispatchStatusHandler,
  commitDonorHandler,
  releaseDonorHandler,
  completeDonorDonationHandler,
  getActiveAlertsHandler,
  cancelRequestHandler,
} from '../controllers/bloodController';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

// ====================================================================
// 1. INVENTORY ROUTES
// ====================================================================

// Public: Find active facilities with available blood units
router.get('/inventory/search', searchStockHandler);

// Protected: Facilities inspect their current stock breakdown
router.get(
  '/inventory/me',
  authenticate,
  authorizeRoles('HOSPITAL'),
  getMyInventoryHandler
);

// Protected: Set absolute stock units
router.put(
  '/inventory',
  authenticate,
  authorizeRoles('HOSPITAL'),
  setInventoryHandler
);

// Protected: Incremental adjustment (+N / -N)
router.patch(
  '/inventory/adjust',
  authenticate,
  authorizeRoles('HOSPITAL'),
  adjustInventoryHandler
);

// ====================================================================
// 2. REQUISITION & EMERGENCY FULFILLMENT ROUTES
// ====================================================================

// Authenticated users or hospitals submit blood requisitions
router.post('/requests', authenticate, createRequestHandler);
router.post('/request', authenticate, createRequestHandler);

// Authenticated requester views their own submitted orders
router.get('/requests/mine', authenticate, getMyRequestsHandler);

// Active persistent alerts for logged-in user (matching donors & facilities)
router.get('/requests/alerts', authenticate, getActiveAlertsHandler);
router.get('/alerts', authenticate, getActiveAlertsHandler);

// Clinical / Admin queue of blood requests (prioritized by CRITICAL > URGENT > ROUTINE)
router.get(
  '/requests',
  authenticate,
  authorizeRoles('HOSPITAL', 'ADMIN'),
  listRequestsHandler
);

// Request details by ID
router.get('/requests/:id', authenticate, getRequestByIdHandler);

// Claim and reserve blood units from inventory (ACID Transaction)
router.post(
  '/requests/:id/claim',
  authenticate,
  authorizeRoles('HOSPITAL'),
  claimRequestHandler
);

// Living citizen donor commits to walk-in emergency donation (Concurrency safe)
router.post(
  '/requests/:id/commit-donor',
  authenticate,
  commitDonorHandler
);

// Living citizen donor releases commitment if unable to reach hospital
router.post(
  '/requests/:id/release-donor',
  authenticate,
  releaseDonorHandler
);

// Receiving hospital confirms phlebotomy draw & completes walk-in requisition
router.post(
  '/requests/:id/complete-donor',
  authenticate,
  authorizeRoles('HOSPITAL'),
  completeDonorDonationHandler
);

// Advance fulfillment status (DISPATCHED, COMPLETED)
router.patch(
  '/requests/:id/status',
  authenticate,
  authorizeRoles('HOSPITAL'),
  updateDispatchStatusHandler
);

// Cancel requisition (auto-replenishes inventory if previously approved)
router.post('/requests/:id/cancel', authenticate, cancelRequestHandler);

export default router;
