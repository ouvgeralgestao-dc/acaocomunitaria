const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('Erro na rota:', err, {
    path: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Erro interno no servidor do SIMAC.';

  res.status(status).json({
    success: false,
    error: message,
    // stack opcional se estiver em desenvolvimento
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}

module.exports = errorHandler;
