const morgan = require('morgan');

const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
};

const requestLogger = morgan('combined');

module.exports = { logger, requestLogger };
