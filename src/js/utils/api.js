/**
 * SIMAC — Módulo de API Client
 * Centraliza todas as chamadas HTTP, injetando o Bearer token automaticamente.
 * Redireciona para login se o token estiver expirado (401).
 * Detecta a subpasta base automaticamente (ex: /simac/).
 */

function getBasePath() {
  // Reutiliza o _basePath já calculado pelo index.html, ou calcula se necessário
  if (window._basePath) return window._basePath;
  const p = window.location.pathname;
  const last = p.lastIndexOf('/');
  return last > 0 ? p.substring(0, last + 1) : '/';
}

function getToken() {
  return localStorage.getItem('simac_token') || '';
}

function getAuthHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`,
    ...extra
  };
}

async function request(url, options = {}) {
  // Se a URL não for absoluta (não começa com http), prepend a base path
  const fullUrl = url.startsWith('http') ? url : getBasePath() + url;
  const headers = getAuthHeaders(options.headers || {});
  const response = await fetch(fullUrl, { ...options, headers });

  if (response.status === 401) {
    localStorage.removeItem('simac_token');
    localStorage.removeItem('simac_usuario');
    window.location.replace(getBasePath() + 'login.html');
    throw new Error('Sessão expirada. Redirecionando para login.');
  }

  return response;
}

export const api = {
  get:    (url, opts = {})       => request(url, { ...opts, method: 'GET' }),
  post:   (url, body, opts = {}) => request(url, { ...opts, method: 'POST',  body: JSON.stringify(body) }),
  put:    (url, body, opts = {}) => request(url, { ...opts, method: 'PUT',   body: JSON.stringify(body) }),
  delete: (url, opts = {})       => request(url, { ...opts, method: 'DELETE' }),
};
