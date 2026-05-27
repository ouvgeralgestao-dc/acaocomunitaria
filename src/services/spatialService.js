'use strict';

/**
 * spatialService.js
 * Regras de negócio para operações territoriais/espaciais.
 * Orquestra o spatialRepository e aplica validações.
 */

const spatialRepository = require('../repositories/spatialRepository');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Retorna todas as comunidades (lista leve para o mapa)
// ---------------------------------------------------------------------------
async function getComunidades() {
  const comunidades = await spatialRepository.listComunidades();
  return comunidades;
}

// ---------------------------------------------------------------------------
// Retorna detalhes completos de uma comunidade
// ---------------------------------------------------------------------------
async function getComunidadeById(id) {
  const parsed = parseInt(id, 10);
  if (!parsed || parsed <= 0) {
    throw Object.assign(new Error('ID de comunidade inválido'), { status: 400 });
  }

  const comunidade = await spatialRepository.findComunidadeById(parsed);

  if (!comunidade) {
    throw Object.assign(new Error(`Comunidade id=${parsed} não encontrada`), { status: 404 });
  }

  return comunidade;
}

// ---------------------------------------------------------------------------
// Geocodificação reversa: ponto → comunidade
// ---------------------------------------------------------------------------
async function getComunidadeByPoint(lat, lng) {
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);

  if (isNaN(latNum) || isNaN(lngNum)) {
    throw Object.assign(new Error('Coordenadas lat/lng inválidas'), { status: 400 });
  }

  if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
    throw Object.assign(new Error('Coordenadas fora do intervalo permitido'), { status: 400 });
  }

  const comunidade = await spatialRepository.findComunidadeByPoint(latNum, lngNum);
  return comunidade;
}

// ---------------------------------------------------------------------------
// Atualiza geometria de uma comunidade (após edição no mapa)
// ---------------------------------------------------------------------------
async function updateGeometria(id, geometria, requestInfo = {}) {
  const parsed = parseInt(id, 10);
  if (!parsed || parsed <= 0) {
    throw Object.assign(new Error('ID de comunidade inválido'), { status: 400 });
  }

  if (!geometria || geometria.type !== 'Polygon') {
    throw Object.assign(new Error('Geometria inválida: deve ser do tipo Polygon'), { status: 400 });
  }

  if (!geometria.coordinates || geometria.coordinates[0]?.length < 4) {
    throw Object.assign(new Error('Polígono com vértices insuficientes (mínimo 4)'), { status: 400 });
  }

  const atualizado = await spatialRepository.updateComunidadeGeometria(parsed, geometria);

  if (!atualizado) {
    throw Object.assign(new Error(`Comunidade id=${parsed} não encontrada para atualização`), { status: 404 });
  }

  logger.info('geometria_atualizada', {
    comunidade_id: parsed,
    ip: requestInfo.ip || 'unknown',
  });

  return { success: true, comunidade_id: parsed };
}

// ---------------------------------------------------------------------------
// Lista ruas de uma comunidade com paginação
// ---------------------------------------------------------------------------
async function getRuasByComunidade(id, page, limit) {
  const parsed = parseInt(id, 10);
  if (!parsed || parsed <= 0) {
    throw Object.assign(new Error('ID de comunidade inválido'), { status: 400 });
  }

  return spatialRepository.listRuasByComunidade(parsed, page, limit);
}

module.exports = {
  getComunidades,
  getComunidadeById,
  getComunidadeByPoint,
  updateGeometria,
  getRuasByComunidade,
};
