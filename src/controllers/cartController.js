const { CartItemDB, Product } = require('../models');

// Giải thích sửa lỗi: Biến đổi dữ liệu (format) để đưa thông tin từ bảng Product (ProductName, ImageUrl...)
// ra ngoài cùng một cấp với CartItemDB giúp Flutter đọc được trực tiếp.


// Hàm bổ trợ: Format phẳng dữ liệu cho Flutter đọc trực tiếp
const formatCartItem = (item) => {
  const plain = item.get({ plain: true });
  const product = plain.Product || {};
  return {
    ...plain,
    ProductName: product.ProductName || 'Sản phẩm',
    ImageUrl: product.ImageUrl || product.IMAGEURL || '',
    Price: product.Price || plain.Price || 0,
    DiscountPrice: product.DiscountPrice || product.Price || plain.Price || 0,
  };
};

// 1. Lấy tất cả giỏ hàng (Admin)
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

// 2. Lấy giỏ hàng theo UserID (Đồng bộ với Flutter)
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

// 3. Thêm sản phẩm vào giỏ hàng
exports.addToCart = async (req, res) => {
  try {
    const { UserID, ProductID, Quantity, Price } = req.body;

    let item = await CartItemDB.findOne({
      where: { UserID, ProductID }
    });

    if (item) {
      item.Quantity += Number(Quantity);
      await item.save();
    } else {
      item = await CartItemDB.create({
        UserID,
        ProductID,
        Quantity,
        Price
      });
    }

    // Lấy lại thông tin hoàn chỉnh kèm Product để trả về cho Flutter
    const fullItem = await CartItemDB.findOne({
      where: { ID: item.ID },
      include: [{ model: Product }]
    });

    return res.status(200).json({
      message: "Thao tác giỏ hàng thành công!",
      data: formatCartItem(fullItem)
    });

  } catch (error) {
    console.error("Lỗi thêm giỏ hàng:", error);
    return res.status(500).json({ message: "Lỗi máy chủ nội bộ", error: error.message });
  }
};

// 4. Cập nhật số lượng sản phẩm
exports.update = async (req, res) => {
  try {
    const { ID, Quantity } = req.body;
    const cartItemId = req.params.id || ID;

    if (!cartItemId) {
      return res.status(400).json({ message: "Thiếu ID sản phẩm giỏ hàng" });
    }

    const [updatedRows] = await CartItemDB.update(
      { Quantity: Number(Quantity) },
      { where: { ID: cartItemId } }
    );

    if (updatedRows > 0) {
      res.status(200).json({ message: 'Cập nhật thành công!' });
    } else {
      res.status(404).json({ message: 'Không tìm thấy sản phẩm trong giỏ!' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 5. Xóa sản phẩm khỏi giỏ
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedCount = await CartItemDB.destroy({
      where: { ID: id }
    });

    if (deletedCount > 0) {
      return res.status(200).json({ message: "Xóa sản phẩm thành công!" });
    } else {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm để xóa!" });
    }
  } catch (error) {
    console.error("Lỗi xóa giỏ hàng:", error);
    return res.status(500).json({ message: "Lỗi máy chủ nội bộ", error: error.message });
  }
};