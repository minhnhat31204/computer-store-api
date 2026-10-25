const { Category, Product } = require('../models');

exports.getAll = async (req, res) => {
  try {
    const data = await Category.findAll();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const CategoryName = String(req.body.CategoryName || '').trim();
    const ImageUrl = String(req.body.ImageUrl || '').trim() || null;
    if (!CategoryName) return res.status(400).json({ error: 'Tên danh mục không được để trống.' });
    if (CategoryName.length > 255) return res.status(400).json({ error: 'Tên danh mục không được vượt quá 255 ký tự.' });
    
    const newItem = await Category.create({
      CategoryName,
      ImageUrl
    });
    
    res.status(201).json(newItem);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Mã danh mục không hợp lệ.' });

    const category = await Category.findByPk(id);
    if (!category) return res.status(404).json({ error: 'Không tìm thấy danh mục.' });

    const productCount = await Product.count({ where: { CategoryID: id } });
    if (productCount > 0) {
      return res.status(409).json({ error: `Danh mục đang có ${productCount} sản phẩm. Hãy chuyển sản phẩm sang danh mục khác trước khi xóa.` });
    }

    await category.destroy();
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const CategoryName = String(req.body.CategoryName || '').trim();
    const ImageUrl = String(req.body.ImageUrl || '').trim() || null;
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Mã danh mục không hợp lệ.' });
    if (!CategoryName) return res.status(400).json({ error: 'Tên danh mục không được để trống.' });
    if (CategoryName.length > 255) return res.status(400).json({ error: 'Tên danh mục không được vượt quá 255 ký tự.' });

    const category = await Category.findByPk(id);
    if (!category) return res.status(404).json({ error: 'Không tìm thấy danh mục.' });

    await category.update({ CategoryName, ImageUrl });
    res.status(200).json({ message: 'Updated successfully', category });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


