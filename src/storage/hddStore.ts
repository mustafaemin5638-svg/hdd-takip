import type { Hdd } from '../types/hdd'

const STORAGE_KEY = 'hdd-takip-verileri'

function normalizeSerial(sn: string): string {
  return sn.trim().toUpperCase()
}

export function loadDiskler(): Hdd[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Hdd[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveDiskler(diskler: Hdd[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(diskler))
}

export function findBySerial(serialNumber: string): Hdd | undefined {
  const sn = normalizeSerial(serialNumber)
  return loadDiskler().find((d) => d.serialNumber === sn)
}

export function addToStock(input: {
  serialNumber: string
  boyut: Hdd['boyut']
  depolama: string
  stokGirisTarihi?: string
  notlar?: string
}): { ok: true; disk: Hdd } | { ok: false; error: string } {
  const serialNumber = normalizeSerial(input.serialNumber)
  if (!serialNumber) {
    return { ok: false, error: 'S/N zorunludur.' }
  }
  if (!input.depolama.trim()) {
    return { ok: false, error: 'Depolama zorunludur.' }
  }

  const stokGirisTarihi = input.stokGirisTarihi || new Date().toISOString()
  if (Number.isNaN(new Date(stokGirisTarihi).getTime())) {
    return { ok: false, error: 'Geçersiz stok giriş tarihi.' }
  }

  const diskler = loadDiskler()
  if (diskler.some((d) => d.serialNumber === serialNumber)) {
    return { ok: false, error: 'Bu S/N zaten sistemde kayıtlı.' }
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
  saveDiskler(diskler)
  return { ok: true, disk }
}

export function sellDisk(input: {
  serialNumber: string
  satilanKisi: string
  satisTarihi?: string
  notlar?: string
}): { ok: true; disk: Hdd } | { ok: false; error: string } {
  const serialNumber = normalizeSerial(input.serialNumber)
  const satilanKisi = input.satilanKisi.trim()

  if (!serialNumber) {
    return { ok: false, error: 'S/N zorunludur.' }
  }
  if (!satilanKisi) {
    return { ok: false, error: 'Alıcı (kime verildi) zorunludur.' }
  }

  const satisTarihi = input.satisTarihi || new Date().toISOString()
  if (Number.isNaN(new Date(satisTarihi).getTime())) {
    return { ok: false, error: 'Geçersiz satış tarihi.' }
  }

  const diskler = loadDiskler()
  const index = diskler.findIndex((d) => d.serialNumber === serialNumber)
  if (index === -1) {
    return { ok: false, error: 'Bu S/N stokta bulunamadı.' }
  }

  const disk = diskler[index]
  if (disk.durum === 'satildi') {
    return {
      ok: false,
      error: `Bu disk zaten satılmış. Alıcı: ${disk.satilanKisi}`,
    }
  }

  const updated: Hdd = {
    ...disk,
    durum: 'satildi',
    satilanKisi,
    satisTarihi,
    notlar: input.notlar?.trim() || disk.notlar,
  }

  diskler[index] = updated
  saveDiskler(diskler)
  return { ok: true, disk: updated }
}

export function getStockCounts(diskler: Hdd[]) {
  return {
    toplam: diskler.length,
    stokta: diskler.filter((d) => d.durum === 'stokta').length,
    satildi: diskler.filter((d) => d.durum === 'satildi').length,
  }
}
