/* عميل API — يتصل بالخادم إن وُجد، وإلا يُرجع null */
const API_BASE = (function () {
  try {
    const stored = localStorage.getItem('maarisk_api_base');
    if (stored) return stored.replace(/\/$/, '');
  } catch (e) {}
  // افتراضي: نفس المضيف على المنفذ 8000
  const loc = window.location;
  if (loc.protocol === 'file:') return 'http://127.0.0.1:8000';
  return loc.protocol + '//' + loc.hostname + ':8000';
})();

async function apiFetch(path, options = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  const token = localStorage.getItem('maarisk_api_token');
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API_BASE + path, Object.assign({}, options, { headers }));
  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = { detail: text }; }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || ('HTTP ' + res.status);
    const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function apiHealth() {
  try {
    const r = await fetch(API_BASE + '/health', { method: 'GET' });
    return r.ok;
  } catch {
    return false;
  }
}

window.API_BASE = API_BASE;
window.apiFetch = apiFetch;
window.apiHealth = apiHealth;
