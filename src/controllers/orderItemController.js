const { OrderItem, Product } = require('../models');

exports.getAll = async (req, res) => {
  try {
    const data = await OrderItem.findAll({
      include: [{ model: Product, attributes: ['ProductName'] }]
    });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getByOrder = async (req, res) => {
  try {
    const data = await OrderItem.findAll({
      where: { OrderID: req.params.orderId },
      include: [Product]
    });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const newItem = await OrderItem.create(req.body);
    res.status(201).json(newItem);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    await OrderItem.update(req.body, { where: { OrderItemID: req.params.id } });
    res.status(200).json({ message: 'Updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await OrderItem.destroy({ where: { OrderItemID: req.params.id } });
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};