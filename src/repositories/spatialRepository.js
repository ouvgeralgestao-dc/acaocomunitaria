'use strict';

/**
 * spatialRepository.js
 * Queries espaciais MySQL usando ST_Contains / ST_Intersects.
 * Todas as geometrias são armazenadas com SRID 4326.
 */

const pool = require('../config/database');

// ---------------------------------------------------------------------------
// Busca comunidade que contém um ponto (lat, lng)
// Usado para geocodificação reversa (ex: "em qual comunidade está este endereço?")
// ---------------------------------------------------------------------------
async function findComunidadeByPoint(lat, lng) {
  const sql = `
    SELECT
      c.id,
      c.nome,
      c.total_ruas
    FROM comunidades c
    WHERE ST_Contains(
      c.geometria,
      ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326)
    )
    LIMIT 1
  `;

  const [rows] = await pool.query(sql, [lng, lat]);
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// Lista todas as comunidades com seus bounding boxes para o mapa
// Leve: sem geometria completa, apenas metadados
// ---------------------------------------------------------------------------
async function listComunidades() {
  const sql = `
    SELECT
      c.id,
      c.nome,
      c.total_ruas,
      c.atualizado_em,
      ST_AsGeoJSON(c.geometria) AS geometria_json
    FROM comunidades c
    ORDER BY c.nome ASC
  `;

  const [rows] = await pool.query(sql);

  return rows.map((row) => ({
    id:           row.id,
    nome:         row.nome,
    total_ruas:   row.total_ruas,
    atualizado_em: row.atualizado_em,
    geometria:    typeof row.geometria_json === 'string' ? JSON.parse(row.geometria_json) : row.geometria_json,
  }));
}

// ---------------------------------------------------------------------------
// Busca detalhada de uma comunidade (com ruas e CEPs)
// ---------------------------------------------------------------------------
async function findComunidadeById(id) {
  const [[comunidade]] = await pool.query(
    `SELECT
       id,
       nome,
       total_ruas,
       criado_em,
       atualizado_em,
       ST_AsGeoJSON(geometria) AS geometria_json
     FROM comunidades
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  if (!comunidade) return null;

  const [ruas] = await pool.query(
    `SELECT nome_rua
     FROM comunidade_ruas
     WHERE comunidade_id = ?
     ORDER BY nome_rua ASC`,
    [id]
  );

  const [ceps] = await pool.query(
    `SELECT cep, logradouro, bairro, localidade, uf, ibge, ddd
     FROM comunidade_ceps
     WHERE comunidade_id = ?
     ORDER BY cep ASC`,
    [id]
  );

  return {
    id:           comunidade.id,
    nome:         comunidade.nome,
    total_ruas:   comunidade.total_ruas,
    criado_em:    comunidade.criado_em,
    atualizado_em: comunidade.atualizado_em,
    geometria:    typeof comunidade.geometria_json === 'string' ? JSON.parse(comunidade.geometria_json) : comunidade.geometria_json,
    ruas:         ruas.map((r) => r.nome_rua),
    ceps:         ceps,
  };
}

// ---------------------------------------------------------------------------
// Busca comunidades que intersectam um polígono (ex: área de busca no mapa)
// ---------------------------------------------------------------------------
async function findComunidadesByPolygon(geojsonPolygon) {
  const wkt = polygonGeoJsonToWKT(geojsonPolygon);

  const sql = `
    SELECT
      c.id,
      c.nome,
      c.total_ruas,
      ST_AsGeoJSON(c.geometria) AS geometria_json
    FROM comunidades c
    WHERE ST_Intersects(
      c.geometria,
      ST_GeomFromText(?, 4326)
    )
    ORDER BY c.nome ASC
  `;

  const [rows] = await pool.query(sql, [wkt]);

  return rows.map((row) => ({
    id:         row.id,
    nome:       row.nome,
    total_ruas: row.total_ruas,
    geometria:  typeof row.geometria_json === 'string' ? JSON.parse(row.geometria_json) : row.geometria_json,
  }));
}

// ---------------------------------------------------------------------------
// Atualiza a geometria de uma comunidade
// ---------------------------------------------------------------------------
async function updateComunidadeGeometria(id, geojsonPolygon) {
  const wkt = polygonGeoJsonToWKT(geojsonPolygon);

  const [result] = await pool.query(
    `UPDATE comunidades
     SET geometria = ST_GeomFromText(?, 4326)
     WHERE id = ?`,
    [wkt, id]
  );

  return result.affectedRows > 0;
}

// ---------------------------------------------------------------------------
// Busca ruas de uma comunidade (com paginação)
// ---------------------------------------------------------------------------
async function listRuasByComunidade(comunidadeId, page = 1, limit = 50) {
  const offset = (page - 1) * limit;

  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) AS total FROM comunidade_ruas WHERE comunidade_id = ?',
    [comunidadeId]
  );

  const [rows] = await pool.query(
    `SELECT nome_rua
     FROM comunidade_ruas
     WHERE comunidade_id = ?
     ORDER BY nome_rua ASC
     LIMIT ? OFFSET ?`,
    [comunidadeId, limit, offset]
  );

  return {
    data:  rows.map((r) => r.nome_rua),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

// ---------------------------------------------------------------------------
// Utilitário interno: GeoJSON Polygon → WKT
// ---------------------------------------------------------------------------
function polygonGeoJsonToWKT(geojson) {
  if (geojson.type !== 'Polygon') {
    throw new Error(`Tipo não suportado: ${geojson.type}`);
  }

  const rings = geojson.coordinates.map((ring) => {
    const pts = ring.map(([lng, lat]) => `${lng} ${lat}`).join(', ');
    return `(${pts})`;
  });

  return `POLYGON(${rings.join(', ')})`;
}

module.exports = {
  findComunidadeByPoint,
  listComunidades,
  findComunidadeById,
  findComunidadesByPolygon,
  updateComunidadeGeometria,
  listRuasByComunidade,
};
