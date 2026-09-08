const { BuildPC, BuildPCItem, Product } = require('../models');

exports.getAll = async (req, res) => {
  try {
    const data = await BuildPC.findAll({
      include: [{ model: BuildPCItem, include: [Product] }]
    });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { items, ...pcData } = req.body;
    const newPc = await BuildPC.create(pcData);

    if (items && items.length > 0) {
      const pcItems = items.map(item => ({
        ...item,
        BuildPCID: newPc.BuildPCID
      }));
      await BuildPCItem.bulkCreate(pcItems);
    }

    res.status(201).json(newPc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    await BuildPC.update(req.body, { where: { BuildPCID: req.params.id } });
    res.status(200).json({ message: 'Updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await BuildPC.destroy({ where: { BuildPCID: req.params.id } });
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};