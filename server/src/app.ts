import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
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
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
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
