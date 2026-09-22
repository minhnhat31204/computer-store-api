const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  UserID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  PasswordHash: { type: DataTypes.STRING, allowNull: true },
  FullName: { type: DataTypes.STRING, allowNull: false },
  Email: { type: DataTypes.STRING, allowNull: false, unique: true },
  Phone: { type: DataTypes.STRING },
  Avatar: { type: DataTypes.STRING },
  Address: { type: DataTypes.STRING },
  Gender: { type: DataTypes.STRING },
  Birthday: { type: DataTypes.DATEONLY }, // DATEONLY chá»‰ lÆ°u NgÃ y/ThÃ¡ng/NÄƒm
  Role: { type: DataTypes.STRING, defaultValue: 'Customer' },
  CreatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { timestamps: false });

module.exports = User;


