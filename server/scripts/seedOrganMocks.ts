import dotenv from 'dotenv';
dotenv.config();
import { seedOrganMocksService } from '../src/services/seedMockService';
import pool from '../src/config/database';
async function main() {
    console.log('Seeding never-expiring test organs and comprehensive patient requests...');
    try {
        const res = await seedOrganMocksService();
        console.log('✓ Success:', res.message);
        console.log(`- Organs Seeded: ${res.organsSeeded}`);
        console.log(`- Patients Seeded: ${res.patientsSeeded}`);
    }
    catch (err) {
        console.error('✗ Seed Failed:', err);
        process.exitCode = 1;
    }
    finally {
        await pool.end();
    }
}
main();
