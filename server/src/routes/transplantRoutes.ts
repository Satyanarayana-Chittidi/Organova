import { Router } from 'express';
import {
  addPatientHandler,
  getWaitlistQueueHandler,
  getMyWaitlistRequestsHandler,
  getRequestDetailsHandler,
  runMatchingHandler,
  allocateOrganHandler,
  respondToMatchHandler,
  getActiveMatchesHandler,
  getMatchDetailsHandler,
  sweepTimeoutsHandler,
  seedMocksHandler,
} from '../controllers/transplantController';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

// ====================================================================
// 1. WAITLIST ROUTES
// ====================================================================

// Attending Hospital registers a verified patient onto the waitlist
router.post(
  '/requests',
  authenticate,
  authorizeRoles('HOSPITAL', 'ADMIN'),
  addPatientHandler
);

// Clinical queue of waiting patients
router.get(
  '/requests',
  authenticate,
  authorizeRoles('HOSPITAL', 'ADMIN'),
  getWaitlistQueueHandler
);

// Recipient Passport: Patient views their own registration & match status
router.get('/requests/mine', authenticate, getMyWaitlistRequestsHandler);

// Single waitlist request details
router.get('/requests/:id', authenticate, getRequestDetailsHandler);

// ====================================================================
// 2. MATCHING & OFFER ROUTES
// ====================================================================

// Triggers the multi-factor scoring matching engine for an available organ (candidate evaluation / preview)
router.post(
  '/matches/organ/:organId',
  authenticate,
  authorizeRoles('HOSPITAL', 'ADMIN'),
  runMatchingHandler
);

// Explicit allocation of organ to a candidate, initiating the 20-minute response window
router.post(
  '/matches/organ/:organId/allocate',
  authenticate,
  authorizeRoles('HOSPITAL', 'ADMIN'),
  allocateOrganHandler
);

// Patient (via citizen portal) or Attending Hospital accepts or declines a 20-minute match offer
router.post(
  '/matches/:id/respond',
  authenticate,
  authorizeRoles('HOSPITAL', 'ADMIN', 'USER'),
  respondToMatchHandler
);

// Active 20-minute match offers across the network
router.get(
  '/matches/active',
  authenticate,
  authorizeRoles('HOSPITAL', 'ADMIN'),
  getActiveMatchesHandler
);

// Match offer details & countdown timer
router.get('/matches/:id', authenticate, getMatchDetailsHandler);

// Cron / Admin endpoint: sweeps overdue match offers and triggers automated failover
router.post(
  '/matches/sweep-timeouts',
  authenticate,
  authorizeRoles('ADMIN'),
  sweepTimeoutsHandler
);

// Testing & Verification: Seeds never-expiring test organs and multi-scenario patient requests
router.post(
  '/seed-mocks',
  authenticate,
  authorizeRoles('HOSPITAL', 'ADMIN'),
  seedMocksHandler
);

export default router;
