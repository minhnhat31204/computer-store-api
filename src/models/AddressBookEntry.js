const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AddressBookEntry = sequelize.define('AddressBookEntry', {
  AddressID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  UserID: { type: DataTypes.INTEGER, allowNull: false },
  RecipientName: { type: DataTypes.STRING(150), allowNull: false },
  RecipientPhone: { type: DataTypes.STRING(30), allowNull: false },
  AddressLine: { type: DataTypes.STRING(400), allowNull: false },
  ProvinceCode: { type: DataTypes.STRING(20), allowNull: true },
  ProvinceName: { type: DataTypes.STRING(100), allowNull: true },
  WardCode: { type: DataTypes.STRING(20), allowNull: true },
  WardName: { type: DataTypes.STRING(100), allowNull: true },
  Latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  Longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  IsDefault: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  UpdatedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'UserAddresses',
  timestamps: false,
});

module.exports = AddressBookEntry;
