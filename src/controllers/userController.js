const { User } = require('../models');
const { hashPassword } = require('../services/authSecurity');

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
    const { Password, ...fields } = req.body;
    if (Password) fields.PasswordHash = await hashPassword(String(Password));
    await User.update(fields, { where: { UserID: req.params.id } });
    res.status(200).json({ message: 'Updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    await User.destroy({ where: { UserID: req.params.id } });
    res.status(200).json({ message: 'Deleted successfully' });
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
    if (req.file) user.Avatar = `/uploads/${req.file.filename}`;
    await user.save();

    const safeUser = user.toJSON();
    delete safeUser.PasswordHash;
    return res.json({ message: 'Đã cập nhật hồ sơ.', user: safeUser });
  } catch (error) {
    return res.status(500).json({ error: 'Không cập nhật được hồ sơ.' });
  }
};
