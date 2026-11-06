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

router.post(
  '/requests',
  authenticate,
  authorizeRoles('HOSPITAL', 'ADMIN'),
  addPatientHandler
);

router.get(
  '/requests',
  authenticate,
  authorizeRoles('HOSPITAL', 'ADMIN'),
  getWaitlistQueueHandler
);

router.get('/requests/mine', authenticate, getMyWaitlistRequestsHandler);

router.get('/requests/:id', authenticate, getRequestDetailsHandler);

router.post(
  '/matches/organ/:organId',
  authenticate,
  authorizeRoles('HOSPITAL', 'ADMIN'),
  runMatchingHandler
);

router.post(
  '/matches/organ/:organId/allocate',
  authenticate,
  authorizeRoles('HOSPITAL', 'ADMIN'),
  allocateOrganHandler
);

router.post(
  '/matches/:id/respond',
  authenticate,
  authorizeRoles('HOSPITAL', 'ADMIN', 'USER'),
  respondToMatchHandler
);

router.get(
  '/matches/active',
  authenticate,
  authorizeRoles('HOSPITAL', 'ADMIN'),
  getActiveMatchesHandler
);

router.get('/matches/:id', authenticate, getMatchDetailsHandler);

router.post(
  '/matches/sweep-timeouts',
  authenticate,
  authorizeRoles('ADMIN'),
  sweepTimeoutsHandler
);

router.post(
  '/seed-mocks',
  authenticate,
  authorizeRoles('HOSPITAL', 'ADMIN'),
  seedMocksHandler
);

export default router;
