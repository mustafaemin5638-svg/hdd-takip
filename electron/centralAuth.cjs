/**
 * Merkezi hesap/lisans senkronu — özel GitHub repo (hdd-takip-auth).
 * Token: userData, env HDD_CENTRAL_TOKEN, veya paket içi centralAuthToken.cjs
 */
const fs = require('fs')
const path = require('path')
const { app } = require('electron')

const OWNER = 'mustafaemin5638-svg'
const REPO = 'hdd-takip-auth'
const FILE_PATH = 'db.json'
const API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`

function tokenPath() {
  return path.join(app.getPath('userData'), 'central-auth-token.txt')
}

function readBundledToken() {
  try {
    // eslint-disable-next-line import/no-unresolved, global-require
    const bundled = require('./centralAuthToken.cjs')
    return String(bundled?.token || '').trim()
  } catch {
    return ''
  }
}

function getToken() {
  try {
    const fromFile = fs.readFileSync(tokenPath(), 'utf8').trim()
    if (fromFile) return fromFile
  } catch {
    /* ignore */
  }
  const fromEnv = String(process.env.HDD_CENTRAL_TOKEN || '').trim()
  if (fromEnv) return fromEnv
  return readBundledToken()
}

function setToken(token) {
  const t = String(token || '').trim()
  fs.mkdirSync(path.dirname(tokenPath()), { recursive: true })
  if (!t) {
    try {
      fs.unlinkSync(tokenPath())
    } catch {
      /* ignore */
    }
    return { ok: true }
  }
  fs.writeFileSync(tokenPath(), t, 'utf8')
  return { ok: true }
}

function hasToken() {
  return Boolean(getToken())
}

function emptyRemote() {
  return {
    individuals: [],
    companies: [],
    licenses: [],
    updatedAt: null,
  }
}

async function githubRequest(url, { method = 'GET', body } = {}) {
  const token = getToken()
  if (!token) {
    return { ok: false, error: 'Merkezi senkron anahtarı yok.' }
  }
  const res = await fetch(url, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'HDD-TAKIP',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: json?.message || text || `HTTP ${res.status}`,
    }
  }
  return { ok: true, data: json }
}

async function fetchRemote() {
  const res = await githubRequest(`${API}?ref=main`)
  if (!res.ok) {
    if (res.status === 404) {
      return { ok: true, db: emptyRemote(), sha: null }
    }
    return res
  }
  const content = Buffer.from(res.data.content || '', 'base64').toString('utf8')
  let db
  try {
    db = JSON.parse(content)
  } catch {
    db = emptyRemote()
  }
  return {
    ok: true,
    sha: res.data.sha,
    db: {
      individuals: Array.isArray(db.individuals) ? db.individuals : [],
      companies: Array.isArray(db.companies) ? db.companies : [],
      licenses: Array.isArray(db.licenses) ? db.licenses : [],
      updatedAt: db.updatedAt || null,
    },
  }
}

async function saveRemote(db, sha) {
  const payload = {
    individuals: db.individuals || [],
    companies: db.companies || [],
    licenses: db.licenses || [],
    updatedAt: new Date().toISOString(),
  }
  const content = Buffer.from(JSON.stringify(payload, null, 2), 'utf8').toString(
    'base64',
  )
  const body = {
    message: `auth sync ${payload.updatedAt}`,
    content,
    branch: 'main',
  }
  if (sha) body.sha = sha
  return githubRequest(API, { method: 'PUT', body })
}

/** Yerel db'nin hesap alanlarını uzak ile değiştir (masterPassword dokunulmaz) */
async function pullIntoLocal(readDb, writeDb) {
  const remote = await fetchRemote()
  if (!remote.ok) return remote
  const db = readDb()
  db.individuals = remote.db.individuals
  db.companies = remote.db.companies
  db.licenses = remote.db.licenses
  writeDb(db)
  return { ok: true, updatedAt: remote.db.updatedAt }
}

/** Yerel hesap alanlarını uzağa yaz */
async function pushFromLocal(readDb) {
  const remote = await fetchRemote()
  if (!remote.ok && remote.status !== 404) return remote
  const db = readDb()
  const put = await saveRemote(
    {
      individuals: db.individuals,
      companies: db.companies,
      licenses: db.licenses,
    },
    remote.sha || null,
  )
  if (!put.ok) return put
  return { ok: true }
}

/** Kayıt/onay sonrası: çek → yerel zaten güncel → çakışmada yeniden dene */
async function syncPush(readDb, writeDb) {
  if (!hasToken()) {
    return { ok: false, error: 'Merkezi senkron anahtarı yok — kayıt yalnızca bu PC’de kaldı.' }
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const remote = await fetchRemote()
    if (!remote.ok && remote.status !== 404) return remote

    // Uzaktakileri yerelle birleştir: aynı id kazanır; yoksa ekle
    const local = readDb()
    const merged = mergeAuth(remote.db || emptyRemote(), local)
    local.individuals = merged.individuals
    local.companies = merged.companies
    local.licenses = merged.licenses
    writeDb(local)

    const put = await saveRemote(merged, remote.sha || null)
    if (put.ok) return { ok: true }
    if (put.status === 409) continue
    return put
  }
  return { ok: false, error: 'Senkron çakışması — tekrar dene.' }
}

function byIdMap(list) {
  const m = new Map()
  for (const item of list || []) {
    if (item?.id) m.set(item.id, item)
  }
  return m
}

function mergeAuth(remote, local) {
  const ind = byIdMap(remote.individuals)
  for (const u of local.individuals || []) {
    if (!u?.id) continue
    const prev = ind.get(u.id)
    if (!prev) ind.set(u.id, u)
    else {
      // Daha yeni / onaylı olanı tercih et
      ind.set(u.id, preferRecord(prev, u))
    }
  }
  const cos = byIdMap(remote.companies)
  for (const c of local.companies || []) {
    if (!c?.id) continue
    const prev = cos.get(c.id)
    if (!prev) cos.set(c.id, c)
    else cos.set(c.id, preferCompany(prev, c))
  }
  const lics = byIdMap(remote.licenses)
  for (const l of local.licenses || []) {
    if (!l?.id) continue
    const prev = lics.get(l.id)
    if (!prev) lics.set(l.id, l)
    else lics.set(l.id, preferRecord(prev, l))
  }
  return {
    individuals: [...ind.values()],
    companies: [...cos.values()],
    licenses: [...lics.values()],
  }
}

function preferRecord(a, b) {
  const rank = (s) =>
    s === 'approved' ? 3 : s === 'rejected' ? 2 : s === 'pending' ? 1 : 0
  const ar = rank(a.accountStatus)
  const br = rank(b.accountStatus)
  if (br !== ar) return br > ar ? b : a
  const at = Date.parse(a.updatedAt || a.createdAt || 0) || 0
  const bt = Date.parse(b.updatedAt || b.createdAt || 0) || 0
  return bt >= at ? b : a
}

function preferCompany(a, b) {
  const base = preferRecord(a, b)
  const staffMap = byIdMap(a.staff)
  for (const s of b.staff || []) {
    if (!s?.id) continue
    const prev = staffMap.get(s.id)
    if (!prev) staffMap.set(s.id, s)
    else staffMap.set(s.id, preferRecord(prev, s))
  }
  return { ...base, staff: [...staffMap.values()] }
}

async function getStatus() {
  const token = hasToken()
  if (!token) {
    return {
      ok: true,
      configured: false,
      message: 'Anahtar yok — diğer PC kayıtları bu panele gelmez.',
    }
  }
  const remote = await fetchRemote()
  if (!remote.ok) {
    return {
      ok: false,
      configured: true,
      error: remote.error,
    }
  }
  const pendingInd = remote.db.individuals.filter((u) => u.accountStatus === 'pending').length
  const pendingCo = remote.db.companies.filter((c) => c.accountStatus === 'pending').length
  return {
    ok: true,
    configured: true,
    updatedAt: remote.db.updatedAt,
    pending: pendingInd + pendingCo,
    individuals: remote.db.individuals.length,
    companies: remote.db.companies.length,
  }
}

module.exports = {
  getToken,
  setToken,
  hasToken,
  fetchRemote,
  pullIntoLocal,
  pushFromLocal,
  syncPush,
  getStatus,
  OWNER,
  REPO,
}
