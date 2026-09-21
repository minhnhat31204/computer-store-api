const router = require('express').Router();
const authController = require('../controllers/authController');

// Khai bÃ¡o Ä‘Æ°á»ng dáº«n Ä‘Äƒng kÃ½
router.post('/register', authController.register);

// Khai bÃ¡o thÃªm cÃ¡c Ä‘Æ°á»ng dáº«n Ä‘Äƒng nháº­p, quÃªn máº­t kháº©u Ä‘Ã£ cÃ³ sáºµn trong controller cá»§a báº¡n
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password-otp', authController.resetPasswordOTP);
router.post('/google-login', authController.googleLogin);
router.post('/send-login-otp', authController.sendLoginOtp);
router.post('/verify-login-otp', authController.verifyLoginOtp);

module.exports = router;


