const { Voucher, sequelize } = require('../models');

exports.getAllVouchers = async (req, res) => {
  try {
    const vouchers = await Voucher.findAll({
      order: [['VoucherID', 'DESC']]
    });
    res.status(200).json(vouchers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getVoucherById = async (req, res) => {
  try {
    const voucher = await Voucher.findByPk(req.params.id);
    if (!voucher) {
      return res.status(404).json({ message: 'Không tìm thấy mã giảm giá.' });
    }
    res.status(200).json(voucher);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getVoucherByCode = async (req, res) => {
  try {
    const code = String(req.params.code || '').trim();
    if (!code) {
      return res.status(400).json({ message: 'Mã giảm giá không hợp lệ.' });
    }
    const voucher = await Voucher.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('Code')),
        code.toLowerCase()
      )
    });
    if (!voucher) {
      return res.status(404).json({ message: `Không tìm thấy mã giảm giá "${code}".` });
    }
    res.status(200).json(voucher);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.validateVoucher = async (req, res) => {
  try {
    const code = String(req.body.code || req.body.Code || '').trim();
    const subtotal = Math.max(0, Number(req.body.subtotal || req.body.TotalAmount || 0));

    if (!code) {
      return res.status(400).json({ valid: false, message: 'Vui lòng cung cấp mã giảm giá.' });
    }

    const voucher = await Voucher.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('Code')),
        code.toLowerCase()
      )
    });

    if (!voucher) {
      return res.status(404).json({ valid: false, message: `Mã giảm giá "${code}" không tồn tại trên hệ thống.` });
    }

    if (voucher.IsActive === false) {
      return res.status(400).json({ valid: false, message: `Mã giảm giá "${voucher.Code}" hiện đã tạm ngưng hoặc không còn hiệu lực.` });
    }

    if (voucher.Quantity !== null && voucher.Quantity !== undefined && Number(voucher.Quantity) <= 0) {
      return res.status(400).json({ valid: false, message: `Mã giảm giá "${voucher.Code}" đã hết lượt sử dụng.` });
    }

    if (voucher.ExpiryDate) {
      const expiry = new Date(voucher.ExpiryDate);
      if (!Number.isNaN(expiry.getTime())) {
        expiry.setHours(23, 59, 59, 999);
        if (expiry < new Date()) {
          return res.status(400).json({ valid: false, message: `Mã giảm giá "${voucher.Code}" đã hết hạn sử dụng (${voucher.ExpiryDate}).` });
        }
      }
    }

    if (voucher.MinOrderAmount !== null && voucher.MinOrderAmount !== undefined) {
      const minSpend = Number(voucher.MinOrderAmount);
      if (Number.isFinite(minSpend) && minSpend > 0 && subtotal < minSpend) {
        return res.status(400).json({
          valid: false,
          message: `Mã giảm giá "${voucher.Code}" chỉ áp dụng cho đơn hàng từ ${Math.round(minSpend).toLocaleString('vi-VN')} ₫ trở lên (hiện tại: ${Math.round(subtotal).toLocaleString('vi-VN')} ₫).`
        });
      }
    }

    const pct = Math.max(0, Number(voucher.DiscountPercentage) || 0);
    const cap = Number(voucher.MaxDiscountAmount);
    const percentageDiscount = (subtotal * pct) / 100;
    const discountAmount = Math.min(
      subtotal,
      Number.isFinite(cap) && cap > 0 ? Math.min(percentageDiscount, cap) : percentageDiscount
    );

    return res.status(200).json({
      valid: true,
      message: `Áp dụng mã giảm giá "${voucher.Code}" thành công!`,
      voucher,
      discountAmount: Math.round(discountAmount)
    });
  } catch (error) {
    return res.status(500).json({ valid: false, message: error.message });
  }
};

exports.createVoucher = async (req, res) => {
  try {
    const code = String(req.body.Code || '').trim().toUpperCase();
    const name = String(req.body.Name || '').trim();
    const discountPercentage = Number(req.body.DiscountPercentage);
    const maxDiscountAmount = req.body.MaxDiscountAmount !== undefined && req.body.MaxDiscountAmount !== '' && req.body.MaxDiscountAmount !== null
      ? Number(req.body.MaxDiscountAmount)
      : null;
    const expiryDate = req.body.ExpiryDate ? String(req.body.ExpiryDate).trim() : null;
    const isActive = req.body.IsActive !== undefined ? Boolean(req.body.IsActive) : true;
    const imageUrl = req.body.ImageUrl ? String(req.body.ImageUrl).trim() : null;
    const quantity = req.body.Quantity !== undefined && req.body.Quantity !== '' && req.body.Quantity !== null
      ? Math.max(0, parseInt(req.body.Quantity, 10))
      : null;
    const condition = req.body.Condition !== undefined && req.body.Condition !== '' && req.body.Condition !== null
      ? String(req.body.Condition).trim()
      : null;
    let minOrderAmount = req.body.MinOrderAmount !== undefined && req.body.MinOrderAmount !== '' && req.body.MinOrderAmount !== null
      ? Number(req.body.MinOrderAmount)
      : null;

    if (!code) {
      return res.status(400).json({ message: 'Mã giảm giá không được để trống.' });
    }
    if (!name) {
      return res.status(400).json({ message: 'Tên chương trình giảm giá không được để trống.' });
    }
    if (!Number.isFinite(discountPercentage) || discountPercentage <= 0 || discountPercentage > 100) {
      return res.status(400).json({ message: 'Phần trăm giảm giá phải là số từ 1 đến 100.' });
    }
    if (maxDiscountAmount !== null && (!Number.isFinite(maxDiscountAmount) || maxDiscountAmount < 0)) {
      return res.status(400).json({ message: 'Số tiền giảm tối đa không hợp lệ.' });
    }
    if (minOrderAmount !== null && (!Number.isFinite(minOrderAmount) || minOrderAmount < 0)) {
      return res.status(400).json({ message: 'Số tiền đơn hàng tối thiểu không hợp lệ.' });
    }

    // Nếu người dùng nhập điều kiện dạng số mà chưa nhập MinOrderAmount thì tự gán MinOrderAmount
    if (minOrderAmount === null && condition) {
      const cleaned = condition.replace(/[.,\sđ₫kK]/g, '');
      if (/^\d+$/.test(cleaned)) {
        let val = parseInt(cleaned, 10);
        if (/[kK]$/.test(condition.trim())) val *= 1000;
        if (Number.isFinite(val) && val > 0) minOrderAmount = val;
      }
    }

    const existing = await Voucher.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('Code')),
        code.toLowerCase()
      )
    });
    if (existing) {
      return res.status(400).json({ message: `Mã giảm giá "${code}" đã tồn tại trên hệ thống.` });
    }

    const newVoucher = await Voucher.create({
      Code: code,
      Name: name,
      DiscountPercentage: discountPercentage,
      MaxDiscountAmount: maxDiscountAmount,
      ExpiryDate: expiryDate || null,
      IsActive: isActive,
      ImageUrl: imageUrl,
      Quantity: quantity,
      Condition: condition,
      MinOrderAmount: minOrderAmount
    });

    res.status(201).json(newVoucher);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateVoucher = async (req, res) => {
  try {
    const voucher = await Voucher.findByPk(req.params.id);
    if (!voucher) {
      return res.status(404).json({ message: 'Không tìm thấy mã giảm giá.' });
    }

    const updateData = {};
    if (req.body.Code !== undefined) {
      const code = String(req.body.Code).trim().toUpperCase();
      if (!code) return res.status(400).json({ message: 'Mã giảm giá không được để trống.' });
      
      const duplicate = await Voucher.findOne({
        where: sequelize.where(
          sequelize.fn('LOWER', sequelize.col('Code')),
          code.toLowerCase()
        )
      });
      if (duplicate && Number(duplicate.VoucherID) !== Number(req.params.id)) {
        return res.status(400).json({ message: `Mã giảm giá "${code}" đã được sử dụng bởi voucher khác.` });
      }
      updateData.Code = code;
    }

    if (req.body.Name !== undefined) {
      const name = String(req.body.Name).trim();
      if (!name) return res.status(400).json({ message: 'Tên chương trình không được để trống.' });
      updateData.Name = name;
    }

    if (req.body.DiscountPercentage !== undefined) {
      const pct = Number(req.body.DiscountPercentage);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        return res.status(400).json({ message: 'Phần trăm giảm giá phải từ 1 đến 100.' });
      }
      updateData.DiscountPercentage = pct;
    }

    if (req.body.MaxDiscountAmount !== undefined) {
      if (req.body.MaxDiscountAmount === '' || req.body.MaxDiscountAmount === null) {
        updateData.MaxDiscountAmount = null;
      } else {
        const cap = Number(req.body.MaxDiscountAmount);
        if (!Number.isFinite(cap) || cap < 0) {
          return res.status(400).json({ message: 'Số tiền giảm tối đa không hợp lệ.' });
        }
        updateData.MaxDiscountAmount = cap;
      }
    }

    if (req.body.ExpiryDate !== undefined) {
      updateData.ExpiryDate = req.body.ExpiryDate ? String(req.body.ExpiryDate).trim() : null;
    }

    if (req.body.IsActive !== undefined) {
      updateData.IsActive = Boolean(req.body.IsActive);
    }

    if (req.body.ImageUrl !== undefined) {
      updateData.ImageUrl = req.body.ImageUrl ? String(req.body.ImageUrl).trim() : null;
    }

    if (req.body.Quantity !== undefined) {
      if (req.body.Quantity === '' || req.body.Quantity === null) {
        updateData.Quantity = null;
      } else {
        const q = parseInt(req.body.Quantity, 10);
        if (Number.isNaN(q) || q < 0) {
          return res.status(400).json({ message: 'Số lượng voucher không hợp lệ.' });
        }
        updateData.Quantity = q;
      }
    }

    if (req.body.Condition !== undefined) {
      updateData.Condition = req.body.Condition !== '' && req.body.Condition !== null
        ? String(req.body.Condition).trim()
        : null;
    }

    if (req.body.MinOrderAmount !== undefined) {
      if (req.body.MinOrderAmount === '' || req.body.MinOrderAmount === null) {
        updateData.MinOrderAmount = null;
      } else {
        const minVal = Number(req.body.MinOrderAmount);
        if (!Number.isFinite(minVal) || minVal < 0) {
          return res.status(400).json({ message: 'Số tiền đơn hàng tối thiểu không hợp lệ.' });
        }
        updateData.MinOrderAmount = minVal;
      }
    }

    // Nếu sửa Condition dạng số mà chưa có MinOrderAmount thì tự gán MinOrderAmount
    if (updateData.MinOrderAmount === undefined && updateData.Condition) {
      const cleaned = updateData.Condition.replace(/[.,\sđ₫kK]/g, '');
      if (/^\d+$/.test(cleaned)) {
        let val = parseInt(cleaned, 10);
        if (/[kK]$/.test(updateData.Condition.trim())) val *= 1000;
        if (Number.isFinite(val) && val > 0) updateData.MinOrderAmount = val;
      }
    }

    await voucher.update(updateData);
    const updated = await Voucher.findByPk(req.params.id);
    res.status(200).json({ message: 'Cập nhật mã giảm giá thành công', voucher: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteVoucher = async (req, res) => {
  try {
    const voucher = await Voucher.findByPk(req.params.id);
    if (!voucher) {
      return res.status(404).json({ message: 'Không tìm thấy mã giảm giá để xóa.' });
    }
    await voucher.destroy();
    res.status(200).json({ message: 'Xóa mã giảm giá thành công' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
