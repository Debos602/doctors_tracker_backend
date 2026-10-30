/** Creates missing indexes and drops ones no longer declared in the schemas. Run on deploy. */
import { connectDB, disconnectDB } from '../config/db.js';
import { Doctor, Patient, RefreshToken, User } from '../models/index.js';

await connectDB();
for (const Model of [User, RefreshToken, Doctor, Patient]) {
  const dropped = await Model.syncIndexes();
  const indexes = await Model.collection.indexes();
  console.info(`✔ ${Model.modelName}: ${indexes.length} indexes${dropped.length ? ` (dropped: ${dropped.join(', ')})` : ''}`);
}
await disconnectDB();
