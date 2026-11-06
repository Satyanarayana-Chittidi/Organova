import bcrypt from 'bcryptjs';

// The cost factor controls how much time is needed to calculate a single bcrypt hash.
// 10 rounds is the current industry standard (balances speed and brute-force resistance).
const SALT_ROUNDS = 10;

/**
 * Hashes a plain-text password using a random cryptographically secure salt.
 * @param password - The raw user password entered during registration
 * @returns The salted and hashed password string to store in MySQL
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
}

/**
 * Compares an incoming plain-text password against a stored bcrypt hash.
 * @param plainText - The password entered by the user during login
 * @param hash - The bcrypt hash retrieved from the MySQL users table
 * @returns True if the password matches, false otherwise
 */
export async function comparePassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}
