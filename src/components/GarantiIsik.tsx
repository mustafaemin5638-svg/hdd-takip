import type { Hdd } from '../types/hdd'
import { isGarantiAktif } from '../types/hdd'

/** Satılmış diskte kalan garanti: yeşil; yok/bitmiş: kırmızı */
export function GarantiIsik({ disk }: { disk: Hdd }) {
  if (disk.durum !== 'satildi') return null

  const aktif = isGarantiAktif(disk)
  const title = aktif
    ? 'Garanti devam ediyor'
    : disk.garantiAy && disk.garantiAy > 0
      ? 'Garanti süresi dolmuş'
      : 'Garanti yok'

  return (
    <span
      className={`garanti-dot ${aktif ? 'on' : 'off'}`}
      title={title}
      aria-label={title}
      role="img"
    />
  )
}
