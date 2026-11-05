import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Create a connection pool to reuse database connections efficiently
// Supports both individual environment variables and cloud connection strings (Railway / Render)
const dbUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;

const pool = dbUrl
  ? mysql.createPool(dbUrl)
  : mysql.createPool({
      host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
      port: Number(process.env.MYSQLPORT || process.env.DB_PORT) || 3306,
      user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
      password: process.env.MYSQLPASSWORD ?? process.env.DB_PASSWORD ?? '',
      database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'organ_donation_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });

// Helper function to verify database connectivity on server startup
export async function testDatabaseConnection(): Promise<void> {
  try {
    const connection = await pool.getConnection();
    const targetDb = dbUrl ? 'cloud connection URL' : (process.env.MYSQLDATABASE || process.env.DB_NAME || 'organ_donation_db');
    console.log(`[DATABASE] Connected successfully to MySQL (${targetDb})`);
    connection.release();
  } catch (error) {
    console.error('[DATABASE] Error connecting to MySQL:', error);
  }
}

export default pool;
