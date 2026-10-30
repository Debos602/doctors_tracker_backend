import mongoose from 'mongoose';
import { BLOOD_GROUPS, CONDITIONS, GENDERS } from '../constants.js';
import { buildSearchTokens } from '../utils/search.js';

const patientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    age: { type: Number, required: true, min: 0, max: 130 },
    gender: { type: String, required: true, enum: GENDERS },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    email: { type: String, trim: true, lowercase: true, maxlength: 150 },
    condition: { type: String, required: true, enum: CONDITIONS, default: 'stable' },
    diagnosis: { type: String, trim: true, maxlength: 200 },
    bloodGroup: { type: String, enum: BLOOD_GROUPS },
    address: { type: String, trim: true, maxlength: 250 },
    admissionDate: { type: Date, required: true, default: Date.now },
    notes: { type: String, trim: true, maxlength: 1000 },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    searchTokens: { type: [String], select: false },
  },
  { timestamps: true },
);

patientSchema.statics.buildSearchTokens = (doc) =>
  buildSearchTokens([doc.name, doc.email, doc.phone, doc.diagnosis], doc.phone);

patientSchema.pre('validate', function setSearchTokens() {
  this.searchTokens = this.constructor.buildSearchTokens(this);
});

// ── Indexes (each backs a real query in services/) ─────────────────────────
patientSchema.index({ doctor: 1, createdAt: -1 });                // a doctor's patients, newest first
patientSchema.index({ doctor: 1, admissionDate: -1 });            // a doctor's patients by admission
patientSchema.index({ condition: 1, admissionDate: -1 });         // condition filter + date sort/range
patientSchema.index({ admissionDate: -1, _id: -1 });              // date range filters & dashboard timeline
patientSchema.index({ createdAt: -1, _id: -1 });                  // default list sort
patientSchema.index({ name: 1, _id: 1 });                         // sort by name
patientSchema.index({ searchTokens: 1 });                         // prefix search (multikey)

patientSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret.searchTokens;
    return ret;
  },
});

export const Patient = mongoose.model('Patient', patientSchema);
