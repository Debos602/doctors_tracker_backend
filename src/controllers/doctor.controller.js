import * as doctorService from '../services/doctor.service.js';
import * as patientService from '../services/patient.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await doctorService.listDoctors(req.valid.query);
  sendSuccess(res, items, { meta });
});

export const filterOptions = asyncHandler(async (_req, res) => {
  sendSuccess(res, await doctorService.getFilterOptions());
});

export const getById = asyncHandler(async (req, res) => {
  sendSuccess(res, await doctorService.getDoctorById(req.valid.params.id));
});

export const create = asyncHandler(async (req, res) => {
  const doctor = await doctorService.createDoctor(req.valid.body);
  sendSuccess(res, doctor, { status: 201, message: 'Doctor created' });
});

export const update = asyncHandler(async (req, res) => {
  const doctor = await doctorService.updateDoctor(req.valid.params.id, req.valid.body);
  sendSuccess(res, doctor, { message: 'Doctor updated' });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await doctorService.deleteDoctor(req.valid.params.id);
  sendSuccess(res, result, { message: 'Doctor deleted' });
});

// ── Nested patients ────────────────────────────────────────────────────────
export const listPatients = asyncHandler(async (req, res) => {
  const { id } = req.valid.params;
  await doctorService.ensureDoctorExists(id);
  const { items, meta } = await patientService.listPatients({ ...req.valid.query, doctor: id });
  sendSuccess(res, items, { meta });
});

export const addPatient = asyncHandler(async (req, res) => {
  const patient = await patientService.createPatient({
    ...req.valid.body,
    doctor: req.valid.params.id,
  });
  sendSuccess(res, patient, { status: 201, message: 'Patient added' });
});

export const removePatient = asyncHandler(async (req, res) => {
  const { id, patientId } = req.valid.params;
  const result = await patientService.deletePatient(patientId, { doctorId: id });
  sendSuccess(res, result, { message: 'Patient removed' });
});
