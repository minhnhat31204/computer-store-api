const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Favorite = sequelize.define('Favorite', {
  FavoriteID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  UserID: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  ProductID: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'Favorites',
  timestamps: false
});

module.exports = Favorite;


