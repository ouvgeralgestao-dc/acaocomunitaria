const geocodeOrchestrator = require('../services/geocodeOrchestrator');
const logger = require('../utils/logger');

/**
 * Controller responsável pelos serviços de Inteligência de Endereços (Geocoding & Autocomplete)
 */
const geocodeController = {
  async autocomplete(req, res) {
    const { q } = req.query;
    const clientIP = req.ip || req.connection.remoteAddress;

    if (!q || q.trim().length < 3) {
      return res.json([]);
    }

    try {
      logger.info('[Geocode API] Requisição recebida para autocomplete.', { query: q, ip: clientIP });
      const results = await geocodeOrchestrator.autocomplete(q, 5);
      res.json(results || []);
    } catch (error) {
      logger.error('[Geocode Controller Error] Erro no processamento de autocomplete.', error, { query: q, ip: clientIP });
      res.status(500).json([]);
    }
  },

  async search(req, res) {
    const { q, limit = 1 } = req.query;
    const clientIP = req.ip || req.connection.remoteAddress;

    if (!q || !q.trim()) {
      logger.warn('[Geocode API] Requisição de busca sem parâmetro obrigatório "q".', { ip: clientIP });
      return res.status(400).json({ error: 'O parâmetro q é obrigatório.' });
    }

    try {
      const parsedLimit = parseInt(limit, 10) || 1;
      logger.info('[Geocode API] Iniciando busca geográfica profunda.', { query: q, limit: parsedLimit, ip: clientIP });
      
      const results = await geocodeOrchestrator.search(q, parsedLimit);
      
      logger.info('[Geocode API] Busca geográfica concluída com sucesso.', { 
        query: q, 
        resultsCount: results ? results.length : 0, 
        ip: clientIP 
      });
      res.json(results || []);
    } catch (error) {
      logger.error('[Geocode Controller Error] Falha profunda no geoprocessamento.', error, { query: q, ip: clientIP });
      res.status(500).json({ error: 'Erro interno no processamento geográfico.' });
    }
  }
};

module.exports = geocodeController;
