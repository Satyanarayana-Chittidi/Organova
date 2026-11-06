import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/database';
import { User, UserRole } from '../types/auth';

interface UserRow extends User, RowDataPacket {}

export async function findUserByEmail(email: string): Promise<User | null> {
  const [rows] = await pool.query<UserRow[]>(
    'SELECT * FROM users WHERE email = ? LIMIT 1',
    [email.toLowerCase().trim()]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function findUserById(id: string): Promise<User | null> {
  const [rows] = await pool.query<UserRow[]>(
    'SELECT * FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function findUserByGoogleId(googleId: string): Promise<User | null> {
  const [rows] = await pool.query<UserRow[]>(
    'SELECT * FROM users WHERE google_id = ? LIMIT 1',
    [googleId]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function createLocalUser(params: {
  id: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
  isVerified?: boolean;
}): Promise<User> {
  const { id, email, passwordHash, role = 'USER', isVerified = true } = params;

  await pool.query<ResultSetHeader>(
    `INSERT INTO users (id, email, password_hash, role, auth_provider, is_active, is_verified)
     VALUES (?, ?, ?, ?, 'LOCAL', TRUE, ?)`,
    [id, email.toLowerCase().trim(), passwordHash, role, isVerified]
  );

  const user = await findUserById(id);
  if (!user) throw new Error('User creation failed');
  return user;
}

export async function createGoogleUser(params: {
  id: string;
  email: string;
  googleId: string;
  role?: UserRole;
}): Promise<User> {
  const { id, email, googleId, role = 'USER' } = params;

  await pool.query<ResultSetHeader>(
    `INSERT INTO users (id, email, password_hash, role, auth_provider, google_id, is_active, is_verified)
     VALUES (?, ?, NULL, ?, 'GOOGLE', ?, TRUE, TRUE)`,
    [id, email.toLowerCase().trim(), role, googleId]
  );

  const user = await findUserById(id);
  if (!user) throw new Error('Google user creation failed');
  return user;
}

export async function markUserAsVerified(userId: string): Promise<void> {
  await pool.query<ResultSetHeader>(
    'UPDATE users SET is_verified = TRUE WHERE id = ?',
    [userId]
  );
}
