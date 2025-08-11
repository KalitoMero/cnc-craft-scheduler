const { ZodError } = require('zod');

const validate = (schema, source = 'body') => (req, res, next) => {
  try {
    if (!schema) return next();
    req[source] = schema.parse(req[source]);
    return next();
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
    }
    return next(err);
  }
};

module.exports = { validate };
