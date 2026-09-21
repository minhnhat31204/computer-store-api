const { User } = require('../models');
const nodemailer = require('nodemailer');

// LÆ°u trá»¯ OTP táº¡m thá»i trong bá»™ nhá»› (Production nÃªn lÆ°u CSDL/Redis)
const otpStore = {}; 

// ÄÄƒng kÃ½
exports.register = async (req, res) => {
  try {
    const {fullName, email, password, phone} = req.body;
    const newUser = await User.create({ FullName: fullName, Email: email, PasswordHash: password, Phone: phone });
    res.status(201).json({ message: 'ÄÄƒng kÃ½ thÃ nh cÃ´ng', user: newUser });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ÄÄƒng nháº­p
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { Email: email, PasswordHash: password } });
    if (!user) return res.status(401).json({ error: 'Email hoáº·c máº­t kháº©u khÃ´ng Ä‘Ãºng' });
    res.status(200).json({ message: 'ÄÄƒng nháº­p thÃ nh cÃ´ng', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Gá»­i mÃ£ OTP QuÃªn Máº­t Kháº©u
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ where: { Email: email } });
  if (!user) return res.status(404).json({ error: 'Email khÃ´ng tá»“n táº¡i trong há»‡ thá»‘ng' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = { otp, expires: Date.now() + 5 * 60 * 1000 }; // MÃ£ háº¿t háº¡n sau 5 phÃºt

  // Cáº¥u hÃ¬nh Nodemailer gá»­i mail
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'YOUR_EMAIL@gmail.com', // Thay báº±ng email cá»§a báº¡n
      pass: 'YOUR_APP_PASSWORD'      // Máº­t kháº©u á»©ng dá»¥ng Gmail (App Password)
    }
  });

  await transporter.sendMail({
    from: '"MANB SHOP" <YOUR_EMAIL@gmail.com>',
    to: email,
    subject: 'MÃ£ xÃ¡c thá»±c OTP - Äáº·t láº¡i máº­t kháº©u MANB SHOP',
    text: `MÃ£ OTP Ä‘áº·t láº¡i máº­t kháº©u cá»§a báº¡n lÃ : ${otp}. MÃ£ cÃ³ hiá»‡u lá»±c trong 5 phÃºt.`
  });

  res.status(200).json({ message: 'MÃ£ OTP Ä‘Ã£ Ä‘Æ°á»£c gá»­i Ä‘áº¿n email cá»§a báº¡n' });
};

// Äáº·t láº¡i máº­t kháº©u báº±ng OTP
exports.resetPasswordOTP = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const record = otpStore[email];

  if (!record || record.otp !== otp || Date.now() > record.expires) {
    return res.status(400).json({ error: 'MÃ£ OTP khÃ´ng há»£p lá»‡ hoáº·c Ä‘Ã£ háº¿t háº¡n' });
  }

  await User.update({ PasswordHash: newPassword }, { where: { Email: email } });
  delete otpStore[email];
  res.status(200).json({ message: 'Äáº·t láº¡i máº­t kháº©u thÃ nh cÃ´ng' });
};

// ÄÄƒng nháº­p / ÄÄƒng kÃ½ báº±ng Google
exports.googleLogin = async (req, res) => {
  try {
    const { fullName, email, avatar } = req.body;

    // TÃ¬m xem user Ä‘Ã£ tá»“n táº¡i trong DB theo Email chÆ°a
    let user = await User.findOne({ where: { Email: email } });

    if (!user) {
      // Náº¿u chÆ°a cÃ³ thÃ¬ tá»± Ä‘á»™ng táº¡o má»›i
      user = await User.create({
        FullName: fullName,
        Email: email,
        Avatar: avatar,
        Role: 'Customer'
      });
    }

    res.status(200).json({ message: 'ThÃ nh cÃ´ng', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



// OTP đăng nhập: yêu cầu cấu hình SMTP trong .env
exports.sendLoginOtp = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email là bắt buộc' });
    const user = await User.findOne({ where: { Email: email } });
    if (!user) return res.status(404).json({ error: 'Email không tồn tại trong hệ thống' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[`login:${email}`] = { otp, expires: Date.now() + 5 * 60 * 1000 };
    const { getTransporter } = require('../config/mail');
    const transporter = getTransporter();
    if (!transporter) return res.status(503).json({ error: 'Chưa cấu hình SMTP trên Backend' });
    await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: email, subject: 'Mã OTP đăng nhập', text: `Mã OTP của bạn là ${otp}. Mã có hiệu lực trong 5 phút.` });
    return res.json({ message: 'Đã gửi OTP' });
  } catch (error) { return res.status(500).json({ error: error.message }); }
};

exports.verifyLoginOtp = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();
    const record = otpStore[`login:${email}`];
    if (!record || record.otp !== otp || Date.now() > record.expires) return res.status(400).json({ error: 'OTP không hợp lệ hoặc đã hết hạn' });
    const user = await User.findOne({ where: { Email: email }, attributes: { exclude: ['PasswordHash'] } });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    delete otpStore[`login:${email}`];
    return res.json({ message: 'Đăng nhập thành công', user });
  } catch (error) { return res.status(500).json({ error: error.message }); }
};
