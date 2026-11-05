import crypto from 'crypto';
import pool from '../src/config/database';
import { hashPassword } from '../src/utils/hash';
async function seedAdmin() {
    console.log('[SEED] Checking for root Administrator account...');
    const adminEmail = 'admin@organdonation.gov.in';
    const adminPassword = 'AdminSecurePass@2026';
    const [existing]: any = await pool.query('SELECT id, email, role FROM users WHERE email = ? LIMIT 1', [adminEmail]);
    if (existing.length > 0) {
        console.log(`[SEED] Admin account already exists: ${adminEmail} (Role: ${existing[0].role})`);
        process.exit(0);
    }
    const adminId = crypto.randomUUID();
    const passwordHash = await hashPassword(adminPassword);
    await pool.query(`INSERT INTO users (id, email, password_hash, role, auth_provider, is_active, is_verified)
     VALUES (?, ?, ?, 'ADMIN', 'LOCAL', TRUE, TRUE)`, [adminId, adminEmail, passwordHash]);
    console.log('====================================================');
    console.log('[SEED] Root Administrator successfully seeded!');
    console.log(`[SEED] Email:    ${adminEmail}`);
    console.log(`[SEED] Password: ${adminPassword}`);
    console.log(`[SEED] Role:     ADMIN`);
    console.log('====================================================');
    await pool.end();
    process.exit(0);
}
seedAdmin().catch((err) => {
    console.error('[SEED ERROR]:', err);
    process.exit(1);
});
