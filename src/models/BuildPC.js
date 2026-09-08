const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BuildPC = sequelize.define('BuildPC', {
  BuildPCID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  UserID: { type: DataTypes.INTEGER, allowNull: false }, // FK -> Users
  BuildName: { type: DataTypes.STRING, defaultValue: 'Cấu hình PC cá nhân' },
  TotalPrice: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  CreatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { timestamps: false });

module.exports = BuildPC;