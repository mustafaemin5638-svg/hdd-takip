export type HddBoyut = '2.5"' | '3.5"'

export type HddDurum = 'stokta' | 'satildi'

/** Disk kaynağı / durumu */
export type HddTur = 'sifir' | 'ikinci_el'

export interface Hdd {
  id: string
  serialNumber: string
  boyut: HddBoyut
  depolama: string
  /** Sıfır veya 2. el — eski kayıtlarda yoksa ikinci_el sayılır */
  tur?: HddTur
  /**
   * Garanti süresi (ay) — satış anında verilir.
   * 0 = garanti yok; 1–24 = ay; stoktayken genelde yok.
   */
  garantiAy?: number
  /** Distribütör / tedarikçi — yalnızca sıfır stokta zorunlu */
  distributor?: string
  stokGirisTarihi: string
  durum: HddDurum
  satilanKisi?: string
  satisTarihi?: string
  /** Aynı anda yapılan toplu satışın ortak kimliği */
  saleId?: string
  /** Satışı kaydeden kullanıcı (username) */
  satanKullanici?: string
  /** Satışı kaydeden görünen ad */
  satanDisplayName?: string
  notlar?: string
}

export const BOYUT_SECENEKLERI: HddBoyut[] = ['2.5"', '3.5"']

export const HDD_TUR_SECENEKLERI: { value: HddTur; label: string }[] = [
  { value: 'sifir', label: 'Sıfır' },
  { value: 'ikinci_el', label: '2. El' },
]

/** 1–24 ay (UI’da ayrıca “Garanti yok” = 0) */
export const GARANTI_AY_SECENEKLERI: number[] = Array.from(
  { length: 24 },
  (_, i) => i + 1,
)

export function turLabel(tur?: HddTur): string {
  if (tur === 'sifir') return 'Sıfır'
  return '2. El'
}

export function normalizeTur(tur?: HddTur | null): HddTur {
  return tur === 'sifir' ? 'sifir' : 'ikinci_el'
}

/** Satıştan itibaren garanti bitiş tarihi; yoksa null */
export function garantiBitisTarihi(
  satisTarihi?: string,
  garantiAy?: number,
): Date | null {
  if (!satisTarihi || garantiAy == null || garantiAy <= 0) return null
  const start = new Date(satisTarihi)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start)
  end.setMonth(end.getMonth() + garantiAy)
  return end
}

/** Satılmış diskte garanti hâlâ geçerli mi (yeşil ışık) */
export function isGarantiAktif(disk: Hdd, now: Date = new Date()): boolean {
  if (disk.durum !== 'satildi') return false
  const end = garantiBitisTarihi(disk.satisTarihi, disk.garantiAy)
  if (!end) return false
  return now.getTime() < end.getTime()
}

export function garantiMetin(disk: Hdd): string {
  if (disk.durum !== 'satildi') return '—'
  if (disk.garantiAy == null) return '—'
  if (disk.garantiAy <= 0) return 'Yok'
  return `${disk.garantiAy} ay`
}

export const DEPOLAMA_SECENEKLERI = [
  '160GB',
  '250GB',
  '320GB',
  '500GB',
  '640GB',
  '750GB',
  '1TB',
  '2TB',
  '3TB',
  '4TB',
  '6TB',
  '8TB',
  '10TB',
  '12TB',
  '14TB',
  '16TB',
  '18TB',
  '20TB',
] as const
