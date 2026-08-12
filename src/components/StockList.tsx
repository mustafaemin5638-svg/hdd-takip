import type { Hdd, HddTur } from '../types/hdd'
import { garantiMetin, normalizeTur } from '../types/hdd'
import { formatDate } from '../utils/date'
import { GarantiIsik } from './GarantiIsik'
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

  const filtered = useMemo(() => {
    const query = q.trim().toUpperCase()
    return diskler.filter((d) => {
      if (durumFilter !== 'hepsi' && d.durum !== durumFilter) return false
      const tur = normalizeTur(d.tur)
      if (turFilter !== 'hepsi' && tur !== turFilter) return false
      if (!query) return true
      return (
        d.serialNumber.includes(query) ||
        d.depolama.toUpperCase().includes(query) ||
        (d.distributor?.toUpperCase().includes(query) ?? false) ||
        (d.satilanKisi?.toUpperCase().includes(query) ?? false)
      )
    })
  }, [diskler, durumFilter, turFilter, q])

  const grouped = useMemo(() => {
    const sifir = filtered.filter((d) => normalizeTur(d.tur) === 'sifir')
    const ikinci = filtered.filter((d) => normalizeTur(d.tur) === 'ikinci_el')
    return { sifir, ikinci }
  }, [filtered])

  function renderTable(rows: Hdd[], emptyText: string) {
    if (rows.length === 0) {
      return <p className="empty-list">{emptyText}</p>
    }
    return (
      <div className="table-scroll">
        <table className="disk-table">
          <colgroup>
            <col className="col-sn" />
            <col className="col-boyut" />
            <col className="col-depolama" />
            <col className="col-garanti" />
            <col className="col-dist" />
            <col className="col-durum" />
            <col className="col-tarih" />
            <col className="col-satis" />
            <col className="col-aksiyon" />
          </colgroup>
          <thead>
            <tr>
              <th>S/N</th>
              <th>Boyut</th>
              <th>Depolama</th>
              <th>Garanti</th>
              <th>Distribütör</th>
              <th>Durum</th>
              <th>Stoğa giriş</th>
              <th>Satış / Alıcı</th>
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
                <td>
                  <span className="garanti-cell">
                    <GarantiIsik disk={d} />
                    <span>{garantiMetin(d)}</span>
                  </span>
                </td>
                <td title={d.distributor || undefined}>{d.distributor || '—'}</td>
                <td>
                  <span className={`badge ${d.durum}`}>
                    {d.durum === 'stokta' ? 'Stokta' : 'Satıldı'}
                  </span>
                </td>
                <td className="mono">{formatDate(d.stokGirisTarihi)}</td>
                <td>
                  {d.durum === 'satildi' ? (
                    <span className="satis-cell">
                      <span className="satis-kisi" title={d.satilanKisi}>
                        {d.satilanKisi}
                      </span>
                      <span className="muted mono">{formatDate(d.satisTarihi)}</span>
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="aksiyon-cell">
                  {d.durum === 'stokta' ? (
                    <button
                      type="button"
                      className="btn small accent"
                      onClick={() => onSell(d.serialNumber)}
                    >
                      Sat
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

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
          placeholder="Ara (S/N, depolama, distribütör, alıcı)"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="empty-list">Kayıt yok.</p>
      ) : turFilter === 'hepsi' ? (
        <div className="list-categories">
          <section className="list-category sifir">
            <h3 className="list-category-title">
              <span className="badge tur-sifir">Sıfır</span>
              <span className="muted">({grouped.sifir.length})</span>
            </h3>
            {renderTable(grouped.sifir, 'Sıfır disk yok.')}
          </section>
          <section className="list-category ikinci_el">
            <h3 className="list-category-title">
              <span className="badge tur-ikinci_el">2. El</span>
              <span className="muted">({grouped.ikinci.length})</span>
            </h3>
            {renderTable(grouped.ikinci, '2. el disk yok.')}
          </section>
        </div>
      ) : (
        renderTable(filtered, 'Kayıt yok.')
      )}
    </div>
  )
}
