import type { Hdd } from '../types/hdd'
import {
  buildSaleReceipt,
  buildSaleReceiptHtml,
  saleReceiptFileName,
  type SaleReceipt,
} from '../utils/saleReceipt'
import { useState } from 'react'

interface Props {
  diskler: Hdd[]
  onClose?: () => void
  compact?: boolean
}

export function SalePackageView({ diskler, onClose, compact }: Props) {
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfMsg, setPdfMsg] = useState('')
  const receipt = buildSaleReceipt(diskler)

  if (!receipt) {
    return <p className="empty-list">Satış paketi yok.</p>
  }

  async function exportPdf(r: SaleReceipt) {
    if (!window.hddTakip?.savePdf) {
      setPdfMsg('PDF kaydı Electron uygulamasında çalışır.')
      return
    }
    setPdfBusy(true)
    setPdfMsg('')
    try {
      const res = await window.hddTakip.savePdf({
        html: buildSaleReceiptHtml(r),
        defaultFileName: saleReceiptFileName(r),
      })
      if (res.canceled) return
      if (!res.ok) {
        setPdfMsg(res.error || 'PDF kaydedilemedi.')
        return
      }
      setPdfMsg(`PDF kaydedildi: ${res.path}`)
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div className={`sale-package ${compact ? 'compact' : ''}`}>
      <div className="sale-package-head">
        <div>
          <h4>Satış paketi</h4>
          <p className="muted">
            {receipt.musteri} · {receipt.tarih} · {receipt.toplam} adet ·{' '}
            {receipt.ozetDepolama}
          </p>
          <p className="muted">
            İşlemi yapan: {receipt.islemiYapan} · Garanti: {receipt.garanti}
          </p>
          {receipt.notlar && <p className="muted">Not: {receipt.notlar}</p>}
        </div>
        <div className="sale-package-actions">
          <button
            type="button"
            className="btn primary"
            disabled={pdfBusy}
            onClick={() => void exportPdf(receipt)}
          >
            {pdfBusy ? 'PDF…' : 'PDF indir'}
          </button>
          {onClose && (
            <button type="button" className="btn small" onClick={onClose}>
              Kapat
            </button>
          )}
        </div>
      </div>
      <div className="sale-package-groups">
        {receipt.groups.map((g) => (
          <section
            key={`${g.depolama}-${g.boyut}-${g.turLabel}`}
            className="sale-package-group"
          >
            <h5>
              {g.depolama}{' '}
              <span className="muted">
                · {g.boyut} · {g.turLabel} · {g.adet} adet
              </span>
            </h5>
            <p className="mono sale-package-sns">{g.serials.join(' - ')}</p>
          </section>
        ))}
      </div>
      {pdfMsg && <p className="msg ok">{pdfMsg}</p>}
    </div>
  )
}
