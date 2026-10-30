/** Consistent success envelope: { success, message?, data, meta? } */
export function sendSuccess(res, data, { status = 200, meta, message } = {}) {
  return res.status(status).json({
    success: true,
    ...(message && { message }),
    data,
    ...(meta && { meta }),
  });
}
