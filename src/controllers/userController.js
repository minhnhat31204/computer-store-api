const { User } = require('../models');

exports.getAll = async (req, res) => {
  try {
    const data = await User.findAll();
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
    const newItem = await User.create(req.body);
    res.status(201).json(newItem);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    await User.update(req.body, { where: { UserID: req.params.id } });
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