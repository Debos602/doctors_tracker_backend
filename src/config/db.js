import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

let connecting = null;
let listenersAttached = false;

/**
 * Connects once and reuses the connection. On Vercel the same function
 * instance serves many requests, so later calls return the open connection
 * instead of opening a new one. A failed attempt is forgotten, so the next
 * request tries again.
 */
export function connectDB(uri = env.MONGODB_URI) {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);

  if (!listenersAttached) {
    mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
    mongoose.connection.on('reconnected', () => console.info('🔁 MongoDB reconnected'));
    listenersAttached = true;
  }

  connecting ??= mongoose
    .connect(uri, {
      // Build indexes automatically in dev; in production run `npm run sync-indexes` during deploy.
      autoIndex: !env.isProd,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000,
    })
    .then(() => {
      const { host, name } = mongoose.connection;
      console.info(`✅ MongoDB connected → ${host}/${name}`);
      return mongoose.connection;
    })
    .catch((err) => {
      connecting = null;
      throw err;
    });

  return connecting;
}

export async function disconnectDB() {
  connecting = null;
  await mongoose.connection.close();
}
