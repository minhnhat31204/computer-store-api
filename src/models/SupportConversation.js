const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// IDs are intentionally scalar references: keep SQL Server sync free of FK cascade constraints.
module.exports = sequelize.define('SupportConversation', {
  ConversationID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  UserID: { type: DataTypes.INTEGER, allowNull: true },
  VisitorKey: { type: DataTypes.STRING(100), allowNull: true },
  CustomerName: { type: DataTypes.STRING(150), allowNull: false, defaultValue: 'Khách hàng' },
  CustomerEmail: { type: DataTypes.STRING(255), allowNull: true },
  Status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'Open' },
  CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  LastMessageAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: 'SupportConversations', timestamps: false });
