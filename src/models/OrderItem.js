const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrderItem = sequelize.define('OrderItem', {
  OrderItemID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  OrderID: { type: DataTypes.INTEGER, allowNull: false }, // FK
  ProductID: { type: DataTypes.INTEGER, allowNull: false }, // FK
  Quantity: { type: DataTypes.INTEGER, allowNull: false },
  UnitPrice: { type: DataTypes.DECIMAL(18, 2), allowNull: false }
}, { timestamps: false });

module.exports = OrderItem;