require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const logger = require('./src/utils/logger');

/**
 * SIMAC - Sistema de Inteligência e Monitoramento de Ação Comunitária
 * Backend API Server
 * Arquitetura em camadas robusta, focada em segurança, observabilidade e performance.
 */

const app = express();
const PORT = process.env.PORT || 8200;

// Configurações Globais
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Servir arquivos estáticos (Frontend)
app.use(express.static(path.join(__dirname, './')));

// Rota silenciosa para favicon.ico
app.get('/favicon.ico', (req, res) => res.status(204).end());

// 🛡️ Segurança: Rate Limiting para APIs públicas geográficas (Totalmente gratuito)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Janela de 15 minutos
  max: 100, // Limite estrito de 100 requisições por IP por janela de 15 minutos
  message: { error: 'Excesso de requisições. Por favor, aguarde alguns minutos e tente novamente.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Importação das Camadas de Controle Modularizadas
const geojsonController  = require('./src/controllers/geojsonController');
const geocodeController  = require('./src/controllers/geocodeController');
const spatialController  = require('./src/controllers/spatialController');

// 🗺️ Registro das Rotas API Territoriais e GIS (GeoJSON / Geocodificação)
app.post('/api/save-geojson',   geojsonController.saveGeoJSON);
app.post('/api/clear-geojson', geojsonController.clearGeoJSON);
app.post('/api/import-geojson', geojsonController.importGeoJSON);
app.get('/api/autocomplete',    apiLimiter, geocodeController.autocomplete);
app.get('/api/geocode',         apiLimiter, geocodeController.search);

// 🌐 Rotas API Espacial MySQL (ST_Contains / ST_Intersects)
app.get('/api/comunidades',                   spatialController.listarComunidades);
app.get('/api/comunidades/ponto',             spatialController.buscarPorPonto);
app.get('/api/comunidades/:id',               spatialController.detalharComunidade);
app.get('/api/comunidades/:id/ruas',          spatialController.listarRuas);
app.put('/api/comunidades/:id/geometria',     spatialController.atualizarGeometria);

// 🔍 Tratamento Global de Exceções para Evitar Crash do Servidor
process.on('unhandledRejection', (reason, promise) => {
  logger.error('[Fatal Error] Unhandled Rejection detectada no processo principal.', reason, { promise });
});

process.on('uncaughtException', (err) => {
  logger.error('[Fatal Error] Uncaught Exception disparada no processo principal.', err);
});

// Inicialização do Servidor Enterprise
app.listen(PORT, () => {
  logger.info('Servidor corporativo SIMAC (Sistema de Inteligência e Monitoramento de Ação Comunitária) iniciado com sucesso.', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    gisOrchestrator: 'Active (Hybrid Fallback Enabled)',
    rateLimiting: 'Active (100req/15min)'
  });
});
