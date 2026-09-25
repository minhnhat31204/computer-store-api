const Notification = require('../models/Notification');

exports.listForUser = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'Tài khoản không hợp lệ.' });
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const [notifications, unreadCount] = await Promise.all([
      Notification.findAll({ where: { UserID: userId }, order: [['CreatedAt', 'DESC'], ['NotificationID', 'DESC']], limit }),
      Notification.count({ where: { UserID: userId, IsRead: false } }),
    ]);
    return res.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Unable to list notifications:', error.message);
    return res.status(500).json({ error: 'Không tải được thông báo.' });
  }
};

exports.setRead = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const notificationId = Number(req.params.notificationId);
    if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(notificationId) || notificationId <= 0) {
      return res.status(400).json({ error: 'Thông tin thông báo không hợp lệ.' });
    }
    const isRead = req.body?.IsRead;
    if (typeof isRead !== 'boolean') return res.status(400).json({ error: 'Trạng thái đã đọc không hợp lệ.' });
    const [updated] = await Notification.update({ IsRead: isRead }, { where: { UserID: userId, NotificationID: notificationId } });
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy thông báo.' });
    return res.json({ success: true });
  } catch (error) {
    console.error('Unable to update notification:', error.message);
    return res.status(500).json({ error: 'Không cập nhật được thông báo.' });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'Tài khoản không hợp lệ.' });
    await Notification.update({ IsRead: true }, { where: { UserID: userId, IsRead: false } });
    return res.json({ success: true });
  } catch (error) {
    console.error('Unable to mark notifications read:', error.message);
    return res.status(500).json({ error: 'Không cập nhật được thông báo.' });
  }
};
