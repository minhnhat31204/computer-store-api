const { Product, Category } = require('../models');

exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.findAll({ include: Category });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const newProduct = await Product.create(req.body);
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    await Product.update(req.body, { where: { ProductID: req.params.id } });
    res.status(200).json({ message: 'Updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    await Product.destroy({ where: { ProductID: req.params.id } });
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};