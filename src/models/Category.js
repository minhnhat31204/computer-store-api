const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Category = sequelize.define('Category', {
  CategoryID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  CategoryName: { type: DataTypes.STRING, allowNull: false }
}, { timestamps: false });

module.exports = Category;