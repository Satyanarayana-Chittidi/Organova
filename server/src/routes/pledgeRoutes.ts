import { Router } from 'express';
import {
  getOrganCatalog,
  createPledges,
  getMyPledges,
  revokePledge,
  revokeAllMyPledges,
  getMyDonorCard,
} from '../controllers/pledgeController';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

// ====================================================================
// DONOR PLEDGE ROUTES (/api/donor)
// ====================================================================

// Public route: Reference catalog of approved organs and living donation eligibility
router.get('/organ-types', getOrganCatalog);

// Protected Citizen routes: Requires active citizen session
router.post('/pledges', authenticate, authorizeRoles('USER'), createPledges);
router.get('/pledges', authenticate, authorizeRoles('USER'), getMyPledges);
router.patch('/pledges/revoke-all', authenticate, authorizeRoles('USER'), revokeAllMyPledges);
router.patch('/pledges/:id/revoke', authenticate, authorizeRoles('USER'), revokePledge);
router.get('/card', authenticate, authorizeRoles('USER'), getMyDonorCard);

export default router;
