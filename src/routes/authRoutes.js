const router = require('express').Router();
const authController = require('../controllers/authController');

// Khai báo đường dẫn đăng ký và đăng nhập
router.post('/register', authController.register);
router.post('/register/send-otp', authController.sendRegistrationOtp);
router.post('/login', authController.login);
router.post('/firebase-phone-login', authController.firebasePhoneLogin);

// Các đường dẫn xử lý quên mật khẩu qua OTP
router.post('/forgot-password', authController.forgotPassword);
router.post('/forgot-password/send-otp', authController.sendPasswordResetOtp);
router.post('/forgot-password/verify-otp', authController.verifyPasswordResetOtp);
router.post('/forgot-password/reset', authController.resetPassword);
router.post('/verify-otp', authController.verifyOtp);
router.post('/reset-password', authController.resetPasswordLegacy);
router.post('/reset-password-otp', authController.resetPasswordOTP); // Giữ lại tương thích ngược
router.post('/email/send-otp', authController.sendEmailVerificationOtp);
router.post('/email/verify-otp', authController.verifyEmailOtp);

// Các đường dẫn phụ trợ khác
router.post('/google-login', authController.googleLogin);
router.post('/send-login-otp', authController.sendLoginOtp);
router.post('/verify-login-otp', authController.verifyLoginOtp);

module.exports = router;
