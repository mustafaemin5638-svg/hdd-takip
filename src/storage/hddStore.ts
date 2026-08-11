import type { Hdd } from '../types/hdd'

const LEGACY_KEY = 'hdd-takip-verileri'
let tenantKey = 'default'

export function setTenantKey(key: string) {
  tenantKey = key || 'default'
}

function storageKey() {
  return `${LEGACY_KEY}:${tenantKey}`
}

function normalizeSerial(sn: string): string {
  return sn.trim().toUpperCase()
}

export function loadDiskler(): Hdd[] {
  try {
    const raw = localStorage.getItem(storageKey())
    if (!raw) {
      // Eski tek-havuz veriyi yalnızca default tenant'ta bir kez göster
      if (tenantKey === 'default') {
        const legacy = localStorage.getItem(LEGACY_KEY)
        if (legacy) {
          const parsed = JSON.parse(legacy) as Hdd[]
          return Array.isArray(parsed) ? parsed : []
        }
      }
      return []
    }
    const parsed = JSON.parse(raw) as Hdd[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveDiskler(diskler: Hdd[]): void {
  localStorage.setItem(storageKey(), JSON.stringify(diskler))
}

export function findBySerial(serialNumber: string): Hdd | undefined {
  const sn = normalizeSerial(serialNumber)
  return loadDiskler().find((d) => d.serialNumber === sn)
}

export function addManyToStock(input: {
  serialNumbers: string[]
  boyut: Hdd['boyut']
  depolama: string
  stokGirisTarihi?: string
  notlar?: string
}): {
  ok: true
  added: Hdd[]
  skipped: { serialNumber: string; error: string }[]
} | { ok: false; error: string } {
  const unique = [
    ...new Set(
      input.serialNumbers.map(normalizeSerial).filter(Boolean),
    ),
  ]
  if (unique.length === 0) {
    return { ok: false, error: 'En az bir S/N gir.' }
  }
  if (!input.depolama.trim()) {
    return { ok: false, error: 'Depolama zorunludur.' }
  }

  const stokGirisTarihi = input.stokGirisTarihi || new Date().toISOString()
  if (Number.isNaN(new Date(stokGirisTarihi).getTime())) {
    return { ok: false, error: 'Geçersiz stok giriş tarihi.' }
  }

  const diskler = loadDiskler()
  const existing = new Set(diskler.map((d) => d.serialNumber))
  const added: Hdd[] = []
  const skipped: { serialNumber: string; error: string }[] = []

  for (const serialNumber of unique) {
    if (existing.has(serialNumber)) {
      skipped.push({ serialNumber, error: 'Zaten kayıtlı' })
      continue
    }
    const disk: Hdd = {
      id: crypto.randomUUID(),
      serialNumber,
      boyut: input.boyut,
      depolama: input.depolama.trim(),
      stokGirisTarihi,
      durum: 'stokta',
      notlar: input.notlar?.trim() || undefined,
    }
    diskler.unshift(disk)
    existing.add(serialNumber)
    added.push(disk)
  }

  if (added.length > 0) saveDiskler(diskler)
  return { ok: true, added, skipped }
}

export function sellManyDisks(input: {
  serialNumbers: string[]
  satilanKisi: string
  satisTarihi?: string
  notlar?: string
}): {
  ok: true
  sold: Hdd[]
  failed: { serialNumber: string; error: string }[]
} | { ok: false; error: string } {
  const unique = [
    ...new Set(
      input.serialNumbers.map(normalizeSerial).filter(Boolean),
    ),
  ]
  const satilanKisi = input.satilanKisi.trim()

  if (unique.length === 0) {
    return { ok: false, error: 'En az bir S/N gir.' }
  }
  if (!satilanKisi) {
    return { ok: false, error: 'Alıcı (kime verildi) zorunludur.' }
  }

  const satisTarihi = input.satisTarihi || new Date().toISOString()
  if (Number.isNaN(new Date(satisTarihi).getTime())) {
    return { ok: false, error: 'Geçersiz satış tarihi.' }
  }

  const diskler = loadDiskler()
  const sold: Hdd[] = []
  const failed: { serialNumber: string; error: string }[] = []

  for (const serialNumber of unique) {
    const index = diskler.findIndex((d) => d.serialNumber === serialNumber)
    if (index === -1) {
      failed.push({ serialNumber, error: 'Stokta yok' })
      continue
    }
    const disk = diskler[index]
    if (disk.durum === 'satildi') {
      failed.push({
        serialNumber,
        error: `Zaten satılmış (${disk.satilanKisi || '—'})`,
      })
      continue
    }

    const updated: Hdd = {
      ...disk,
      durum: 'satildi',
      satilanKisi,
      satisTarihi,
      notlar: input.notlar?.trim() || disk.notlar,
    }
    diskler[index] = updated
    sold.push(updated)
  }

  if (sold.length > 0) saveDiskler(diskler)
  return { ok: true, sold, failed }
}

export function getStockCounts(diskler: Hdd[]) {
  return {
    toplam: diskler.length,
    stokta: diskler.filter((d) => d.durum === 'stokta').length,
    satildi: diskler.filter((d) => d.durum === 'satildi').length,
  }
}

/** Stokta olan diskleri depolama + boyut grubuna göre say */
export function getInStockSummary(diskler: Hdd[]) {
  const map = new Map<string, { depolama: string; boyut: Hdd['boyut']; adet: number }>()
  for (const d of diskler) {
    if (d.durum !== 'stokta') continue
    const key = `${d.depolama}||${d.boyut}`
    const prev = map.get(key)
    if (prev) prev.adet += 1
    else map.set(key, { depolama: d.depolama, boyut: d.boyut, adet: 1 })
  }
  return [...map.values()].sort((a, b) => {
    if (a.boyut !== b.boyut) return a.boyut.localeCompare(b.boyut)
    return a.depolama.localeCompare(b.depolama)
  })
}

export function parseSerialList(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\n\r,;\t]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map(normalizeSerial),
    ),
  ]
}
