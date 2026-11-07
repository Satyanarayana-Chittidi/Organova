import pool from '../src/config/database';

async function seedAdmin(): Promise<void> {
  const adminHash = '$2b$10$1pqXqzsdydZ7xAGVl2wYweY5ObOLKc69s7kCNL4KTPmqcoBCUVZA2';
  const connection = await pool.getConnection();

  try {
    await connection.query(
      `INSERT INTO users (id, email, password_hash, role, is_active, is_verified)
       VALUES ('99fef86d-d4b8-4803-b174-b6292e231ab3', 'admin@mastercontrol.local', ?, 'ADMIN', 1, 1)
       ON DUPLICATE KEY UPDATE 
         password_hash = VALUES(password_hash),
         role = 'ADMIN',
         is_active = 1,
         is_verified = 1`,
      [adminHash]
    );
    console.log('[SEED] Administrator account provisioned: admin@mastercontrol.local');
  } catch (err: any) {
    console.error('[SEED] Failed to provision administrator account:', err.message);
    process.exit(1);
  } finally {
    connection.release();
    process.exit(0);
  }
}

seedAdmin();
