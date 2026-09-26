const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

module.exports = sequelize.define('OrderStatusHistory', {
  StatusHistoryID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  OrderID: { type: DataTypes.INTEGER, allowNull: false },
  ActorUserID: { type: DataTypes.INTEGER, allowNull: true },
  PreviousStatus: { type: DataTypes.STRING, allowNull: true },
  NewStatus: { type: DataTypes.STRING, allowNull: false },
  Note: { type: DataTypes.STRING(500), allowNull: true },
  ChangedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: 'OrderStatusHistory', timestamps: false });
