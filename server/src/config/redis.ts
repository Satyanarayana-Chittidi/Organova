import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;

const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  lazyConnect: true,
  enableOfflineQueue: false,
  commandTimeout: 1000,
  retryStrategy(times) {
    if (times > 3) {
      console.warn('[REDIS] Notice: In-memory cache offline, operating in database fallback mode');
      return null;
    }
    return Math.min(times * 1000, 3000);
  },
});

redis.on('connect', () => {
  console.log('[REDIS] Connected successfully to in-memory cache (port 6379)');
});

redis.on('error', (err) => {
  console.warn('[REDIS] Error:', err.message);
});

export async function testRedisConnection(): Promise<void> {
  try {
    await redis.connect();
  } catch (error) {
    console.warn('[REDIS] Notice: Initial connection failed (check if Redis service is started)');
  }
}

export default redis;
