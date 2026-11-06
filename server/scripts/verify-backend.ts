import pool from '../src/config/database';

async function runVerification(): Promise<void> {
  console.log('====================================================');
  console.log('  RUNNING BACKEND AUTOMATED VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function record(title: string, condition: boolean, detail: string = ''): void {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] Test ${total}: ${title} ${detail ? `(${detail})` : ''}`);
    } else {
      console.error(`[FAIL] Test ${total}: ${title} ${detail ? `(${detail})` : ''}`);
    }
  }

  try {
    const res = await fetch('http://localhost:5000/api/health');
    const data = (await res.json()) as any;
    record('HTTP /api/health Endpoint', res.status === 200 && data.status === 'OK', `Status: ${data.status}`);
  } catch (err: any) {
    record('HTTP /api/health Endpoint', false, err.message);
  }

  try {
    const res = await fetch('http://localhost:5000/api/nonexistent-route');
    const data = (await res.json()) as any;
    record('HTTP 404 Error Handler', res.status === 404 && data.success === false, `Message: ${data.message}`);
  } catch (err: any) {
    record('HTTP 404 Error Handler', false, err.message);
  }

  try {
    const [rows] = await pool.query('SELECT 1 + 1 AS sum');
    const sum = (rows as any)[0].sum;
    record('MySQL Connection Pool Connectivity', sum === 2, 'Ping query returned 2');
  } catch (err: any) {
    record('MySQL Connection Pool Connectivity', false, err.message);
  }

  try {
    const [rows] = await pool.query('SHOW TABLES');
    const tables = (rows as any[]).map((r) => Object.values(r)[0]);
    record('Database Schema Verification', tables.length === 10, `Found all ${tables.length} expected tables`);
  } catch (err: any) {
    record('Database Schema Verification', false, err.message);
  }

  try {
    const [rows] = await pool.query('SELECT code, name, category, max_viability_hours FROM organ_types ORDER BY id ASC');
    const items = rows as any[];
    record('Clinical Organ Catalog Seed Data', items.length === 8, `Found ${items.length} verified types`);
  } catch (err: any) {
    record('Clinical Organ Catalog Seed Data', false, err.message);
  }

  console.log('\n====================================================');
  console.log(`  VERIFICATION RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log('====================================================');

  await pool.end();
  process.exit(passed === total ? 0 : 1);
}

runVerification();
