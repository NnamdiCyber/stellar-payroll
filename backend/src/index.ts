import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { loadEnv } from './config/index.js';
import { payrollRoutes } from './routes/payroll.js';
import { streamRoutes } from './routes/stream.js';
import { anchorRoutes } from './routes/anchor.js';
import { errorHandler } from './middleware/errorHandler.js';

const env = loadEnv();

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', network: env.STELLAR_NETWORK });
});

app.use('/api/v1/payroll', payrollRoutes);
app.use('/api/v1/streams', streamRoutes);
app.use('/api/v1/anchor', anchorRoutes);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Payroll API running on port ${env.PORT}`);
  console.log(`Network: ${env.STELLAR_NETWORK}`);
});
