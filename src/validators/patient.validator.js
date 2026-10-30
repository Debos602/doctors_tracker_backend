import { z } from 'zod';
import { BLOOD_GROUPS, CONDITIONS, GENDERS } from '../constants.js';
import {
  atLeastOneField,
  clearable,
  email,
  enumList,
  idParams,
  listQueryBase,
  objectId,
  optional,
  optionalDate,
  phone,
  withValidDateRange,
} from './common.js';

// ── Create ─────────────────────────────────────────────────────────────────
export const patientBody = z.object({
  name: z.string().trim().min(2).max(100),
  age: z.coerce.number().int().min(0).max(130),
  gender: z.enum(GENDERS),
  phone,
  email: optional(email),
  condition: z.enum(CONDITIONS).default('stable'),
  diagnosis: optional(z.string().trim().max(200)),
  bloodGroup: optional(z.enum(BLOOD_GROUPS)),
  address: optional(z.string().trim().max(250)),
  admissionDate: optionalDate,
  notes: optional(z.string().trim().max(1000)),
});

export const createPatientSchema = {
  body: patientBody.extend({ doctor: objectId }),
};

// ── Update ("" clears an optional field) ───────────────────────────────────
export const updatePatientSchema = {
  params: idParams,
  body: atLeastOneField(
    z.object({
      name: z.string().trim().min(2).max(100).optional(),
      age: z.coerce.number().int().min(0).max(130).optional(),
      gender: z.enum(GENDERS).optional(),
      phone: phone.optional(),
      email: clearable(email),
      condition: z.enum(CONDITIONS).optional(),
      diagnosis: z.string().trim().max(200).optional(),
      bloodGroup: clearable(z.enum(BLOOD_GROUPS)),
      address: z.string().trim().max(250).optional(),
      admissionDate: optionalDate,
      notes: z.string().trim().max(1000).optional(),
      doctor: objectId.optional(),
    }),
  ),
};

export const patientIdSchema = {
  params: idParams,
};

// ── List ───────────────────────────────────────────────────────────────────
const patientListFields = {
  ...listQueryBase,
  sortBy: z.enum(['createdAt', 'admissionDate', 'name', 'age']).default('createdAt'),
  dateField: z.enum(['admissionDate', 'createdAt']).default('admissionDate'),
  condition: enumList(CONDITIONS),
  gender: optional(z.enum(GENDERS)),
  minAge: optional(z.coerce.number().int().min(0).max(130)),
  maxAge: optional(z.coerce.number().int().min(0).max(130)),
};

const withValidAgeRange = (schema) =>
  schema.refine((d) => d.minAge === undefined || d.maxAge === undefined || d.minAge <= d.maxAge, {
    message: '"minAge" must be less than or equal to "maxAge"',
    path: ['minAge'],
  });

export const listPatientsSchema = {
  query: withValidAgeRange(
    withValidDateRange(z.object({ ...patientListFields, doctor: optional(objectId) })),
  ),
};

// ── Nested under /doctors/:id ──────────────────────────────────────────────
export const listDoctorPatientsSchema = {
  params: idParams,
  query: withValidAgeRange(withValidDateRange(z.object(patientListFields))),
};

export const createDoctorPatientSchema = {
  params: idParams,
  body: patientBody,
};

export const doctorPatientParamsSchema = {
  params: z.object({ id: objectId, patientId: objectId }),
};
