import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { autoMigrateDatabase } from './config/database';
import authRoutes from './routes/authRoutes';
import citizenRoutes from './routes/citizenRoutes';
import pledgeRoutes from './routes/pledgeRoutes';
import hubRoutes from './routes/hubRoutes';
import adminRoutes from './routes/adminRoutes';
import bloodRoutes from './routes/bloodRoutes';
import organRoutes from './routes/organRoutes';
import transplantRoutes from './routes/transplantRoutes';
import campRoutes from './routes/campRoutes';

dotenv.config();

const app: Application = express();

const uploadDir = path.join(__dirname, '../uploads/avatars');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const clientUrl = process.env.CLIENT_URL;
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        !clientUrl ||
        origin === clientUrl ||
        origin === 'http://localhost:3000' ||
        origin.endsWith('.railway.app') ||
        origin.endsWith('.onrender.com') ||
        origin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(cookieParser());

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    service: 'Organova Platform API',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health/seed', async (req: Request, res: Response) => {
  try {
    const outcome = await autoMigrateDatabase();
    res.status(200).json({
      success: true,
      service: 'Organova Platform API',
      message: 'Database schema verified and active.',
      details: outcome,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/citizen', citizenRoutes);
app.use('/api/donor', pledgeRoutes);
app.use('/api/hubs', hubRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/blood', bloodRoutes);
app.use('/api/organs', organRoutes);
app.use('/api/transplant', transplantRoutes);
app.use('/api/camps', campRoutes);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[SERVER] Unhandled Exception:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    statusCode,
    code: err.code,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export default app;
