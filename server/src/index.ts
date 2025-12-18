/**
 * AiProofTrace Server
 * 
 * Express server for recording, batching, anchoring, and verifying
 * AI inference metadata.
 */

import express, { Request, Response, NextFunction } from 'express';
import * as dotenv from 'dotenv';
import { inferenceRouter, batchRouter, anchorRouter, verifyRouter } from './api';
import { initializeStorage, getStorage } from './storage';

dotenv.config();

const app = express();
const PORT = process.env['PORT'] ?? 3000;

// Middleware
app.use(express.json());

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// API Routes
app.use('/api/inference', inferenceRouter);
app.use('/api/batch', batchRouter);
app.use('/api/anchor', anchorRouter);
app.use('/api/verify', verifyRouter);

// Health check
app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// Stats endpoint
app.get('/api/stats', (_req: Request, res: Response) => {
    try {
        const storage = getStorage();
        const stats = storage.getStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// Error handling
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
    });
});

// 404 handler
app.use((_req: Request, res: Response) => {
    res.status(404).json({
        error: 'Not found',
        code: 'NOT_FOUND',
    });
});

// Start server
async function start(): Promise<void> {
    try {
        // Initialize storage
        await initializeStorage();
        console.log('Storage initialized');

        app.listen(PORT, () => {
            console.log(`AiProofTrace server running on port ${PORT}`);
            console.log('Endpoints:');
            console.log('  POST /api/inference  - Record inference');
            console.log('  POST /api/batch      - Create Merkle batch');
            console.log('  POST /api/anchor     - Anchor batch on-chain');
            console.log('  POST /api/verify     - Verify inference');
            console.log('  GET  /api/stats      - Get storage stats');
            console.log('  GET  /health         - Health check');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

start();

export { app };
