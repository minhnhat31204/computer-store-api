const rateLimit = require('express-rate-limit');

// 1. Giới hạn đăng nhập: tối đa 5 lần thử trong 5 phút trên mỗi IP
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 5 phút để bảo vệ an toàn tài khoản.'
  }
});

// 2. Giới hạn gửi OTP: tối đa 3 lần yêu cầu trong 10 phút trên mỗi IP
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Bạn đã yêu cầu gửi mã OTP quá nhiều lần. Vui lòng đợi 10 phút trước khi thử lại.'
  }
});

// 3. Giới hạn đăng ký tài khoản: tối đa 10 tài khoản mỗi giờ trên mỗi IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Quá nhiều yêu cầu tạo tài khoản từ thiết bị này. Vui lòng thử lại sau 1 giờ.'
  }
});

module.exports = {
  loginLimiter,
  otpLimiter,
  registerLimiter
};
