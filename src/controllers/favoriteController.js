const { Favorite, Product } = require('../models');

// 1. Láº¥y táº¥t cáº£ danh sÃ¡ch (DÃ nh cho Admin Panel)
exports.getAllFavorites = async (req, res) => {
  try {
    const favorites = await Favorite.findAll();
    res.json(favorites);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. Láº¥y danh sÃ¡ch yÃªu thÃ­ch theo UserID (DÃ nh cho App/User)
exports.getFavorites = async (req, res) => {
  try {
    const { userId } = req.params;
    const favorites = await Favorite.findAll({
      where: { UserID: userId },
      include: [
        {
          model: Product,
          as: 'Product' // Khá»›p vá»›i alias 'Product' á»Ÿ dÃ²ng 70 trong index.js
        }
      ]
    });
    res.json(favorites);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. ThÃªm hoáº·c Bá» yÃªu thÃ­ch
exports.toggleFavorite = async (req, res) => {
  try {
    const { userId, productId } = req.body;
    const existing = await Favorite.findOne({
      where: { UserID: userId, ProductID: productId }
    });

    if (existing) {
      await existing.destroy();
      return res.json({ isFavorite: false, message: 'ÄÃ£ xÃ³a khá»i yÃªu thÃ­ch' });
    } else {
      await Favorite.create({ UserID: userId, ProductID: productId });
      return res.json({ isFavorite: true, message: 'ÄÃ£ thÃªm vÃ o yÃªu thÃ­ch' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. XÃ³a theo FavoriteID (DÃ nh cho Admin Panel)
exports.deleteFavorite = async (req, res) => {
  try {
    const { id } = req.params;
    await Favorite.destroy({ where: { FavoriteID: id } });
    res.json({ message: 'XÃ³a thÃ nh cÃ´ng' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


