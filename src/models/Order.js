const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
  OrderID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  UserID: { type: DataTypes.INTEGER, allowNull: false }, // FK
  OrderDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  Status: { type: DataTypes.STRING },
  TotalAmount: { type: DataTypes.DECIMAL(18, 2) },
  RecipientName: { type: DataTypes.STRING },
  RecipientPhone: { type: DataTypes.STRING },
  ShippingAddress: { type: DataTypes.STRING },
  Note: { type: DataTypes.TEXT },
  PaymentMethod: { type: DataTypes.STRING },
  DiscountAmount: { type: DataTypes.DECIMAL(18, 2) }
}, { timestamps: false });

module.exports = Order;