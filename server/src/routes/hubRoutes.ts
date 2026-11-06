import { Router } from 'express';
import {
  registerHubHandler,
  getMyHubProfileHandler,
  getMyHubHistoryHandler,
  updateMyHubProfileHandler,
  getPublicDirectoryHandler,
  getHubCitiesHandler,
  getHubByIdHandler,
  searchCitizensHandler,
  masterRegisterCitizenHandler,
} from '../controllers/hubController';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

// Public: Onboard a medical facility (Accredited Hospital)
router.post('/register', registerHubHandler);

// Public: Search and filter verified active medical hubs
router.get('/directory', getPublicDirectoryHandler);

// Public: Distinct cities of verified active hospitals
router.get('/cities', getHubCitiesHandler);

// Protected: Authenticated institutional users view their facility profile & verification status
router.get(
  '/me',
  authenticate,
  authorizeRoles('HOSPITAL'),
  getMyHubProfileHandler
);

// Protected: Authenticated facility views operational & clinical transaction history ledger
router.get(
  '/me/history',
  authenticate,
  authorizeRoles('HOSPITAL'),
  getMyHubHistoryHandler
);

// Protected: Authenticated facility updates its contact / location details
router.put(
  '/me',
  authenticate,
  authorizeRoles('HOSPITAL'),
  updateMyHubProfileHandler
);

// Protected: Search registered citizens to link to clinical transactions (organ harvest, waitlist, etc.)
router.get(
  '/citizens/search',
  authenticate,
  authorizeRoles('HOSPITAL', 'ADMIN'),
  searchCitizensHandler
);

// Protected: Hospital Master Control to register a citizen with auto-generated temp password (No OTP)
router.post(
  '/citizens/master-register',
  authenticate,
  authorizeRoles('HOSPITAL', 'ADMIN'),
  masterRegisterCitizenHandler
);

// Public: Retrieve details of an active medical facility by ID
router.get('/:id', getHubByIdHandler);

export default router;
