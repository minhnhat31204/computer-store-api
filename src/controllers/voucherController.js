const { Voucher } = require('../models');

exports.getAllVouchers = async (req, res) => {
  try {
    const vouchers = await Voucher.findAll();
    res.status(200).json(vouchers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createVoucher = async (req, res) => {
  try {
    const newVoucher = await Voucher.create(req.body);
    res.status(201).json(newVoucher);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateVoucher = async (req, res) => {
  try {
    await Voucher.update(req.body, { where: { VoucherID: req.params.id } });
    res.status(200).json({ message: 'Updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteVoucher = async (req, res) => {
  try {
    await Voucher.destroy({ where: { VoucherID: req.params.id } });
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};