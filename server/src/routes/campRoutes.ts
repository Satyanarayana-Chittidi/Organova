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

router.get('/', listCampsHandler);

router.get('/hub/mine', authenticate, authorizeRoles('HOSPITAL', 'ADMIN'), getMyHubCampsHandler);

router.get('/:id', getCampByIdHandler);

router.post('/', authenticate, authorizeRoles('HOSPITAL', 'ADMIN'), createCampHandler);

router.put('/:id', authenticate, authorizeRoles('HOSPITAL', 'ADMIN'), updateCampHandler);

router.patch('/:id/status', authenticate, authorizeRoles('HOSPITAL', 'ADMIN'), updateCampStatusHandler);

export default router;
