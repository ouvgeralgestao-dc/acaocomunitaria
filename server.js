require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const logger = require('./src/utils/logger');

/**
 * SIMAC - Sistema de Inteligência e Monitoramento de Ação Comunitária
 * Backend API Server — Arquitetura em camadas com autenticação JWT e RBAC.
 */

const app = express();
const PORT = process.env.PORT || 8200;

// ── Middlewares Globais ──────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// ── Arquivos Estáticos (Frontend) ─────────────────────────────────────────────
// A página de login é pública; o index.html é protegido via verificação no cliente
app.use(express.static(path.join(__dirname, './')));

// Rota silenciosa para favicon.ico
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Rota raiz: redireciona para login
app.get('/', (req, res) => res.redirect('/login.html'));

// ── Rate Limiting para APIs públicas ──────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Excesso de requisições. Por favor, aguarde alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting específico para auth (proteção anti-brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
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

// ── Tratamento Global de Exceções ──────────────────────────────────────────────
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
    environment: process.env.NODE_ENV || 'development',
    auth: 'JWT (8h expiry)',
    rateLimiting: 'Active (100req/15min | auth: 10req/15min)',
  });
});
