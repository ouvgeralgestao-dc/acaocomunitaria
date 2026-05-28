/**
 * ASA v3 - Structured Logger
 * Utilitário de alta performance para padronização de observabilidade e logs de Ação Comunitária.
 */

const formatMessage = (level, message, meta = {}) => {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    ...meta
  });
};

const logger = {
  info(message, meta) {
    console.log(formatMessage('info', message, meta));
  },
  
  warn(message, meta) {
    console.warn(formatMessage('warn', message, meta));
  },
  
  error(message, error, meta = {}) {
    const errorMeta = {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      ...meta
    };
    console.error(formatMessage('error', message, errorMeta));
  }
};

module.exports = logger;
