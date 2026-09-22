const { Order, OrderItem, User, Product, CartItemDB } = require('../models');

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
        }
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