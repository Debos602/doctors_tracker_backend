/** Operational error with an HTTP status, safe to show to the client. */
export class ApiError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message   human readable
   * @param {Array}  [errors]  field-level details
   * @param {string} [code]    stable machine-readable code the client can branch on
   */
  constructor(statusCode, message, errors, code) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = code;
  }

  static badRequest(message = 'Bad request', errors) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = 'Authentication required', code = 'AUTH_REQUIRED') {
    return new ApiError(401, message, undefined, code);
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, message, undefined, 'FORBIDDEN');
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message, undefined, 'NOT_FOUND');
  }

  static conflict(message = 'Conflict', code = 'CONFLICT') {
    return new ApiError(409, message, undefined, code);
  }
}
