const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST || 'localhost',
    port: 1433,
    dialect: 'mssql',
    dialectOptions: {
      options: { // Tên Instance SQL Server của bạn
        encrypt: false,
        trustServerCertificate: true
      }
    },
    logging: false
  }
);

module.exports = sequelize;