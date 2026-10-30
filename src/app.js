import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import routes from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { ApiError } from './utils/ApiError.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Allow same-origin / server-to-server requests (no Origin header) and listed clients.
        if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
        return callback(ApiError.forbidden(`Origin ${origin} is not allowed`));
      },
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 1000,
      skip: () => env.isTest,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { success: false, message: 'Too many requests, please slow down.' },
    }),
  );

  // Serverless (Vercel): open the database connection on the first request and
  // reuse it afterwards. Mongoose queues queries until it is connected.
  app.use((_req, _res, next) => {
    if (mongoose.connection.readyState === 0) {
      connectDB().catch((err) => console.error('❌ MongoDB connection failed:', err.message));
    }
    next();
  });

  app.get('/', (_req, res) => res.json({ success: true, message: 'Doctor Tracker API', docs: '/api/health' }));
  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

/**
 * Default export for Vercel, which runs `src/app.js` as one serverless function.
 * Locally, `src/server.js` connects first and then listens on PORT.
 */
const app = createApp();
export default app;
