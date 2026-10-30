import mongoose from 'mongoose';
import { buildSearchTokens } from '../utils/search.js';

const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    specialization: { type: String, required: true, trim: true, maxlength: 100 },
    hospital: { type: String, required: true, trim: true, maxlength: 150 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 150 },
    // Denormalised, lower-cased words used for indexed prefix search (see utils/search.js).
    searchTokens: { type: [String], select: false },
  },
  { timestamps: true },
);

doctorSchema.statics.buildSearchTokens = (doc) =>
  buildSearchTokens([doc.name, doc.specialization, doc.hospital, doc.email, doc.phone], doc.phone);

doctorSchema.pre('validate', function setSearchTokens() {
  this.searchTokens = this.constructor.buildSearchTokens(this);
});

// Indexes (each backs a real query in services/) 
doctorSchema.index({ email: 1 }, { unique: true });              // uniqueness + lookups
doctorSchema.index({ createdAt: -1, _id: -1 });                   // default list sort / date filter
doctorSchema.index({ specialization: 1, createdAt: -1 });         // filter by specialization + sort
doctorSchema.index({ hospital: 1, createdAt: -1 });               // filter by hospital + sort
doctorSchema.index({ name: 1, _id: 1 });                          // sort by name
doctorSchema.index({ searchTokens: 1 });                          // prefix search (multikey)

doctorSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret.searchTokens;
    return ret;
  },
});

export const Doctor = mongoose.model('Doctor', doctorSchema);
