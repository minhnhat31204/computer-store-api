const { Transaction } = require('sequelize');
const { sequelize, CartItemDB, Product } = require('../models');

// Giáº£i thÃ­ch sá»­a lá»—i: Biáº¿n Ä‘á»•i dá»¯ liá»‡u (format) Ä‘á»ƒ Ä‘Æ°a thÃ´ng tin tá»« báº£ng Product (ProductName, ImageUrl...)
// ra ngoÃ i cÃ¹ng má»™t cáº¥p vá»›i CartItemDB giÃºp Flutter Ä‘á»c Ä‘Æ°á»£c trá»±c tiáº¿p.


// HÃ m bá»• trá»£: Format pháº³ng dá»¯ liá»‡u cho Flutter Ä‘á»c trá»±c tiáº¿p
const formatCartItem = (item) => {
  const plain = item.get({ plain: true });
  const product = plain.Product || {};
  return {
    ...plain,
    ProductName: product.ProductName || 'Sáº£n pháº©m',
    ImageUrl: product.ImageUrl || product.IMAGEURL || '',
    Price: product.Price || plain.Price || 0,
    DiscountPrice: product.DiscountPrice || product.Price || plain.Price || 0,
    StockQuantity: Number(product.StockQuantity) || 0,
  };
};

// 1. Láº¥y táº¥t cáº£ giá» hÃ ng (Admin)
exports.getAll = async (req, res) => {
  try {
    const data = await CartItemDB.findAll({
      include: [{ model: Product }]
    });
    
    const formattedData = data.map(formatCartItem);
    res.status(200).json(formattedData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 2. Láº¥y giá» hÃ ng theo UserID (Äá»“ng bá»™ vá»›i Flutter)
exports.getByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const data = await CartItemDB.findAll({
      where: { UserID: userId },
      include: [{ model: Product }]
    });

    const formattedData = data.map(formatCartItem);
    res.status(200).json(formattedData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 3. ThÃªm sáº£n pháº©m vÃ o giá» hÃ ng
exports.addToCart = async (req, res) => {
  try {
    const { UserID, ProductID, Quantity, Price } = req.body;

    const userId = Number(UserID);
    const productId = Number(ProductID);
    const quantityToAdd = Number(Quantity);
    if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantityToAdd) || quantityToAdd <= 0) {
      return res.status(400).json({ error: 'Thông tin sản phẩm trong giỏ hàng không hợp lệ.' });
    }

    const item = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (transaction) => {
      const product = await Product.findByPk(productId, { transaction });
      if (!product) {
        const error = new Error('Không tìm thấy sản phẩm.');
        error.statusCode = 404;
        throw error;
      }
      let cartItem = await CartItemDB.findOne({ where: { UserID: userId, ProductID: productId }, transaction });
      const nextQuantity = Number(cartItem?.Quantity || 0) + quantityToAdd;
      const stock = Number(product.StockQuantity) || 0;
      if (nextQuantity > stock) {
        const error = new Error(`Sản phẩm chỉ còn ${stock} sản phẩm trong kho.`);
        error.statusCode = 409;
        throw error;
      }
      if (cartItem) await cartItem.update({ Quantity: nextQuantity }, { transaction });
      else cartItem = await CartItemDB.create({ UserID: userId, ProductID: productId, Quantity: nextQuantity, Price: Price ?? product.Price }, { transaction });
      return cartItem;
    });

    // Láº¥y láº¡i thÃ´ng tin hoÃ n chá»‰nh kÃ¨m Product Ä‘á»ƒ tráº£ vá» cho Flutter
    const fullItem = await CartItemDB.findOne({
      where: { ID: item.ID },
      include: [{ model: Product }]
    });

    return res.status(200).json({
      message: "Thao tÃ¡c giá» hÃ ng thÃ nh cÃ´ng!",
      data: formatCartItem(fullItem)
    });

  } catch (error) {
    console.error("Lá»—i thÃªm giá» hÃ ng:", error);
    return res.status(error.statusCode || 500).json({ message: error.message, error: error.message });
  }
};

// 4. Cáº­p nháº­t sá»‘ lÆ°á»£ng sáº£n pháº©m
exports.update = async (req, res) => {
  try {
    const { ID, Quantity } = req.body;
    const cartItemId = req.params.id || ID;
    const quantity = Number(Quantity);

    if (!cartItemId) {
      return res.status(400).json({ message: "Thiáº¿u ID sáº£n pháº©m giá» hÃ ng" });
    }
    if (!Number.isInteger(quantity) || quantity <= 0) return res.status(400).json({ error: 'Số lượng phải lớn hơn 0.' });

    const result = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (transaction) => {
      const item = await CartItemDB.findByPk(cartItemId, { transaction });
      if (!item) return { missing: true };
      const product = await Product.findByPk(item.ProductID, { transaction });
      if (!product) return { missing: true };
      const stock = Number(product.StockQuantity) || 0;
      if (quantity > stock) {
        const error = new Error(`Sản phẩm chỉ còn ${stock} sản phẩm trong kho.`);
        error.statusCode = 409;
        throw error;
      }
      await item.update({ Quantity: quantity }, { transaction });
      return { item };
    });
    if (result.missing) return res.status(404).json({ error: 'Không tìm thấy sản phẩm trong giỏ.' });
    return res.status(200).json({ message: 'Cập nhật thành công!' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

// 5. XÃ³a sáº£n pháº©m khá»i giá»
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedCount = await CartItemDB.destroy({
      where: { ID: id }
    });

    if (deletedCount > 0) {
      return res.status(200).json({ message: "XÃ³a sáº£n pháº©m thÃ nh cÃ´ng!" });
    } else {
      return res.status(404).json({ message: "KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m Ä‘á»ƒ xÃ³a!" });
    }
  } catch (error) {
    console.error("Lá»—i xÃ³a giá» hÃ ng:", error);
    return res.status(500).json({ message: "Lá»—i mÃ¡y chá»§ ná»™i bá»™", error: error.message });
  }
};


