const { Review, User, Product } = require('../models');

// Láº¥y danh sÃ¡ch Ä‘Ã¡nh giÃ¡ cá»§a sáº£n pháº©m kÃ¨m tÃªn vÃ  avatar ngÆ°á»i dÃ¹ng
exports.getByProduct = async (req, res) => {
  try {
    const data = await Review.findAll({
      where: { ProductID: req.params.productId },
      include: [{ 
        model: User, 
        attributes: ['FullName', 'Avatar'] // <--- ThÃªm 'Avatar' vÃ o Ä‘Ã¢y
      }],
      order: [['ReviewDate', 'DESC']]
    });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Kiá»ƒm tra ngÆ°á»i dÃ¹ng Ä‘Ã£ Ä‘Ã¡nh giÃ¡ sáº£n pháº©m nÃ y trong Ä‘Æ¡n hÃ ng chÆ°a (CÃ³ kiá»ƒm tra tráº¡ng thÃ¡i Ä‘Æ¡n hÃ ng)
exports.checkEligibility = async (req, res) => {
  try {
    const { userId, productId, orderId } = req.query;
    if (!userId || !productId || !orderId) {
      return res.status(400).json({ canReview: false, message: 'Thiáº¿u tham sá»‘' });
    }

    // 1. Kiá»ƒm tra Ä‘Æ¡n hÃ ng cÃ³ tá»“n táº¡i vÃ  Ä‘Ã£ hoÃ n thÃ nh/giao thÃ nh cÃ´ng chÆ°a
    const { Order } = require('../models'); // ThÃªm model Order náº¿u chÆ°a import á»Ÿ Ä‘áº§u file
    const order = await Order.findOne({
      where: { OrderID: orderId, UserID: userId }
    });

    if (!order) {
      return res.status(200).json({ canReview: false, reason: 'KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n hÃ ng' });
    }

    const status = (order.Status || '').toLowerCase();
    if (status !== 'completed' && status !== 'delivered' && status !== 'Ä‘Ã£ giao') {
      return res.status(200).json({ canReview: false, reason: 'ÄÆ¡n hÃ ng chÆ°a hoÃ n thÃ nh' });
    }

    // 2. Kiá»ƒm tra xem Ä‘Ã£ Ä‘Ã¡nh giÃ¡ sáº£n pháº©m nÃ y cho hÃ³a Ä‘Æ¡n nÃ y chÆ°a
    const existingReview = await Review.findOne({
      where: {
        UserID: userId,
        ProductID: productId,
        OrderID: orderId
      }
    });

    res.status(200).json({ canReview: !existingReview });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ThÃªm Ä‘Ã¡nh giÃ¡ má»›i
exports.create = async (req, res) => {
  try {
    const { UserID, ProductID, OrderID } = req.body;
    
    // Kiá»ƒm tra láº§n cuá»‘i trÆ°á»›c khi táº¡o
    const existing = await Review.findOne({ where: { UserID, ProductID, OrderID } });
    if (existing) {
      return res.status(400).json({ error: 'Báº¡n Ä‘Ã£ Ä‘Ã¡nh giÃ¡ sáº£n pháº©m nÃ y cho hÃ³a Ä‘Æ¡n nÃ y rá»“i.' });
    }

    const newItem = await Review.create(req.body);
    res.status(201).json(newItem);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Láº¥y toÃ n bá»™ danh sÃ¡ch Ä‘Ã¡nh giÃ¡ (cho Admin Dashboard)
exports.getAll = async (req, res) => {
  try {
    const data = await Review.findAll({
      order: [['ReviewID', 'DESC']] // Sáº¯p xáº¿p theo ReviewID giáº£m dáº§n thay vÃ¬ ReviewDate
    });
    res.status(200).json(data);
  } catch (err) {
    console.error("Lá»—i láº¥y danh sÃ¡ch Review:", err); // In chi tiáº¿t lá»—i ra Terminal
    res.status(500).json({ error: err.message });
  }
};

// XÃ³a Ä‘Ã¡nh giÃ¡ theo ReviewID (cho Admin Dashboard)
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Review.destroy({
      where: { ReviewID: id }
    });

    if (deleted) {
      return res.status(200).json({ message: 'XÃ³a Ä‘Ã¡nh giÃ¡ thÃ nh cÃ´ng!' });
    }
    return res.status(404).json({ error: 'KhÃ´ng tÃ¬m tháº¥y Ä‘Ã¡nh giÃ¡ Ä‘á»ƒ xÃ³a.' });
  } catch (err) {
    console.error("Lá»—i xÃ³a Review:", err);
    res.status(500).json({ error: err.message });
  }
};


