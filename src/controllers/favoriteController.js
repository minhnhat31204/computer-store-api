const { Favorite, Product } = require('../models');

// 1. Lấy tất cả danh sách (Dành cho Admin Panel)
exports.getAllFavorites = async (req, res) => {
  try {
    const favorites = await Favorite.findAll();
    res.json(favorites);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. Lấy danh sách yêu thích theo UserID (Dành cho App/User)
exports.getFavorites = async (req, res) => {
  try {
    const { userId } = req.params;
    const favorites = await Favorite.findAll({
      where: { UserID: userId },
      include: [
        {
          model: Product,
          as: 'Product' // Khớp với alias 'Product' ở dòng 70 trong index.js
        }
      ]
    });
    res.json(favorites);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. Thêm hoặc Bỏ yêu thích
exports.toggleFavorite = async (req, res) => {
  try {
    const { userId, productId } = req.body;
    const existing = await Favorite.findOne({
      where: { UserID: userId, ProductID: productId }
    });

    if (existing) {
      await existing.destroy();
      return res.json({ isFavorite: false, message: 'Đã xóa khỏi yêu thích' });
    } else {
      await Favorite.create({ UserID: userId, ProductID: productId });
      return res.json({ isFavorite: true, message: 'Đã thêm vào yêu thích' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. Xóa theo FavoriteID (Dành cho Admin Panel)
exports.deleteFavorite = async (req, res) => {
  try {
    const { id } = req.params;
    await Favorite.destroy({ where: { FavoriteID: id } });
    res.json({ message: 'Xóa thành công' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};