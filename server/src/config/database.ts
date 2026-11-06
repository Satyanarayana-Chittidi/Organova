import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Create a connection pool to reuse database connections efficiently
// Supports individual environment variables and cloud connection strings (TiDB / Render / Railway)
const dbUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;

function createDatabasePool() {
  if (dbUrl) {
    try {
      const isTidb = dbUrl.includes('tidbcloud.com');
      // If TiDB Cloud is detected and SSL isn't explicitly defined in query params, enforce TLSv1.2
      if (isTidb && !dbUrl.includes('ssl=')) {
        const parsed = new URL(dbUrl);
        return mysql.createPool({
          host: parsed.hostname,
          port: Number(parsed.port) || 4000,
          user: decodeURIComponent(parsed.username),
          password: decodeURIComponent(parsed.password),
          database: parsed.pathname.replace(/^\//, '') || 'organ_donation_db',
          ssl: {
            minVersion: 'TLSv1.2',
            rejectUnauthorized: true,
          },
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          enableKeepAlive: true,
          keepAliveInitialDelay: 0,
        });
      }
    } catch (e) {
      // Fall through to standard pool creation
    }
    return mysql.createPool(dbUrl);
  }

  return mysql.createPool({
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
}

const pool = createDatabasePool();

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
export async function autoMigrateDatabase(force = false): Promise<{ executed: number; errors: string[] }> {
  const result = { executed: 0, errors: [] as string[] };
  try {
    const connection = await pool.getConnection();
    try {
      const [rows]: any = await connection.query(
        "SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'blood_donation_camps'"
      );
      if (force || rows[0]?.cnt === 0) {
        console.log('[AUTO-MIGRATE] Running schema & seed dump (force=' + force + ')...');
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

          // Ensure modern schema columns exist if tables already existed without them
          const schemaPatches = [
            'ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) NULL AFTER google_id',
            'ALTER TABLE citizen_profiles ADD COLUMN avatar_url VARCHAR(255) NULL AFTER pincode',
            'ALTER TABLE blood_donation_camps ADD COLUMN map_url TEXT NULL AFTER longitude',
          ];
          for (const patch of schemaPatches) {
            try {
              await connection.query(patch);
            } catch (err: any) {
              // Ignore if already present (ER_DUP_FIELDNAME 1060) or table not created yet (ER_NO_SUCH_TABLE 1146)
            }
          }

          for (const stmt of statements) {
            if (stmt.toLowerCase().startsWith('use ') || stmt.toLowerCase().startsWith('create database')) {
              continue;
            }
            try {
              await connection.query(stmt);
              result.executed++;
            } catch (err: any) {
              result.errors.push(err.message);
              console.warn('[AUTO-MIGRATE] Statement warning:', err.message?.slice(0, 120));
            }
          }
          await connection.query('SET FOREIGN_KEY_CHECKS = 1');
          console.log(`[AUTO-MIGRATE] ✓ Successfully executed ${result.executed} operations (${result.errors.length} warnings)`);
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
    result.errors.push(err.message);
  }
  return result;
}

export default pool;
