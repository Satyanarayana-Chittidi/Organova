import { Router } from 'express';
import {
  getOrganTypesHandler,
  harvestOrganHandler,
  getOrganByIdHandler,
  listOrgansHandler,
  updateOrganStatusHandler,
  sweepExpiredOrgansHandler,
} from '../controllers/organController';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

// Public: View all supported organ types and cold ischemia limits
router.get('/types', getOrganTypesHandler);

// Protected: Active Hospital logs a newly harvested organ
router.post(
  '/harvest',
  authenticate,
  authorizeRoles('HOSPITAL'),
  harvestOrganHandler
);

// Protected: View available organs across the network
router.get(
  '/',
  authenticate,
  authorizeRoles('HOSPITAL', 'ADMIN'),
  listOrgansHandler
);

// Protected: View specific organ details & viability countdown
router.get('/:id', authenticate, getOrganByIdHandler);

// Protected: Update organ state along transit/transplant chain
router.patch(
  '/:id/status',
  authenticate,
  authorizeRoles('HOSPITAL', 'ADMIN'),
  updateOrganStatusHandler
);

// Admin / Cron: Sweeps overdue organs that exceeded cold ischemia limit
router.post(
  '/sweep-expired',
  authenticate,
  authorizeRoles('ADMIN'),
  sweepExpiredOrgansHandler
);

export default router;
