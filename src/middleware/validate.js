/**
 * Validates params/query/body with zod and stores the parsed (coerced,
 * defaulted, stripped) values on req.valid. Controllers only read req.valid,
 * so unknown fields never reach the database layer.
 */
export const validate = (schemas) => (req, _res, next) => {
  try {
    req.valid = {};
    for (const key of ['params', 'query', 'body']) {
      if (schemas[key]) req.valid[key] = schemas[key].parse(req[key] ?? {});
    }
    next();
  } catch (err) {
    next(err);
  }
};
