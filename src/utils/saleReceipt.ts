import type { Hdd } from '../types/hdd'
import { garantiMetin, normalizeTur, turLabel } from '../types/hdd'
import { formatDate } from './date'

export interface SaleGroup {
  depolama: string
  boyut: Hdd['boyut']
  turLabel: string
  adet: number
  serials: string[]
}

export interface SaleReceipt {
  saleId?: string
  musteri: string
  tarih: string
  islemiYapan: string
  garanti: string
  toplam: number
  ozetDepolama: string
  groups: SaleGroup[]
  notlar?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildSaleReceipt(diskler: Hdd[]): SaleReceipt | null {
  const sold = diskler.filter((d) => d.durum === 'satildi')
  if (sold.length === 0) return null

  const first = sold[0]
  const map = new Map<string, SaleGroup>()
  for (const d of sold) {
    const tur = turLabel(normalizeTur(d.tur))
    const key = `${d.depolama}||${d.boyut}||${tur}`
    const prev = map.get(key)
    if (prev) {
      prev.adet += 1
      prev.serials.push(d.serialNumber)
    } else {
      map.set(key, {
        depolama: d.depolama,
        boyut: d.boyut,
        turLabel: tur,
        adet: 1,
        serials: [d.serialNumber],
      })
    }
  }

  const groups = [...map.values()].sort((a, b) => {
    const dep = a.depolama.localeCompare(b.depolama, 'tr')
    if (dep !== 0) return dep
    return a.boyut.localeCompare(b.boyut)
  })
  for (const g of groups) {
    g.serials.sort((a, b) => a.localeCompare(b))
  }

  const islemiYapan =
    first.satanDisplayName?.trim() ||
    first.satanKullanici?.trim() ||
    '—'

  return {
    saleId: first.saleId,
    musteri: first.satilanKisi?.trim() || '—',
    tarih: formatDate(first.satisTarihi),
    islemiYapan,
    garanti: garantiMetin(first),
    toplam: sold.length,
    ozetDepolama: [...new Set(groups.map((g) => g.depolama))].join(' · '),
    groups,
    notlar: first.notlar?.trim() || undefined,
  }
}

export function saleReceiptFileName(receipt: SaleReceipt): string {
  const safe = receipt.musteri
    .replace(/[<>:"/\\|?*]+/g, '')
    .trim()
    .slice(0, 40) || 'musteri'
  return `HDD-Satis-${safe}-${receipt.tarih.replace(/\//g, '-')}.pdf`
}

/** Yazdırılabilir / PDF HTML — sade belge düzeni */
export function buildSaleReceiptHtml(receipt: SaleReceipt): string {
  const groupsHtml = receipt.groups
    .map(
      (g) => `
      <section class="grp">
        <h2>${escapeHtml(g.depolama)} <span>· ${escapeHtml(g.boyut)} · ${escapeHtml(g.turLabel)} · ${g.adet} adet</span></h2>
        <p class="sns">${escapeHtml(g.serials.join(' - '))}</p>
      </section>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>Satış Belgesi — ${escapeHtml(receipt.musteri)}</title>
<style>
  @page { margin: 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    color: #122033;
    font-size: 12px;
    line-height: 1.45;
    margin: 0;
    padding: 8px 4px;
  }
  .brand { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #5b6b7c; margin: 0 0 4px; }
  h1 { margin: 0 0 14px; font-size: 20px; letter-spacing: -0.02em; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; margin-bottom: 16px; }
  .meta div { border-bottom: 1px solid #e4e9ef; padding-bottom: 6px; }
  .meta .label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7c8d; }
  .meta .value { font-weight: 650; font-size: 13px; }
  .summary {
    background: #f3f7fa;
    border: 1px solid #d9e3ec;
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 16px;
  }
  .summary strong { font-size: 13px; }
  .grp { margin: 0 0 14px; page-break-inside: avoid; }
  .grp h2 { margin: 0 0 6px; font-size: 13px; }
  .grp h2 span { font-weight: 500; color: #5b6b7c; font-size: 12px; }
  .sns {
    margin: 0;
    font-family: Consolas, "Courier New", monospace;
    font-size: 11px;
    line-height: 1.55;
    word-break: break-word;
  }
  .foot { margin-top: 22px; font-size: 10px; color: #7a8896; }
</style>
</head>
<body>
  <p class="brand">NEXTSOFTWARE · HDD TAKİP</p>
  <h1>Satış Belgesi</h1>
  <div class="meta">
    <div><span class="label">Tarih (Gün/Ay/Yıl)</span><span class="value">${escapeHtml(receipt.tarih)}</span></div>
    <div><span class="label">İşlemi yapan</span><span class="value">${escapeHtml(receipt.islemiYapan)}</span></div>
    <div><span class="label">Müşteri / Alıcı</span><span class="value">${escapeHtml(receipt.musteri)}</span></div>
    <div><span class="label">Garanti</span><span class="value">${escapeHtml(receipt.garanti)}</span></div>
  </div>
  <div class="summary">
    <div><strong>Toplam:</strong> ${receipt.toplam} adet</div>
    <div><strong>Depolamalar:</strong> ${escapeHtml(receipt.ozetDepolama || '—')}</div>
    ${receipt.notlar ? `<div><strong>Not:</strong> ${escapeHtml(receipt.notlar)}</div>` : ''}
  </div>
  ${groupsHtml}
  <p class="foot">Bu belge HDD TAKİP satış kaydından oluşturulmuştur.</p>
</body>
</html>`
}
