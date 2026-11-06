import { Router } from 'express';
import {
  saveMyProfile,
  getMyProfile,
  uploadMyAvatar,
  removeMyAvatar,
  getMyDonationHistory,
} from '../controllers/citizenController';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware';
import { uploadAvatarMiddleware } from '../middlewares/uploadMiddleware';

const router = Router();

// ====================================================================
// CITIZEN PROFILE ROUTES (/api/citizen)
// All endpoints are protected and restricted to verified citizens ('USER')
// ====================================================================

router.use(authenticate); // Require valid JWT session
router.use(authorizeRoles('USER')); // Require citizen role

router.get('/profile', getMyProfile);   // View personal medical profile
router.post('/profile', saveMyProfile); // Save or update profile (Upsert)
router.put('/profile', saveMyProfile);  // Save or update profile (Upsert)
router.get('/history', getMyDonationHistory); // Lifetime donation & impact ledger

// Profile picture avatar management
router.post(
  '/avatar',
  uploadAvatarMiddleware.single('avatar'),
  uploadMyAvatar
);
router.delete('/avatar', removeMyAvatar);

export default router;
