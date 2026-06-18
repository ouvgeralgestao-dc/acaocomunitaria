'use strict';

/**
 * spatialController.js
 * Orquestra as rotas espaciais, delega ao spatialService.
 */

const spatialService = require('../services/spatialService');
const logger = require('../utils/logger');

async function listarComunidades(req, res) {
  try {
    const comunidades = await spatialService.getComunidades();
    res.json({ success: true, total: comunidades.length, data: comunidades });
  } catch (err) {
    logger.error('listarComunidades', err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

async function detalharComunidade(req, res) {
  try {
    const comunidade = await spatialService.getComunidadeById(req.params.id);
    res.json({ success: true, data: comunidade });
  } catch (err) {
    logger.error('detalharComunidade', err, { id: req.params.id });
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

async function buscarPorPonto(req, res) {
  try {
    const { lat, lng } = req.query;
    const comunidade = await spatialService.getComunidadeByPoint(lat, lng);

    if (!comunidade) {
      return res.status(404).json({ success: false, error: 'Nenhuma comunidade encontrada para este ponto' });
    }

    res.json({ success: true, data: comunidade });
  } catch (err) {
    logger.error('buscarPorPonto', err, { query: req.query });
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

async function atualizarGeometria(req, res) {
  try {
    const { geometria } = req.body;

    if (!geometria) {
      return res.status(400).json({ success: false, error: 'Campo "geometria" é obrigatório no body' });
    }

    // Passando ID do usuário logado para gravar no histórico/auditoria de geometria
    const resultado = await spatialService.updateGeometria(req.params.id, geometria, {
      ip: req.ip,
      usuarioId: req.usuario?.id
    });

    res.json(resultado);
  } catch (err) {
    logger.error('atualizarGeometria', err, { id: req.params.id });
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

async function listarRuas(req, res) {
  try {
    const page  = Math.max(1, parseInt(req.query.page  || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));

    const resultado = await spatialService.getRuasByComunidade(req.params.id, page, limit);
    res.json({ success: true, ...resultado });
  } catch (err) {
    logger.error('listarRuas', err, { id: req.params.id });
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

module.exports = {
  listarComunidades,
  detalharComunidade,
  buscarPorPonto,
  atualizarGeometria,
  listarRuas,
};
