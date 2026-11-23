/** Tenant bazlı tedarikçi / distribütör listesi */

const LEGACY_KEY = 'hdd-takip-distribitorler'
let tenantKey = 'default'

export function setDistributorTenantKey(key: string) {
  tenantKey = key || 'default'
}

function storageKey() {
  return `${LEGACY_KEY}:${tenantKey}`
}

function normalizeName(name: string): string {
  return String(name || '').trim().replace(/\s+/g, ' ')
}

export function loadDistributors(): string[] {
  try {
    const raw = localStorage.getItem(storageKey())
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return [
      ...new Set(
        parsed
          .map((x) => normalizeName(String(x)))
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b, 'tr'))
  } catch {
    return []
  }
}

function saveDistributors(list: string[]) {
  localStorage.setItem(storageKey(), JSON.stringify(list))
}

export function addDistributor(
  name: string,
): { ok: true; name: string } | { ok: false; error: string } {
  const n = normalizeName(name)
  if (!n) return { ok: false, error: 'Distribütör adı zorunlu.' }
  if (n.length < 2) return { ok: false, error: 'En az 2 karakter gir.' }

  const list = loadDistributors()
  if (list.some((x) => x.toLowerCase() === n.toLowerCase())) {
    return { ok: false, error: 'Bu distribütör zaten kayıtlı.' }
  }
  list.push(n)
  list.sort((a, b) => a.localeCompare(b, 'tr'))
  saveDistributors(list)
  return { ok: true, name: n }
}

export function removeDistributor(
  name: string,
): { ok: true } | { ok: false; error: string } {
  const n = normalizeName(name)
  const before = loadDistributors()
  const list = before.filter((x) => x.toLowerCase() !== n.toLowerCase())
  if (list.length === before.length) {
    return { ok: false, error: 'Distribütör bulunamadı.' }
  }
  saveDistributors(list)
  return { ok: true }
}
