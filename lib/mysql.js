import mysql from 'mysql2/promise';

const globalForMySQL = globalThis;

export const sqlPool = globalForMySQL.__hospitalSqlPool ?? mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'hospital_supply_chain',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true
});

if (process.env.NODE_ENV !== 'production') {
  globalForMySQL.__hospitalSqlPool = sqlPool;
}
