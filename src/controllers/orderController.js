const { Order, OrderItem, User, Product } = require('../models');

// 1. Láº¥y táº¥t cáº£ Ä‘Æ¡n hÃ ng (bao gá»“m OrderItems vÃ  Chi tiáº¿t sáº£n pháº©m)
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

// 2. Láº¥y Ä‘Æ¡n hÃ ng theo UserID (Náº¿u app gá»i Ä‘Æ°á»ng dáº«n theo UserId)
exports.getByUserId = async (req, res) => {
  try {
    const data = await Order.findAll({
      where: { UserID: req.params.userId },
      include: [
        { 
          model: OrderItem, 
          include: [
            { 
              model: Product // Bá» 'attributes' Ä‘á»ƒ Sequelize tá»± SELECT * cÃ¡c cá»™t thá»±c táº¿ Ä‘ang cÃ³
            }
          ] 
        }
      ],
      order: [['OrderID', 'DESC']]
    });
    res.status(200).json(data);
  } catch (err) {
    console.error("Lá»—i getByUserId:", err); // In lá»—i ra terminal cá»§a Node.js Ä‘á»ƒ kiá»ƒm tra
    res.status(500).json({ error: err.message });
  }
};

// 3. Sá»­a hÃ m Create: Táº¡o ÄÆ¡n hÃ ng kÃ¨m theo danh sÃ¡ch OrderItems
exports.create = async (req, res) => {
  try {
    const { UserID, TotalAmount, PaymentMethod, Status, Items, RecipientName, RecipientPhone, ShippingAddress, Note } = req.body;

    // Táº¡o báº£n ghi Order trÆ°á»›c
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

    // Náº¿u cÃ³ danh sÃ¡ch items gá»­i lÃªn, duyá»‡t vÃ  lÆ°u vÃ o báº£ng OrderItem
    if (Items && Array.isArray(Items) && Items.length > 0) {
      const orderItemsData = Items.map(item => ({
        OrderID: newOrder.OrderID,
        ProductID: item.ProductID || item.productID || item.ID,
        Quantity: item.Quantity || item.quantity || 1,
        UnitPrice: item.UnitPrice || item.Price || item.price || 0
      }));

      // ThÃªm toÃ n bá»™ cÃ¡c sáº£n pháº©m vÃ o CSDL cÃ¹ng lÃºc
      await OrderItem.bulkCreate(orderItemsData);
    }

    res.status(201).json({ 
      message: 'Äáº·t hÃ ng thÃ nh cÃ´ng', 
      order: newOrder 
    });
  } catch (err) {
    console.error("Lá»—i táº¡o Ä‘Æ¡n hÃ ng:", err);
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


