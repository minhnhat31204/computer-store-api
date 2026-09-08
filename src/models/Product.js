const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
  ProductID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ProductName: { type: DataTypes.STRING, allowNull: false },
  Description: { type: DataTypes.TEXT },
  Price: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
  DiscountPrice: { type: DataTypes.DECIMAL(18, 2) },
  StockQuantity: { type: DataTypes.INTEGER, defaultValue: 0 },
  ImageUrl: { type: DataTypes.STRING },
  CreatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  CategoryID: { type: DataTypes.INTEGER }, // FK
  CPU: { type: DataTypes.STRING },
  RAM: { type: DataTypes.STRING },
  Storage: { type: DataTypes.STRING },
  Display: { type: DataTypes.STRING },
  RefreshRate: { type: DataTypes.STRING }
}, { timestamps: false });

module.exports = Product;