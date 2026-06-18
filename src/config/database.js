const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

// Garante o carregamento do arquivo .env a partir da raiz do /simac
dotenv.config({ path: path.join(__dirname, '../../.env'), override: true });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'simac',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

module.exports = pool;
