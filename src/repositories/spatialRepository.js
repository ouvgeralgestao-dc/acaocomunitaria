'use strict';

/**
 * spatialRepository.js
 * Queries espaciais MySQL usando ST_Contains / ST_Intersects com histórico e auditoria.
 */

const pool = require('../config/database');

// Converte GeoJSON para WKT (Well-Known Text)
function polygonGeoJsonToWKT(geojson) {
  if (geojson.type === 'Polygon') {
    const rings = geojson.coordinates.map((ring) => {
      const pts = ring.map(([lng, lat]) => `${lat} ${lng}`).join(', ');
      return `(${pts})`;
    });
    return `POLYGON(${rings.join(', ')})`;
  } else if (geojson.type === 'MultiPolygon') {
    const polys = geojson.coordinates.map((poly) => {
      const rings = poly.map((ring) => {
        const pts = ring.map(([lng, lat]) => `${lat} ${lng}`).join(', ');
        return `(${pts})`;
      });
      return `(${rings.join(', ')})`;
    });
    return `MULTIPOLYGON(${polys.join(', ')})`;
  }
  throw new Error(`Tipo de geometria não suportado para WKT: ${geojson.type}`);
}

async function findComunidadeByPoint(lat, lng) {
  const sql = `
    SELECT
      c.id,
      c.nome,
      c.total_ruas,
      c.complexo,
      c.cor_hex
    FROM comunidades c
    WHERE ST_Contains(
      c.geometria,
      ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326)
    )
    LIMIT 1
  `;
  const [rows] = await pool.query(sql, [lat, lng]);
  return rows[0] || null;
}

async function listComunidades() {
  const sql = `
    SELECT
      c.id,
      c.nome,
      c.total_ruas,
      c.complexo,
      c.cor_hex,
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
    complexo:     row.complexo,
    cor_hex:      row.cor_hex,
    atualizado_em: row.atualizado_em,
    geometria:    typeof row.geometria_json === 'string' ? JSON.parse(row.geometria_json) : row.geometria_json,
  }));
}

async function findComunidadeById(id) {
  const [[comunidade]] = await pool.query(
    `SELECT
       id,
       nome,
       total_ruas,
       complexo,
       cor_hex,
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
    complexo:     comunidade.complexo,
    cor_hex:      comunidade.cor_hex,
    criado_em:    comunidade.criado_em,
    atualizado_em: comunidade.atualizado_em,
    geometria:    typeof comunidade.geometria_json === 'string' ? JSON.parse(comunidade.geometria_json) : comunidade.geometria_json,
    ruas:         ruas.map((r) => r.nome_rua),
    ceps:         ceps,
  };
}

async function findComunidadesByPolygon(geojsonPolygon) {
  const wkt = polygonGeoJsonToWKT(geojsonPolygon);
  const sql = `
    SELECT
      c.id,
      c.nome,
      c.total_ruas,
      c.complexo,
      c.cor_hex,
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
    complexo:   row.complexo,
    cor_hex:    row.cor_hex,
    geometria:  typeof row.geometria_json === 'string' ? JSON.parse(row.geometria_json) : row.geometria_json,
  }));
}

// Atualiza geometria de uma comunidade de forma transacionada gravando histórico e audit
async function updateComunidadeGeometria(id, geojsonPolygon, usuarioId, ipOrigem) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Obter a geometria atual da comunidade antes de atualizar
    const [[current]] = await connection.query(
      `SELECT ST_AsGeoJSON(geometria) as geometria_json, nome FROM comunidades WHERE id = ? FOR UPDATE`,
      [id]
    );

    if (!current) {
      throw new Error(`Comunidade com ID ${id} não localizada.`);
    }

    // 2. Gravar no histórico de geometria
    await connection.query(
      `INSERT INTO comunidade_historico_geometria (comunidade_id, geometria, usuario_id) 
       VALUES (?, ST_GeomFromText(?, 4326), ?)`,
      [id, polygonGeoJsonToWKT(JSON.parse(current.geometria_json)), usuarioId || null]
    );

    // 3. Atualizar a geometria da comunidade
    const wkt = polygonGeoJsonToWKT(geojsonPolygon);
    await connection.query(
      `UPDATE comunidades
       SET geometria = ST_GeomFromText(?, 4326)
       WHERE id = ?`,
      [wkt, id]
    );

    // 4. Gravar log de auditoria simplificado
    const auditPayload = JSON.stringify({
      antes: { nome: current.nome, id },
      depois: { nome: current.nome, id, geometria_atualizada: true }
    });

    await connection.query(
      `INSERT INTO audit_log (entidade, entidade_id, acao, usuario_id, payload, ip_origem) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['comunidade', id, 'UPDATE', usuarioId || null, auditPayload, ipOrigem || '127.0.0.1']
    );

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

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

module.exports = {
  findComunidadeByPoint,
  listComunidades,
  findComunidadeById,
  findComunidadesByPolygon,
  updateComunidadeGeometria,
  listRuasByComunidade,
  polygonGeoJsonToWKT
};
