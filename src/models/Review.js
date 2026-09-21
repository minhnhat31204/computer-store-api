const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Review = sequelize.define('Review', {
  ReviewID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Rating: { type: DataTypes.INTEGER, allowNull: false },
  Comment: { type: DataTypes.TEXT },
  ReviewDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  ProductID: { type: DataTypes.INTEGER, allowNull: false },
  UserID: { type: DataTypes.INTEGER, allowNull: false },
  OrderID: { type: DataTypes.INTEGER, allowNull: false }
}, { timestamps: false });

module.exports = Review;


