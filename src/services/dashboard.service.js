import { Doctor, Patient } from '../models/index.js';
import { CONDITIONS, GENDERS } from '../constants.js';

const DAY = 86_400_000;
const FORMATS = { day: '%Y-%m-%d', month: '%Y-%m' };

const AGE_BUCKETS = [
  { min: 0, label: '0-12' },
  { min: 13, label: '13-17' },
  { min: 18, label: '18-29' },
  { min: 30, label: '30-44' },
  { min: 45, label: '45-59' },
  { min: 60, label: '60+' },
];

function resolveRange({ from, to }) {
  const end = to ?? new Date();
  const start = from ?? new Date(end.getTime() - 29 * DAY); // default: last 30 days
  return { start, end };
}

function resolveGranularity(start, end, requested) {
  if (requested !== 'auto') return requested;
  return (end - start) / DAY <= 92 ? 'day' : 'month';
}

/** Every bucket key in the range, so charts get explicit zeros instead of gaps. */
function bucketKeys(start, end, granularity, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    ...(granularity === 'day' && { day: '2-digit' }),
  });
  const keys = new Set();
  for (let t = start.getTime(); t <= end.getTime(); t += DAY) keys.add(fmt.format(new Date(t)));
  keys.add(fmt.format(end));
  return [...keys];
}

const percentChange = (current, previous) =>
  previous === 0 ? (current === 0 ? 0 : 100) : Math.round(((current - previous) / previous) * 1000) / 10;

const fillCounts = (rows, keys, keyName) => {
  const map = new Map(rows.map((r) => [r._id, r.count]));
  return keys.map((k) => ({ [keyName]: k, count: map.get(k) ?? 0 }));
};

/**
 * Everything the dashboard needs in one round trip. Each metric is its own
 * small aggregation run in parallel (rather than one big $facet), so the
 * date-bounded ones can use the admissionDate index.
 */
export async function getSummary({ from, to, granularity: requested, tz, topDoctors }) {
  const { start, end } = resolveRange({ from, to });
  const granularity = resolveGranularity(start, end, requested);
  const span = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - span);
  const inRange = { $gte: start, $lte: end };

  const [
    totalDoctors,
    totalPatients,
    admissionsInRange,
    admissionsPrevRange,
    newDoctorsInRange,
    criticalPatients,
    byCondition,
    byGender,
    byAge,
    perDoctor,
    bySpecialization,
    timeline,
    recentPatients,
  ] = await Promise.all([
    Doctor.estimatedDocumentCount(),
    Patient.estimatedDocumentCount(),
    Patient.countDocuments({ admissionDate: inRange }),
    Patient.countDocuments({ admissionDate: { $gte: prevStart, $lt: start } }),
    Doctor.countDocuments({ createdAt: inRange }),
    Patient.countDocuments({ condition: 'critical' }),

    Patient.aggregate([{ $group: { _id: '$condition', count: { $sum: 1 } } }]),

    Patient.aggregate([{ $group: { _id: '$gender', count: { $sum: 1 } } }]),

    Patient.aggregate([
      {
        $bucket: {
          groupBy: '$age',
          boundaries: [...AGE_BUCKETS.map((b) => b.min), 131],
          default: 'unknown',
          output: { count: { $sum: 1 } },
        },
      },
    ]),

    Patient.aggregate([
      { $group: { _id: '$doctor', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: topDoctors },
      { $lookup: { from: 'doctors', localField: '_id', foreignField: '_id', as: 'doctor' } },
      { $unwind: '$doctor' },
      {
        $project: {
          _id: 0,
          doctorId: '$_id',
          name: '$doctor.name',
          specialization: '$doctor.specialization',
          count: 1,
        },
      },
    ]),

    Doctor.aggregate([
      { $group: { _id: '$specialization', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $project: { _id: 0, specialization: '$_id', count: 1 } },
    ]),

    Patient.aggregate([
      { $match: { admissionDate: inRange } },
      {
        $group: {
          _id: { $dateToString: { format: FORMATS[granularity], date: '$admissionDate', timezone: tz } },
          admissions: { $sum: 1 },
          critical: { $sum: { $cond: [{ $eq: ['$condition', 'critical'] }, 1, 0] } },
          discharged: { $sum: { $cond: [{ $eq: ['$condition', 'discharged'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    Patient.find()
      .sort({ createdAt: -1, _id: -1 })
      .limit(5)
      .select('name age gender condition admissionDate doctor createdAt')
      .populate({ path: 'doctor', select: 'name specialization' })
      .lean(),
  ]);

  const timelineMap = new Map(timeline.map((t) => [t._id, t]));
  const ageMap = new Map(byAge.map((b) => [b._id, b.count]));

  return {
    range: { from: start, to: end, granularity, timezone: tz },
    totals: {
      doctors: totalDoctors,
      patients: totalPatients,
      criticalPatients,
      avgPatientsPerDoctor: totalDoctors ? Math.round((totalPatients / totalDoctors) * 10) / 10 : 0,
      admissionsInRange,
      admissionsPrevRange,
      admissionsChangePct: percentChange(admissionsInRange, admissionsPrevRange),
      newDoctorsInRange,
    },
    patientsByCondition: fillCounts(byCondition, CONDITIONS, 'condition'),
    patientsByGender: fillCounts(byGender, GENDERS, 'gender'),
    patientsByAgeGroup: AGE_BUCKETS.map((b) => ({ ageGroup: b.label, count: ageMap.get(b.min) ?? 0 })),
    patientsPerDoctor: perDoctor,
    doctorsBySpecialization: bySpecialization,
    admissionsTimeline: bucketKeys(start, end, granularity, tz).map((date) => {
      const row = timelineMap.get(date);
      return {
        date,
        admissions: row?.admissions ?? 0,
        critical: row?.critical ?? 0,
        discharged: row?.discharged ?? 0,
      };
    }),
    recentPatients,
  };
}
