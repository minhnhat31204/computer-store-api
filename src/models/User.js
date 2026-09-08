const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  UserID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  FullName: { type: DataTypes.STRING, allowNull: false },
  Email: { type: DataTypes.STRING, allowNull: false, unique: true },
  PasswordHash: { type: DataTypes.STRING, allowNull: false },
  Phone: { type: DataTypes.STRING },
  Role: { type: DataTypes.STRING, defaultValue: 'Customer' },
  CreatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { timestamps: false });

module.exports = User;