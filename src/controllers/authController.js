const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'simac_jwt_super_secret_2026_change_me';
const JWT_EXPIRES_IN = '8h';

/**
 * POST /api/auth/login
 * Autentica usuário e retorna JWT (Nível Único Administrativo).
 */
async function login(req, res) {
  const { usuario, senha } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, nome, usuario, senha_hash, ativo FROM usuarios WHERE usuario = ? LIMIT 1',
      [usuario.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      logger.warn('Tentativa de login com usuário inexistente.', { usuario, ip: req.ip });
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const user = rows[0];

    if (!user.ativo) {
      return res.status(403).json({ error: 'Usuário inativo. Contate o administrador.' });
    }

    const senhaValida = await bcrypt.compare(senha, user.senha_hash);
    if (!senhaValida) {
      logger.warn('Tentativa de login com senha incorreta.', { usuario, ip: req.ip });
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const payload = {
      id: user.id,
      nome: user.nome,
      usuario: user.usuario
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Registra auditoria de login
    await pool.query(
      'INSERT INTO audit_log (entidade, entidade_id, acao, usuario_id, payload, ip_origem) VALUES (?, ?, ?, ?, ?, ?)',
      ['usuario', user.id, 'INSERT', user.id, JSON.stringify({ evento: 'LOGIN', usuario: user.usuario }), req.ip]
    );

    logger.info('Login realizado com sucesso.', { usuario: user.usuario, ip: req.ip });

    return res.json({
      token,
      usuario: {
        id: user.id,
        nome: user.nome,
        usuario: user.usuario
      }
    });

  } catch (err) {
    logger.error('Erro interno durante autenticação.', err);
    return res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  }
}

/**
 * GET /api/auth/me
 * Retorna dados do usuário autenticado (requer token válido).
 */
async function me(req, res) {
  return res.json({ usuario: req.usuario });
}

/**
 * POST /api/auth/logout
 */
async function logout(req, res) {
  logger.info('Logout registrado.', { usuario: req.usuario?.usuario, ip: req.ip });
  return res.json({ message: 'Logout realizado com sucesso.' });
}

module.exports = { login, me, logout };
