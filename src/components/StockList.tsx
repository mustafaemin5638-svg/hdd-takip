import type { Hdd, HddTur } from '../types/hdd'
import { normalizeTur } from '../types/hdd'
import { listSalePackages } from '../storage/hddStore'
import { buildSaleReceipt } from '../utils/saleReceipt'
import { formatDate } from '../utils/date'
import { SalePackageView } from './SalePackageView'
import { useMemo, useState } from 'react'

interface Props {
  diskler: Hdd[]
  onSell: (serialNumber: string) => void
}

type DurumFilter = 'hepsi' | 'stokta' | 'satildi'
type TurFilter = 'hepsi' | HddTur

export function StockList({ diskler, onSell }: Props) {
  const [durumFilter, setDurumFilter] = useState<DurumFilter>('hepsi')
  const [turFilter, setTurFilter] = useState<TurFilter>('hepsi')
  const [q, setQ] = useState('')
  const [inspectBatch, setInspectBatch] = useState<Hdd[] | null>(null)

  const query = q.trim().toUpperCase()

  const stockRows = useMemo(() => {
    if (durumFilter === 'satildi') return []
    return diskler.filter((d) => {
      if (d.durum !== 'stokta') return false
      const tur = normalizeTur(d.tur)
      if (turFilter !== 'hepsi' && tur !== turFilter) return false
      if (!query) return true
      return (
        d.serialNumber.includes(query) ||
        d.depolama.toUpperCase().includes(query) ||
        (d.distributor?.toUpperCase().includes(query) ?? false)
      )
    })
  }, [diskler, durumFilter, turFilter, query])

  const salePackages = useMemo(() => {
    if (durumFilter === 'stokta') return []
    return listSalePackages(diskler).filter((batch) => {
      if (turFilter !== 'hepsi') {
        const hasTur = batch.some((d) => normalizeTur(d.tur) === turFilter)
        if (!hasTur) return false
      }
      if (!query) return true
      const receipt = buildSaleReceipt(batch)
      const hay = [
        receipt?.musteri,
        receipt?.ozetDepolama,
        receipt?.islemiYapan,
        ...batch.map((d) => d.serialNumber),
      ]
        .join(' ')
        .toUpperCase()
      return hay.includes(query)
    })
  }, [diskler, durumFilter, turFilter, query])

  const stockByTur = useMemo(() => {
    const sifir = stockRows.filter((d) => normalizeTur(d.tur) === 'sifir')
    const ikinci = stockRows.filter((d) => normalizeTur(d.tur) === 'ikinci_el')
    return { sifir, ikinci }
  }, [stockRows])

  function renderStockTable(rows: Hdd[], emptyText: string) {
    if (rows.length === 0) {
      return <p className="empty-list">{emptyText}</p>
    }
    return (
      <div className="table-scroll">
        <table className="disk-table stock-only-table">
          <thead>
            <tr>
              <th>S/N</th>
              <th>Boyut</th>
              <th>Depolama</th>
              <th>Distribütör</th>
              <th>Stoğa giriş</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td className="mono" title={d.serialNumber}>
                  {d.serialNumber}
                </td>
                <td>{d.boyut}</td>
                <td>{d.depolama}</td>
                <td title={d.distributor || undefined}>{d.distributor || '—'}</td>
                <td className="mono">{formatDate(d.stokGirisTarihi)}</td>
                <td className="aksiyon-cell">
                  <button
                    type="button"
                    className="btn small accent"
                    onClick={() => onSell(d.serialNumber)}
                  >
                    Sat
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  function renderSalePackages() {
    if (salePackages.length === 0) {
      return <p className="empty-list">Satış paketi yok.</p>
    }
    return (
      <ul className="sale-package-list">
        {salePackages.map((batch) => {
          const receipt = buildSaleReceipt(batch)
          if (!receipt) return null
          const key = batch[0]?.saleId || `${receipt.musteri}-${receipt.tarih}-${batch[0]?.id}`
          return (
            <li key={key} className="sale-package-card">
              <button
                type="button"
                className="sale-package-card-btn"
                onClick={() => setInspectBatch(batch)}
              >
                <div className="sale-package-card-main">
                  <strong className="sale-package-card-title">{receipt.musteri}</strong>
                  <span className="sale-package-card-meta">
                    Satış · {receipt.tarih} · {receipt.toplam} adet
                  </span>
                  <span className="sale-package-card-deps muted">
                    {receipt.ozetDepolama}
                    {receipt.garanti !== '—' ? ` · Garanti ${receipt.garanti}` : ''}
                  </span>
                  {receipt.islemiYapan !== '—' && (
                    <span className="sale-package-card-seller muted">
                      İşlemi yapan: {receipt.islemiYapan}
                    </span>
                  )}
                </div>
                <span className="btn small primary">İncele</span>
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  const showStock = durumFilter !== 'satildi'
  const showSales = durumFilter !== 'stokta'
  const empty =
    (showStock ? stockRows.length === 0 : true) &&
    (showSales ? salePackages.length === 0 : true)

  return (
    <div className="list-wrap">
      <div className="list-toolbar">
        <div className="tabs" role="tablist" aria-label="Tür">
          {(
            [
              ['hepsi', 'Hepsi'],
              ['sifir', 'Sıfır'],
              ['ikinci_el', '2. El'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              className={turFilter === key ? 'tab active' : 'tab'}
              aria-selected={turFilter === key}
              onClick={() => setTurFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="tabs" role="tablist" aria-label="Durum">
          {(
            [
              ['hepsi', 'Hepsi'],
              ['stokta', 'Stokta'],
              ['satildi', 'Satılan'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              className={durumFilter === key ? 'tab active' : 'tab'}
              aria-selected={durumFilter === key}
              onClick={() => setDurumFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          className="search mono"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ara (müşteri, S/N, depolama…)"
        />
      </div>

      {empty ? (
        <p className="empty-list">Kayıt yok.</p>
      ) : (
        <div className="list-categories">
          {showStock && (
            <>
              {(turFilter === 'hepsi' || turFilter === 'sifir') && (
                <section className="list-category sifir">
                  <h3 className="list-category-title">
                    <span className="badge tur-sifir">Sıfır · Stok</span>
                    <span className="muted">({stockByTur.sifir.length})</span>
                  </h3>
                  {renderStockTable(stockByTur.sifir, 'Stokta sıfır disk yok.')}
                </section>
              )}
              {(turFilter === 'hepsi' || turFilter === 'ikinci_el') && (
                <section className="list-category ikinci_el">
                  <h3 className="list-category-title">
                    <span className="badge tur-ikinci_el">2. El · Stok</span>
                    <span className="muted">({stockByTur.ikinci.length})</span>
                  </h3>
                  {renderStockTable(stockByTur.ikinci, 'Stokta 2. el disk yok.')}
                </section>
              )}
            </>
          )}

          {showSales && (
            <section className="list-category sales">
              <h3 className="list-category-title">
                <span className="badge satildi">Satış paketleri</span>
                <span className="muted">({salePackages.length})</span>
              </h3>
              {renderSalePackages()}
            </section>
          )}
        </div>
      )}

      {inspectBatch && (
        <div
          className="sale-modal-backdrop"
          role="presentation"
          onClick={() => setInspectBatch(null)}
        >
          <div
            className="sale-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Satış paketi"
            onClick={(e) => e.stopPropagation()}
          >
            <SalePackageView
              diskler={inspectBatch}
              onClose={() => setInspectBatch(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
