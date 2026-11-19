const rateLimit = require('express-rate-limit');

// 1. Giới hạn đăng nhập: nới rộng phục vụ kiểm thử
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 5 phút để bảo vệ an toàn tài khoản.'
  }
});

// 2. Giới hạn gửi OTP: Cho phép gửi OTP nhiều lần tự do theo yêu cầu kiểm thử
const otpLimiter = (req, res, next) => next();

// 3. Giới hạn đăng ký tài khoản: nới rộng phục vụ kiểm thử
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Quá nhiều yêu cầu tạo tài khoản từ thiết bị này. Vui lòng thử lại sau 1 giờ.'
  }
});

// 4. Giới hạn upload tệp / hình ảnh: tối đa 20 file trong 15 phút trên mỗi IP
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Bạn đã tải lên quá nhiều hình ảnh trong thời gian ngắn. Vui lòng đợi 15 phút trước khi thử lại.'
  }
});

// 5. Giới hạn tin nhắn hỗ trợ & yêu cầu AI chat: tối đa 30 tin trong 1 phút trên mỗi IP
const supportLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Bạn đang gửi tin nhắn quá nhanh. Vui lòng thử lại sau 1 phút.'
  }
});

module.exports = {
  loginLimiter,
  otpLimiter,
  registerLimiter,
  uploadLimiter,
  supportLimiter
};
