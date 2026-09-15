const { Review, User, Product } = require('../models');

// Lấy danh sách đánh giá của sản phẩm kèm tên và avatar người dùng
exports.getByProduct = async (req, res) => {
  try {
    const data = await Review.findAll({
      where: { ProductID: req.params.productId },
      include: [{ 
        model: User, 
        attributes: ['FullName', 'Avatar'] // <--- Thêm 'Avatar' vào đây
      }],
      order: [['ReviewDate', 'DESC']]
    });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Kiểm tra người dùng đã đánh giá sản phẩm này trong đơn hàng chưa (Có kiểm tra trạng thái đơn hàng)
exports.checkEligibility = async (req, res) => {
  try {
    const { userId, productId, orderId } = req.query;
    if (!userId || !productId || !orderId) {
      return res.status(400).json({ canReview: false, message: 'Thiếu tham số' });
    }

    // 1. Kiểm tra đơn hàng có tồn tại và đã hoàn thành/giao thành công chưa
    const { Order } = require('../models'); // Thêm model Order nếu chưa import ở đầu file
    const order = await Order.findOne({
      where: { OrderID: orderId, UserID: userId }
    });

    if (!order) {
      return res.status(200).json({ canReview: false, reason: 'Không tìm thấy đơn hàng' });
    }

    const status = (order.Status || '').toLowerCase();
    if (status !== 'completed' && status !== 'delivered' && status !== 'đã giao') {
      return res.status(200).json({ canReview: false, reason: 'Đơn hàng chưa hoàn thành' });
    }

    // 2. Kiểm tra xem đã đánh giá sản phẩm này cho hóa đơn này chưa
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

// Thêm đánh giá mới
exports.create = async (req, res) => {
  try {
    const { UserID, ProductID, OrderID } = req.body;
    
    // Kiểm tra lần cuối trước khi tạo
    const existing = await Review.findOne({ where: { UserID, ProductID, OrderID } });
    if (existing) {
      return res.status(400).json({ error: 'Bạn đã đánh giá sản phẩm này cho hóa đơn này rồi.' });
    }

    const newItem = await Review.create(req.body);
    res.status(201).json(newItem);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Lấy toàn bộ danh sách đánh giá (cho Admin Dashboard)
exports.getAll = async (req, res) => {
  try {
    const data = await Review.findAll({
      order: [['ReviewID', 'DESC']] // Sắp xếp theo ReviewID giảm dần thay vì ReviewDate
    });
    res.status(200).json(data);
  } catch (err) {
    console.error("Lỗi lấy danh sách Review:", err); // In chi tiết lỗi ra Terminal
    res.status(500).json({ error: err.message });
  }
};

// Xóa đánh giá theo ReviewID (cho Admin Dashboard)
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Review.destroy({
      where: { ReviewID: id }
    });

    if (deleted) {
      return res.status(200).json({ message: 'Xóa đánh giá thành công!' });
    }
    return res.status(404).json({ error: 'Không tìm thấy đánh giá để xóa.' });
  } catch (err) {
    console.error("Lỗi xóa Review:", err);
    res.status(500).json({ error: err.message });
  }
};