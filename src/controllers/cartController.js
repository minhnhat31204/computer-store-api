const { CartItem, Product } = require('../models'); // Hoặc tên model Cart của bạn

exports.getAll = async (req, res) => {
  try {
    const data = await CartItem.findAll();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getByUser = async (req, res) => {
  try {
    const data = await CartItem.findAll({ where: { UserID: req.params.userId } });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const newItem = await CartItem.create(req.body);
    res.status(201).json(newItem);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// BỔ SUNG HÀM UPDATE
exports.update = async (req, res) => {
  try {
    await CartItem.update(req.body, { where: { ID: req.params.id } }); // Kiểm tra lại tên khóa chính ID/CartID
    res.status(200).json({ message: 'Updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// BỔ SUNG HÀM DELETE
exports.delete = async (req, res) => {
  try {
    await CartItem.destroy({ where: { ID: req.params.id } });
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};