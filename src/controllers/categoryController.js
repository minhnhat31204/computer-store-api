const { Category } = require('../models');

exports.getAll = async (req, res) => {
  try {
    const data = await Category.findAll();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const newItem = await Category.create(req.body);
    res.status(201).json(newItem);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await Category.destroy({ where: { CategoryID: req.params.id } });
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    await Category.update(req.body, { where: { CategoryID: id } });
    res.status(200).json({ message: 'Updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};