const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Promotion = sequelize.define('Promotion', {
  PromotionID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Title: { type: DataTypes.STRING, allowNull: false },
  Description: { type: DataTypes.TEXT },
  ImageUrl: { type: DataTypes.STRING },
  CreatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { timestamps: false });

module.exports = Promotion;