const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Promotion = sequelize.define('Promotion', {
  PromotionID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Title: { type: DataTypes.STRING, allowNull: false },
  Description: { type: DataTypes.TEXT },
  ImageUrl: { type: DataTypes.STRING },
  LinkUrl: { type: DataTypes.STRING, allowNull: true },
  DiscountPercent: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
  ProductIDs: { type: DataTypes.TEXT, allowNull: true }, // JSON array or comma-separated list of product IDs in this promotion
  IsActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  StartDate: { type: DataTypes.DATEONLY, allowNull: true },
  EndDate: { type: DataTypes.DATEONLY, allowNull: true },
  CreatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { timestamps: false });

module.exports = Promotion;


