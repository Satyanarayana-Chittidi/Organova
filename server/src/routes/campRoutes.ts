import { Router } from 'express';
import {
  createCampHandler,
  updateCampHandler,
  listCampsHandler,
  getCampByIdHandler,
  getMyHubCampsHandler,
  updateCampStatusHandler,
} from '../controllers/campController';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

// Public: Browse all active & upcoming broadcasted camps
router.get('/', listCampsHandler);

// Hospital: Get camps organized by logged-in hub (including DRAFT)
router.get('/hub/mine', authenticate, authorizeRoles('HOSPITAL', 'ADMIN'), getMyHubCampsHandler);

// Public / Authenticated: View specific camp details
router.get('/:id', getCampByIdHandler);

// Hospital / Admin: Schedule new camp (draft or broadcast)
router.post('/', authenticate, authorizeRoles('HOSPITAL', 'ADMIN'), createCampHandler);

// Hospital / Admin: Edit camp details
router.put('/:id', authenticate, authorizeRoles('HOSPITAL', 'ADMIN'), updateCampHandler);

// Hospital / Admin: Update camp status (e.g. Broadcast to UPCOMING, CANCELLED, or COMPLETED)
router.patch('/:id/status', authenticate, authorizeRoles('HOSPITAL', 'ADMIN'), updateCampStatusHandler);

export default router;
