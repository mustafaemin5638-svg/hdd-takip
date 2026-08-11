import type { Hdd } from '../types/hdd'
import { getInStockSummary } from '../storage/hddStore'

interface Props {
  diskler: Hdd[]
}

export function StockSummary({ diskler }: Props) {
  const rows = getInStockSummary(diskler)
  const total = rows.reduce((sum, r) => sum + r.adet, 0)

  return (
    <aside className="stock-summary" aria-label="Stoktaki diskler">
      <div className="stock-summary-head">
        <h3>Stoktaki Diskler</h3>
        <span className="stock-summary-total">{total} adet</span>
      </div>
      {rows.length === 0 ? (
        <p className="empty-list">Stokta disk yok.</p>
      ) : (
        <ul className="stock-summary-list">
          {rows.map((r) => (
            <li key={`${r.depolama}-${r.boyut}`}>
              <span>
                {r.depolama} · {r.boyut}
              </span>
              <strong>{r.adet}</strong>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
