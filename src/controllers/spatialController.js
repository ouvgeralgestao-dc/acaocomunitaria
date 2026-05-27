'use strict';

/**
 * spatialController.js
 * Orquestra as rotas espaciais, delega ao spatialService.
 * Sem lógica de negócio — apenas validação de HTTP e formatação de resposta.
 */

const spatialService = require('../services/spatialService');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// GET /api/comunidades
// Lista todas as comunidades com geometrias (para o mapa)
// ---------------------------------------------------------------------------
async function listarComunidades(req, res) {
  try {
    const comunidades = await spatialService.getComunidades();
    res.json({ success: true, total: comunidades.length, data: comunidades });
  } catch (err) {
    logger.error('listarComunidades', { message: err.message });
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// GET /api/comunidades/:id
// Retorna detalhes de uma comunidade (ruas, CEPs, geometria)
// ---------------------------------------------------------------------------
async function detalharComunidade(req, res) {
  try {
    const comunidade = await spatialService.getComunidadeById(req.params.id);
    res.json({ success: true, data: comunidade });
  } catch (err) {
    logger.error('detalharComunidade', { id: req.params.id, message: err.message });
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// GET /api/comunidades/ponto?lat=...&lng=...
// Geocodificação reversa: retorna a comunidade que contém o ponto
// ---------------------------------------------------------------------------
async function buscarPorPonto(req, res) {
  try {
    const { lat, lng } = req.query;
    const comunidade = await spatialService.getComunidadeByPoint(lat, lng);

    if (!comunidade) {
      return res.status(404).json({ success: false, error: 'Nenhuma comunidade encontrada para este ponto' });
    }

    res.json({ success: true, data: comunidade });
  } catch (err) {
    logger.error('buscarPorPonto', { query: req.query, message: err.message });
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/comunidades/:id/geometria
// Atualiza o polígono de uma comunidade após edição no mapa
// Body: { geometria: { type: "Polygon", coordinates: [...] } }
// ---------------------------------------------------------------------------
async function atualizarGeometria(req, res) {
  try {
    const { geometria } = req.body;

    if (!geometria) {
      return res.status(400).json({ success: false, error: 'Campo "geometria" é obrigatório no body' });
    }

    const resultado = await spatialService.updateGeometria(req.params.id, geometria, {
      ip: req.ip,
    });

    res.json(resultado);
  } catch (err) {
    logger.error('atualizarGeometria', { id: req.params.id, message: err.message });
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// GET /api/comunidades/:id/ruas?page=1&limit=50
// Lista ruas de uma comunidade com paginação
// ---------------------------------------------------------------------------
async function listarRuas(req, res) {
  try {
    const page  = Math.max(1, parseInt(req.query.page  || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));

    const resultado = await spatialService.getRuasByComunidade(req.params.id, page, limit);
    res.json({ success: true, ...resultado });
  } catch (err) {
    logger.error('listarRuas', { id: req.params.id, message: err.message });
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
