const Notification = require('../models/Notification');

const STATUS_COPY = {
  pending: ['Đơn hàng đang chờ xác nhận', 'Cửa hàng đang tiếp nhận đơn hàng'],
  confirmed: ['Đơn hàng đã được xác nhận', 'Cửa hàng đã xác nhận đơn hàng'],
  processing: ['Đơn hàng đang được xử lý', 'Cửa hàng đang chuẩn bị đơn hàng'],
  preparing: ['Đơn hàng đang được chuẩn bị', 'Cửa hàng đang chuẩn bị sản phẩm'],
  shipping: ['Đơn hàng đang giao', 'Đơn hàng đang trên đường giao đến bạn'],
  delivering: ['Đơn hàng đang giao', 'Đơn hàng đang trên đường giao đến bạn'],
  completed: ['Đơn hàng đã giao', 'Đơn hàng đã được giao hoàn tất'],
  delivered: ['Đơn hàng đã giao', 'Đơn hàng đã được giao hoàn tất'],
  cancelled: ['Đơn hàng đã hủy', 'Đơn hàng đã bị hủy'],
  canceled: ['Đơn hàng đã hủy', 'Đơn hàng đã bị hủy'],
};

async function createOrderNotification({ userId, orderId, eventKey, type, title, message }) {
  try {
    await Notification.findOrCreate({
      where: { EventKey: eventKey },
      defaults: {
        UserID: userId,
        OrderID: orderId || null,
        EventKey: eventKey,
        Type: type,
        Title: title,
        Message: message,
      },
    });
  } catch (error) {
    // Notification persistence must not interrupt order or payment processing.
    console.error('Order notification creation failed:', error.message);
  }
}

async function notifyOrderCreated(order) {
  const id = Number(order.OrderID);
  await createOrderNotification({
    userId: order.UserID,
    orderId: id,
    eventKey: `order:${id}:created`,
    type: 'ORDER_CREATED',
    title: 'Đã tiếp nhận đơn hàng',
    message: `Đơn hàng #${id} đã được tạo và đang chờ cửa hàng xác nhận.`,
  });
}

async function notifyOrderStatus(order, status) {
  const id = Number(order.OrderID);
  const value = String(status || '').trim().toLowerCase();
  const [title, description] = STATUS_COPY[value] || ['Trạng thái đơn hàng đã cập nhật', `Trạng thái mới: ${status}`];
  await createOrderNotification({
    userId: order.UserID,
    orderId: id,
    eventKey: `order:${id}:status:${value || 'unknown'}`,
    type: 'ORDER_STATUS',
    title,
    message: `${description} (đơn hàng #${id}).`,
  });
}

async function notifyOrderPaid(order) {
  const id = Number(order.OrderID);
  await createOrderNotification({
    userId: order.UserID,
    orderId: id,
    eventKey: `order:${id}:payment:paid`,
    type: 'PAYMENT_PAID',
    title: 'Đã nhận thanh toán',
    message: `Thanh toán cho đơn hàng #${id} đã được PayOS xác nhận.`,
  });
}

module.exports = { notifyOrderCreated, notifyOrderStatus, notifyOrderPaid };
