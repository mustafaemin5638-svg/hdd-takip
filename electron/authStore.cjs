const fs = require('fs')
const path = require('path')
const { app } = require('electron')
const crypto = require('crypto')

function dataPath() {
  return path.join(app.getPath('userData'), 'auth-db.json')
}

function machinePath() {
  return path.join(app.getPath('userData'), 'machine.json')
}

function emptyDb() {
  return {
    masterPassword: null,
    individuals: [],
    companies: [],
    licenses: [],
    settings: {
      // Uzaktan lisans paneli için (sonra doldurulacak)
      remoteLicenseUrl: '',
    },
  }
}

function readDb() {
  try {
    const raw = fs.readFileSync(dataPath(), 'utf8')
    const parsed = JSON.parse(raw)
    return {
      masterPassword: parsed.masterPassword ?? null,
      individuals: Array.isArray(parsed.individuals) ? parsed.individuals : [],
      companies: Array.isArray(parsed.companies) ? parsed.companies : [],
      licenses: Array.isArray(parsed.licenses) ? parsed.licenses : [],
      settings: {
        remoteLicenseUrl: parsed.settings?.remoteLicenseUrl || '',
      },
    }
  } catch {
    return emptyDb()
  }
}

function writeDb(db) {
  fs.mkdirSync(path.dirname(dataPath()), { recursive: true })
  fs.writeFileSync(dataPath(), JSON.stringify(db, null, 2), 'utf8')
}

function readMachine() {
  try {
    return JSON.parse(fs.readFileSync(machinePath(), 'utf8'))
  } catch {
    return {
      machineId: crypto.randomUUID(),
      boundCompanyId: null,
      boundCompanyName: null,
      remembered: null,
    }
  }
}

function writeMachine(machine) {
  fs.mkdirSync(path.dirname(machinePath()), { recursive: true })
  fs.writeFileSync(machinePath(), JSON.stringify(machine, null, 2), 'utf8')
}

function normalizeUser(u) {
  return String(u || '').trim()
}

function normalizeCompany(name) {
  return String(name || '').trim()
}

function publicSession(session) {
  if (!session) return null
  return {
    type: session.type,
    userId: session.userId,
    username: session.username,
    displayName: session.displayName,
    companyId: session.companyId || null,
    companyName: session.companyName || null,
    role: session.role || null,
    tenantKey: session.tenantKey,
    license: session.license
      ? {
          plan: session.license.plan,
          status: session.license.status,
          expiresAt: session.license.expiresAt,
          targetType: session.license.targetType,
        }
      : null,
  }
}

/** @type {any} */
let currentSession = null

function getSession() {
  return publicSession(currentSession)
}

function logout() {
  currentSession = null
  return true
}

function getRemembered() {
  return readMachine().remembered || null
}

function clearRemembered() {
  const m = readMachine()
  m.remembered = null
  writeMachine(m)
  return true
}

function setRemembered(payload) {
  const m = readMachine()
  m.remembered = payload
  writeMachine(m)
  return true
}

function getMachineBinding() {
  const m = readMachine()
  return {
    machineId: m.machineId,
    boundCompanyId: m.boundCompanyId,
    boundCompanyName: m.boundCompanyName,
  }
}

function bindCompanyToMachine(companyId, companyName) {
  const m = readMachine()
  if (m.boundCompanyId && m.boundCompanyId !== companyId) {
    return {
      ok: false,
      error: `Bu bilgisayar "${m.boundCompanyName}" firmasına kilitli. Temizlemek için uygulama verisini silmen veya format gerekir.`,
    }
  }
  m.boundCompanyId = companyId
  m.boundCompanyName = companyName
  if (!m.machineId) m.machineId = crypto.randomUUID()
  writeMachine(m)
  return { ok: true }
}

function hasMasterPassword() {
  return Boolean(readDb().masterPassword)
}

function setMasterPassword(password) {
  const pw = String(password || '')
  if (pw.length < 4) return { ok: false, error: 'Yönetici şifresi en az 4 karakter olmalı.' }
  const db = readDb()
  if (db.masterPassword) return { ok: false, error: 'Yönetici şifresi zaten tanımlı.' }
  db.masterPassword = pw
  writeDb(db)
  return { ok: true }
}

function verifyMasterPassword(password) {
  const db = readDb()
  if (!db.masterPassword) return { ok: false, error: 'Önce yönetici şifresi oluştur.' }
  if (db.masterPassword !== String(password || '')) {
    return { ok: false, error: 'Yönetici şifresi hatalı.' }
  }
  return { ok: true }
}

function addDays(isoOrNow, days) {
  const d = new Date(isoOrNow || Date.now())
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function refreshLicenseStatus(lic) {
  if (lic.status === 'suspended') return lic
  const expired = new Date(lic.expiresAt).getTime() <= Date.now()
  return { ...lic, status: expired ? 'expired' : 'active' }
}

function findActiveLicense(db, targetType, targetId) {
  const list = (db.licenses || [])
    .map(refreshLicenseStatus)
    .filter(
      (l) =>
        l.targetType === targetType &&
        l.targetId === targetId &&
        l.status === 'active',
    )
  list.sort((a, b) => new Date(b.expiresAt) - new Date(a.expiresAt))
  return list[0] || null
}

function assertLicense(db, targetType, targetId) {
  const lic = findActiveLicense(db, targetType, targetId)
  if (!lic) {
    return {
      ok: false,
      error:
        'Aktif lisans yok veya süresi dolmuş. Abonelik için yöneticiyle iletişime geç.',
    }
  }
  return { ok: true, license: lic }
}

/** Eski kayıtlarda status yoksa onaylı sayılır. */
function accountStatusOf(entity) {
  const s = entity?.accountStatus
  if (s === 'pending' || s === 'rejected' || s === 'approved') return s
  return 'approved'
}

function assertAccountApproved(entity, label = 'Hesap') {
  const status = accountStatusOf(entity)
  if (status === 'pending') {
    return {
      ok: false,
      error: `${label} onay bekliyor. Yönetici onayından sonra giriş yapabilirsin.`,
    }
  }
  if (status === 'rejected') {
    return {
      ok: false,
      error: `${label} reddedildi. Destek için yöneticiyle iletişime geç.`,
    }
  }
  return { ok: true }
}

function createLicense({
  targetType,
  targetId,
  targetLabel,
  plan,
  days,
  note,
}) {
  const startsAt = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    targetType,
    targetId,
    targetLabel: targetLabel || targetId,
    // individual | company — farklı ürünler, sonra fiyat/özellik ayrılır
    plan: plan === 'yearly' ? 'yearly' : 'monthly',
    status: 'active',
    startsAt,
    expiresAt: addDays(startsAt, days),
    note: note || '',
    updatedAt: startsAt,
  }
}

function grantOrExtendLicense({
  masterPassword,
  targetType,
  targetId,
  targetLabel,
  plan,
}) {
  const check = verifyMasterPassword(masterPassword)
  if (!check.ok) return check
  if (!targetType || !targetId) return { ok: false, error: 'Hedef gerekli.' }

  const days = plan === 'yearly' ? 365 : 30
  const db = readDb()
  const existing = findActiveLicense(db, targetType, targetId)
  if (existing) {
    existing.plan = plan === 'yearly' ? 'yearly' : 'monthly'
    existing.status = 'active'
    existing.expiresAt = addDays(existing.expiresAt, days)
    existing.updatedAt = new Date().toISOString()
    if (targetLabel) existing.targetLabel = targetLabel
    writeDb(db)
    return { ok: true, license: existing }
  }

  const lic = createLicense({
    targetType,
    targetId,
    targetLabel,
    plan,
    days,
  })
  db.licenses.push(lic)
  writeDb(db)
  return { ok: true, license: lic }
}

function setLicenseStatus({ masterPassword, licenseId, status }) {
  const check = verifyMasterPassword(masterPassword)
  if (!check.ok) return check
  const db = readDb()
  const lic = db.licenses.find((l) => l.id === licenseId)
  if (!lic) return { ok: false, error: 'Lisans bulunamadı.' }
  if (!['active', 'suspended', 'expired'].includes(status)) {
    return { ok: false, error: 'Geçersiz durum.' }
  }
  lic.status = status
  lic.updatedAt = new Date().toISOString()
  writeDb(db)
  return { ok: true, license: lic }
}

function listDirectory(masterPassword) {
  const check = verifyMasterPassword(masterPassword)
  if (!check.ok) return check
  const db = readDb()
  return {
    ok: true,
    individuals: db.individuals.map((u) => ({
      id: u.id,
      username: u.username,
      password: u.password,
      createdAt: u.createdAt,
      accountStatus: accountStatusOf(u),
      license: findActiveLicense(db, 'individual', u.id),
    })),
    companies: db.companies.map((c) => ({
      id: c.id,
      name: c.name,
      adminUsername: c.admin.username,
      adminPassword: c.admin.password,
      createdAt: c.createdAt,
      accountStatus: accountStatusOf(c),
      staff: c.staff.map((s) => ({
        id: s.id,
        username: s.username,
        password: s.password,
        accountStatus: accountStatusOf(s),
        createdAt: s.createdAt,
      })),
      license: findActiveLicense(db, 'company', c.id),
    })),
  }
}

function setRemoteLicenseUrl({ masterPassword, url }) {
  const check = verifyMasterPassword(masterPassword)
  if (!check.ok) return check
  const db = readDb()
  db.settings.remoteLicenseUrl = String(url || '').trim()
  writeDb(db)
  return { ok: true }
}

function getRemoteLicenseUrl(masterPassword) {
  const check = verifyMasterPassword(masterPassword)
  if (!check.ok) return check
  return { ok: true, url: readDb().settings.remoteLicenseUrl || '' }
}

function registerIndividual({ username, password }) {
  const user = normalizeUser(username)
  const pw = String(password || '')
  if (!user || !pw) return { ok: false, error: 'Kullanıcı adı ve şifre zorunlu.' }
  if (pw.length < 4) return { ok: false, error: 'Şifre en az 4 karakter olmalı.' }

  const db = readDb()
  if (db.individuals.some((u) => u.username.toLowerCase() === user.toLowerCase())) {
    return { ok: false, error: 'Bu kullanıcı adı zaten var.' }
  }

  const record = {
    id: crypto.randomUUID(),
    username: user,
    password: pw,
    accountStatus: 'pending',
    createdAt: new Date().toISOString(),
  }
  db.individuals.push(record)
  // Lisans yönetici onayından sonra verilir
  writeDb(db)
  return {
    ok: true,
    pending: true,
    message:
      'Kayıt alındı. Yönetici onayından sonra giriş yapabilirsin.',
  }
}

function loginIndividual({ username, password, remember }) {
  const user = normalizeUser(username)
  const pw = String(password || '')
  const db = readDb()
  const found = db.individuals.find(
    (u) => u.username.toLowerCase() === user.toLowerCase() && u.password === pw,
  )
  if (!found) return { ok: false, error: 'Kullanıcı adı veya şifre hatalı.' }

  const approved = assertAccountApproved(found, 'Hesabın')
  if (!approved.ok) return approved

  const lic = assertLicense(db, 'individual', found.id)
  if (!lic.ok) return lic

  currentSession = {
    type: 'individual',
    userId: found.id,
    username: found.username,
    displayName: found.username,
    tenantKey: `individual:${found.id}`,
    license: lic.license,
  }

  if (remember) {
    setRemembered({
      mode: 'individual',
      username: found.username,
      password: pw,
    })
  } else {
    clearRemembered()
  }

  return { ok: true, session: getSession() }
}

function registerCompanyAdmin({ companyName, username, password }) {
  const name = normalizeCompany(companyName)
  const user = normalizeUser(username)
  const pw = String(password || '')
  if (!name || !user || !pw) {
    return { ok: false, error: 'Firma adı, kullanıcı adı ve şifre zorunlu.' }
  }
  if (pw.length < 4) return { ok: false, error: 'Şifre en az 4 karakter olmalı.' }

  const db = readDb()
  if (db.companies.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: 'Bu firma adı zaten kayıtlı.' }
  }

  const company = {
    id: crypto.randomUUID(),
    name,
    admin: {
      id: crypto.randomUUID(),
      username: user,
      password: pw,
    },
    staff: [],
    accountStatus: 'pending',
    createdAt: new Date().toISOString(),
  }
  db.companies.push(company)
  writeDb(db)
  return {
    ok: true,
    companyId: company.id,
    pending: true,
    message:
      'Firma kaydı alındı. Yönetici onayından sonra giriş yapabilirsin.',
  }
}

function loginCompanyAdmin({ companyName, username, password, remember }) {
  const name = normalizeCompany(companyName)
  const user = normalizeUser(username)
  const pw = String(password || '')
  const db = readDb()
  const company = db.companies.find((c) => c.name.toLowerCase() === name.toLowerCase())
  if (!company) return { ok: false, error: 'Firma bulunamadı.' }
  if (
    company.admin.username.toLowerCase() !== user.toLowerCase() ||
    company.admin.password !== pw
  ) {
    return { ok: false, error: 'Yetkili kullanıcı adı veya şifre hatalı.' }
  }

  const approved = assertAccountApproved(company, 'Firma hesabın')
  if (!approved.ok) return approved

  const lic = assertLicense(db, 'company', company.id)
  if (!lic.ok) return lic

  const bind = bindCompanyToMachine(company.id, company.name)
  if (!bind.ok) return bind

  currentSession = {
    type: 'company',
    role: 'admin',
    userId: company.admin.id,
    username: company.admin.username,
    displayName: company.admin.username,
    companyId: company.id,
    companyName: company.name,
    tenantKey: `company:${company.id}`,
    license: lic.license,
  }

  if (remember) {
    setRemembered({
      mode: 'company-admin',
      companyName: company.name,
      username: company.admin.username,
      password: pw,
    })
  } else {
    clearRemembered()
  }

  return { ok: true, session: getSession() }
}

function loginCompanyStaff({ companyName, username, password, remember }) {
  const name = normalizeCompany(companyName)
  const user = normalizeUser(username)
  const pw = String(password || '')
  const db = readDb()
  const company = db.companies.find((c) => c.name.toLowerCase() === name.toLowerCase())
  if (!company) return { ok: false, error: 'Firma bulunamadı.' }

  const staff = company.staff.find(
    (s) => s.username.toLowerCase() === user.toLowerCase() && s.password === pw,
  )
  if (!staff) return { ok: false, error: 'Personel kullanıcı adı veya şifre hatalı.' }

  const companyOk = assertAccountApproved(company, 'Firma hesabı')
  if (!companyOk.ok) return companyOk

  const staffOk = assertAccountApproved(staff, 'Personel hesabın')
  if (!staffOk.ok) return staffOk

  const lic = assertLicense(db, 'company', company.id)
  if (!lic.ok) return lic

  const bind = bindCompanyToMachine(company.id, company.name)
  if (!bind.ok) return bind

  currentSession = {
    type: 'company',
    role: 'staff',
    userId: staff.id,
    username: staff.username,
    displayName: staff.username,
    companyId: company.id,
    companyName: company.name,
    tenantKey: `company:${company.id}`,
    license: lic.license,
  }

  if (remember) {
    setRemembered({
      mode: 'company-staff',
      companyName: company.name,
      username: staff.username,
      password: pw,
    })
  } else {
    clearRemembered()
  }

  return { ok: true, session: getSession() }
}

function addStaff({ username, password }) {
  if (!currentSession || currentSession.role !== 'admin') {
    return { ok: false, error: 'Sadece firma yetkilisi personel ekleyebilir.' }
  }
  const user = normalizeUser(username)
  const pw = String(password || '') || '1234'
  if (!user) return { ok: false, error: 'Personel kullanıcı adı zorunlu.' }

  const db = readDb()
  const company = db.companies.find((c) => c.id === currentSession.companyId)
  if (!company) return { ok: false, error: 'Firma bulunamadı.' }

  const taken =
    company.admin.username.toLowerCase() === user.toLowerCase() ||
    company.staff.some((s) => s.username.toLowerCase() === user.toLowerCase())
  if (taken) return { ok: false, error: 'Bu kullanıcı adı firmada zaten var.' }

  company.staff.push({
    id: crypto.randomUUID(),
    username: user,
    password: pw,
    accountStatus: 'pending',
    createdAt: new Date().toISOString(),
  })
  writeDb(db)
  return {
    ok: true,
    pending: true,
    message: 'Personel eklendi. Yönetici onayından sonra giriş yapabilir.',
  }
}

/**
 * Yönetici onayı / red.
 * targetType: individual | company | staff
 * staff için companyId + targetId (staffId) gerekli.
 * Onayda şahıs/firma için 7 gün deneme lisansı (yoksa) verilir.
 */
function setAccountStatus({
  masterPassword,
  targetType,
  targetId,
  companyId,
  status,
}) {
  const check = verifyMasterPassword(masterPassword)
  if (!check.ok) return check
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return { ok: false, error: 'Geçersiz onay durumu.' }
  }

  const db = readDb()

  if (targetType === 'individual') {
    const u = db.individuals.find((x) => x.id === targetId)
    if (!u) return { ok: false, error: 'Şahıs bulunamadı.' }
    u.accountStatus = status
    if (status === 'approved' && !findActiveLicense(db, 'individual', u.id)) {
      db.licenses.push(
        createLicense({
          targetType: 'individual',
          targetId: u.id,
          targetLabel: u.username,
          plan: 'monthly',
          days: 7,
          note: 'Onay sonrası deneme lisansı',
        }),
      )
    }
    writeDb(db)
    return { ok: true, accountStatus: status }
  }

  if (targetType === 'company') {
    const c = db.companies.find((x) => x.id === targetId)
    if (!c) return { ok: false, error: 'Firma bulunamadı.' }
    c.accountStatus = status
    if (status === 'approved' && !findActiveLicense(db, 'company', c.id)) {
      db.licenses.push(
        createLicense({
          targetType: 'company',
          targetId: c.id,
          targetLabel: c.name,
          plan: 'monthly',
          days: 7,
          note: 'Onay sonrası deneme lisansı',
        }),
      )
    }
    writeDb(db)
    return { ok: true, accountStatus: status }
  }

  if (targetType === 'staff') {
    if (!companyId || !targetId) return { ok: false, error: 'Personel bilgisi eksik.' }
    const c = db.companies.find((x) => x.id === companyId)
    if (!c) return { ok: false, error: 'Firma bulunamadı.' }
    const s = c.staff.find((x) => x.id === targetId)
    if (!s) return { ok: false, error: 'Personel bulunamadı.' }
    s.accountStatus = status
    writeDb(db)
    return { ok: true, accountStatus: status }
  }

  return { ok: false, error: 'Geçersiz hedef tipi.' }
}

function listStaff() {
  if (!currentSession || currentSession.type !== 'company') {
    return { ok: false, error: 'Firma oturumu gerekli.' }
  }
  const db = readDb()
  const company = db.companies.find((c) => c.id === currentSession.companyId)
  if (!company) return { ok: false, error: 'Firma bulunamadı.' }
  return {
    ok: true,
    staff: company.staff.map((s) => ({
      id: s.id,
      username: s.username,
      password: currentSession.role === 'admin' ? s.password : undefined,
      accountStatus: accountStatusOf(s),
    })),
  }
}

function changeOwnPassword({ currentPassword, newPassword }) {
  if (!currentSession) return { ok: false, error: 'Oturum yok.' }
  const pw = String(newPassword || '')
  if (pw.length < 4) return { ok: false, error: 'Yeni şifre en az 4 karakter olmalı.' }

  const db = readDb()

  if (currentSession.type === 'individual') {
    const user = db.individuals.find((u) => u.id === currentSession.userId)
    if (!user || user.password !== String(currentPassword || '')) {
      return { ok: false, error: 'Mevcut şifre hatalı.' }
    }
    user.password = pw
    writeDb(db)
    return { ok: true }
  }

  if (currentSession.type === 'company' && currentSession.role === 'admin') {
    const company = db.companies.find((c) => c.id === currentSession.companyId)
    if (!company || company.admin.password !== String(currentPassword || '')) {
      return { ok: false, error: 'Mevcut şifre hatalı.' }
    }
    company.admin.password = pw
    writeDb(db)
    return { ok: true }
  }

  if (currentSession.type === 'company' && currentSession.role === 'staff') {
    const company = db.companies.find((c) => c.id === currentSession.companyId)
    const staff = company?.staff.find((s) => s.id === currentSession.userId)
    if (!staff || staff.password !== String(currentPassword || '')) {
      return { ok: false, error: 'Mevcut şifre hatalı.' }
    }
    staff.password = pw
    writeDb(db)
    return { ok: true }
  }

  return { ok: false, error: 'Şifre değiştirilemedi.' }
}

function updateIndividual({ masterPassword, id, username, password }) {
  const check = verifyMasterPassword(masterPassword)
  if (!check.ok) return check
  const userName = normalizeUser(username)
  const pw = String(password || '')
  if (!id) return { ok: false, error: 'Kullanıcı id gerekli.' }
  if (!userName || !pw) return { ok: false, error: 'Kullanıcı adı ve şifre zorunlu.' }
  if (pw.length < 4) return { ok: false, error: 'Şifre en az 4 karakter olmalı.' }

  const db = readDb()
  const user = db.individuals.find((u) => u.id === id)
  if (!user) return { ok: false, error: 'Şahıs bulunamadı.' }

  const clash = db.individuals.some(
    (u) => u.id !== id && u.username.toLowerCase() === userName.toLowerCase(),
  )
  if (clash) return { ok: false, error: 'Bu kullanıcı adı başka bir şahısta var.' }

  user.username = userName
  user.password = pw

  for (const lic of db.licenses) {
    if (lic.targetType === 'individual' && lic.targetId === id) {
      lic.targetLabel = userName
    }
  }

  writeDb(db)
  return { ok: true }
}

function updateCompany({
  masterPassword,
  id,
  name,
  adminUsername,
  adminPassword,
}) {
  const check = verifyMasterPassword(masterPassword)
  if (!check.ok) return check
  const companyName = normalizeCompany(name)
  const adminUser = normalizeUser(adminUsername)
  const adminPw = String(adminPassword || '')
  if (!id) return { ok: false, error: 'Firma id gerekli.' }
  if (!companyName || !adminUser || !adminPw) {
    return { ok: false, error: 'Firma adı, yetkili ve şifre zorunlu.' }
  }
  if (adminPw.length < 4) return { ok: false, error: 'Şifre en az 4 karakter olmalı.' }

  const db = readDb()
  const company = db.companies.find((c) => c.id === id)
  if (!company) return { ok: false, error: 'Firma bulunamadı.' }

  const nameClash = db.companies.some(
    (c) => c.id !== id && c.name.toLowerCase() === companyName.toLowerCase(),
  )
  if (nameClash) return { ok: false, error: 'Bu firma adı zaten var.' }

  const userClash = company.staff.some(
    (s) => s.username.toLowerCase() === adminUser.toLowerCase(),
  )
  if (userClash) {
    return { ok: false, error: 'Yetkili kullanıcı adı bir personelle çakışıyor.' }
  }

  company.name = companyName
  company.admin.username = adminUser
  company.admin.password = adminPw

  for (const lic of db.licenses) {
    if (lic.targetType === 'company' && lic.targetId === id) {
      lic.targetLabel = companyName
    }
  }

  const machine = readMachine()
  if (machine.boundCompanyId === id) {
    machine.boundCompanyName = companyName
    writeMachine(machine)
  }

  writeDb(db)
  return { ok: true }
}

function updateStaffMember({
  masterPassword,
  companyId,
  staffId,
  username,
  password,
}) {
  const check = verifyMasterPassword(masterPassword)
  if (!check.ok) return check
  const userName = normalizeUser(username)
  const pw = String(password || '')
  if (!companyId || !staffId) return { ok: false, error: 'Personel bilgisi eksik.' }
  if (!userName || !pw) return { ok: false, error: 'Kullanıcı adı ve şifre zorunlu.' }
  if (pw.length < 4) return { ok: false, error: 'Şifre en az 4 karakter olmalı.' }

  const db = readDb()
  const company = db.companies.find((c) => c.id === companyId)
  if (!company) return { ok: false, error: 'Firma bulunamadı.' }
  const staff = company.staff.find((s) => s.id === staffId)
  if (!staff) return { ok: false, error: 'Personel bulunamadı.' }

  const clash =
    company.admin.username.toLowerCase() === userName.toLowerCase() ||
    company.staff.some(
      (s) => s.id !== staffId && s.username.toLowerCase() === userName.toLowerCase(),
    )
  if (clash) return { ok: false, error: 'Bu kullanıcı adı firmada zaten var.' }

  staff.username = userName
  staff.password = pw
  writeDb(db)
  return { ok: true }
}

function deleteIndividual({ masterPassword, id }) {
  const check = verifyMasterPassword(masterPassword)
  if (!check.ok) return check
  if (!id) return { ok: false, error: 'Kullanıcı id gerekli.' }

  const db = readDb()
  const idx = db.individuals.findIndex((u) => u.id === id)
  if (idx < 0) return { ok: false, error: 'Şahıs bulunamadı.' }
  const removed = db.individuals[idx]
  db.individuals.splice(idx, 1)
  db.licenses = db.licenses.filter(
    (l) => !(l.targetType === 'individual' && l.targetId === id),
  )
  writeDb(db)

  const machine = readMachine()
  if (
    machine.remembered?.mode === 'individual' &&
    machine.remembered?.username === removed.username
  ) {
    machine.remembered = null
    writeMachine(machine)
  }

  return { ok: true }
}

function deleteCompany({ masterPassword, id }) {
  const check = verifyMasterPassword(masterPassword)
  if (!check.ok) return check
  if (!id) return { ok: false, error: 'Firma id gerekli.' }

  const db = readDb()
  const idx = db.companies.findIndex((c) => c.id === id)
  if (idx < 0) return { ok: false, error: 'Firma bulunamadı.' }
  const removed = db.companies[idx]
  db.companies.splice(idx, 1)
  db.licenses = db.licenses.filter(
    (l) => !(l.targetType === 'company' && l.targetId === id),
  )
  writeDb(db)

  const machine = readMachine()
  if (machine.boundCompanyId === id) {
    machine.boundCompanyId = null
    machine.boundCompanyName = null
  }
  if (
    machine.remembered &&
    (machine.remembered.mode === 'company-admin' ||
      machine.remembered.mode === 'company-staff') &&
    machine.remembered.companyName === removed.name
  ) {
    machine.remembered = null
  }
  writeMachine(machine)

  return { ok: true }
}

function deleteStaffMember({ masterPassword, companyId, staffId }) {
  const check = verifyMasterPassword(masterPassword)
  if (!check.ok) return check
  if (!companyId || !staffId) return { ok: false, error: 'Personel bilgisi eksik.' }

  const db = readDb()
  const company = db.companies.find((c) => c.id === companyId)
  if (!company) return { ok: false, error: 'Firma bulunamadı.' }
  const idx = company.staff.findIndex((s) => s.id === staffId)
  if (idx < 0) return { ok: false, error: 'Personel bulunamadı.' }
  const removed = company.staff[idx]
  company.staff.splice(idx, 1)
  writeDb(db)

  const machine = readMachine()
  if (
    machine.remembered?.mode === 'company-staff' &&
    machine.remembered?.username === removed.username &&
    machine.remembered?.companyName === company.name
  ) {
    machine.remembered = null
    writeMachine(machine)
  }

  return { ok: true }
}

function ensureMachineFile() {
  const m = readMachine()
  if (!m.machineId) {
    m.machineId = crypto.randomUUID()
    writeMachine(m)
  }
  return m
}

module.exports = {
  ensureMachineFile,
  getSession,
  logout,
  getRemembered,
  getMachineBinding,
  hasMasterPassword,
  setMasterPassword,
  listDirectory,
  grantOrExtendLicense,
  setLicenseStatus,
  setRemoteLicenseUrl,
  getRemoteLicenseUrl,
  registerIndividual,
  loginIndividual,
  registerCompanyAdmin,
  loginCompanyAdmin,
  loginCompanyStaff,
  addStaff,
  listStaff,
  changeOwnPassword,
  updateIndividual,
  updateCompany,
  updateStaffMember,
  deleteIndividual,
  deleteCompany,
  deleteStaffMember,
  setAccountStatus,
}
