/**
 * Seeds an admin user plus realistic demo doctors & patients.
 *
 *   npm run seed                        # add data (keeps existing)
 *   npm run seed:fresh                  # wipe doctors & patients first
 *   node src/scripts/seed.js --doctors=50 --patients=5000 --fresh
 */
import { env } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { Doctor, Patient, User } from '../models/index.js';
import { BLOOD_GROUPS, CONDITIONS, ROLES } from '../constants.js';

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
    return [key, value];
  }),
);

const DOCTOR_COUNT = Number(args.doctors ?? 30);
const PATIENT_COUNT = Number(args.patients ?? 800);
const FRESH = args.fresh === 'true';
const DAY = 86_400_000;

// ── Random helpers ─────────────────────────────────────────────────────────
const int = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[int(0, arr.length - 1)];
const digits = (n) => Array.from({ length: n }, () => int(0, 9)).join('');
const weighted = (entries) => {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [value, weight] of entries) if ((r -= weight) < 0) return value;
  return entries[0][0];
};

// ── Reference data ─────────────────────────────────────────────────────────
const MALE = ['Arif', 'Tanvir', 'Rakib', 'Imran', 'Fahim', 'Sabbir', 'Nayeem', 'Rafiq', 'Mahmud', 'Shakil', 'Hasan', 'Jahid', 'Omar', 'Daniel', 'James', 'Ryan', 'Arjun', 'Kabir', 'Zahid', 'Tariq'];
const FEMALE = ['Ayesha', 'Nusrat', 'Farhana', 'Sadia', 'Tasnim', 'Mim', 'Riya', 'Nadia', 'Sumaiya', 'Lamia', 'Fatema', 'Jannat', 'Sarah', 'Emily', 'Priya', 'Ananya', 'Maria', 'Zara', 'Tahmina', 'Rumana'];
const LAST = ['Rahman', 'Hossain', 'Ahmed', 'Chowdhury', 'Islam', 'Khan', 'Das', 'Sarkar', 'Uddin', 'Karim', 'Akter', 'Barua', 'Sen', 'Roy', 'Haque', 'Miah', 'Talukder', 'Siddiqui', 'Smith', 'Patel'];
const HOSPITALS = ['Chattogram Medical College Hospital', 'Evercare Hospital', 'Square Hospital', 'United Hospital', 'Labaid Specialized Hospital', 'Ibn Sina Hospital', 'Popular Medical College Hospital', 'Dhaka Medical College Hospital', 'Max Hospital', 'Park View Hospital'];

const SPECIALIZATIONS = {
  Cardiology: ['Hypertension', 'Coronary artery disease', 'Arrhythmia', 'Heart failure', 'Angina'],
  Neurology: ['Migraine', 'Epilepsy', 'Stroke recovery', 'Parkinson’s disease', 'Neuropathy'],
  Orthopedics: ['Fracture', 'Osteoarthritis', 'Lower back pain', 'ACL tear', 'Frozen shoulder'],
  Pediatrics: ['Bronchiolitis', 'Asthma', 'Dengue fever', 'Gastroenteritis', 'Tonsillitis'],
  Dermatology: ['Eczema', 'Psoriasis', 'Acne', 'Fungal infection', 'Urticaria'],
  Gynecology: ['PCOS', 'Prenatal care', 'Endometriosis', 'Anemia in pregnancy', 'Fibroids'],
  Oncology: ['Breast cancer', 'Lung cancer', 'Lymphoma', 'Colorectal cancer', 'Leukemia'],
  Endocrinology: ['Type 2 diabetes', 'Hypothyroidism', 'Hyperthyroidism', 'Obesity', 'Osteoporosis'],
  Gastroenterology: ['Peptic ulcer', 'IBS', 'Fatty liver', 'Hepatitis B', 'GERD'],
  Pulmonology: ['COPD', 'Pneumonia', 'Asthma', 'Tuberculosis', 'Sleep apnea'],
  Nephrology: ['Chronic kidney disease', 'Kidney stones', 'UTI', 'Nephrotic syndrome', 'Dialysis care'],
  Psychiatry: ['Depression', 'Anxiety disorder', 'Insomnia', 'Bipolar disorder', 'ADHD'],
};
const SPECIALIZATION_NAMES = Object.keys(SPECIALIZATIONS);

const CONDITION_WEIGHTS = [
  ['stable', 35],
  ['recovering', 25],
  ['under_observation', 18],
  ['critical', 8],
  ['discharged', 14],
];
const AREAS = ['Agrabad', 'GEC Circle', 'Nasirabad', 'Halishahar', 'Panchlaish', 'Dhanmondi', 'Gulshan', 'Uttara', 'Mirpur', 'Banani'];

const phoneNumber = () => `+8801${pick(['3', '5', '6', '7', '8', '9'])}${digits(8)}`;

// ── Seeding ────────────────────────────────────────────────────────────────
async function seedAdmin() {
  const existing = await User.findOne({ email: env.ADMIN_EMAIL }).lean();
  if (existing) return console.info(`• Admin exists: ${env.ADMIN_EMAIL}`);
  await User.create({ name: env.ADMIN_NAME, email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD, role: ROLES.ADMIN });
  console.info(`✔ Admin created: ${env.ADMIN_EMAIL}`);
}

async function seedDoctors(now) {
  const runId = digits(4);
  const docs = Array.from({ length: DOCTOR_COUNT }, (_, i) => {
    const first = pick(Math.random() < 0.5 ? MALE : FEMALE);
    const last = pick(LAST);
    const createdAt = new Date(now - int(30, 540) * DAY);
    const doc = {
      name: `Dr. ${first} ${last}`,
      specialization: pick(SPECIALIZATION_NAMES),
      hospital: pick(HOSPITALS),
      phone: phoneNumber(),
      email: `${first}.${last}.${runId}${i}@doctortracker.dev`.toLowerCase(),
      createdAt,
      updatedAt: createdAt,
    };
    return { ...doc, searchTokens: Doctor.buildSearchTokens(doc) };
  });
  // Native insert keeps our historical createdAt values and is much faster than .create().
  const result = await Doctor.collection.insertMany(docs);
  console.info(`✔ ${result.insertedCount} doctors`);
  return docs.map((d, i) => ({ ...d, _id: result.insertedIds[i] }));
}

async function seedPatients(doctors, now) {
  // Uneven workload so "patients per doctor" is an interesting chart.
  const doctorWeights = doctors.map((d) => [d, 0.2 + Math.random() ** 2 * 3]);
  const BATCH = 1000;
  let inserted = 0;

  for (let offset = 0; offset < PATIENT_COUNT; offset += BATCH) {
    const batch = Array.from({ length: Math.min(BATCH, PATIENT_COUNT - offset) }, () => {
      const doctor = weighted(doctorWeights);
      const gender = weighted([['male', 48], ['female', 49], ['other', 3]]);
      const first = pick(gender === 'female' ? FEMALE : gender === 'male' ? MALE : [...MALE, ...FEMALE]);
      const last = pick(LAST);
      const age = doctor.specialization === 'Pediatrics' ? int(0, 17) : int(18, 88);
      // Skewed towards recent dates so the timeline trends upward.
      const daysAgo = Math.floor(Math.random() ** 1.6 * 365);
      const admissionDate = new Date(Math.max(now - daysAgo * DAY - int(0, DAY - 1), doctor.createdAt.getTime()));
      const createdAt = new Date(admissionDate.getTime() + int(0, 6) * 3_600_000);
      const doc = {
        name: `${first} ${last}`,
        age,
        gender,
        phone: phoneNumber(),
        ...(Math.random() < 0.7 && { email: `${first}.${last}${digits(3)}@example.com`.toLowerCase() }),
        condition: weighted(CONDITION_WEIGHTS),
        diagnosis: pick(SPECIALIZATIONS[doctor.specialization]),
        bloodGroup: pick(BLOOD_GROUPS),
        address: `${int(1, 250)} Road ${int(1, 30)}, ${pick(AREAS)}`,
        admissionDate,
        doctor: doctor._id,
        createdAt,
        updatedAt: createdAt,J
      };
      if (!CONDITIONS.includes(doc.condition)) doc.condition = 'stable';
      return { ...doc, searchTokens: Patient.buildSearchTokens(doc) };
    });
    inserted += (await Patient.collection.insertMany(batch)).insertedCount;
  }
  console.info(`✔ ${inserted} patients`);
}

async function main() {
  await connectDB();
  await Promise.all([User.syncIndexes(), Doctor.syncIndexes(), Patient.syncIndexes()]);

  if (FRESH) {
    await Promise.all([Doctor.deleteMany({}), Patient.deleteMany({})]);
    console.info('• Cleared doctors and patients');
  }

  const now = Date.now();
  await seedAdmin();
  const doctors = await seedDoctors(now);
  await seedPatients(doctors, now);

  console.info(`\n🎉 Done. Log in with ${env.ADMIN_EMAIL} / ${env.ADMIN_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(disconnectDB);
