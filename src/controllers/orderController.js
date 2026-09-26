const { Transaction } = require('sequelize');
const { sequelize, Order, OrderItem, User, Product, CartItemDB, PaymentTransaction, Voucher, OrderStatusHistory } = require('../models');
const { getPayOS } = require('../services/payos');
const { notifyOrderCreated, notifyOrderStatus, notifyOrderPaid } = require('../services/orderNotifications');

// Local development machines cannot receive PayOS webhooks without a public URL.
// Throttle provider status checks because the order detail page polls every few seconds.
const payOSStatusSyncChecks = new Map();
const PAYOS_STATUS_SYNC_INTERVAL_MS = 10000;

function isDeliveredStatus(status) {
  return ['delivered', 'completed', 'complete'].includes(String(status || '').trim().toLowerCase());
}

function isCancelledStatus(status) {
  return ['cancelled', 'canceled'].includes(String(status || '').trim().toLowerCase());
}

async function adjustOrderInventory(orderId, direction, transaction) {
  const items = await OrderItem.findAll({ where: { OrderID: orderId }, transaction });
  const quantities = new Map();
  for (const item of items) {
    const productId = Number(item.ProductID);
    const quantity = Number(item.Quantity);
    if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Chi tiết đơn hàng có số lượng sản phẩm không hợp lệ.');
    }
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  }

  for (const [productId, quantity] of [...quantities.entries()].sort(([a], [b]) => a - b)) {
    const product = await Product.findByPk(productId, { transaction });
    if (!product) throw new Error(`Không tìm thấy sản phẩm #${productId} để cập nhật tồn kho.`);
    const stock = Number(product.StockQuantity) || 0;
    if (direction < 0 && stock < quantity) {
      const error = new Error(`Sản phẩm "${product.ProductName}" chỉ còn ${stock} sản phẩm trong kho.`);
      error.statusCode = 409;
      throw error;
    }
    await product.update({ StockQuantity: stock + direction * quantity }, { transaction });
  }
}

async function cancelPendingPayOSPayment(order, transaction) {
  if (String(order.PaymentMethod || '').toLowerCase() !== 'payos') return;
  const payment = await PaymentTransaction.findOne({
    where: { OrderID: order.OrderID },
    order: [['PaymentTransactionID', 'DESC']],
    transaction
  });
  if (!payment || payment.Status !== 'PENDING') {
    if (payment?.Status === 'PAID') {
      const error = new Error('Đơn hàng đã được thanh toán nên không thể hủy.');
      error.statusCode = 409;
      throw error;
    }
    return;
  }

  const paymentIdentifier = payment.PayOSPaymentLinkID || Number(payment.PayOSOrderCode);
  let remotePayment = await getPayOS().paymentRequests.get(paymentIdentifier);
  if (remotePayment.status === 'PENDING') {
    remotePayment = await getPayOS().paymentRequests.cancel(paymentIdentifier, 'Khách hàng hoặc cửa hàng đã hủy đơn hàng');
  }
  if (remotePayment.status === 'PAID') {
    const error = new Error('PayOS đã nhận thanh toán; không thể hủy đơn hàng.');
    error.statusCode = 409;
    error.paidPaymentId = payment.PaymentTransactionID;
    throw error;
  }
  if (['CANCELLED', 'EXPIRED', 'FAILED'].includes(remotePayment.status)) {
    await payment.update({ Status: remotePayment.status }, { transaction });
    return;
  }
  const error = new Error('Chưa thể xác nhận hủy liên kết PayOS. Vui lòng thử lại.');
  error.statusCode = 502;
  throw error;
}

async function persistPaidPaymentFromConflict(error) {
  if (!error.paidPaymentId) return;
  const payment = await PaymentTransaction.findByPk(error.paidPaymentId);
  if (!payment || payment.Status === 'PAID') return;
  await payment.update({ Status: 'PAID', PaidAt: payment.PaidAt || new Date() });
  const order = await Order.findByPk(payment.OrderID);
  if (order) await notifyOrderPaid(order);
}

async function changeOrderStatus(order, status, transaction, payOSAlreadyResolved = false, actorUserId = null, note = null) {
  const previousValue = order.Status || null;
  const previousStatus = String(previousValue || '').trim().toLowerCase();
  if (isDeliveredStatus(previousStatus) && previousStatus !== status.toLowerCase()) {
    const error = new Error('Đơn hàng đã giao, không thể thay đổi tiến độ.');
    error.statusCode = 409;
    throw error;
  }
  if (previousStatus === status.toLowerCase()) return false;

  let inventoryReserved = Boolean(order.InventoryReserved);
  if (!isCancelledStatus(previousStatus) && status.toLowerCase() === 'cancelled') {
    if (!payOSAlreadyResolved) await cancelPendingPayOSPayment(order, transaction);
    if (inventoryReserved) await adjustOrderInventory(order.OrderID, 1, transaction);
    inventoryReserved = false;
  } else if (isCancelledStatus(previousStatus) && status.toLowerCase() !== 'cancelled') {
    await adjustOrderInventory(order.OrderID, -1, transaction);
    inventoryReserved = true;
  }
  await order.update({ Status: status, InventoryReserved: inventoryReserved }, { transaction });
  await OrderStatusHistory.create({
    OrderID: order.OrderID,
    ActorUserID: actorUserId || null,
    PreviousStatus: previousValue,
    NewStatus: status,
    Note: note || null,
  }, { transaction });
  return true;
}

exports.cancelByUser = async (req, res) => {
  try {
    const userId = Number(req.body.UserID);
    const result = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (transaction) => {
      const order = await Order.findByPk(req.params.id, { transaction });
      if (!order || Number(order.UserID) !== userId) return { missing: true };
      if (String(order.Status || '').trim().toLowerCase() !== 'pending') {
        const error = new Error('Chỉ có thể hủy đơn đang chờ xác nhận.');
        error.statusCode = 409;
        throw error;
      }
      const changed = await changeOrderStatus(order, 'Cancelled', transaction, false, userId, 'Khách hàng hủy đơn');
      return { order, changed };
    });
    if (result.missing) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
    if (result.changed) await notifyOrderStatus(result.order, 'Cancelled');
    return res.json({ message: 'Đã hủy đơn hàng.', order: result.order });
  } catch (error) {
    await persistPaidPaymentFromConflict(error).catch((persistError) => console.error('PayOS paid-state sync failed:', persistError.message));
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Không hủy được đơn hàng.' });
  }
};

// 1. Lấy tất cả đơn hàng (bao gồm OrderItems và Chi tiết sản phẩm)
exports.getAll = async (req, res) => {
  try {
    const data = await Order.findAll({
      include: [
        { model: User, attributes: ['FullName', 'Email', 'Phone'] },
        { 
          model: OrderItem, 
          include: [{ model: Product, attributes: ['ProductName', 'Price', 'ImageUrl'] }]
        },
        { model: PaymentTransaction, as: 'Payments', separate: true, limit: 1, order: [['PaymentTransactionID', 'DESC']], attributes: ['PaymentTransactionID', 'Status', 'Amount', 'CreatedAt', 'PaidAt'] },
      ],
      order: [['OrderID', 'DESC']]
    });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getStatusHistory = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, { attributes: ['OrderID'] });
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
    const history = await OrderStatusHistory.findAll({
      where: { OrderID: order.OrderID },
      order: [['ChangedAt', 'ASC'], ['StatusHistoryID', 'ASC']],
    });
    const actorIds = [...new Set(history.map((entry) => Number(entry.ActorUserID)).filter((id) => Number.isInteger(id) && id > 0))];
    const actors = actorIds.length
      ? await User.findAll({ where: { UserID: actorIds }, attributes: ['UserID', 'FullName', 'Email'] })
      : [];
    const actorById = new Map(actors.map((actor) => [Number(actor.UserID), actor]));
    return res.json(history.map((entry) => ({ ...entry.toJSON(), Actor: actorById.get(Number(entry.ActorUserID)) || null })));
  } catch (error) {
    return res.status(500).json({ error: 'Không tải được lịch sử trạng thái đơn hàng.' });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const allowedStatuses = new Set(['Pending', 'Confirmed', 'Processing', 'Shipping', 'Delivered', 'Cancelled']);
    const status = String(req.body.Status || '').trim();
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ error: 'Tiến độ đơn hàng không hợp lệ.' });
    }
    const result = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (transaction) => {
      const order = await Order.findByPk(req.params.id, { transaction });
      if (!order) return { missing: true };
      const changed = await changeOrderStatus(order, status, transaction, false, req.user?.UserID, req.body.Note);
      return { order, changed };
    });
    if (result.missing) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
    if (result.changed) await notifyOrderStatus(result.order, status);
    return res.json({ message: result.changed ? 'Đã cập nhật tiến độ đơn hàng.' : 'Tiến độ đơn hàng không thay đổi.', order: result.order });
  } catch (error) {
    await persistPaidPaymentFromConflict(error).catch((persistError) => console.error('PayOS paid-state sync failed:', persistError.message));
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Không cập nhật được tiến độ đơn hàng.' });
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
    const { UserID, TotalAmount, PaymentMethod, Items, RecipientName, RecipientPhone, ShippingAddress, Note, VoucherID } = req.body;

    if (!Array.isArray(Items) || Items.length === 0) {
      return res.status(400).json({ error: 'Đơn hàng cần có ít nhất một sản phẩm.' });
    }
    const orderItemsData = Items.map((item) => ({
      ProductID: Number(item.ProductID || item.productID || item.ID),
      Quantity: Number(item.Quantity || item.quantity || 1),
      UnitPrice: Number(item.UnitPrice ?? item.Price ?? item.price ?? 0)
    }));
    if (orderItemsData.some((item) => !Number.isInteger(item.ProductID) || item.ProductID <= 0 || !Number.isInteger(item.Quantity) || item.Quantity <= 0 || !Number.isFinite(item.UnitPrice) || item.UnitPrice < 0)) {
      return res.status(400).json({ error: 'Thông tin sản phẩm trong đơn hàng không hợp lệ.' });
    }

    let discountAmount = 0;
    let voucherCode = null;
    if (VoucherID) {
      const voucher = await Voucher.findByPk(Number(VoucherID));
      const expiresAt = voucher?.ExpiryDate ? new Date(voucher.ExpiryDate) : null;
      if (expiresAt) expiresAt.setHours(23, 59, 59, 999);
      if (!voucher || !voucher.IsActive || (expiresAt && expiresAt < new Date())) {
        return res.status(400).json({ error: 'Voucher không tồn tại, đã hết hạn hoặc đã ngừng áp dụng.' });
      }
      const subtotal = (Array.isArray(Items) ? Items : []).reduce((sum, item) => {
        const unitPrice = Number(item.UnitPrice ?? item.Price ?? item.price ?? 0);
        const quantity = Number(item.Quantity ?? item.quantity ?? 1);
        return sum + Math.max(0, unitPrice) * Math.max(0, quantity);
      }, 0);
      const percentageDiscount = subtotal * Math.max(0, Number(voucher.DiscountPercentage) || 0) / 100;
      const cap = Number(voucher.MaxDiscountAmount);
      discountAmount = Math.min(subtotal, percentageDiscount, Number.isFinite(cap) && cap > 0 ? cap : percentageDiscount);
      voucherCode = voucher.Code;
    }

    const newOrder = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (transaction) => {
      const quantities = new Map();
      for (const item of orderItemsData) quantities.set(item.ProductID, (quantities.get(item.ProductID) || 0) + item.Quantity);
      for (const [productId, quantity] of [...quantities.entries()].sort(([a], [b]) => a - b)) {
        const product = await Product.findByPk(productId, { transaction });
        if (!product) {
          const error = new Error(`Không tìm thấy sản phẩm #${productId}.`);
          error.statusCode = 400;
          throw error;
        }
        const stock = Number(product.StockQuantity) || 0;
        if (stock < quantity) {
          const error = new Error(`Sản phẩm "${product.ProductName}" chỉ còn ${stock} sản phẩm trong kho.`);
          error.statusCode = 409;
          throw error;
        }
        await product.update({ StockQuantity: stock - quantity }, { transaction });
      }

      const order = await Order.create({
        UserID,
        TotalAmount,
        PaymentMethod: PaymentMethod || 'VNPAY-QR',
        Status: 'Pending',
        InventoryReserved: true,
        RecipientName,
        RecipientPhone,
        ShippingAddress,
        Note,
        DiscountAmount: discountAmount,
        VoucherCode: voucherCode ? String(voucherCode).trim().slice(0, 50) : null,
        VoucherID: VoucherID ? Number(VoucherID) : null
      }, { transaction });
      await OrderStatusHistory.create({ OrderID: order.OrderID, NewStatus: 'Pending', Note: 'Đơn hàng được tạo' }, { transaction });
      await OrderItem.bulkCreate(orderItemsData.map((item) => ({ ...item, OrderID: order.OrderID })), { transaction });
      if (UserID) await CartItemDB.destroy({ where: { UserID }, transaction });
      return order;
    });

    await notifyOrderCreated(newOrder);

    res.status(201).json({ 
      message: 'Đặt hàng thành công', 
      order: newOrder 
    });
  } catch (err) {
    console.error("Lỗi tạo đơn hàng:", err);
    res.status(err.statusCode || 400).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const result = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (transaction) => {
      const order = await Order.findByPk(req.params.id, { transaction });
      if (!order) return { missing: true };
      const { Status, InventoryReserved: _inventoryReserved, ...fields } = req.body;
      const permittedFields = ['CarrierName', 'TrackingNumber', 'EstimatedDelivery'];
      if (Object.keys(fields).some((field) => !permittedFields.includes(field))) {
        const error = new Error('Chỉ có thể cập nhật thông tin vận chuyển tại đây.');
        error.statusCode = 400;
        throw error;
      }
      await order.update(fields, { transaction });
      let changed = false;
      if (Status !== undefined) {
        const allowedStatuses = new Set(['Pending', 'Confirmed', 'Processing', 'Shipping', 'Delivered', 'Cancelled']);
        const status = String(Status).trim();
        if (!allowedStatuses.has(status)) {
          const error = new Error('Tiến độ đơn hàng không hợp lệ.');
          error.statusCode = 400;
          throw error;
        }
        changed = await changeOrderStatus(order, status, transaction, false, req.user?.UserID, req.body.Note);
      }
      return { order, changed };
    });
    if (result.missing) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
    if (result.changed) await notifyOrderStatus(result.order, result.order.Status);
    return res.status(200).json({ message: 'Updated successfully', order: result.order });
  } catch (err) {
    await persistPaidPaymentFromConflict(err).catch((persistError) => console.error('PayOS paid-state sync failed:', persistError.message));
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (transaction) => {
      const order = await Order.findByPk(req.params.id, { transaction });
      if (!order) return;
      if (order.InventoryReserved && !isCancelledStatus(order.Status) && !isDeliveredStatus(order.Status)) {
        await cancelPendingPayOSPayment(order, transaction);
        await adjustOrderInventory(order.OrderID, 1, transaction);
      }
      await OrderStatusHistory.destroy({ where: { OrderID: order.OrderID }, transaction });
      await order.destroy({ transaction });
    });
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (err) {
    await persistPaidPaymentFromConflict(err).catch((persistError) => console.error('PayOS paid-state sync failed:', persistError.message));
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
      const order = await Order.findByPk(payment.OrderID);
      if (order) await notifyOrderPaid(order);
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

    let payment = await PaymentTransaction.findOne({
      where: { OrderID: orderId },
      order: [['CreatedAt', 'DESC']],
      attributes: ['PaymentTransactionID', 'PayOSOrderCode', 'PayOSPaymentLinkID', 'Status', 'Amount', 'CreatedAt', 'PaidAt']
    });

    let synchronizedOrderStatus;
    if (payment?.Status === 'PENDING' && payment.PayOSOrderCode) {
      const orderCode = Number(payment.PayOSOrderCode);
      const lastCheck = payOSStatusSyncChecks.get(orderCode) || 0;
      if (Number.isSafeInteger(orderCode) && Date.now() - lastCheck >= PAYOS_STATUS_SYNC_INTERVAL_MS) {
        payOSStatusSyncChecks.set(orderCode, Date.now());
        try {
          const payOSLink = await getPayOS().paymentRequests.get(orderCode);
          const expectedAmount = Math.round(Number(payment.Amount));
          const paidAmount = Math.round(Number(payOSLink.amountPaid));

          if (payOSLink.orderCode === orderCode && payOSLink.status === 'PAID' && paidAmount === expectedAmount) {
            await payment.update({ Status: 'PAID', PaidAt: new Date() });
            const paidOrder = await Order.findByPk(payment.OrderID);
            if (paidOrder) await notifyOrderPaid(paidOrder);
          } else if (payOSLink.orderCode === orderCode && ['CANCELLED', 'EXPIRED', 'FAILED'].includes(payOSLink.status)) {
            const finalStatus = payOSLink.status === 'CANCELLED' ? 'CANCELLED' : 'FAILED';
            const syncResult = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (transaction) => {
              const currentPayment = await PaymentTransaction.findByPk(payment.PaymentTransactionID, { transaction });
              const currentOrder = await Order.findByPk(orderId, { transaction });
              if (!currentPayment || currentPayment.Status !== 'PENDING' || !currentOrder) {
                return { payment: currentPayment, order: currentOrder, changed: false };
              }
              await currentPayment.update({ Status: finalStatus }, { transaction });
              let changed = false;
              if (payOSLink.status === 'EXPIRED' && String(currentOrder.Status || '').toLowerCase() === 'pending') {
                changed = await changeOrderStatus(currentOrder, 'Cancelled', transaction, true);
              }
              return { payment: currentPayment, order: currentOrder, changed };
            });
            payment = syncResult.payment || payment;
            synchronizedOrderStatus = syncResult.order?.Status;
            if (syncResult.changed && syncResult.order) await notifyOrderStatus(syncResult.order, 'Cancelled');
          }
        } catch (syncError) {
          // Webhook remains the primary path. A temporary provider error should not
          // prevent the UI from displaying the last known database status.
          console.error('PayOS status sync failed:', syncError.message);
        }
      }
    }

    if (payment && payment.Status === 'PENDING' && payOSStatusSyncChecks.size > 500) {
      const cutoff = Date.now() - PAYOS_STATUS_SYNC_INTERVAL_MS * 6;
      for (const [checkedOrderCode, checkedAt] of payOSStatusSyncChecks) {
        if (checkedAt < cutoff) payOSStatusSyncChecks.delete(checkedOrderCode);
      }
    }

    if (payment?.Status === 'PENDING') {
      payment = await PaymentTransaction.findByPk(payment.PaymentTransactionID, {
        attributes: ['PaymentTransactionID', 'PayOSOrderCode', 'PayOSPaymentLinkID', 'Status', 'Amount', 'CreatedAt', 'PaidAt']
      });
    }
    const latestOrder = synchronizedOrderStatus ? null : await Order.findOne({ where: { OrderID: orderId, UserID: userId }, attributes: ['Status'] });
    return res.status(200).json({ payment: payment || null, orderStatus: synchronizedOrderStatus || latestOrder?.Status });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
