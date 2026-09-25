const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
  NotificationID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  UserID: { type: DataTypes.INTEGER, allowNull: false },
  OrderID: { type: DataTypes.INTEGER, allowNull: true },
  EventKey: { type: DataTypes.STRING(200), allowNull: false, unique: true },
  Type: { type: DataTypes.STRING(50), allowNull: false },
  Title: { type: DataTypes.STRING(160), allowNull: false },
  Message: { type: DataTypes.STRING(500), allowNull: false },
  IsRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: 'Notifications', timestamps: false });

module.exports = Notification;
