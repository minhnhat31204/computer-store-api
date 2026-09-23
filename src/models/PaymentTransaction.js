const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PaymentTransaction = sequelize.define('PaymentTransaction', {
  PaymentTransactionID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  OrderID: { type: DataTypes.INTEGER, allowNull: false },
  PayOSOrderCode: { type: DataTypes.STRING(32), allowNull: false, unique: true },
  PayOSPaymentLinkID: { type: DataTypes.STRING(100), allowNull: true },
  Amount: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
  Status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING' },
  CheckoutUrl: { type: DataTypes.STRING(1000), allowNull: true },
  QrCode: { type: DataTypes.TEXT, allowNull: true },
  PaidAt: { type: DataTypes.DATE, allowNull: true },
  CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  UpdatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, { timestamps: false });

module.exports = PaymentTransaction;
