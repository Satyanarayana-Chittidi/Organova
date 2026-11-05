import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import pool from '../src/config/database';
import { RowDataPacket } from 'mysql2';

async function exportSql() {
  console.log('Generating self-contained production_seed_dump.sql...');

  const outputPath = path.resolve(__dirname, '../database/production_seed_dump.sql');
  const organovaOutputPath = path.resolve('D:/Organova/server/database/production_seed_dump.sql');

  // Read base schema DDL
  const initSqlPath = path.resolve(__dirname, '../database/init.sql');
  let sqlContent = fs.readFileSync(initSqlPath, 'utf8');

  sqlContent += '\n\n-- ====================================================================\n';
  sqlContent += '-- COMPLETE DEPLOYMENT SEED DATA (MOCK HOSPITALS, ORGANS, BLOOD, CAMPS)\n';
  sqlContent += '-- ====================================================================\n\n';

  // Helper to escape SQL string values
  const escapeSql = (val: any): string => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return val.toString();
    if (typeof val === 'boolean') return val ? '1' : '0';
    if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
    const str = String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${str}'`;
  };

  const tablesToExport = [
    'users',
    'citizen_profiles',
    'medical_hubs',
    'donor_pledges',
    'blood_inventory',
    'available_organs',
    'transplant_requests',
    'blood_requests',
    'blood_donation_camps',
  ];

  for (const table of tablesToExport) {
    const [rows]: any = await pool.query(`SELECT * FROM ${table}`);
    if (rows.length === 0) continue;

    sqlContent += `-- --------------------------------------------------------------------\n`;
    sqlContent += `-- DATA FOR TABLE: ${table} (${rows.length} rows)\n`;
    sqlContent += `-- --------------------------------------------------------------------\n`;

    const cols = Object.keys(rows[0]);
    const colList = cols.map((c) => `\`${c}\``).join(', ');

    // Write INSERT statements in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const valuesList = chunk
        .map((row: any) => {
          const vals = cols.map((col) => escapeSql(row[col])).join(', ');
          return `  (${vals})`;
        })
        .join(',\n');

      sqlContent += `INSERT INTO \`${table}\` (${colList}) VALUES\n${valuesList}\nON DUPLICATE KEY UPDATE \`${cols[0]}\` = \`${cols[0]}\`;\n\n`;
    }
  }

  // Write file to local server/database
  fs.writeFileSync(outputPath, sqlContent, 'utf8');
  console.log(`✓ Successfully exported SQL dump to ${outputPath}`);

  // Also write to Organova repo if present
  try {
    fs.writeFileSync(organovaOutputPath, sqlContent, 'utf8');
    console.log(`✓ Successfully exported SQL dump to ${organovaOutputPath}`);
  } catch (e) {
    // Organova dir might not exist in some environments
  }

  await pool.end();
}

exportSql().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
