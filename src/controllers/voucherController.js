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

    if (voucher.ExpiryDate) {
      const expiry = new Date(voucher.ExpiryDate);
      if (!Number.isNaN(expiry.getTime())) {
        expiry.setHours(23, 59, 59, 999);
        if (expiry < new Date()) {
          return res.status(400).json({ valid: false, message: `Mã giảm giá "${voucher.Code}" đã hết hạn sử dụng (${voucher.ExpiryDate}).` });
        }
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
      ImageUrl: imageUrl
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
