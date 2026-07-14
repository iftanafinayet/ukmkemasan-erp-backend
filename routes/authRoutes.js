const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getProfile, updateProfile, changePassword, forgotPassword, resetPassword, sendOtp, verifyOtpCode } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
router.post('/send-otp', authLimiter, sendOtp);
router.post('/verify-otp', authLimiter, verifyOtpCode);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

module.exports = router;