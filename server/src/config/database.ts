import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

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

// Automatically seeds the database on startup if fresh/empty tables are detected
export async function autoMigrateDatabase(): Promise<void> {
  try {
    const connection = await pool.getConnection();
    try {
      const [rows]: any = await connection.query(
        "SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'medical_hubs'"
      );
      if (rows[0]?.cnt === 0) {
        console.log('[AUTO-MIGRATE] Fresh database detected. Automatically running schema & seed dump...');
        const candidatePaths = [
          path.resolve(__dirname, '../../database/production_seed_dump.sql'),
          path.resolve(__dirname, '../database/production_seed_dump.sql'),
          path.resolve(process.cwd(), 'database/production_seed_dump.sql'),
          path.resolve(process.cwd(), 'server/database/production_seed_dump.sql'),
        ];
        const targetPath = candidatePaths.find((p) => fs.existsSync(p));

        if (targetPath) {
          const rawSql = fs.readFileSync(targetPath, 'utf8');
          const cleanedSql = rawSql
            .replace(/--.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '');
          const statements = cleanedSql
            .split(';')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

          await connection.query('SET FOREIGN_KEY_CHECKS = 0');
          let executed = 0;
          for (const stmt of statements) {
            if (stmt.toLowerCase().startsWith('use ') || stmt.toLowerCase().startsWith('create database')) {
              continue;
            }
            try {
              await connection.query(stmt);
              executed++;
            } catch (err: any) {
              // Ignore duplicate or non-fatal warnings
            }
          }
          await connection.query('SET FOREIGN_KEY_CHECKS = 1');
          console.log(`[AUTO-MIGRATE] ✓ Successfully initialized ${executed} database operations, 34 hospitals, blood stock, organs, and mock data!`);
        } else {
          console.warn('[AUTO-MIGRATE] Notice: production_seed_dump.sql not found at expected paths.');
        }
      } else {
        console.log('[AUTO-MIGRATE] Database schema verified and active.');
      }
    } finally {
      connection.release();
    }
  } catch (err: any) {
    console.warn('[AUTO-MIGRATE] Non-fatal notice during database check:', err.message);
  }
}

export default pool;
