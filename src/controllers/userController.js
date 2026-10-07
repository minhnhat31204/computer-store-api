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
    if (Object.prototype.hasOwnProperty.call(req.body, 'PasswordHash')) {
      return res.status(400).json({ error: 'Không nhận mật khẩu đã mã hóa trực tiếp.' });
    }

    const { oldPassword, newPassword, Password, ...fields } = req.body;
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Nếu người dùng có nhập mật khẩu mới hoặc mật khẩu cũ
    if (oldPassword || newPassword) {
      // 1. Bắt buộc phải nhập đầy đủ cả 2 trường
      if (!oldPassword || !newPassword) {
        return res.status(400).json({ 
          message: 'Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới.' 
        });
      }

      // 2. Kiểm tra MẬT KHẨU CŨ (Trích xuất thuộc tính .valid)
      const oldCheck = await verifyPassword(String(oldPassword), user.PasswordHash);
      if (!oldCheck.valid) {
        return res.status(400).json({ 
          message: 'Mật khẩu cũ không chính xác.' 
        });
      }

      // 3. Kiểm tra MẬT KHẨU MỚI (Không được trùng mật khẩu cũ)
      const newCheck = await verifyPassword(String(newPassword), user.PasswordHash);
      if (newCheck.valid) {
        return res.status(400).json({ 
          message: 'Mật khẩu mới không được trùng với mật khẩu hiện tại.' 
        });
      }

      // 4. Mã hóa và lưu mật khẩu mới vào biến user
      user.PasswordHash = await hashPassword(String(newPassword));
    }

    // Cập nhật các trường thông tin cá nhân khác
    if (fields.FullName !== undefined) user.FullName = fields.FullName;
    if (fields.Email !== undefined) user.Email = fields.Email;
    if (fields.Address !== undefined) user.Address = fields.Address;
    if (fields.Gender !== undefined) user.Gender = fields.Gender;
    if (fields.Birthday !== undefined) user.Birthday = fields.Birthday;
    if (fields.Avatar !== undefined) user.Avatar = fields.Avatar;

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
    const { role } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    user.Role = role;
    await user.save();

    res.status(200).json({ message: 'Cập nhật quyền thành công', user });
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

    // Xóa/gỡ bỏ liên kết các bản ghi phụ thuộc tránh lỗi ràng buộc khóa ngoại (Foreign Key)
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
    const fullName = String(req.body.fullName || '').trim();
    if (!fullName) return res.status(400).json({ error: 'Tên hiển thị không được để trống.' });
    if (fullName.length > 100) return res.status(400).json({ error: 'Tên hiển thị không được dài quá 100 ký tự.' });

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng.' });

    user.FullName = fullName;
    if (req.body.username !== undefined) user.Username = String(req.body.username || '').trim() || null;
    if (req.body.bio !== undefined) user.Bio = String(req.body.bio || '').trim() || null;
    if (req.body.gender !== undefined) user.Gender = String(req.body.gender || '').trim() || null;
    if (req.body.birthday !== undefined) user.Birthday = req.body.birthday ? String(req.body.birthday).trim() : null;
    if (req.body.phone !== undefined) user.Phone = String(req.body.phone || '').trim() || null;
    if (req.body.address !== undefined) user.Address = String(req.body.address || '').trim() || null;
    if (req.file) user.Avatar = `/uploads/${req.file.filename}`;

    await user.save();

    const safeUser = user.toJSON();
    delete safeUser.PasswordHash;
    return res.json({ message: 'Đã cập nhật hồ sơ.', user: safeUser });
  } catch (error) {
    console.error('Lỗi updateProfile:', error);
    return res.status(500).json({ error: 'Không cập nhật được hồ sơ.' });
  }
};