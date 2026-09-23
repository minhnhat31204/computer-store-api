const { Order, OrderItem, User, Product, CartItemDB, PaymentTransaction } = require('../models');
const { getPayOS } = require('../services/payos');

// 1. Lấy tất cả đơn hàng (bao gồm OrderItems và Chi tiết sản phẩm)
exports.getAll = async (req, res) => {
  try {
    const data = await Order.findAll({
      include: [
        { model: User, attributes: ['FullName'] },
        { 
          model: OrderItem, 
          include: [{ model: Product, attributes: ['ProductName', 'Price'] }] 
        }
      ],
      order: [['OrderID', 'DESC']]
    });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 2. Lấy đơn hàng theo UserID
exports.getByUserId = async (req, res) => {
  try {
    const data = await Order.findAll({
      where: { UserID: req.params.userId },
      include: [
        { 
          model: OrderItem, 
          include: [
            { 
              model: Product 
            } 
          ] 
        },
        { model: PaymentTransaction, as: 'Payments', separate: true, limit: 1, order: [['PaymentTransactionID', 'DESC']], attributes: ['PaymentTransactionID', 'Status', 'Amount', 'CreatedAt', 'PaidAt'] }
      ],
      order: [['OrderID', 'DESC']]
    });
    res.status(200).json(data);
  } catch (err) {
    console.error("Lỗi getByUserId:", err);
    res.status(500).json({ error: err.message });
  }
};

// 3. Tạo Đơn hàng kèm theo danh sách OrderItems và Tự động xóa giỏ hàng
exports.create = async (req, res) => {
  try {
    const { UserID, TotalAmount, PaymentMethod, Status, Items, RecipientName, RecipientPhone, ShippingAddress, Note } = req.body;

    // Tạo bản ghi Order trước
    const newOrder = await Order.create({
      UserID,
      TotalAmount,
      PaymentMethod: PaymentMethod || 'VNPAY-QR',
      Status: Status || 'Pending',
      RecipientName,
      RecipientPhone,
      ShippingAddress,
      Note
    });

    // Nếu có danh sách items gửi lên, duyệt và lưu vào bảng OrderItem
    if (Items && Array.isArray(Items) && Items.length > 0) {
      const orderItemsData = Items.map(item => ({
        OrderID: newOrder.OrderID,
        ProductID: item.ProductID || item.productID || item.ID,
        Quantity: item.Quantity || item.quantity || 1,
        UnitPrice: item.UnitPrice || item.Price || item.price || 0
      }));

      // Thêm toàn bộ các sản phẩm vào CSDL cùng lúc
      await OrderItem.bulkCreate(orderItemsData);
    }

    // Tự động xóa toàn bộ sản phẩm trong giỏ hàng (CartItemDB) của User sau khi đặt hàng thành công
    if (UserID) {
      await CartItemDB.destroy({
        where: { UserID: UserID }
      });
    }

    res.status(201).json({ 
      message: 'Đặt hàng thành công', 
      order: newOrder 
    });
  } catch (err) {
    console.error("Lỗi tạo đơn hàng:", err);
    res.status(400).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    await Order.update(req.body, { where: { OrderID: req.params.id } });
    res.status(200).json({ message: 'Updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await Order.destroy({ where: { OrderID: req.params.id } });
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create a PayOS checkout link for an existing order. The PayOS credentials never leave this API.
exports.createPayOSPayment = async (req, res) => {
  let payment;
  try {
    const orderId = Number(req.params.id);
    const userId = Number(req.body.UserID);
    if (!Number.isInteger(orderId) || orderId <= 0 || !Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Thông tin đơn hàng không hợp lệ.' });
    }

    const order = await Order.findOne({
      where: { OrderID: orderId, UserID: userId },
      include: [{ model: OrderItem, include: [{ model: Product, attributes: ['ProductName'] }] }]
    });
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
    if (String(order.Status || '').toLowerCase() === 'cancelled') {
      return res.status(409).json({ error: 'Đơn hàng đã bị hủy.' });
    }

    const amount = Math.round(Number(order.TotalAmount));
    if (!Number.isSafeInteger(amount) || amount < 2000) {
      return res.status(400).json({ error: 'Số tiền đơn hàng không hợp lệ để thanh toán qua PayOS.' });
    }

    const previousPayment = await PaymentTransaction.findOne({
      where: { OrderID: order.OrderID },
      order: [['PaymentTransactionID', 'DESC']]
    });
    if (previousPayment?.Status === 'PAID') {
      return res.status(409).json({ error: 'Đơn hàng này đã được thanh toán.' });
    }
    if (previousPayment?.Status === 'PENDING' && previousPayment.CheckoutUrl) {
      return res.status(200).json({
        orderId: order.OrderID,
        paymentStatus: previousPayment.Status,
        checkoutUrl: previousPayment.CheckoutUrl,
        qrCode: previousPayment.QrCode
      });
    }

    const orderCode = Date.now();
    payment = await PaymentTransaction.create({
      OrderID: order.OrderID,
      PayOSOrderCode: String(orderCode),
      Amount: amount,
      Status: 'PENDING'
    });

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const returnBase = (process.env.PAYOS_RETURN_URL || `${frontendUrl}/customer/orders`).replace(/\/$/, '');
    const cancelBase = (process.env.PAYOS_CANCEL_URL || `${frontendUrl}/customer/orders`).replace(/\/$/, '');
    const returnUrl = `${returnBase}/${order.OrderID}?payment=return`;
    const cancelUrl = `${cancelBase}/${order.OrderID}?payment=cancel`;
    const link = await getPayOS().paymentRequests.create({
      orderCode,
      amount,
      description: `Don hang ${order.OrderID}`,
      items: [{
        name: `Don hang #${order.OrderID}`.slice(0, 50),
        quantity: 1,
        price: amount
      }],
      returnUrl,
      cancelUrl,
      buyerName: order.RecipientName || undefined,
      buyerPhone: order.RecipientPhone || undefined
    });

    await payment.update({ PayOSPaymentLinkID: link.paymentLinkId, CheckoutUrl: link.checkoutUrl, QrCode: link.qrCode });
    await order.update({ PaymentMethod: 'PayOS' });
    return res.status(201).json({
      orderId: order.OrderID,
      paymentStatus: payment.Status,
      checkoutUrl: link.checkoutUrl,
      qrCode: link.qrCode
    });
  } catch (err) {
    if (payment) await payment.update({ Status: 'FAILED' }).catch(() => {});
    console.error('PayOS link creation failed:', err.message);
    return res.status(502).json({ error: 'Không tạo được liên kết thanh toán PayOS. Bạn có thể thử lại từ chi tiết đơn hàng.' });
  }
};

// PayOS is the source of truth for payment completion; browser return parameters are only for UX.
exports.handlePayOSWebhook = async (req, res) => {
  try {
    const webhookData = await getPayOS().webhooks.verify(req.body);
    const payment = await PaymentTransaction.findOne({
      where: { PayOSOrderCode: String(webhookData.orderCode) }
    });
    if (!payment) return res.status(404).json({ error: 'Không tìm thấy giao dịch.' });

    const amount = Math.round(Number(payment.Amount));
    if (Number(webhookData.amount) !== amount) {
      return res.status(400).json({ error: 'Số tiền webhook không khớp đơn hàng.' });
    }

    if (webhookData.code === '00' && payment.Status !== 'PAID') {
      await payment.update({ Status: 'PAID', PaidAt: new Date() });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('PayOS webhook rejected:', err.message);
    return res.status(400).json({ error: 'Webhook PayOS không hợp lệ.' });
  }
};

exports.getPaymentStatus = async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const userId = Number(req.query.userId);
    const order = await Order.findOne({ where: { OrderID: orderId, UserID: userId } });
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });

    const payment = await PaymentTransaction.findOne({
      where: { OrderID: orderId },
      order: [['CreatedAt', 'DESC']],
      attributes: ['Status', 'Amount', 'CreatedAt', 'PaidAt']
    });
    return res.status(200).json({ payment: payment || null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
