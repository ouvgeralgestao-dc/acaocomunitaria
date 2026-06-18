const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const pool = require('../config/database');
const { validateAndSanitizeGeometry } = require('../services/spatialService');

// Fila global de escrita para serializar operações e evitar Race Conditions/Lost Updates no arquivo
let writeQueue = Promise.resolve();

// Caminhos dos arquivos
const GEOJSON_PATH = path.join(__dirname, '../data/comunidades.geojson');
const MASTER_DB_PATH = path.join(__dirname, '../data/simac_master_db.json');

/**
 * Normaliza uma feature importada extraindo chaves corretas e preservando a hierarquia
 */
function extractFeatureProps(f, index) {
  const props = f.properties || {};
  
  // Rótulo principal da comunidade (Problema 1 corrigido: prioriza 'COMUNIDADE' sobre 'BAIRRO / REFERÊNCIA')
  const nome = props.COMUNIDADE || props.comunidade || props.Comunidade || props.nome || props.NOME || props.name || `Comunidade_${index + 1}`;
  
  // Bairro ou Referência
  const bairro = props["BAIRRO / REFERÊNCIA"] || props.bairro_referencia || props.bairro || props.BAIRRO || props.district || 'Não Informado';
  
  // Complexo e Metodologia de Cores (Problema 3 corrigido: lê hierarquia de cores e complexos)
  const complexo = props.COMPLEXO || props.complexo || props.Complexo || null;
  const corHex = props.COR_HEX || props.cor_hex || props.cor || props.COLOR || props.color || null;

  return { nome, bairro, complexo, corHex };
}

/**
 * Converte GeoJSON Polygon/MultiPolygon para WKT compatível com MySQL 8
 */
function toWkt(geom) {
  if (geom.type === 'Polygon') {
    const coordsStr = geom.coordinates.map(ring => 
      '(' + ring.map(pt => `${pt[1]} ${pt[0]}`).join(', ') + ')'
    ).join(', ');
    return `POLYGON(${coordsStr})`;
  } else if (geom.type === 'MultiPolygon') {
    const polysStr = geom.coordinates.map(poly => 
      '(' + poly.map(ring => 
        '(' + ring.map(pt => `${pt[1]} ${pt[0]}`).join(', ') + ')'
      ).join(', ') + ')'
    ).join(', ');
    return `MULTIPOLYGON(${polysStr})`;
  }
  throw new Error(`Tipo geométrico ${geom.type} não suportado.`);
}

/**
 * Sincroniza o arquivo GeoJSON físico e o arquivo simac_master_db.json com o banco de dados.
 */
async function syncFilesFromDatabase() {
  const [comunidadesRows] = await pool.query(
    `SELECT id, nome, total_ruas, complexo, cor_hex, ST_AsGeoJSON(geometria) as geometria_json FROM comunidades`
  );

  const features = [];
  const masterDbList = [];

  for (const row of comunidadesRows) {
    const geom = typeof row.geometria_json === 'string' ? JSON.parse(row.geometria_json) : row.geometria_json;
    
    // Obter ruas e ceps
    const [ruas] = await pool.query('SELECT nome_rua FROM comunidade_ruas WHERE comunidade_id = ?', [row.id]);
    const [ceps] = await pool.query('SELECT cep, logradouro, bairro, localidade, uf, ibge, ddd FROM comunidade_ceps WHERE comunidade_id = ?', [row.id]);

    // Montar propriedades respeitando as regras do sistema
    const properties = {
      id: row.id,
      COMUNIDADE: row.nome,
      "BAIRRO / REFERÊNCIA": ceps[0]?.bairro || 'Não Informado',
      COMPLEXO: row.complexo,
      COR_HEX: row.cor_hex,
      total_ruas: row.total_ruas
    };

    features.push({
      type: "Feature",
      id: row.id,
      geometry: geom,
      properties
    });

    masterDbList.push({
      id: row.id,
      nome: row.nome,
      total_ruas: row.total_ruas,
      complexo: row.complexo,
      cor_hex: row.cor_hex,
      geometria: geom,
      ruas: ruas.map(r => r.nome_rua),
      ceps: ceps.map(c => ({
        cep: c.cep,
        oficial: {
          logradouro: c.logradouro,
          bairro: c.bairro,
          localidade: c.localidade,
          uf: c.uf,
          ibge: c.ibge,
          ddd: c.ddd
        }
      }))
    });
  }

  const featureCollection = {
    type: "FeatureCollection",
    features
  };

  // Garante a existência do diretório data/
  await fs.mkdir(path.dirname(GEOJSON_PATH), { recursive: true });

  // Escrita síncrona nos arquivos
  await fs.writeFile(GEOJSON_PATH, JSON.stringify(featureCollection, null, 2), 'utf8');
  await fs.writeFile(MASTER_DB_PATH, JSON.stringify(masterDbList, null, 2), 'utf8');
  
  logger.info('[Sync] Arquivos GeoJSON e MasterDB sincronizados com sucesso a partir do banco de dados.');
}

const geojsonController = {
  /**
   * Salva alterações em lote (GeoJSON FeatureCollection) e persiste de forma transacionada no Banco de Dados
   */
  async saveGeoJSON(req, res) {
    const { featureCollection } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;
    const usuarioId = req.usuario?.id || null;

    if (!featureCollection || featureCollection.type !== 'FeatureCollection' || !Array.isArray(featureCollection.features)) {
      return res.status(400).json({ success: false, error: 'Formato GeoJSON inválido.' });
    }

    // Sequenciamento seguro contra concorrência
    writeQueue = writeQueue.then(async () => {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        logger.info('[GeoJSON Save] Iniciando persistência transacionada...');

        // 1. Coleta e validação estrutural preliminar
        const parsedFeatures = [];
        let index = 0;
        for (const f of featureCollection.features) {
          if (!f || !f.geometry) {
            throw new Error('Uma ou mais feições possuem geometria ausente ou corrompida.');
          }

          // Validação espacial ativa com ST_IsValid / ST_MakeValid (Fase 1 / Regra GeoJSON)
          const validGeom = await validateAndSanitizeGeometry(f.geometry);
          const { nome, bairro, complexo, corHex } = extractFeatureProps(f, index);
          
          parsedFeatures.push({
            id: f.id ? parseInt(f.id, 10) || (index + 1000) : (index + 1000),
            nome,
            bairro,
            complexo,
            corHex,
            geometria: validGeom
          });
          index++;
        }

        // 2. Limpar base atual para sobrescrever (Operação em Lote Segura)
        await connection.query('DELETE FROM comunidade_ceps');
        await connection.query('DELETE FROM comunidade_ruas');
        await connection.query('DELETE FROM comunidades');

        // 3. Inserir dados limpos e normalizados
        const stmtComunidade = await connection.prepare(
          'INSERT INTO comunidades (id, nome, total_ruas, geometria, complexo, cor_hex) VALUES (?, ?, ?, ST_GeomFromText(?, 4326), ?, ?)'
        );

        for (const com of parsedFeatures) {
          const wkt = toWkt(com.geometria);
          await stmtComunidade.execute([
            com.id,
            com.nome,
            0,
            wkt,
            com.complexo,
            com.corHex
          ]);
        }

        await connection.commit();
        logger.info('[GeoJSON Save] Banco de dados atualizado com sucesso. Atualizando arquivos...');

        // 4. Sincronizar arquivos em disco a partir da base higienizada do MySQL
        await syncFilesFromDatabase();

        res.json({ success: true, message: 'GeoJSON e Banco de dados sincronizados com sucesso!' });
      } catch (error) {
        await connection.rollback();
        logger.error('[GeoJSON Save Error] Falha de persistência transacionada.', error, { ip: clientIP });
        res.status(500).json({ success: false, error: error.message || 'Erro crítico ao sincronizar base.' });
      } finally {
        connection.release();
      }
    });

    await writeQueue;
  },

  /**
   * Importa e mescla arquivos GeoJSON externos, corrigindo polígonos e cores
   */
  async importGeoJSON(req, res) {
    const { featureCollection, replaceExisting = false } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;
    const usuarioId = req.usuario?.id || null;

    if (!featureCollection || featureCollection.type !== 'FeatureCollection' || !Array.isArray(featureCollection.features)) {
      return res.status(400).json({ success: false, error: 'Arquivo inválido. Deve ser FeatureCollection.' });
    }

    writeQueue = writeQueue.then(async () => {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        logger.info('[GeoJSON Import] Iniciando importação transacionada...');

        let imported = 0;
        let skipped = 0;
        let replaced = 0;

        let index = 0;
        for (const f of featureCollection.features) {
          const validGeom = await validateAndSanitizeGeometry(f.geometry);
          const { nome, bairro, complexo, corHex } = extractFeatureProps(f, index);
          
          // Gerar ID numérico único
          const id = f.id ? parseInt(f.id, 10) || (Date.now() + index) : (Date.now() + index);

          // Verificar existência por nome
          const [[exists]] = await connection.query(
            'SELECT id FROM comunidades WHERE nome = ?',
            [nome]
          );

          if (exists) {
            if (replaceExisting) {
              // Substituir: Grava no histórico, deleta antigo e adiciona novo
              await connection.query('DELETE FROM comunidades WHERE id = ?', [exists.id]);
              
              const wkt = toWkt(validGeom);
              await connection.query(
                `INSERT INTO comunidades (id, nome, geometria, complexo, cor_hex) VALUES (?, ?, ST_GeomFromText(?, 4326), ?, ?)`,
                [id, nome, wkt, complexo, corHex]
              );
              replaced++;
            } else {
              skipped++;
            }
          } else {
            // Novo registro
            const wkt = toWkt(validGeom);
            await connection.query(
              `INSERT INTO comunidades (id, nome, geometria, complexo, cor_hex) VALUES (?, ?, ST_GeomFromText(?, 4326), ?, ?)`,
              [id, nome, wkt, complexo, corHex]
            );
            imported++;
          }
          index++;
        }

        await connection.commit();
        
        // Sincronizar disco
        await syncFilesFromDatabase();

        res.json({
          success: true,
          message: 'GeoJSON importado e banco atualizado com sucesso!',
          summary: { imported, skipped, replaced }
        });
      } catch (error) {
        await connection.rollback();
        logger.error('[GeoJSON Import Error] Falha de importação.', error, { ip: clientIP });
        res.status(500).json({ success: false, error: error.message || 'Erro ao importar GeoJSON.' });
      } finally {
        connection.release();
      }
    });

    await writeQueue;
  },

  /**
   * Limpa completamente o banco de dados e sincroniza arquivos vazios
   */
  async clearGeoJSON(req, res) {
    const clientIP = req.ip || req.connection.remoteAddress;

    writeQueue = writeQueue.then(async () => {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        logger.info('[GeoJSON Clear] Iniciando limpeza total...');

        await connection.query('DELETE FROM comunidade_ceps');
        await connection.query('DELETE FROM comunidade_ruas');
        await connection.query('DELETE FROM comunidades');

        await connection.commit();
        
        // Sincronizar arquivos vazios
        await syncFilesFromDatabase();

        res.json({ success: true, message: 'Todos os dados do mapa foram limpos.' });
      } catch (error) {
        await connection.rollback();
        logger.error('[GeoJSON Clear Error] Falha ao limpar dados.', error, { ip: clientIP });
        res.status(500).json({ success: false, error: 'Erro crítico ao limpar base.' });
      } finally {
        connection.release();
      }
    });

    await writeQueue;
  },

  syncFilesFromDatabase
};

module.exports = geojsonController;
