export const ROLES = Object.freeze({ ADMIN: 'admin', STAFF: 'staff' });

export const GENDERS = Object.freeze(['male', 'female', 'other']);

export const CONDITIONS = Object.freeze([
  'stable',
  'recovering',
  'under_observation',
  'critical',
  'discharged',
]);

export const BLOOD_GROUPS = Object.freeze(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);

export const PAGINATION = Object.freeze({ DEFAULT_LIMIT: 10, MAX_LIMIT: 100 });
