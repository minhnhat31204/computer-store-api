const { Op } = require('sequelize');
const { User } = require('../models');
const {
  normalizePhone, phoneLookupValues, issueChallenge, checkChallenge,
  getVerifiedChallenge, consumeChallenge, sendSms, sendEmail, sendChallenge,
  hashPassword, verifyPassword,
} = require('../services/authSecurity');

function sendError(res, error, fallback) {
  const status = Number(error.status) || 500;
  if (status >= 500) console.error(fallback, error.message);
  return res.status(status).json({ error: status >= 500 && status !== 503 ? fallback : error.message });
}

function emailAddress(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Email không hợp lệ.'), { status: 400 });
  return email;
}

function resetKey(channel, value) {
  return `reset:${channel}:${value}`;
}

function resetContact(channel, body) {
  if (channel === 'phone') return normalizePhone(body.phone);
  if (channel === 'email') return emailAddress(body.email);
  throw Object.assign(new Error('Phương thức nhận OTP không hợp lệ.'), { status: 400 });
}

function safeUser(user) {
  const value = user.toJSON();
  delete value.PasswordHash;
  return value;
}

// Send registration OTP to a phone before creating the account.
exports.sendRegisterOtp = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const existing = await User.findOne({ where: { Phone: { [Op.in]: phoneLookupValues(phone) } } });
    if (existing) return res.status(409).json({ error: 'Số điện thoại đã được đăng ký.' });
    await sendChallenge(`register:${phone}`, (code) => sendSms(phone, code));
    return res.json({ message: 'Đã gửi mã xác thực đến số điện thoại.' });
  } catch (error) {
    return sendError(res, error, 'Không gửi được mã SMS.');
  }
};

exports.register = async (req, res) => {
  try {
    const phone = req.body.phone ? normalizePhone(req.body.phone) : '';
    const otp = String(req.body.otp || '').trim();
    const password = String(req.body.password || '');
    if (password.length < 8) return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 8 ký tự.' });
    const email = req.body.email ? emailAddress(req.body.email) : '';
    if (otp) {
      if (!phone || !checkChallenge(`register:${phone}`, otp)) return res.status(400).json({ error: 'Mã OTP không hợp lệ hoặc đã hết hạn.' });
    } else if (!email) {
      return res.status(400).json({ error: 'Hãy xác minh số điện thoại bằng OTP trước khi đăng ký.' });
    }
    const where = phone ? { Phone: { [Op.in]: phoneLookupValues(phone) } } : null;
    const existing = where ? await User.findOne({ where }) : null;
    if (existing) return res.status(409).json({ error: 'Số điện thoại đã được đăng ký.' });

    const passwordHash = await hashPassword(password);
    const emailAddressToSave = email || `phone-${phone.replace(/\D/g, '')}@phone.manb.local`;
    const user = await User.create({
      FullName: String(req.body.fullName || '').trim() || (phone ? `Khách hàng ${phone.slice(-4)}` : 'Khách hàng'),
      Email: emailAddressToSave,
      Phone: phone || null,
      PasswordHash: passwordHash,
      RecoveryEmailVerified: false,
      Role: 'Customer',
    });
    if (otp) consumeChallenge(`register:${phone}`);
    return res.status(201).json({ message: 'Đăng ký thành công.', user: safeUser(user) });
  } catch (error) {
    return sendError(res, error, 'Đăng ký thất bại.');
  }
};

// Phone is the primary login identifier; email remains supported for older app accounts.
exports.login = async (req, res) => {
  try {
    const identifier = String(req.body.phone || req.body.email || '').trim();
    const password = String(req.body.password || '');
    if (!identifier || !password) return res.status(400).json({ error: 'Vui lòng nhập số điện thoại và mật khẩu.' });
    const isEmail = identifier.includes('@');
    const conditions = isEmail
      ? [{ Email: identifier.toLowerCase() }]
      : [{ Phone: { [Op.in]: phoneLookupValues(identifier) } }];
    const user = await User.findOne({ where: { [Op.or]: conditions } });
    if (!user) return res.status(401).json({ error: 'Số điện thoại hoặc mật khẩu không đúng.' });
    const result = await verifyPassword(password, user.PasswordHash);
    if (!result.valid) return res.status(401).json({ error: 'Số điện thoại hoặc mật khẩu không đúng.' });
    if (result.needsUpgrade) {
      user.PasswordHash = await hashPassword(password);
      await user.save();
    }
    return res.json({ message: 'Đăng nhập thành công.', user: safeUser(user) });
  } catch (error) {
    return sendError(res, error, 'Đăng nhập thất bại.');
  }
};

exports.sendPasswordResetOtp = async (req, res) => {
  try {
    const channel = String(req.body.channel || '');
    if (!['phone', 'email'].includes(channel)) return res.status(400).json({ error: 'Phương thức nhận OTP không hợp lệ.' });
    const contact = resetContact(channel, req.body);
    const user = channel === 'phone'
      ? await User.findOne({ where: { Phone: { [Op.in]: phoneLookupValues(contact) } } })
      : await User.findOne({ where: { [Op.or]: [
          { RecoveryEmail: contact, RecoveryEmailVerified: true },
          { Email: contact },
        ] } });

    // Keep the response generic so this endpoint does not reveal whether an account exists.
    if (user) {
      const key = resetKey(channel, contact);
      if (channel === 'phone') await sendChallenge(key, (code) => sendSms(contact, code));
      else await sendChallenge(key, (code) => sendEmail(contact, code, 'Mã OTP đặt lại mật khẩu MANB SHOP'));
    }
    return res.json({ message: 'Nếu thông tin khớp tài khoản, mã OTP sẽ được gửi đến bạn.' });
  } catch (error) {
    return sendError(res, error, 'Không gửi được mã OTP.');
  }
};

exports.verifyPasswordResetOtp = async (req, res) => {
  try {
    const channel = String(req.body.channel || '');
    const contact = resetContact(channel, req.body);
    const record = checkChallenge(resetKey(channel, contact), req.body.otp);
    if (!record) return res.status(400).json({ error: 'Mã OTP không hợp lệ hoặc đã hết hạn.' });
    return res.json({ message: 'Xác thực OTP thành công.' });
  } catch (error) {
    return sendError(res, error, 'Không xác thực được mã OTP.');
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const channel = String(req.body.channel || '');
    const contact = resetContact(channel, req.body);
    const key = resetKey(channel, contact);
    const record = getVerifiedChallenge(key);
    const password = String(req.body.newPassword || '');
    if (!record) return res.status(400).json({ error: 'Hãy xác thực OTP trước khi đổi mật khẩu.' });
    if (password.length < 8) return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 8 ký tự.' });
    const user = channel === 'phone'
      ? await User.findOne({ where: { Phone: { [Op.in]: phoneLookupValues(contact) } } })
      : await User.findOne({ where: { [Op.or]: [
          { RecoveryEmail: contact, RecoveryEmailVerified: true },
          { Email: contact },
        ] } });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    user.PasswordHash = await hashPassword(password);
    await user.save();
    consumeChallenge(key);
    return res.json({ message: 'Đặt lại mật khẩu thành công.' });
  } catch (error) {
    return sendError(res, error, 'Không đặt lại được mật khẩu.');
  }
};

exports.sendEmailVerificationOtp = async (req, res) => {
  try {
    const userId = Number(req.body.userId);
    const email = emailAddress(req.body.email);
    const currentPassword = String(req.body.currentPassword || '');
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    const passwordCheck = await verifyPassword(currentPassword, user.PasswordHash);
    if (!currentPassword || !passwordCheck.valid) return res.status(401).json({ error: 'Nhập đúng mật khẩu hiện tại để xác minh email mới.' });
    const existing = await User.findOne({ where: { RecoveryEmail: email } });
    if (existing && existing.UserID !== user.UserID) return res.status(409).json({ error: 'Email đã được dùng bởi tài khoản khác.' });
    const key = `email:${userId}:${email}`;
    await sendChallenge(key, (code) => sendEmail(email, code, 'Mã OTP xác minh email MANB SHOP'));
    return res.json({ message: 'Đã gửi mã xác minh đến email.' });
  } catch (error) {
    return sendError(res, error, 'Không gửi được mã email.');
  }
};

exports.verifyEmailOtp = async (req, res) => {
  try {
    const userId = Number(req.body.userId);
    const email = emailAddress(req.body.email);
    const key = `email:${userId}:${email}`;
    if (!checkChallenge(key, req.body.otp)) return res.status(400).json({ error: 'Mã OTP không hợp lệ hoặc đã hết hạn.' });
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    const existing = await User.findOne({ where: { RecoveryEmail: email } });
    if (existing && existing.UserID !== user.UserID) return res.status(409).json({ error: 'Email đã được dùng bởi tài khoản khác.' });
    user.RecoveryEmail = email;
    user.RecoveryEmailVerified = true;
    await user.save();
    consumeChallenge(key);
    return res.json({ message: 'Email đã được xác minh.', user: safeUser(user) });
  } catch (error) {
    return sendError(res, error, 'Không xác minh được email.');
  }
};

// Backwards-compatible endpoints used by older web/app clients.
exports.forgotPassword = (req, res) => { req.body.channel = 'email'; return exports.sendPasswordResetOtp(req, res); };
exports.verifyOtp = (req, res) => { req.body.channel = 'email'; return exports.verifyPasswordResetOtp(req, res); };
exports.resetPasswordLegacy = (req, res) => { req.body.channel = 'email'; return exports.resetPassword(req, res); };
exports.resetPasswordOTP = exports.resetPasswordLegacy;

exports.googleLogin = async (req, res) => {
  try {
    const { fullName, email, avatar } = req.body;
    let user = await User.findOne({ where: { Email: email } });
    if (!user) user = await User.create({ FullName: fullName, Email: email, Avatar: avatar, Role: 'Customer' });
    return res.json({ message: 'Thành công', user: safeUser(user) });
  } catch (error) {
    return sendError(res, error, 'Đăng nhập Google thất bại.');
  }
};

exports.sendLoginOtp = async (req, res) => {
  try {
    const email = emailAddress(req.body.email);
    const user = await User.findOne({ where: { Email: email } });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    await sendChallenge(`login:${email}`, (code) => sendEmail(email, code, 'Mã OTP đăng nhập MANB SHOP'));
    return res.json({ message: 'Đã gửi OTP.' });
  } catch (error) {
    return sendError(res, error, 'Không gửi được OTP.');
  }
};

exports.verifyLoginOtp = async (req, res) => {
  try {
    const email = emailAddress(req.body.email);
    if (!checkChallenge(`login:${email}`, req.body.otp)) return res.status(400).json({ error: 'OTP không hợp lệ hoặc đã hết hạn.' });
    const user = await User.findOne({ where: { Email: email }, attributes: { exclude: ['PasswordHash'] } });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    consumeChallenge(`login:${email}`);
    return res.json({ message: 'Đăng nhập thành công.', user });
  } catch (error) {
    return sendError(res, error, 'Đăng nhập OTP thất bại.');
  }
};
