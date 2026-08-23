import type { Hdd } from '../types/hdd'
import { getInStockSummary } from '../storage/hddStore'

interface Props {
  diskler: Hdd[]
}

export function StockSummary({ diskler }: Props) {
  const rows = getInStockSummary(diskler)
  const sifir = rows.filter((r) => r.tur === 'sifir')
  const ikinci = rows.filter((r) => r.tur === 'ikinci_el')
  const sifirAdet = sifir.reduce((s, r) => s + r.adet, 0)
  const ikinciAdet = ikinci.reduce((s, r) => s + r.adet, 0)
  const total = sifirAdet + ikinciAdet

  function renderGroup(
    title: string,
    kind: 'sifir' | 'ikinci_el',
    group: typeof rows,
    adet: number,
  ) {
    return (
      <section className={`stock-summary-group ${kind}`}>
        <div className="stock-summary-group-head">
          <span className={`badge tur-${kind}`}>{title}</span>
          <span className="stock-summary-group-count">{adet} adet</span>
        </div>
        {group.length === 0 ? (
          <p className="stock-summary-empty">Yok</p>
        ) : (
          <ul className="stock-summary-list">
            {group.map((r) => (
              <li key={`${r.depolama}-${r.boyut}-${r.tur}`}>
                <span>
                  {r.depolama} · {r.boyut}
                </span>
                <strong>{r.adet}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    )
  }

  return (
    <aside className="stock-summary" aria-label="Stoktaki diskler">
      <div className="stock-summary-head">
        <h3>Stoktaki Diskler</h3>
        <span className="stock-summary-total">{total} adet</span>
      </div>
      {total === 0 ? (
        <p className="empty-list">Stokta disk yok.</p>
      ) : (
        <div className="stock-summary-groups">
          {renderGroup('Sıfır', 'sifir', sifir, sifirAdet)}
          {renderGroup('2. El', 'ikinci_el', ikinci, ikinciAdet)}
        </div>
      )}
    </aside>
  )
}
