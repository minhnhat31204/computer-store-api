const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  UserID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  PasswordHash: { type: DataTypes.STRING, allowNull: true },
  FullName: { type: DataTypes.STRING, allowNull: false },
  Username: { type: DataTypes.STRING, allowNull: true },
  Bio: { type: DataTypes.STRING, allowNull: true },
  Email: { type: DataTypes.STRING, allowNull: false, unique: true },
  RecoveryEmail: { type: DataTypes.STRING, allowNull: true },
  RecoveryEmailVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  Phone: { type: DataTypes.STRING },
  Avatar: { type: DataTypes.STRING },
  Address: { type: DataTypes.STRING },
  Gender: { type: DataTypes.STRING },
  Birthday: { type: DataTypes.DATEONLY },
  Role: { type: DataTypes.STRING, defaultValue: 'Customer' },
  CreatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { timestamps: false });

module.exports = User;
