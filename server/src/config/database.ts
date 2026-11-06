import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;

function createDatabasePool() {
  if (dbUrl) {
    try {
      const isTidb = dbUrl.includes('tidbcloud.com');
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
          keepAliveInitialDelay: 10000,
          idleTimeout: 60000,
          connectTimeout: 20000,
          maxIdle: 5,
        });
      }
    } catch (e) {
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
    keepAliveInitialDelay: 10000,
    idleTimeout: 60000,
    connectTimeout: 20000,
    maxIdle: 5,
  });
}

const pool = createDatabasePool();

pool.on('connection', (connection: any) => {
  connection.on('error', (err: any) => {
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
      console.warn('[DATABASE] Stale connection closed by database server, recycling socket.');
    }
  });
});

async function ensureDatabaseExists(): Promise<void> {
  const targetDb = process.env.MYSQLDATABASE || process.env.DB_NAME || 'organ_donation_db';
  if (dbUrl) {
    try {
      const parsed = new URL(dbUrl);
      const dbName = parsed.pathname.replace(/^\//, '') || targetDb;
      const connConfig: any = {
        host: parsed.hostname,
        port: Number(parsed.port) || 4000,
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
      };
      if (dbUrl.includes('tidbcloud.com') || !dbUrl.includes('ssl=')) {
        connConfig.ssl = { minVersion: 'TLSv1.2', rejectUnauthorized: true };
      }
      const connection = await mysql.createConnection(connConfig);
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
      console.log(`[DATABASE] ✓ Ensured database '${dbName}' exists on MySQL / TiDB`);
      await connection.end();
    } catch (err: any) {
      console.warn('[DATABASE] Notice during database creation check:', err.message);
    }
  } else {
    try {
      const connection = await mysql.createConnection({
        host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
        port: Number(process.env.MYSQLPORT || process.env.DB_PORT) || 3306,
        user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
        password: process.env.MYSQLPASSWORD ?? process.env.DB_PASSWORD ?? '',
      });
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${targetDb}\``);
      await connection.end();
    } catch (err: any) {
      console.warn('[DATABASE] Notice during local database creation check:', err.message);
    }
  }
}

export async function testDatabaseConnection(): Promise<void> {
  await ensureDatabaseExists();
  try {
    const connection = await pool.getConnection();
    const targetDb = dbUrl ? 'cloud connection URL' : (process.env.MYSQLDATABASE || process.env.DB_NAME || 'organ_donation_db');
    console.log(`[DATABASE] Connected successfully to MySQL (${targetDb})`);
    connection.release();
  } catch (error) {
    console.error('[DATABASE] Error connecting to MySQL:', error);
  }
}

export async function autoMigrateDatabase(): Promise<{ status: string; tables: number }> {
  await ensureDatabaseExists();
  try {
    const connection = await pool.getConnection();
    try {
      const [rows]: any = await connection.query(
        "SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = DATABASE()"
      );
      const tableCount = rows[0]?.cnt || 0;
      console.log(`[AUTO-MIGRATE] Database schema verified: ${tableCount} active tables.`);
      return { status: 'active', tables: tableCount };
    } finally {
      connection.release();
    }
  } catch (err: any) {
    console.warn('[AUTO-MIGRATE] Database check notice:', err.message);
    return { status: 'error', tables: 0 };
  }
}

export default pool;
