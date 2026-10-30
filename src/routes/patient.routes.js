import { Router } from 'express';
import * as ctrl from '../controllers/patient.controller.js';
import { authorize, protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../constants.js';
import {
  createPatientSchema,
  listPatientsSchema,
  patientIdSchema,
  updatePatientSchema,
} from '../validators/patient.validator.js';

const router = Router();

router.use(protect);

router
  .route('/')
  .get(validate(listPatientsSchema), ctrl.list)
  .post(validate(createPatientSchema), ctrl.create);

router
  .route('/:id')
  .get(validate(patientIdSchema), ctrl.getById)
  .patch(validate(updatePatientSchema), ctrl.update)
  .delete(authorize(ROLES.ADMIN), validate(patientIdSchema), ctrl.remove);

export default router;
