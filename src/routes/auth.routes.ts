import express from 'express';
import { register, login, refreshToken, verifyEmail, forgotPassword, resetPassword, logout, getMe } from '../controllers/auth.controller';
import { protect } from '../middlewares/auth.middleware';
import { passwordResetRateLimiter } from '../middlewares/rateLimit.middleware';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.get('/verify-email/:token', verifyEmail);
router.post('/forgot-password', passwordResetRateLimiter, forgotPassword);
router.post('/reset-password', passwordResetRateLimiter, resetPassword);

// Protected routes
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

export default router;
