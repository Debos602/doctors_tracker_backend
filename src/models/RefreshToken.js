import mongoose from 'mongoose';

/**
 * One row per issued refresh token. Only a SHA-256 hash is stored, so a
 * database leak doesn't expose usable tokens. Tokens issued from the same
 * login share a `family`; reusing an already-rotated token revokes the family.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true },
    family: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, enum: ['rotated', 'logout', 'logout_all', 'reuse_detected'] },
    replacedByHash: String,
    createdByIp: String,
    userAgent: String,
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

refreshTokenSchema.index({ tokenHash: 1 }, { unique: true });          // lookup on refresh
refreshTokenSchema.index({ family: 1, revokedAt: 1 });                 // revoke a family on reuse
refreshTokenSchema.index({ user: 1, revokedAt: 1 });                   // logout from all devices
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB deletes expired rows

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
