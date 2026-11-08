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
    const id = req.params.id;
    const { ProductVariant, OrderItem, CartItemDB, Favorite, Review } = require('../models');

    // Clean up dependent child records
    if (ProductVariant) await ProductVariant.destroy({ where: { ProductID: id } }).catch(() => {});
    if (CartItemDB) await CartItemDB.destroy({ where: { ProductID: id } }).catch(() => {});
    if (Favorite) await Favorite.destroy({ where: { ProductID: id } }).catch(() => {});
    if (Review) await Review.destroy({ where: { ProductID: id } }).catch(() => {});
    // For OrderItems, keep order history intact by detaching ProductID (which we altered to NULL)
    if (OrderItem) await OrderItem.update({ ProductID: null }, { where: { ProductID: id } }).catch(() => {});

    const deletedCount = await Product.destroy({ where: { ProductID: id } });
    if (!deletedCount) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm để xóa' });
    }
    res.status(200).json({ message: 'Xóa sản phẩm thành công' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: error.message });
  }
};


