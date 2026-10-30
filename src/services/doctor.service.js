import mongoose from 'mongoose';
import { Doctor, Patient } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { buildSearchFilter } from '../utils/search.js';
import {
  buildDateRange,
  buildMeta,
  buildSort,
  countDocuments,
  getPagination,
} from '../utils/query.js';
import { CONDITIONS } from '../constants.js';

export async function ensureDoctorExists(id) {
  if (!(await Doctor.exists({ _id: id }))) throw ApiError.notFound('Doctor not found');
}

/** One grouped query for the whole page instead of N count queries. */
async function getPatientCounts(doctorIds) {
  if (!doctorIds.length) return new Map();
  const rows = await Patient.aggregate([
    { $match: { doctor: { $in: doctorIds } } },
    { $group: { _id: '$doctor', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

export async function listDoctors(query) {
  const { page, limit, skip } = getPagination(query);

  const filter = { ...buildSearchFilter(query.search) };
  if (query.specialization) filter.specialization = query.specialization;
  if (query.hospital) filter.hospital = query.hospital;
  const createdAt = buildDateRange(query.from, query.to);
  if (createdAt) filter.createdAt = createdAt;

  const [doctors, total] = await Promise.all([
    Doctor.find(filter)
      .sort(buildSort(query.sortBy, query.order))
      .skip(skip)
      .limit(limit)
      .select('-__v')
      .lean(),
    countDocuments(Doctor, filter),
  ]);

  const counts = await getPatientCounts(doctors.map((d) => d._id));

  return {
    items: doctors.map((d) => ({ ...d, patientCount: counts.get(String(d._id)) ?? 0 })),
    meta: buildMeta({ page, limit, total }),
  };
}

export async function getDoctorById(id) {
  const [doctor, byCondition] = await Promise.all([
    Doctor.findById(id).select('-__v').lean(),
    Patient.aggregate([
      { $match: { doctor: new mongoose.Types.ObjectId(id) } },
      { $group: { _id: '$condition', count: { $sum: 1 } } },
    ]),
  ]);

  if (!doctor) throw ApiError.notFound('Doctor not found');

  const counts = Object.fromEntries(byCondition.map((r) => [r._id, r.count]));
  const conditionBreakdown = CONDITIONS.map((condition) => ({
    condition,
    count: counts[condition] ?? 0,
  }));

  return {
    ...doctor,
    patientCount: conditionBreakdown.reduce((sum, c) => sum + c.count, 0),
    conditionBreakdown,
  };
}

export async function createDoctor(data) {
  const doctor = await Doctor.create(data);
  return { ...doctor.toJSON(), patientCount: 0 };
}

export async function updateDoctor(id, data) {
  const doctor = await Doctor.findById(id);
  if (!doctor) throw ApiError.notFound('Doctor not found');
  doctor.set(data);
  await doctor.save(); // save() (not updateOne) so searchTokens are rebuilt by the pre-validate hook
  return doctor.toJSON();
}

/** Deletes the doctor and their patients (patients cannot exist without a doctor). */
export async function deleteDoctor(id) {
  const doctor = await Doctor.findById(id).select('_id').lean();
  if (!doctor) throw ApiError.notFound('Doctor not found');

  const { deletedCount } = await Patient.deleteMany({ doctor: doctor._id });
  await Doctor.deleteOne({ _id: doctor._id });

  return { _id: doctor._id, deletedPatients: deletedCount };
}

/** Distinct values for filter dropdowns — answered from the indexes (DISTINCT_SCAN). */
export async function getFilterOptions() {
  const [specializations, hospitals] = await Promise.all([
    Doctor.distinct('specialization'),
    Doctor.distinct('hospital'),
  ]);
  const sort = (arr) => arr.sort((a, b) => a.localeCompare(b));
  return { specializations: sort(specializations), hospitals: sort(hospitals) };
}
