import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

let listenersAttached = false;

export async function connectDB(uri = env.MONGODB_URI) {
  if (!listenersAttached) {
    mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
    mongoose.connection.on('reconnected', () => console.info('🔁 MongoDB reconnected'));
    listenersAttached = true;
  }

  await mongoose.connect(uri, {
    // Build indexes automatically in dev; in production run `npm run sync-indexes` during deploy.
    autoIndex: !env.isProd,
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 10_000,
  });

  const { host, name } = mongoose.connection;
  console.info(`✅ MongoDB connected → ${host}/${name}`);
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.connection.close();
}
