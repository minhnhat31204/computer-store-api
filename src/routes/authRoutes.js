const router = require('express').Router();
const authController = require('../controllers/authController');

// Khai báo đường dẫn đăng ký và đăng nhập
router.post('/register', authController.register);
router.post('/login', authController.login);

// Các đường dẫn xử lý quên mật khẩu qua OTP
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-otp', authController.verifyOtp);
router.post('/reset-password', authController.resetPassword);
router.post('/reset-password-otp', authController.resetPasswordOTP); // Giữ lại tương thích ngược

// Các đường dẫn phụ trợ khác
router.post('/google-login', authController.googleLogin);
router.post('/send-login-otp', authController.sendLoginOtp);
router.post('/verify-login-otp', authController.verifyLoginOtp);

module.exports = router;