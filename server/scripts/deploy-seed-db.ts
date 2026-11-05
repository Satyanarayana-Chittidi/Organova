import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import pool from '../src/config/database';

async function deploySeed() {
  console.log('========================================================');
  console.log('DEPLOYMENT DATABASE SEED RUNNER');
  console.log(`Connecting to: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '3306'} / ${process.env.DB_NAME || 'organ_donation_db'}`);
  console.log('========================================================');

  const sqlFilePath = path.resolve(__dirname, '../database/production_seed_dump.sql');
  if (!fs.existsSync(sqlFilePath)) {
    throw new Error(`Dump file not found at ${sqlFilePath}. Run npm run db:export first.`);
  }

  const rawSql = fs.readFileSync(sqlFilePath, 'utf8');

  // Strip comments and split by semicolon
  const cleanedSql = rawSql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  const statements = cleanedSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`Found ${statements.length} SQL execution blocks.`);

  const connection = await pool.getConnection();
  try {
    // Disable FK checks during seed for smooth loading
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    let executed = 0;
    for (const stmt of statements) {
      if (stmt.toLowerCase().startsWith('use ') || stmt.toLowerCase().startsWith('create database')) {
        // Skip database switching if user is targeting a managed cloud DB with a specific db name
        continue;
      }
      try {
        await connection.query(stmt);
        executed++;
      } catch (err: any) {
        console.warn(`[Warning during stmt]: ${err.message?.slice(0, 120)}`);
      }
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log(`\n✓ Successfully executed ${executed} schema & seed operations on target database!`);

    // Verify summary counts
    const [hubs]: any = await connection.query('SELECT COUNT(*) as cnt FROM medical_hubs WHERE verification_status = "ACTIVE"');
    const [camps]: any = await connection.query('SELECT COUNT(*) as cnt FROM blood_donation_camps WHERE status = "UPCOMING"');
    const [organs]: any = await connection.query('SELECT COUNT(*) as cnt FROM available_organs WHERE status = "AVAILABLE"');
    const [blood]: any = await connection.query('SELECT COUNT(*) as cnt FROM blood_inventory');

    console.log('\n--- Target Database Verification Summary ---');
    console.log(`• Active Hospitals:    ${hubs[0].cnt}`);
    console.log(`• Viable Organs:       ${organs[0].cnt}`);
    console.log(`• Blood Stock Slots:   ${blood[0].cnt}`);
    console.log(`• Multi-Hospital Camps:${camps[0].cnt}`);
    console.log('========================================================\n');
  } finally {
    connection.release();
    await pool.end();
  }
}

deploySeed().catch((err) => {
  console.error('Deployment Seed Failed:', err);
  process.exit(1);
});
