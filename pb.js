// pb.js — minimal fetch-based PocketBase client for the 23မောင်း Admin app.
// No CDN dependency. Works in the browser (ES module) and in Node (tests).
// Admin logs in as the PocketBase SUPERUSER (schema §7 Q2).
// No password, token or secret is ever stored in any file — the token lives
// only in localStorage (browser) / memory (Node) after a runtime login.

export const PB_URL = 'https://api.23ledger.com';

const TOKEN_KEY = 'm23_admin_token';
let _memToken = null;

function storageGet() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(TOKEN_KEY);
  } catch (e) { /* storage unavailable (Node / private mode) */ }
  return _memToken;
}
function storageSet(v) {
  _memToken = v;
  try {
    if (typeof localStorage !== 'undefined') {
      if (v) localStorage.setItem(TOKEN_KEY, v); else localStorage.removeItem(TOKEN_KEY);
    }
  } catch (e) { /* ignore */ }
}

export function getToken() { return storageGet(); }
export function setToken(t) { storageSet(t || null); }
export function clearToken() { storageSet(null); }
export function isLoggedIn() { return !!getToken(); }

// Low-level request. Throws an Error with .status / .data on HTTP failure.
async function req(path, opts) {
  const o = opts || {};
  const method = o.method || 'GET';
  const headers = {};
  const t = getToken();
  if (t) headers['Authorization'] = 'Bearer ' + t;
  let body;
  if (o.body !== undefined) {
    if (o.isForm) { body = o.body; /* FormData: fetch sets the boundary itself */ }
    else { headers['Content-Type'] = 'application/json'; body = JSON.stringify(o.body); }
  }
  const res = await fetch(PB_URL + path, { method: method, headers: headers, body: body });
  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch (e) { data = { raw: text }; } }
  if (!res.ok) {
    const err = new Error((data && data.message) || ('PocketBase HTTP ' + res.status + ' ' + path));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ---- Auth (superuser) -------------------------------------------------------
export async function authWithPassword(email, password) {
  const d = await req('/api/collections/_superusers/auth-with-password', {
    method: 'POST', body: { identity: email, password: password }
  });
  if (d && d.token) setToken(d.token);
  return d;
}
export async function authRefresh() {
  const d = await req('/api/collections/_superusers/auth-refresh', { method: 'POST' });
  if (d && d.token) setToken(d.token);
  return d;
}

// ---- Files ------------------------------------------------------------------
export function fileUrl(collection, recordId, filename) {
  if (!filename) return null;
  return PB_URL + '/api/files/' + collection + '/' + recordId + '/' + encodeURIComponent(filename);
}
// Screenshot (or any single-file field) URL for a record, e.g. m23_requests.screenshot.
export function fileUrlFromRecord(collection, rec, field) {
  if (!rec) return null;
  const f = rec[field || 'screenshot'];
  if (!f) return null;
  return fileUrl(collection, rec.id, f);
}

// ---- Records ----------------------------------------------------------------
function qs(params) {
  const q = new URLSearchParams();
  Object.keys(params || {}).forEach(function (k) {
    const v = params[k];
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  const s = q.toString();
  return s ? '?' + s : '';
}

// getList returns the raw PocketBase page: { page, perPage, totalItems, totalPages, items[] }
export async function getList(collection, opts) {
  const o = opts || {};
  return req('/api/collections/' + collection + '/records' + qs({
    page: o.page || 1,
    perPage: o.perPage || 200,
    filter: o.filter || '',
    sort: o.sort || '',
    expand: o.expand || '',
    fields: o.fields || ''
  }));
}

// getAll pages through the whole list and returns a flat array of records.
export async function getAll(collection, opts) {
  const o = opts || {};
  const out = [];
  let page = 1;
  for (;;) {
    const d = await getList(collection, {
      page: page, perPage: o.perPage || 200,
      filter: o.filter, sort: o.sort, expand: o.expand, fields: o.fields
    });
    const items = (d && d.items) || [];
    out.push.apply(out, items);
    const total = (d && d.totalItems) || 0;
    const pages = (d && d.totalPages) || 1;
    if (!items.length || out.length >= total || page >= pages) break;
    page++;
    if (page > 500) break; // safety valve, never loop forever
  }
  return out;
}

export async function getOne(collection, id, opts) {
  const o = opts || {};
  return req('/api/collections/' + collection + '/records/' + id + qs({ expand: o.expand || '' }));
}

export async function create(collection, body) {
  return req('/api/collections/' + collection + '/records', { method: 'POST', body: body });
}

export async function update(collection, id, body) {
  return req('/api/collections/' + collection + '/records/' + id, { method: 'PATCH', body: body });
}

export async function del(collection, id) {
  return req('/api/collections/' + collection + '/records/' + id, { method: 'DELETE' });
}

export default {
  PB_URL: PB_URL,
  getToken: getToken, setToken: setToken, clearToken: clearToken, isLoggedIn: isLoggedIn,
  authWithPassword: authWithPassword, authRefresh: authRefresh,
  fileUrl: fileUrl, fileUrlFromRecord: fileUrlFromRecord,
  getList: getList, getAll: getAll, getOne: getOne, create: create, update: update, del: del
};
