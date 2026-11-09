const router = require('express').Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { loginLimiter, otpLimiter, registerLimiter } = require('../middlewares/rateLimiter');

// Khai báo đường dẫn đăng ký và đăng nhập (Áp dụng Rate Limiting chống Brute-Force)
router.post('/register', registerLimiter, authController.register);
router.post('/register/send-otp', otpLimiter, authController.sendRegistrationOtp);
router.get('/check-phone/:phone', authController.checkPhone);
router.post('/check-phone', authController.checkPhone);
router.post('/register/verify-otp', authController.verifyRegistrationOtp);
router.get('/check-username/:username', authController.checkUsername);
router.post('/check-username', authController.checkUsername);
router.post('/login', loginLimiter, authController.login);
router.post('/firebase-phone-login', authController.firebasePhoneLogin);
router.get('/me', authenticateToken, authController.getMe);

// Các đường dẫn xử lý quên mật khẩu qua OTP (Áp dụng Rate Limiting chống spam OTP)
router.post('/forgot-password', otpLimiter, authController.forgotPassword);
router.post('/forgot-password/send-otp', otpLimiter, authController.sendPasswordResetOtp);
router.post('/forgot-password/verify-otp', authController.verifyPasswordResetOtp);
router.post('/forgot-password/reset', authController.resetPassword);
router.post('/verify-otp', authController.verifyOtp);
router.post('/reset-password', authController.resetPasswordLegacy);
router.post('/reset-password-otp', authController.resetPasswordOTP);
router.post('/email/change/send-phone-otp', otpLimiter, authController.sendChangeEmailPhoneOtp);
router.post('/email/change/verify-phone-otp', authController.verifyChangeEmailPhoneOtp);
router.post('/email/send-otp', otpLimiter, authController.sendEmailVerificationOtp);
router.post('/email/verify-otp', authController.verifyEmailOtp);

// Các đường dẫn phụ trợ khác
router.post('/google-login', authController.googleLogin);
router.post('/send-login-otp', otpLimiter, authController.sendLoginOtp);
router.post('/verify-login-otp', authController.verifyLoginOtp);
router.post('/change-password', authController.changePassword);

module.exports = router;
