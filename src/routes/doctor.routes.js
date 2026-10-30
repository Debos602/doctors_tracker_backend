import { Router } from 'express';
import * as ctrl from '../controllers/doctor.controller.js';
import { authorize, protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../constants.js';
import {
  createDoctorSchema,
  doctorIdSchema,
  listDoctorsSchema,
  updateDoctorSchema,
} from '../validators/doctor.validator.js';
import {
  createDoctorPatientSchema,
  doctorPatientParamsSchema,
  listDoctorPatientsSchema,
} from '../validators/patient.validator.js';

const router = Router();
const adminOnly = authorize(ROLES.ADMIN);

router.use(protect);

router
  .route('/')
  .get(validate(listDoctorsSchema), ctrl.list)
  .post(validate(createDoctorSchema), ctrl.create);

router.get('/filters', ctrl.filterOptions);

router
  .route('/:id')
  .get(validate(doctorIdSchema), ctrl.getById)
  .patch(validate(updateDoctorSchema), ctrl.update)
  .delete(adminOnly, validate(doctorIdSchema), ctrl.remove);

router
  .route('/:id/patients')
  .get(validate(listDoctorPatientsSchema), ctrl.listPatients)
  .post(validate(createDoctorPatientSchema), ctrl.addPatient);

router.delete('/:id/patients/:patientId', adminOnly, validate(doctorPatientParamsSchema), ctrl.removePatient);

export default router;
