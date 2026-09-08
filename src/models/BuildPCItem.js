const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BuildPCItem = sequelize.define('BuildPCItem', {
  BuildPCItemID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  BuildPCID: { type: DataTypes.INTEGER, allowNull: false }, // FK -> BuildPCs
  ProductID: { type: DataTypes.INTEGER, allowNull: false }, // FK -> Products
  ComponentType: { type: DataTypes.STRING }, // CPU, RAM, GPU, Storage, Mainboard,...
  Quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
  UnitPrice: { type: DataTypes.DECIMAL(18, 2) }
}, { timestamps: false });

module.exports = BuildPCItem;