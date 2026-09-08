const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CartItemDB = sequelize.define('CartItemDB', {
  ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  UserID: { type: DataTypes.INTEGER, allowNull: false }, // FK
  ProductID: { type: DataTypes.INTEGER, allowNull: false }, // FK
  Quantity: { type: DataTypes.INTEGER, allowNull: false },
  Price: { type: DataTypes.DECIMAL(18, 2) }
}, { timestamps: false });

module.exports = CartItemDB;