const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'simac_jwt_super_secret_2026_change_me';

/**
 * Middleware de autenticação JWT para acesso administrativo.
 * Verifica o token no header Authorization ou no cookie de sessão.
 */
function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.cookies?.simac_token;

    if (!token) {
      return res.status(401).json({ error: 'Não autenticado. Token ausente.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (err) {
    logger.warn('Tentativa de acesso com token inválido ou expirado.', { ip: req.ip });
    return res.status(401).json({ error: 'Token inválido ou expirado. Faça login novamente.' });
  }
}

module.exports = authMiddleware;
