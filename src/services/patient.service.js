import mongoose from 'mongoose';
import { Patient } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { buildSearchFilter } from '../utils/search.js';
import {
  buildDateRange,
  buildMeta,
  buildSort,
  countDocuments,
  getPagination,
} from '../utils/query.js';
import { ensureDoctorExists } from './doctor.service.js';

const DOCTOR_POPULATE = { path: 'doctor', select: 'name specialization hospital' };

export function buildPatientFilter(query) {
  const filter = { ...buildSearchFilter(query.q) };

  if (query.doctor) filter.doctor = new mongoose.Types.ObjectId(query.doctor);

  if (query.condition?.length) {
    filter.condition = query.condition.length === 1 ? query.condition[0] : { $in: query.condition };
  }

  if (query.gender) filter.gender = query.gender;

  if (query.minAge !== undefined || query.maxAge !== undefined) {
    filter.age = {};
    if (query.minAge !== undefined) filter.age.$gte = query.minAge;
    if (query.maxAge !== undefined) filter.age.$lte = query.maxAge;
  }

  const range = buildDateRange(query.from, query.to);
  if (range) filter[query.dateField ?? 'admissionDate'] = range;

  return filter;
}

export async function listPatients(query) {
  const { page, limit, skip } = getPagination(query);
  const filter = buildPatientFilter(query);

  const [items, total] = await Promise.all([
    Patient.find(filter)
      .sort(buildSort(query.sortBy, query.order))
      .skip(skip)
      .limit(limit)
      .select('-__v')
      .populate(DOCTOR_POPULATE) // a single $in query for the whole page
      .lean(),
    countDocuments(Patient, filter),
  ]);

  return { items, meta: buildMeta({ page, limit, total }) };
}

export async function getPatientById(id) {
  const patient = await Patient.findById(id).select('-__v').populate(DOCTOR_POPULATE).lean();
  if (!patient) throw ApiError.notFound('Patient not found');
  return patient;
}

export async function createPatient(data) {
  await ensureDoctorExists(data.doctor);
  const patient = await Patient.create(data);
  await patient.populate(DOCTOR_POPULATE);
  return patient.toJSON();
}

export async function updatePatient(id, data) {
  const patient = await Patient.findById(id);
  if (!patient) throw ApiError.notFound('Patient not found');

  if (data.doctor && String(data.doctor) !== String(patient.doctor)) {
    await ensureDoctorExists(data.doctor);
  }

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    patient.set(key, value === '' ? undefined : value); // "" clears optional fields
  }

  await patient.save();
  await patient.populate(DOCTOR_POPULATE);
  return patient.toJSON();
}

/** When doctorId is given, the patient must belong to that doctor. */
export async function deletePatient(id, { doctorId } = {}) {
  const filter = { _id: id };
  if (doctorId) filter.doctor = doctorId;

  const deleted = await Patient.findOneAndDelete(filter).select('_id doctor').lean();
  if (!deleted) {
    throw ApiError.notFound(doctorId ? 'Patient not found for this doctor' : 'Patient not found');
  }
  return { _id: deleted._id, doctor: deleted.doctor };
}
