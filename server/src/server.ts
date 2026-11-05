import http from 'http';
import app from './app';
import { testDatabaseConnection, autoMigrateDatabase } from './config/database';
import { testRedisConnection } from './config/redis';
import { initSocketServer } from './config/socket';
import { sweepTimedOutMatches } from './services/matchingService';
import dotenv from 'dotenv';

dotenv.config();

const PORT = Number(process.env.PORT) || 5000;

// Create standard Node.js HTTP server wrapping our Express application
const server = http.createServer(app);

// Initialize real-time WebSocket server
initSocketServer(server);

// Server startup lifecycle
async function startServer(): Promise<void> {
  console.log('====================================================');
  console.log('  ORGANOVA PLATFORM: BACKEND SERVER');
  console.log('====================================================');

  // 1. Verify database and cache connectivity
  await testDatabaseConnection();
  await autoMigrateDatabase();
  await testRedisConnection();

  // 2. Start HTTP listener
  server.listen(PORT, () => {
    console.log(`[SERVER] Running in ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`[SERVER] Listening on http://localhost:${PORT}`);
    console.log(`[SERVER] Health-check available at http://localhost:${PORT}/api/health`);
    console.log('====================================================');
  });

  // 3. Automated 15-second background sweeper for expired 20-minute match offers
  setInterval(async () => {
    try {
      const result = await sweepTimedOutMatches();
      if (result.timedOutCount > 0) {
        console.log(`[SWEEPER] Auto-declined ${result.timedOutCount} expired match offer(s).`);
      }
    } catch (err) {
      console.error('[SWEEPER] Error during timeout sweep:', err);
    }
  }, 15000);
}

// Handle termination signals for clean, graceful server shutdowns
process.on('SIGINT', () => {
  console.log('\n[SERVER] Received SIGINT. Gracefully shutting down...');
  server.close(() => {
    console.log('[SERVER] Closed all active HTTP connections.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n[SERVER] Received SIGTERM. Gracefully shutting down...');
  server.close(() => {
    console.log('[SERVER] Closed all active HTTP connections.');
    process.exit(0);
  });
});

startServer();
