import type { Hdd } from '../types/hdd'
import { formatDate } from '../utils/date'
import { useMemo, useState } from 'react'

interface Props {
  diskler: Hdd[]
  onSell: (serialNumber: string) => void
}

type Filter = 'hepsi' | 'stokta' | 'satildi'

export function StockList({ diskler, onSell }: Props) {
  const [filter, setFilter] = useState<Filter>('hepsi')
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const query = q.trim().toUpperCase()
    return diskler.filter((d) => {
      if (filter !== 'hepsi' && d.durum !== filter) return false
      if (!query) return true
      return (
        d.serialNumber.includes(query) ||
        d.depolama.toUpperCase().includes(query) ||
        (d.satilanKisi?.toUpperCase().includes(query) ?? false)
      )
    })
  }, [diskler, filter, q])

  return (
    <div className="list-wrap">
      <div className="list-toolbar">
        <div className="tabs" role="tablist">
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
              className={filter === key ? 'tab active' : 'tab'}
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          className="search mono"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Listede ara (S/N, depolama, alıcı)"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="empty-list">Kayıt yok.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>S/N</th>
                <th>Boyut</th>
                <th>Depolama</th>
                <th>Durum</th>
                <th>Stoğa giriş</th>
                <th>Satış / Alıcı</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id}>
                  <td className="mono">{d.serialNumber}</td>
                  <td>{d.boyut}</td>
                  <td>{d.depolama}</td>
                  <td>
                    <span className={`badge ${d.durum}`}>
                      {d.durum === 'stokta' ? 'Stokta' : 'Satıldı'}
                    </span>
                  </td>
                  <td>{formatDate(d.stokGirisTarihi)}</td>
                  <td>
                    {d.durum === 'satildi' ? (
                      <>
                        <div>{d.satilanKisi}</div>
                        <div className="muted">{formatDate(d.satisTarihi)}</div>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {d.durum === 'stokta' && (
                      <button
                        type="button"
                        className="btn small accent"
                        onClick={() => onSell(d.serialNumber)}
                      >
                        Sat
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
