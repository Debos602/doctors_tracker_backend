import * as patientService from '../services/patient.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await patientService.listPatients(req.valid.query);
  sendSuccess(res, items, { meta });
});

export const getById = asyncHandler(async (req, res) => {
  sendSuccess(res, await patientService.getPatientById(req.valid.params.id));
});

export const create = asyncHandler(async (req, res) => {
  const patient = await patientService.createPatient(req.valid.body);
  sendSuccess(res, patient, { status: 201, message: 'Patient created' });
});

export const update = asyncHandler(async (req, res) => {
  const patient = await patientService.updatePatient(req.valid.params.id, req.valid.body);
  sendSuccess(res, patient, { message: 'Patient updated' });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await patientService.deletePatient(req.valid.params.id);
  sendSuccess(res, result, { message: 'Patient deleted' });
});
