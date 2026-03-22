import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { adapterFactory } from './adapters/adapterFactory.js';
import marketsRouter from './routes/markets.js';
import ordersRouter from './routes/orders.js';
import positionsRouter from './routes/positions.js';
import balanceRouter from './routes/balance.js';
import authRouter from './routes/auth.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// Routes
app.use('/api/markets', marketsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/positions', positionsRouter);
app.use('/api/balance', balanceRouter);
app.use('/api/auth', authRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

app.listen(config.port, async () => {
  console.log(`Server running on http://localhost:${config.port}`);
  await adapterFactory.restoreCredentials();
});
