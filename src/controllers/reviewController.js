const { Op, Transaction } = require('sequelize');
const { sequelize, Review, User, Order, OrderItem, Product } = require('../models');

const DELIVERED_STATUSES = new Set(['completed', 'complete', 'delivered', 'đã giao', 'giao thành công', 'đã giao thành công']);

function isDelivered(status) {
  return DELIVERED_STATUSES.has(String(status || '').trim().toLowerCase());
}

async function getDeliveredProductOrders(userId, productId) {
  const orders = await Order.findAll({
    where: { UserID: userId },
    include: [{ model: OrderItem, where: { ProductID: productId }, required: true }],
    order: [['OrderID', 'DESC']],
  });
  return orders.filter((order) => isDelivered(order.Status));
}

exports.getByProduct = async (req, res) => {
  try {
    const data = await Review.findAll({
      where: { ProductID: req.params.productId },
      include: [{ model: User, attributes: ['FullName', 'Avatar'] }],
      order: [['ReviewDate', 'DESC']],
    });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Entitlement is calculated from delivered quantities, with one review row consuming one unit.
exports.checkEligibility = async (req, res) => {
  try {
    const userId = Number(req.query.userId);
    const productId = Number(req.query.productId);
    const requestedOrderId = req.query.orderId ? Number(req.query.orderId) : null;
    if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: 'Thiếu hoặc sai userId/productId.' });
    }

    const orders = await getDeliveredProductOrders(userId, productId);
    const orderIds = orders.map((order) => Number(order.OrderID));
    const reviews = orderIds.length ? await Review.findAll({
      where: { UserID: userId, ProductID: productId, OrderID: { [Op.in]: orderIds } },
      order: [['ReviewDate', 'DESC']],
    }) : [];
    const reviewsByOrder = new Map();
    for (const review of reviews) {
      const id = Number(review.OrderID);
      reviewsByOrder.set(id, [...(reviewsByOrder.get(id) || []), review]);
    }

    const eligibleOrders = orders.map((order) => {
      const orderId = Number(order.OrderID);
      const quantity = (order.OrderItems || []).reduce((sum, item) => sum + Number(item.Quantity || 0), 0);
      const orderReviews = reviewsByOrder.get(orderId) || [];
      return {
        OrderID: orderId,
        quantity,
        reviewedQuantity: orderReviews.length,
        remainingQuantity: Math.max(0, quantity - orderReviews.length),
        reviews: orderReviews,
      };
    });
    const purchasedQuantity = eligibleOrders.reduce((sum, order) => sum + order.quantity, 0);
    const reviewedQuantity = eligibleOrders.reduce((sum, order) => sum + order.reviewedQuantity, 0);
    const selectedOrder = requestedOrderId ? eligibleOrders.find((order) => order.OrderID === requestedOrderId) : null;

    return res.status(200).json({
      canReview: purchasedQuantity > reviewedQuantity,
      purchasedQuantity,
      reviewedQuantity,
      remainingQuantity: Math.max(0, purchasedQuantity - reviewedQuantity),
      orders: eligibleOrders,
      reviews,
      selectedOrder: selectedOrder || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.createOrderReview = async (req, res) => {
  const userId = Number(req.body.UserID);
  const orderId = Number(req.body.OrderID);
  const productId = Number(req.body.ProductID);
  const rating = Number(req.body.Rating);
  const comment = String(req.body.Comment || '').trim();

  if (![userId, orderId, productId].every((value) => Number.isInteger(value) && value > 0)) {
    return res.status(400).json({ error: 'Vui lòng cung cấp UserID, OrderID và ProductID hợp lệ.' });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Số sao đánh giá phải từ 1 đến 5.' });
  }
  if (comment.length > 4000) {
    return res.status(400).json({ error: 'Nội dung đánh giá tối đa 4000 ký tự.' });
  }

  const transaction = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE });
  try {
    // Serializable isolation keeps concurrent requests from exceeding the per-order quota.
    const order = await Order.findOne({
      where: { OrderID: orderId, UserID: userId },
      transaction,
    });
    if (!order || !isDelivered(order.Status)) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Chỉ có thể đánh giá sản phẩm trong đơn đã giao thành công của bạn.' });
    }

    const purchased = await OrderItem.sum('Quantity', { where: { OrderID: orderId, ProductID: productId }, transaction }) || 0;
    if (purchased <= 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Sản phẩm này không có trong đơn hàng.' });
    }

    const alreadyReviewed = await Review.count({ where: { UserID: userId, OrderID: orderId, ProductID: productId }, transaction });
    if (alreadyReviewed >= purchased) {
      await transaction.rollback();
      return res.status(409).json({ error: 'Bạn đã dùng hết lượt đánh giá cho sản phẩm này trong đơn hàng.' });
    }

    const review = await Review.create({
      UserID: userId,
      OrderID: orderId,
      ProductID: productId,
      Rating: rating,
      Comment,
      ReviewDate: new Date(),
    }, { transaction });
    await transaction.commit();
    const created = await Review.findByPk(review.ReviewID, {
      include: [{ model: User, attributes: ['FullName', 'Avatar'] }],
    });
    return res.status(201).json({ message: 'Đánh giá sản phẩm thành công.', review: created });
  } catch (err) {
    if (!transaction.finished) await transaction.rollback();
    return res.status(500).json({ error: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const data = await Review.findAll({ order: [['ReviewID', 'DESC']] });
    res.status(200).json(data);
  } catch (err) {
    console.error('Lỗi lấy danh sách Review:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getAllAdmin = async (_req, res) => {
  try {
    const data = await Review.findAll({
      include: [
        { model: Product, attributes: ['ProductID', 'ProductName', 'ImageUrl'] },
        { model: User, attributes: ['UserID', 'FullName', 'Avatar'] },
      ],
      order: [['ReviewDate', 'DESC'], ['ReviewID', 'DESC']],
    });
    return res.status(200).json(data);
  } catch (err) {
    console.error('Lỗi lấy danh sách đánh giá cho admin:', err);
    return res.status(500).json({ error: 'Không thể tải danh sách đánh giá.' });
  }
};

exports.replyToReview = async (req, res) => {
  try {
    const reviewId = Number(req.params.id);
    const reply = String(req.body?.reply || '').trim();
    if (!Number.isInteger(reviewId) || reviewId <= 0) {
      return res.status(400).json({ error: 'Mã đánh giá không hợp lệ.' });
    }
    if (!reply) return res.status(400).json({ error: 'Vui lòng nhập nội dung phản hồi.' });
    if (reply.length > 4000) return res.status(400).json({ error: 'Nội dung phản hồi tối đa 4000 ký tự.' });

    const review = await Review.findByPk(reviewId);
    if (!review) return res.status(404).json({ error: 'Không tìm thấy đánh giá.' });

    await review.update({
      AdminReply: reply,
      AdminReplyAt: new Date(),
      AdminReplyUserID: req.currentUser?.UserID || req.user?.userId || null,
    });
    const updated = await Review.findByPk(reviewId, {
      include: [
        { model: Product, attributes: ['ProductID', 'ProductName', 'ImageUrl'] },
        { model: User, attributes: ['UserID', 'FullName', 'Avatar'] },
      ],
    });
    return res.status(200).json({ message: 'Đã lưu phản hồi cho đánh giá.', review: updated });
  } catch (err) {
    console.error('Lỗi phản hồi đánh giá:', err);
    return res.status(500).json({ error: 'Không thể lưu phản hồi đánh giá.' });
  }
};

exports.delete = async (req, res) => {
  try {
    const deleted = await Review.destroy({ where: { ReviewID: req.params.id } });
    if (deleted) return res.status(200).json({ message: 'Xóa đánh giá thành công!' });
    return res.status(404).json({ error: 'Không tìm thấy đánh giá để xóa.' });
  } catch (err) {
    console.error('Lỗi xóa Review:', err);
    res.status(500).json({ error: err.message });
  }
};

// Kept for older order pages; a reviewed order means at least one item has a review.
exports.checkOrderReview = async (req, res) => {
  try {
    const orderId = Number(req.query.orderId);
    const userId = Number(req.query.userId);
    if (!orderId || !userId) return res.status(400).json({ error: 'Thiếu orderId hoặc userId.' });
    const reviews = await Review.findAll({ where: { OrderID: orderId, UserID: userId }, order: [['ReviewDate', 'DESC']] });
    return res.status(200).json({ reviewed: reviews.length > 0, review: reviews[0] || null, reviews });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Legacy generic create endpoint now shares the same purchase and quota checks.
exports.create = exports.createOrderReview;
