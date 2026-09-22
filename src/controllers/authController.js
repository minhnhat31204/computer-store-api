const { User } = require('../models');
const nodemailer = require('nodemailer');

// Lưu trữ OTP tạm thời trong bộ nhớ
const otpStore = {}; 

// Đăng ký
exports.register = async (req, res) => {
  try {
    const { fullName, email, password, phone } = req.body;
    const newUser = await User.create({ 
      FullName: fullName, 
      Email: email, 
      PasswordHash: password, 
      Phone: phone 
    });
    res.status(201).json({ message: 'Đăng ký thành công', user: newUser });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Đăng nhập
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { Email: email, PasswordHash: password } });
    if (!user) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    res.status(200).json({ message: 'Đăng nhập thành công', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Gửi mã OTP Quên Mật Khẩu
exports.forgotPassword = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email là bắt buộc' });

    const user = await User.findOne({ where: { Email: email } });
    if (!user) return res.status(404).json({ error: 'Email không tồn tại trong hệ thống' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = { otp, expires: Date.now() + 5 * 60 * 1000 }; // Mã hết hạn sau 5 phút

    // Lấy transporter từ file config/mail hoặc tạo mới bằng Nodemailer
    let transporter;
    try {
      const { getTransporter } = require('../config/mail');
      transporter = getTransporter();
    } catch {
      transporter = null;
    }

    if (!transporter) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER || 'YOUR_EMAIL@gmail.com', // Thay bằng email của bạn hoặc cấu hình trong .env
          pass: process.env.SMTP_PASS || 'YOUR_APP_PASSWORD'     // Mật khẩu ứng dụng Gmail (App Password)
        }
      });
    }

    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"MANB SHOP" <noreply@manb.vn>',
      to: email,
      subject: 'Mã xác thực OTP - Đặt lại mật khẩu MANB SHOP',
      text: `Mã OTP đặt lại mật khẩu của bạn là: ${otp}. Mã có hiệu lực trong 5 phút.`
    });

    res.status(200).json({ message: 'Mã OTP đã được gửi đến email của bạn' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Xác thực mã OTP (Bước trung gian trước khi đổi mật khẩu mới)
exports.verifyOtp = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();
    const record = otpStore[email];

    if (!record || record.otp !== otp || Date.now() > record.expires) {
      return res.status(400).json({ error: 'Mã OTP không hợp lệ hoặc đã hết hạn' });
    }

    res.status(200).json({ message: 'Xác thực OTP thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Đặt lại mật khẩu mới bằng OTP
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const record = otpStore[cleanEmail];

    if (!record || record.otp !== otp || Date.now() > record.expires) {
      return res.status(400).json({ error: 'Mã OTP không hợp lệ hoặc đã hết hạn' });
    }

    await User.update({ PasswordHash: newPassword }, { where: { Email: cleanEmail } });
    delete otpStore[cleanEmail];
    res.status(200).json({ message: 'Đặt lại mật khẩu thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Giữ lại hàm tương thích ngược
exports.resetPasswordOTP = exports.resetPassword;

// Đăng nhập / Đăng ký bằng Google
exports.googleLogin = async (req, res) => {
  try {
    const { fullName, email, avatar } = req.body;
    let user = await User.findOne({ where: { Email: email } });

    if (!user) {
      user = await User.create({
        FullName: fullName,
        Email: email,
        Avatar: avatar,
        Role: 'Customer'
      });
    }

    res.status(200).json({ message: 'Thành công', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// OTP đăng nhập
exports.sendLoginOtp = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email là bắt buộc' });
    
    const user = await User.findOne({ where: { Email: email } });
    if (!user) return res.status(404).json({ error: 'Email không tồn tại trong hệ thống' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[`login:${email}`] = { otp, expires: Date.now() + 5 * 60 * 1000 };

    let transporter;
    try {
      const { getTransporter } = require('../config/mail');
      transporter = getTransporter();
    } catch {
      transporter = null;
    }

    if (!transporter) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER || 'YOUR_EMAIL@gmail.com',
          pass: process.env.SMTP_PASS || 'YOUR_APP_PASSWORD'
        }
      });
    }

    await transporter.sendMail({ 
      from: process.env.SMTP_FROM || process.env.SMTP_USER || '"MANB SHOP" <noreply@manb.vn>', 
      to: email, 
      subject: 'Mã OTP đăng nhập', 
      text: `Mã OTP của bạn là ${otp}. Mã có hiệu lực trong 5 phút.` 
    });

    return res.json({ message: 'Đã gửi OTP' });
  } catch (error) { 
    return res.status(500).json({ error: error.message }); 
  }
};

exports.verifyLoginOtp = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();
    const record = otpStore[`login:${email}`];

    if (!record || record.otp !== otp || Date.now() > record.expires) {
      return res.status(400).json({ error: 'OTP không hợp lệ hoặc đã hết hạn' });
    }

    const user = await User.findOne({ where: { Email: email }, attributes: { exclude: ['PasswordHash'] } });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

    delete otpStore[`login:${email}`];
    return res.json({ message: 'Đăng nhập thành công', user });
  } catch (error) { 
    return res.status(500).json({ error: error.message }); 
  }
};