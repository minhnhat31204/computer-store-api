const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductVariant = sequelize.define('ProductVariant', {
  VariantID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ProductID: { type: DataTypes.INTEGER, allowNull: false }, // FK
  Color: { type: DataTypes.STRING },
  Configuration: { type: DataTypes.STRING },
  Price: { type: DataTypes.DECIMAL(18, 2) },
  StockQuantity: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { timestamps: false });

module.exports = ProductVariant;