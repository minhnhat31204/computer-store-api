const { Review, User, Product } = require('../models');

exports.getAll = async (req, res) => {
  try {
    const data = await Review.findAll({
      include: [
        { model: User, attributes: ['FullName'] },
        { model: Product, attributes: ['ProductName'] }
      ]
    });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getByProduct = async (req, res) => {
  try {
    const data = await Review.findAll({
      where: { ProductID: req.params.productId },
      include: [{ model: User, attributes: ['FullName'] }]
    });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const newItem = await Review.create(req.body);
    res.status(201).json(newItem);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    await Review.update(req.body, { where: { ReviewID: req.params.id } });
    res.status(200).json({ message: 'Updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await Review.destroy({ where: { ReviewID: req.params.id } });
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};