import type { Hdd, HddTur } from '../types/hdd'
import { normalizeTur } from '../types/hdd'

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

function normalizeDisk(d: Hdd): Hdd {
  return {
    ...d,
    tur: normalizeTur(d.tur),
    garantiAy:
      typeof d.garantiAy === 'number' &&
      Number.isInteger(d.garantiAy) &&
      d.garantiAy >= 0 &&
      d.garantiAy <= 24
        ? d.garantiAy
        : undefined,
    distributor: d.distributor?.trim() || undefined,
  }
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
          return Array.isArray(parsed) ? parsed.map(normalizeDisk) : []
        }
      }
      return []
    }
    const parsed = JSON.parse(raw) as Hdd[]
    return Array.isArray(parsed) ? parsed.map(normalizeDisk) : []
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
  tur: HddTur
  distributor?: string
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

  const tur = normalizeTur(input.tur)
  const distributor =
    tur === 'sifir' ? String(input.distributor || '').trim() : ''
  if (tur === 'sifir' && !distributor) {
    return { ok: false, error: 'Sıfır disk için distribütör zorunlu.' }
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
      tur,
      distributor: distributor || undefined,
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
  /** 0 = garanti yok, 1–24 = ay */
  garantiAy: number
  satisTarihi?: string
  notlar?: string
  satanKullanici?: string
  satanDisplayName?: string
}): {
  ok: true
  sold: Hdd[]
  failed: { serialNumber: string; error: string }[]
  saleId?: string
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

  const garantiAy = Number(input.garantiAy)
  if (!Number.isInteger(garantiAy) || garantiAy < 0 || garantiAy > 24) {
    return { ok: false, error: 'Garanti: Yok veya 1–24 ay seç.' }
  }

  const satisTarihi = input.satisTarihi || new Date().toISOString()
  if (Number.isNaN(new Date(satisTarihi).getTime())) {
    return { ok: false, error: 'Geçersiz satış tarihi.' }
  }

  const saleId = crypto.randomUUID()
  const satanKullanici = input.satanKullanici?.trim() || undefined
  const satanDisplayName = input.satanDisplayName?.trim() || undefined

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
      garantiAy,
      saleId,
      satanKullanici,
      satanDisplayName,
      notlar: input.notlar?.trim() || disk.notlar,
    }
    diskler[index] = updated
    sold.push(updated)
  }

  if (sold.length > 0) saveDiskler(diskler)
  return { ok: true, sold, failed, saleId: sold.length > 0 ? saleId : undefined }
}

/** Aynı satış paketindeki diskler (saleId veya eski kayıtlarda alıcı+gün) */
export function findSaleBatch(anchor: Hdd, pool?: Hdd[]): Hdd[] {
  if (anchor.durum !== 'satildi') return [anchor]
  const all = (pool ?? loadDiskler()).filter((d) => d.durum === 'satildi')
  const key = salePackageKey(anchor)
  const batch = all.filter((d) => salePackageKey(d) === key)
  if (batch.length === 0) return [anchor]
  return sortSaleBatch(batch)
}

/** Tüm satılmış diskleri satış paketlerine ayırır (liste için tek satır) */
export function listSalePackages(diskler: Hdd[]): Hdd[][] {
  const sold = diskler.filter((d) => d.durum === 'satildi')
  const map = new Map<string, Hdd[]>()
  for (const d of sold) {
    const key = salePackageKey(d)
    const arr = map.get(key)
    if (arr) arr.push(d)
    else map.set(key, [d])
  }
  return [...map.values()]
    .map(sortSaleBatch)
    .sort((a, b) => {
      const ta = new Date(a[0]?.satisTarihi || 0).getTime()
      const tb = new Date(b[0]?.satisTarihi || 0).getTime()
      return tb - ta
    })
}

export function salePackageKey(d: Hdd): string {
  if (d.saleId) return `id:${d.saleId}`
  const buyer = (d.satilanKisi || '').trim().toUpperCase()
  return `legacy:${buyer}|${dayKey(d.satisTarihi)}`
}

function sortSaleBatch(batch: Hdd[]): Hdd[] {
  return [...batch].sort((a, b) => {
    const dep = a.depolama.localeCompare(b.depolama, 'tr')
    if (dep !== 0) return dep
    return a.serialNumber.localeCompare(b.serialNumber)
  })
}

function dayKey(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
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
  const map = new Map<
    string,
    { depolama: string; boyut: Hdd['boyut']; tur: HddTur; adet: number }
  >()
  for (const d of diskler) {
    if (d.durum !== 'stokta') continue
    const tur = normalizeTur(d.tur)
    const key = `${d.depolama}||${d.boyut}||${tur}`
    const prev = map.get(key)
    if (prev) prev.adet += 1
    else map.set(key, { depolama: d.depolama, boyut: d.boyut, tur, adet: 1 })
  }
  return [...map.values()].sort((a, b) => {
    if (a.tur !== b.tur) return a.tur === 'sifir' ? -1 : 1
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
