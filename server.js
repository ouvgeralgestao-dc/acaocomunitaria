require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const logger = require('./src/utils/logger');
const errorHandler = require('./src/middlewares/errorHandler');

/**
 * SIMAC - Sistema de Inteligência e Monitoramento de Ação Comunitária
 * Backend API Server (Refatorado & Seguro)
 */

const app = express();
const PORT = process.env.PORT || 8200;

// ── Middlewares Globais de Segurança ─────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Permite carregar Leaflet e fontes externas sem CSP complexa local
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: true, // Em homologação/produção, configurar para domínio oficial
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// Servir arquivos estáticos do frontend (página de login, index.html, JS, CSS)
app.use(express.static(path.join(__dirname, './')));

app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/', (req, res) => res.redirect('/login.html'));

// ── Rate Limiting ────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Excesso de requisições. Por favor, aguarde alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Importação das Camadas ─────────────────────────────────────────────────────
const authController    = require('./src/controllers/authController');
const authMiddleware    = require('./src/middlewares/authMiddleware');
const geojsonController = require('./src/controllers/geojsonController');
const geocodeController = require('./src/controllers/geocodeController');
const spatialController = require('./src/controllers/spatialController');

// ── Rotas de Autenticação (públicas) ──────────────────────────────────────────
app.post('/api/auth/login',  authLimiter, authController.login);
app.get('/api/auth/me',      authMiddleware, authController.me);
app.post('/api/auth/logout', authMiddleware, authController.logout);

// ── Rotas API GIS (protegidas) ────────────────────────────────────────────────
app.post('/api/save-geojson',              authMiddleware, geojsonController.saveGeoJSON);
app.post('/api/clear-geojson',             authMiddleware, geojsonController.clearGeoJSON);
app.post('/api/import-geojson',            authMiddleware, geojsonController.importGeoJSON);
app.get('/api/autocomplete',               apiLimiter, authMiddleware, geocodeController.autocomplete);
app.get('/api/geocode',                    apiLimiter, authMiddleware, geocodeController.search);

// ── Rotas API Espacial MySQL ──────────────────────────────────────────────────
app.get('/api/comunidades',                authMiddleware, spatialController.listarComunidades);
app.get('/api/comunidades/ponto',          authMiddleware, spatialController.buscarPorPonto);
app.get('/api/comunidades/:id',            authMiddleware, spatialController.detalharComunidade);
app.get('/api/comunidades/:id/ruas',       authMiddleware, spatialController.listarRuas);
app.put('/api/comunidades/:id/geometria',  authMiddleware, spatialController.atualizarGeometria);

// ── Tratamento Centralizado de Erros ─────────────────────────────────────────
app.use(errorHandler);

// ── Tratamento de Exceções não capturadas no processo ────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error('[Fatal] Unhandled Rejection no processo principal.', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('[Fatal] Uncaught Exception no processo principal.', err);
});

// ── Inicialização ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info('Servidor SIMAC iniciado com sucesso.', {
    port: PORT,
    environment: process.env.NODE_ENV || 'production',
    auth: 'JWT (8h expiry, administrador único)',
    rateLimiting: 'Active',
  });
});
