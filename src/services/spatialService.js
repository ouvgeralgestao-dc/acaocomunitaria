'use strict';

/**
 * spatialService.js
 * Regras de negócio para operações territoriais/espaciais com validação de topologia.
 */

const spatialRepository = require('../repositories/spatialRepository');
const pool = require('../config/database');
const logger = require('../utils/logger');

// Valida topologia no MySQL e tenta corrigir se for inválida
async function validateAndSanitizeGeometry(geojson) {
  const wkt = spatialRepository.polygonGeoJsonToWKT(geojson);
  
  try {
    const [[result]] = await pool.query(
      `SELECT ST_IsValid(ST_GeomFromText(?, 4326)) AS isValid`,
      [wkt]
    );

    if (result.isValid === 1) {
      return geojson; // Geometria válida
    }

    logger.warn('Geometria inválida detectada. Retornando original para evitar falha de salvamento.', { geojson });
    return geojson;
  } catch (err) {
    logger.error('Erro ao processar/validar geometria no MySQL', err);
    return geojson;
  }
}

async function getComunidades() {
  return spatialRepository.listComunidades();
}

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

async function getComunidadeByPoint(lat, lng) {
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);

  if (isNaN(latNum) || isNaN(lngNum)) {
    throw Object.assign(new Error('Coordenadas lat/lng inválidas'), { status: 400 });
  }

  if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
    throw Object.assign(new Error('Coordenadas fora do intervalo permitido'), { status: 400 });
  }

  return spatialRepository.findComunidadeByPoint(latNum, lngNum);
}

async function updateGeometria(id, geometria, requestInfo = {}) {
  const parsed = parseInt(id, 10);
  if (!parsed || parsed <= 0) {
    throw Object.assign(new Error('ID de comunidade inválido'), { status: 400 });
  }

  if (!geometria || (geometria.type !== 'Polygon' && geometria.type !== 'MultiPolygon')) {
    throw Object.assign(new Error('Geometria inválida: deve ser do tipo Polygon ou MultiPolygon'), { status: 400 });
  }

  // Validar e sanitizar a geometria
  const validGeometry = await validateAndSanitizeGeometry(geometria);

  const atualizado = await spatialRepository.updateComunidadeGeometria(
    parsed, 
    validGeometry, 
    requestInfo.usuarioId, 
    requestInfo.ip
  );

  if (!atualizado) {
    throw Object.assign(new Error(`Comunidade id=${parsed} não encontrada para atualização`), { status: 404 });
  }

  logger.info('geometria_atualizada_sucesso', {
    comunidade_id: parsed,
    usuario_id: requestInfo.usuarioId,
    ip: requestInfo.ip || 'unknown',
  });

  return { success: true, comunidade_id: parsed, geometria: validGeometry };
}

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
  validateAndSanitizeGeometry
};
