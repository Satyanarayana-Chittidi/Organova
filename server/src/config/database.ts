import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'organ_donation_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
});
export async function testDatabaseConnection(): Promise<void> {
    try {
        const connection = await pool.getConnection();
        console.log('[DATABASE] Connected successfully to MySQL (organ_donation_db)');
        connection.release();
    }
    catch (error) {
        console.error('[DATABASE] Error connecting to MySQL:', error);
    }
}
export default pool;
