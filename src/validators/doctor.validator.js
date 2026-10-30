import { z } from 'zod';
import {
  atLeastOneField,
  email,
  idParams,
  listQueryBase,
  phone,
  withValidDateRange,
} from './common.js';

const doctorFields = {
  name: z.string().trim().min(2).max(100),
  specialization: z.string().trim().min(2).max(100),
  hospital: z.string().trim().min(2).max(150),
  phone,
  email,
};

export const createDoctorSchema = {
  body: z.object(doctorFields),
};

export const updateDoctorSchema = {
  params: idParams,
  body: atLeastOneField(z.object(doctorFields).partial()),
};

export const doctorIdSchema = {
  params: idParams,
};

export const listDoctorsSchema = {
  query: withValidDateRange(
    z.object({
      ...listQueryBase,
      sortBy: z.enum(['createdAt', 'name', 'specialization', 'hospital']).default('createdAt'),
      specialization: z.string().trim().max(100).optional(),
      hospital: z.string().trim().max(150).optional(),
    }),
  ),
};
