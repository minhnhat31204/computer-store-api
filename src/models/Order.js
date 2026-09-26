const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
  OrderID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  UserID: { type: DataTypes.INTEGER, allowNull: false }, // FK
  OrderDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  Status: { type: DataTypes.STRING },
  InventoryReserved: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  CarrierName: { type: DataTypes.STRING(100), allowNull: true },
  TrackingNumber: { type: DataTypes.STRING(150), allowNull: true },
  EstimatedDelivery: { type: DataTypes.DATEONLY, allowNull: true },
  TotalAmount: { type: DataTypes.DECIMAL(18, 2) },
  RecipientName: { type: DataTypes.STRING },
  RecipientPhone: { type: DataTypes.STRING },
  ShippingAddress: { type: DataTypes.STRING },
  Note: { type: DataTypes.TEXT },
  PaymentMethod: { type: DataTypes.STRING },
  DiscountAmount: { type: DataTypes.DECIMAL(18, 2) },
  VoucherCode: { type: DataTypes.STRING },
  VoucherID: { type: DataTypes.INTEGER }
}, { timestamps: false });

module.exports = Order;
