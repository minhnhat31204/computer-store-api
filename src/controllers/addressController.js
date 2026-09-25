const { Op } = require('sequelize');
const { AddressBookEntry, User, sequelize } = require('../models');

const textFields = ['RecipientName', 'RecipientPhone', 'AddressLine', 'ProvinceCode', 'ProvinceName', 'WardCode', 'WardName'];

function readUserId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validatePayload(payload, { partial = false } = {}) {
  const result = {};
  for (const field of textFields) {
    if (partial && !Object.hasOwn(payload, field)) continue;
    const value = payload[field];
    if (['RecipientName', 'RecipientPhone', 'AddressLine'].includes(field)) {
      if (typeof value !== 'string' || !value.trim()) return { error: `${field} là thông tin bắt buộc.` };
    }
    result[field] = typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  const hasLatitude = payload.Latitude !== undefined;
  const hasLongitude = payload.Longitude !== undefined;
  if (hasLatitude !== hasLongitude) return { error: 'Cần gửi cả vĩ độ và kinh độ.' };
  if (hasLatitude) {
    if (payload.Latitude === null && payload.Longitude === null) {
      result.Latitude = null;
      result.Longitude = null;
    } else {
      const latitude = Number(payload.Latitude);
      const longitude = Number(payload.Longitude);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        return { error: 'Tọa độ bản đồ không hợp lệ.' };
      }
      result.Latitude = latitude;
      result.Longitude = longitude;
    }
  }
  if (Object.hasOwn(payload, 'IsDefault')) {
    if (typeof payload.IsDefault !== 'boolean') return { error: 'IsDefault phải là true hoặc false.' };
    result.IsDefault = payload.IsDefault;
  }
  return { data: result };
}

async function listForUser(userId, transaction) {
  return AddressBookEntry.findAll({
    where: { UserID: userId },
    order: [['IsDefault', 'DESC'], ['AddressID', 'ASC']],
    ...(transaction ? { transaction } : {}),
  });
}

exports.list = async (req, res) => {
  const userId = readUserId(req.params.userId);
  if (!userId) return res.status(400).json({ error: 'UserID không hợp lệ.' });
  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    res.json(await listForUser(userId));
  } catch (error) {
    console.error('Lỗi tải sổ địa chỉ:', error);
    res.status(500).json({ error: 'Không tải được sổ địa chỉ.' });
  }
};

exports.create = async (req, res) => {
  const userId = readUserId(req.params.userId);
  if (!userId) return res.status(400).json({ error: 'UserID không hợp lệ.' });
  const { data, error: validationError } = validatePayload(req.body || {});
  if (validationError) return res.status(400).json({ error: validationError });
  const transaction = await sequelize.transaction();
  try {
    const user = await User.findByPk(userId, { transaction });
    if (!user) { await transaction.rollback(); return res.status(404).json({ error: 'Không tìm thấy người dùng.' }); }
    const count = await AddressBookEntry.count({ where: { UserID: userId }, transaction });
    const isDefault = count === 0 || data.IsDefault === true;
    if (isDefault) await AddressBookEntry.update({ IsDefault: false }, { where: { UserID: userId }, transaction });
    const item = await AddressBookEntry.create({ ...data, IsDefault: isDefault, UserID: userId }, { transaction });
    await transaction.commit();
    res.status(201).json(item);
  } catch (error) {
    await transaction.rollback();
    console.error('Lỗi thêm địa chỉ:', error);
    res.status(500).json({ error: 'Không lưu được địa chỉ.' });
  }
};

exports.importLegacy = async (req, res) => {
  const userId = readUserId(req.params.userId);
  const addresses = req.body?.addresses;
  if (!userId) return res.status(400).json({ error: 'UserID không hợp lệ.' });
  if (!Array.isArray(addresses) || addresses.length > 50) return res.status(400).json({ error: 'Danh sách địa chỉ nhập cũ không hợp lệ.' });
  const normalized = [];
  for (const address of addresses) {
    const legacyPayload = {
      RecipientName: address.recipientName,
      RecipientPhone: address.phone,
      AddressLine: address.address,
      ProvinceCode: address.provinceCode,
      ProvinceName: address.provinceName,
      WardCode: address.wardCode,
      WardName: address.wardName,
      Latitude: address.latitude,
      Longitude: address.longitude,
      IsDefault: address.isDefault,
    };
    const { data, error } = validatePayload(legacyPayload);
    if (error) return res.status(400).json({ error });
    normalized.push(data);
  }

  const transaction = await sequelize.transaction();
  try {
    const user = await User.findByPk(userId, { transaction });
    if (!user) { await transaction.rollback(); return res.status(404).json({ error: 'Không tìm thấy người dùng.' }); }
    const existingCount = await AddressBookEntry.count({ where: { UserID: userId }, transaction });
    if (existingCount === 0 && normalized.length) {
      const defaultIndex = Math.max(0, normalized.findIndex((item) => item.IsDefault));
      await AddressBookEntry.bulkCreate(normalized.map((item, index) => ({
        ...item,
        IsDefault: index === defaultIndex,
        UserID: userId,
      })), { transaction });
    }
    const items = await listForUser(userId, transaction);
    await transaction.commit();
    res.json(items);
  } catch (error) {
    await transaction.rollback();
    console.error('Lỗi chuyển sổ địa chỉ cũ:', error);
    res.status(500).json({ error: 'Không chuyển được địa chỉ đã lưu trước đây.' });
  }
};

exports.update = async (req, res) => {
  const userId = readUserId(req.params.userId);
  const addressId = readUserId(req.params.addressId);
  if (!userId || !addressId) return res.status(400).json({ error: 'Mã người dùng hoặc địa chỉ không hợp lệ.' });
  const { data, error: validationError } = validatePayload(req.body || {}, { partial: true });
  if (validationError) return res.status(400).json({ error: validationError });
  if (!Object.keys(data).length) return res.status(400).json({ error: 'Không có thay đổi để lưu.' });
  const transaction = await sequelize.transaction();
  try {
    const item = await AddressBookEntry.findOne({ where: { UserID: userId, AddressID: addressId }, transaction });
    if (!item) { await transaction.rollback(); return res.status(404).json({ error: 'Không tìm thấy địa chỉ.' }); }
    if (data.IsDefault === true) {
      await AddressBookEntry.update({ IsDefault: false }, { where: { UserID: userId, AddressID: { [Op.ne]: addressId } }, transaction });
    }
    await item.update(data, { transaction });
    await transaction.commit();
    res.json(item);
  } catch (error) {
    await transaction.rollback();
    console.error('Lỗi cập nhật địa chỉ:', error);
    res.status(500).json({ error: 'Không cập nhật được địa chỉ.' });
  }
};

exports.setDefault = async (req, res) => {
  const userId = readUserId(req.params.userId);
  const addressId = readUserId(req.params.addressId);
  if (!userId || !addressId) return res.status(400).json({ error: 'Mã người dùng hoặc địa chỉ không hợp lệ.' });
  const transaction = await sequelize.transaction();
  try {
    const item = await AddressBookEntry.findOne({ where: { UserID: userId, AddressID: addressId }, transaction });
    if (!item) { await transaction.rollback(); return res.status(404).json({ error: 'Không tìm thấy địa chỉ.' }); }
    await AddressBookEntry.update({ IsDefault: false }, { where: { UserID: userId }, transaction });
    await item.update({ IsDefault: true }, { transaction });
    await transaction.commit();
    res.json(item);
  } catch (error) {
    await transaction.rollback();
    console.error('Lỗi đặt địa chỉ mặc định:', error);
    res.status(500).json({ error: 'Không đặt được địa chỉ mặc định.' });
  }
};

exports.remove = async (req, res) => {
  const userId = readUserId(req.params.userId);
  const addressId = readUserId(req.params.addressId);
  if (!userId || !addressId) return res.status(400).json({ error: 'Mã người dùng hoặc địa chỉ không hợp lệ.' });
  const transaction = await sequelize.transaction();
  try {
    const item = await AddressBookEntry.findOne({ where: { UserID: userId, AddressID: addressId }, transaction });
    if (!item) { await transaction.rollback(); return res.status(404).json({ error: 'Không tìm thấy địa chỉ.' }); }
    const wasDefault = item.IsDefault;
    await item.destroy({ transaction });
    if (wasDefault) {
      const next = await AddressBookEntry.findOne({ where: { UserID: userId }, order: [['AddressID', 'ASC']], transaction });
      if (next) await next.update({ IsDefault: true }, { transaction });
    }
    await transaction.commit();
    res.json({ message: 'Đã xóa địa chỉ.' });
  } catch (error) {
    await transaction.rollback();
    console.error('Lỗi xóa địa chỉ:', error);
    res.status(500).json({ error: 'Không xóa được địa chỉ.' });
  }
};
