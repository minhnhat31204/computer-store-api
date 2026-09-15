const router = require('express').Router();
const authController = require('../controllers/authController');

// Khai báo đường dẫn đăng ký
router.post('/register', authController.register);

// Khai báo thêm các đường dẫn đăng nhập, quên mật khẩu đã có sẵn trong controller của bạn
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password-otp', authController.resetPasswordOTP);
router.post('/google-login', authController.googleLogin);

module.exports = router;