const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

module.exports = sequelize.define('SupportMessage', {
  MessageID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ConversationID: { type: DataTypes.INTEGER, allowNull: false },
  SenderUserID: { type: DataTypes.INTEGER, allowNull: true },
  SenderRole: { type: DataTypes.STRING(20), allowNull: false },
  SenderName: { type: DataTypes.STRING(150), allowNull: false },
  Message: { type: DataTypes.STRING(2000), allowNull: false },
  CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: 'SupportMessages', timestamps: false });
