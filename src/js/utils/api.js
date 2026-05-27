/**
 * SIMAC — Módulo de API Client
 * Centraliza todas as chamadas HTTP, injetando o Bearer token automaticamente.
 * Redireciona para login se o token estiver expirado (401).
 */

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
  const headers = getAuthHeaders(options.headers || {});
  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    localStorage.removeItem('simac_token');
    localStorage.removeItem('simac_usuario');
    window.location.replace('/login.html');
    throw new Error('Sessão expirada. Redirecionando para login.');
  }

  return response;
}

export const api = {
  get:    (url, opts = {})   => request(url, { ...opts, method: 'GET' }),
  post:   (url, body, opts = {}) => request(url, { ...opts, method: 'POST',  body: JSON.stringify(body) }),
  put:    (url, body, opts = {}) => request(url, { ...opts, method: 'PUT',   body: JSON.stringify(body) }),
  delete: (url, opts = {})   => request(url, { ...opts, method: 'DELETE' }),
};
