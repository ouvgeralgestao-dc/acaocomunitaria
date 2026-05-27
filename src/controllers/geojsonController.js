const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

// Fila global de escrita em memória para serializar operações e evitar Race Conditions / Lost Updates
let writeQueue = Promise.resolve();

// Caminho único e centralizado do arquivo mestre GeoJSON
const GEOJSON_PATH = path.join(__dirname, '../data/comunidades.geojson');

/**
 * Controller responsável pela gestão e edição cartográfica do GeoJSON
 */
const geojsonController = {
  async saveGeoJSON(req, res) {
    const { featureCollection } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;
    // Token de segurança removido; operação permitida sem autenticação.

    // 2. Validação de Schema Estrutural GeoJSON Básica (Defensiva)
    if (!featureCollection || featureCollection.type !== 'FeatureCollection') {
      logger.warn('[GeoJSON Validation] Payload inválido rejeitado. Estrutura não é FeatureCollection.', {
        ip: clientIP
      });
      return res.status(400).json({ error: 'Formato GeoJSON inválido. Deve ser do tipo FeatureCollection.' });
    }

    if (!Array.isArray(featureCollection.features)) {
      logger.warn('[GeoJSON Validation] Payload sem array de features rejeitado.', {
        ip: clientIP
      });
      return res.status(400).json({ error: 'Formato GeoJSON inválido. Features deve ser um array.' });
    }

    // Validação topológica básica: garantir que as features têm geometria e tipo válido
    const invalidFeature = featureCollection.features.find(f => {
      return !f || f.type !== 'Feature' || !f.geometry || !f.geometry.type || !Array.isArray(f.geometry.coordinates);
    });

    if (invalidFeature) {
      logger.warn('[GeoJSON Validation] Feature com estrutura ou geometria inválida rejeitada.', {
        ip: clientIP,
        invalidFeatureSummary: invalidFeature ? JSON.stringify(invalidFeature).substring(0, 150) : 'null'
      });
      return res.status(400).json({ error: 'Formato GeoJSON inválido. Uma ou mais feições possuem geometria ou estrutura corrompida.' });
    }

    const geojsonPath = GEOJSON_PATH;
    const backupPath = `${geojsonPath}.bak`;

    // 3. Execução Serializada na Fila (Prevenção de Corrupção Concorrente)
    writeQueue = writeQueue.then(async () => {
      try {
        logger.info('[GeoJSON Operation] Iniciando fluxo assíncrono seguro de persistência...', { ip: clientIP });
        
        let currentContent = '';
        try {
          currentContent = await fs.readFile(geojsonPath, 'utf8');
        } catch (readErr) {
          logger.warn('[GeoJSON Warning] Arquivo communities.geojson não localizado ou sem leitura. Criando novo arquivo.', { error: readErr.message });
        }

        // Criar backup apenas se o arquivo original continha dados válidos
        if (currentContent) {
          await fs.writeFile(backupPath, currentContent, 'utf8');
          logger.info('[GeoJSON Backup] Backup de contingência criado com sucesso.', { backupPath });
        }

        // Persistência assíncrona do novo GeoJSON com formatação estruturada
        const serializedData = JSON.stringify(featureCollection, null, 2);
        await fs.writeFile(geojsonPath, serializedData, 'utf8');

        logger.info('[GeoJSON Save] Alterações persistidas no disco com sucesso.', {
          geojsonPath,
          featuresCount: featureCollection.features.length
        });

        // Retornar a resposta dentro da promessa resolvida
        res.json({ 
          message: 'GeoJSON atualizado com sucesso!', 
          backup: backupPath,
          featuresCount: featureCollection.features.length
        });
      } catch (error) {
        logger.error('[GeoJSON Error] Falha crítica durante persistência ou backup.', error, { ip: clientIP });
        res.status(500).json({ error: 'Erro crítico interno ao salvar base de dados GeoJSON.' });
      }
    });

    // Aguardar a execução da fila para a requisição atual
    await writeQueue;
  },

  /**
   * Importa e mescla um GeoJSON externo ao arquivo mestre de comunidades.
   * Realiza validação, normalização de propriedades, deduplicação por nome
   * e backup automático antes da persistência.
   */
  async importGeoJSON(req, res) {
    const { featureCollection, replaceExisting = false } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;
    // Token de segurança removido; importação permitida sem autenticação.

    // 2. Validação estrutural do GeoJSON importado
    if (!featureCollection || featureCollection.type !== 'FeatureCollection' || !Array.isArray(featureCollection.features)) {
      return res.status(400).json({ error: 'Formato inválido. O arquivo deve ser um GeoJSON FeatureCollection.' });
    }

    if (featureCollection.features.length === 0) {
      return res.status(400).json({ error: 'O arquivo GeoJSON está vazio (sem features).' });
    }

    // 3. Validação de geometria em cada feature
    const geometriesValidas = ['Polygon', 'MultiPolygon'];
    const invalidFeatures = featureCollection.features.filter(f => {
      return !f || f.type !== 'Feature'
        || !f.geometry
        || !geometriesValidas.includes(f.geometry.type)
        || !Array.isArray(f.geometry.coordinates);
    });

    if (invalidFeatures.length > 0) {
      logger.warn('[GeoJSON Import Validation] Features com geometria inválida detectadas.', {
        ip: clientIP,
        count: invalidFeatures.length
      });
      return res.status(400).json({
        error: `${invalidFeatures.length} feature(s) com geometria inválida ou não-poligonal. Apenas Polygon e MultiPolygon são aceitos.`
      });
    }

    writeQueue = writeQueue.then(async () => {
      try {
        // 4. Ler o GeoJSON mestre atual
        let masterCollection = { type: 'FeatureCollection', features: [] };
        try {
          const raw = await fs.readFile(GEOJSON_PATH, 'utf8');
          masterCollection = JSON.parse(raw);
        } catch (e) {
          logger.warn('[GeoJSON Import] Arquivo mestre não encontrado. Será criado novo.', { error: e.message });
        }

        // 5. Backup automático do arquivo mestre
        const backupPath = `${GEOJSON_PATH}.bak`;
        if (masterCollection.features.length > 0) {
          await fs.writeFile(backupPath, JSON.stringify(masterCollection, null, 2), 'utf8');
          logger.info('[GeoJSON Import] Backup do arquivo mestre criado.', { backupPath });
        }

        // 6. Normalizar e preparar as features importadas
        const existingNames = new Set(
          masterCollection.features.map(f => (f.properties?.name || f.properties?.neighborhood || '').toLowerCase())
        );

        let imported = 0;
        let skipped = 0;
        let replaced = 0;

        const importedFeatures = featureCollection.features.map((f, index) => {
          // Normalização de propriedades: garantir campos mínimos obrigatórios
          const props = f.properties || {};
          const name = props.name || props.nome || props.NOME || props.community || `Comunidade_${index + 1}`;
          const neighborhood = props.neighborhood || props.bairro || props.BAIRRO || props.district || 'Não Informado';

          return {
            ...f,
            type: 'Feature',
            id: f.id || `import_${Date.now()}_${index}`,
            properties: {
              ...props,
              name,
              neighborhood,
              imported_at: new Date().toISOString(),
              source: 'import'
            }
          };
        });

        // 7. Merge inteligente: mescla ou substitui
        let finalFeatures;
        if (replaceExisting) {
          // Modo substituição: sobreescreve features com mesmo nome
          const importedByName = new Map(importedFeatures.map(f => [f.properties.name.toLowerCase(), f]));
          const filtered = masterCollection.features.filter(f => {
            const n = (f.properties?.name || '').toLowerCase();
            if (importedByName.has(n)) { replaced++; return false; }
            return true;
          });
          finalFeatures = [...filtered, ...importedFeatures];
          imported = importedFeatures.length;
        } else {
          // Modo adição: pula duplicatas por nome
          const newFeatures = importedFeatures.filter(f => {
            const n = f.properties.name.toLowerCase();
            if (existingNames.has(n)) { skipped++; return false; }
            existingNames.add(n);
            imported++;
            return true;
          });
          finalFeatures = [...masterCollection.features, ...newFeatures];
        }

        const updatedCollection = { type: 'FeatureCollection', features: finalFeatures };
        await fs.writeFile(GEOJSON_PATH, JSON.stringify(updatedCollection, null, 2), 'utf8');

        logger.info('[GeoJSON Import] Importação concluída com sucesso.', {
          ip: clientIP,
          imported,
          skipped,
          replaced,
          totalFeatures: finalFeatures.length
        });

        res.json({
          message: 'GeoJSON importado com sucesso!',
          summary: { imported, skipped, replaced, totalFeatures: finalFeatures.length }
        });
      } catch (error) {
        logger.error('[GeoJSON Import Error] Falha crítica durante importação.', error, { ip: clientIP });
        res.status(500).json({ error: 'Erro interno ao importar GeoJSON.' });
      }
    });

    await writeQueue;
  },

  /**
   * Apaga completamente os dados do arquivo mestre GeoJSON, gerando backup antes.
   */
  async clearGeoJSON(req, res) {
    const clientIP = req.ip || req.connection.remoteAddress;
    const geojsonPath = GEOJSON_PATH;
    const backupPath = `${geojsonPath}.bak`;

    writeQueue = writeQueue.then(async () => {
      try {
        logger.info('[GeoJSON Clear] Iniciando limpeza total do GeoJSON...', { ip: clientIP });
        
        let currentContent = '';
        try {
          currentContent = await fs.readFile(geojsonPath, 'utf8');
        } catch (readErr) {
          logger.warn('[GeoJSON Clear Warning] Arquivo communities.geojson não localizado para backup.', { error: readErr.message });
        }

        // Criar backup
        if (currentContent) {
          await fs.writeFile(backupPath, currentContent, 'utf8');
          logger.info('[GeoJSON Clear Backup] Backup de contingência criado antes de apagar.', { backupPath });
        }

        // Criar FeatureCollection vazia
        const emptyCollection = { type: 'FeatureCollection', features: [] };
        await fs.writeFile(geojsonPath, JSON.stringify(emptyCollection, null, 2), 'utf8');

        logger.info('[GeoJSON Clear Success] Todo o conteúdo GeoJSON foi apagado.', { geojsonPath });
        res.json({ message: 'Todos os dados GeoJSON foram apagados com sucesso!' });
      } catch (error) {
        logger.error('[GeoJSON Clear Error] Falha crítica ao apagar dados GeoJSON.', error, { ip: clientIP });
        res.status(500).json({ error: 'Erro crítico interno ao apagar dados GeoJSON.' });
      }
    });

    await writeQueue;
  }
};

module.exports = geojsonController;
