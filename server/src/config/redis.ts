import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;

// Initialize the Redis client instance
const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  lazyConnect: true, // Connect explicitly when needed
  enableOfflineQueue: false, // Prevents queuing/freezing requests when Redis is offline
  commandTimeout: 1000, // 1 second timeout on commands
  retryStrategy(times) {
    // Retry connection up to 3 times, then back off
    if (times > 3) {
      console.warn('[REDIS] Notice: In-memory cache offline, operating in database fallback mode');
      return null; // Stop retrying
    }
    return Math.min(times * 1000, 3000); // Wait 1s, 2s, 3s
  },
});

// Event listeners for Redis connectivity lifecycle
redis.on('connect', () => {
  console.log('[REDIS] Connected successfully to in-memory cache (port 6379)');
});

redis.on('error', (err) => {
  console.warn('[REDIS] Error:', err.message);
});

// Helper function to test Redis connectivity on server boot
export async function testRedisConnection(): Promise<void> {
  try {
    await redis.connect();
  } catch (error) {
    console.warn('[REDIS] Notice: Initial connection failed (check if Redis service is started)');
  }
}

export default redis;
