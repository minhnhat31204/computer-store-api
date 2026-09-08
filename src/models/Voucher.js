const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Voucher = sequelize.define('Voucher', {
  VoucherID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Code: { type: DataTypes.STRING, allowNull: false },
  Name: { type: DataTypes.STRING, allowNull: false },
  ImageUrl: { type: DataTypes.STRING },
  DiscountPercentage: { type: DataTypes.FLOAT },
  MaxDiscountAmount: { type: DataTypes.DECIMAL(18, 2) },
  ExpiryDate: { type: DataTypes.DATE },
  IsActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { timestamps: false });

module.exports = Voucher;