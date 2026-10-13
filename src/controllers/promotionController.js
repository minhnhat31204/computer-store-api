const { Promotion } = require('../models');

exports.getAll = async (req, res) => {
  try {
    const data = await Promotion.findAll({
      order: [['PromotionID', 'DESC']]
    });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const promo = await Promotion.findByPk(req.params.id);
    if (!promo) return res.status(404).json({ error: 'Không tìm thấy chương trình khuyến mãi' });

    let products = [];
    const { Product } = require('../models');
    if (promo.ProductIDs) {
      try {
        const ids = Array.isArray(promo.ProductIDs)
          ? promo.ProductIDs
          : typeof promo.ProductIDs === 'string' && promo.ProductIDs.startsWith('[')
          ? JSON.parse(promo.ProductIDs)
          : String(promo.ProductIDs).split(',').map((x) => Number(x.trim())).filter(Boolean);
        if (ids.length > 0) {
          products = await Product.findAll({ where: { ProductID: ids } });
        }
      } catch (parseErr) {
        console.warn('Error parsing ProductIDs for promotion:', parseErr.message);
      }
    }
    res.status(200).json({ promotion: promo, products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const newItem = await Promotion.create(req.body);
    res.status(201).json(newItem);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    await Promotion.update(req.body, { where: { PromotionID: req.params.id } });
    res.status(200).json({ message: 'Updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await Promotion.destroy({ where: { PromotionID: req.params.id } });
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


