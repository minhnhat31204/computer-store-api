const fs = require('fs');
const path = require('path');
const { User, CartItemDB, Favorite, Notification, AddressBookEntry, Review, Order, SupportConversation } = require('../models');
const { hashPassword, verifyPassword } = require('../services/authSecurity');

exports.getAll = async (req, res) => {
  try {
    const data = await User.findAll({ attributes: { exclude: ['PasswordHash'] } });
    res.status(200).json(data);
  } catch (err) {
    console.error("🔥 LỖI CHI TIẾT KHI GỌI USER.findAll():", err);
    res.status(500).json({ 
      error: err.message, 
      details: err.original ? err.original.message : null 
    });
  }
};

exports.create = async (req, res) => {
  try {
    if (Object.prototype.hasOwnProperty.call(req.body, 'PasswordHash')) {
      return res.status(400).json({ error: 'Không nhận mật khẩu đã mã hóa trực tiếp.' });
    }
    const { Password, ...fields } = req.body;
    const newItem = await User.create({
      ...fields,
      PasswordHash: Password ? await hashPassword(String(Password)) : null,
    });
    const safeUser = newItem.toJSON();
    delete safeUser.PasswordHash;
    res.status(201).json(safeUser);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const targetUserId = Number(req.params.id);
    const requesterRole = String(req.user?.role || '').toLowerCase();
    const requesterId = Number(req.user?.userId || req.user?.UserID || 0);

    // BẢO MẬT: Chỉ chính chủ tài khoản hoặc Admin mới có quyền sửa thông tin
    if (requesterRole !== 'admin' && requesterId !== targetUserId) {
      return res.status(403).json({ message: 'Bạn không có quyền sửa thông tin người dùng khác.' });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'PasswordHash')) {
      return res.status(400).json({ error: 'Không nhận mật khẩu đã mã hóa trực tiếp.' });
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'Phone')) {
      return res.status(400).json({ error: 'Số điện thoại tài khoản được cố định sau khi tạo.' });
    }

    const { oldPassword, newPassword, Password, ...fields } = req.body;
    const user = await User.findByPk(targetUserId);

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Nếu người dùng có nhập mật khẩu mới hoặc mật khẩu cũ
    if (oldPassword || newPassword) {
      if (!oldPassword || !newPassword) {
        return res.status(400).json({ 
          message: 'Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới.' 
        });
      }

      const oldCheck = await verifyPassword(String(oldPassword), user.PasswordHash);
      if (!oldCheck.valid) {
        return res.status(400).json({ 
          message: 'Mật khẩu cũ không chính xác.' 
        });
      }

      if (String(newPassword).length < 8) {
        return res.status(400).json({ 
          message: 'Mật khẩu mới phải có ít nhất 8 ký tự.' 
        });
      }

      const newCheck = await verifyPassword(String(newPassword), user.PasswordHash);
      if (newCheck.valid) {
        return res.status(400).json({ 
          message: 'Mật khẩu mới không được trùng với mật khẩu hiện tại.' 
        });
      }

      user.PasswordHash = await hashPassword(String(newPassword));
    }

    // Cập nhật các trường thông tin cá nhân khác
    if (fields.FullName !== undefined) user.FullName = fields.FullName;
    if (fields.Email !== undefined) user.Email = fields.Email;
    if (fields.Address !== undefined) user.Address = fields.Address;
    if (fields.Gender !== undefined) user.Gender = fields.Gender;
    if (fields.Birthday !== undefined) user.Birthday = fields.Birthday;
    if (fields.Avatar !== undefined) user.Avatar = fields.Avatar;
    if (fields.Username !== undefined) user.Username = fields.Username;
    if (fields.Bio !== undefined) user.Bio = fields.Bio;

    // BẢO MẬT: CHỈ CÓ ADMIN THỰC SỰ MỚI ĐƯỢC PHÉP THAY ĐỔI ROLE
    if (requesterRole === 'admin') {
      const rawRole = fields.Role !== undefined ? fields.Role : fields.role;
      if (rawRole !== undefined && rawRole !== null && String(rawRole).trim() !== '') {
        const cleanRole = String(rawRole).trim();
        user.Role = cleanRole.toLowerCase() === 'admin' ? 'Admin' : 'Customer';
      }
    }

    await user.save();

    const safeUser = user.toJSON();
    delete safeUser.PasswordHash;

    return res.status(200).json({ message: 'Cập nhật thông tin thành công', user: safeUser });
  } catch (err) {
    console.error("Lỗi update user:", err);
    return res.status(500).json({ message: err.message });
  }
};

exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const rawRole = req.body.role !== undefined ? req.body.role : req.body.Role;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    if (!rawRole || String(rawRole).trim() === '') {
      return res.status(400).json({ error: 'Vui lòng cung cấp role (Admin hoặc Customer)' });
    }

    user.Role = String(rawRole).trim().toLowerCase() === 'admin' ? 'Admin' : 'Customer';
    await user.save();

    const safeUser = user.toJSON();
    delete safeUser.PasswordHash;

    res.status(200).json({ message: 'Cập nhật quyền thành công', user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    }

    if (CartItemDB) await CartItemDB.destroy({ where: { UserID: userId } }).catch(() => {});
    if (Favorite) await Favorite.destroy({ where: { UserID: userId } }).catch(() => {});
    if (Notification) await Notification.destroy({ where: { UserID: userId } }).catch(() => {});
    if (AddressBookEntry) await AddressBookEntry.destroy({ where: { UserID: userId } }).catch(() => {});
    if (Review) await Review.destroy({ where: { UserID: userId } }).catch(() => {});
    if (Order) await Order.update({ UserID: null }, { where: { UserID: userId } }).catch(() => {});
    if (SupportConversation) await SupportConversation.update({ UserID: null }, { where: { UserID: userId } }).catch(() => {});

    await user.destroy();
    res.status(200).json({ message: 'Xóa tài khoản thành công.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.checkPhone = async (req, res) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ where: { Phone: phone } });
    if (user) {
      return res.status(200).json({ user: user });
    } else {
      return res.status(200).json({ user: null });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const targetUserId = Number(req.params.id);
    const requesterRole = String(req.user?.role || '').toLowerCase();
    const requesterId = Number(req.user?.userId || req.user?.UserID || 0);

    // BẢO MẬT: Chỉ chính chủ tài khoản hoặc Admin mới có quyền sửa thông tin
    if (requesterRole !== 'admin' && requesterId !== targetUserId) {
      return res.status(403).json({ error: 'Bạn không có quyền sửa thông tin người dùng khác.' });
    }

    const fullName = String(req.body.fullName || '').trim();
    if (!fullName) return res.status(400).json({ error: 'Tên hiển thị không được để trống.' });
    if (fullName.length > 100) return res.status(400).json({ error: 'Tên hiển thị không được dài quá 100 ký tự.' });

    const user = await User.findByPk(targetUserId);
    if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng.' });

    user.FullName = fullName;
    // ID người dùng là duy nhất và KHÔNG ĐƯỢC SỬA sau khi đã tạo
    if (!user.Username && req.body.username) {
      const cleanUsername = String(req.body.username).trim().toLowerCase().replace(/^@/, '');
      if (/^[a-zA-Z0-9_]{3,30}$/.test(cleanUsername)) {
        const existingU = await User.findOne({ where: { Username: cleanUsername } });
        if (!existingU || existingU.UserID === user.UserID) {
          user.Username = cleanUsername;
        }
      }
    }
    if (req.body.bio !== undefined) user.Bio = String(req.body.bio || '').trim() || null;
    if (req.body.gender !== undefined) user.Gender = String(req.body.gender || '').trim() || null;
    if (req.body.birthday !== undefined) user.Birthday = req.body.birthday ? String(req.body.birthday).trim() : null;
    if (req.body.address !== undefined) user.Address = String(req.body.address || '').trim() || null;
    if (req.file) {
      const oldAvatar = user.Avatar;
      user.Avatar = `/api/uploads/${req.file.filename}`;
      if (oldAvatar && (oldAvatar.startsWith('/uploads/') || oldAvatar.startsWith('/api/uploads/'))) {
        try {
          const oldFilename = path.basename(oldAvatar);
          const oldFilePath = path.resolve(__dirname, '../../uploads', oldFilename);
          if (fs.existsSync(oldFilePath)) {
            fs.unlink(oldFilePath, () => {});
          }
        } catch (cleanupErr) {
          console.warn('Cannot delete old avatar:', cleanupErr.message);
        }
      }
    }

    await user.save();

    const safeUser = user.toJSON();
    delete safeUser.PasswordHash;
    return res.json({ message: 'Đã cập nhật hồ sơ.', user: safeUser });
  } catch (error) {
    console.error('Lỗi updateProfile:', error);
    return res.status(500).json({ error: 'Không cập nhật được hồ sơ.' });
  }
};
