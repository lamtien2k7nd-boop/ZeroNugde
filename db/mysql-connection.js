const mysql = require('mysql2/promise');
require('dotenv').config();

// MySQL connection pool
const pool = mysql.createPool({
  // Ưu tiên đọc biến của Railway trước (MYSQLHOST), nếu không có mới tìm MYSQL_HOST hoặc 'localhost'
  host: process.env.MYSQLHOST || process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQLPORT || process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQLUSER || process.env.MYSQL_USER || 'root',
  password: process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'zeronudge',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true
});

// Get connection from pool
const getConnection = async () => {
  try {
    const connection = await pool.getConnection();
    return connection;
  } catch (error) {
    console.error('MySQL connection error:', error);
    throw error;
  }
};

// Execute query
const query = async (sql, params = []) => {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('MySQL query error:', error);
    throw error;
  }
};

// Create database if not exists
const createDatabase = async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.MYSQLHOST || process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQLPORT || process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQLUSER || process.env.MYSQL_USER || 'root',
      password: process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || ''
    });
    
    const dbName = process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'zeronudge';
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`Database '${dbName}' created or already exists`);
    
    await connection.end();
  } catch (error) {
    console.error('Error creating database:', error);
    throw error;
  }
};

// Test connection
const testConnection = async () => {
  try {
    const connection = await getConnection();
    await connection.ping();
    connection.release();
    console.log('MySQL connection successful');
    return true;
  } catch (error) {
    console.error('MySQL connection test failed:', error);
    return false;
  }
};

module.exports = {
  pool,
  getConnection,
  query,
  createDatabase,
  testConnection
};
