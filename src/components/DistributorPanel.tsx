import {
  addDistributor,
  loadDistributors,
  removeDistributor,
} from '../storage/distributorStore'
import { useEffect, useState, type FormEvent } from 'react'

export function DistributorPanel() {
  const [list, setList] = useState<string[]>([])
  const [name, setName] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function refresh() {
    setList(loadDistributors())
  }

  useEffect(() => {
    refresh()
  }, [])

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    const res = addDistributor(name)
    if (!res.ok) {
      setMessage({ type: 'err', text: res.error })
      return
    }
    setMessage({ type: 'ok', text: `"${res.name}" eklendi.` })
    setName('')
    refresh()
  }

  function handleRemove(item: string) {
    if (!window.confirm(`Distribütörü sil: ${item}?`)) return
    const res = removeDistributor(item)
    if (!res.ok) {
      setMessage({ type: 'err', text: res.error })
      return
    }
    setMessage({ type: 'ok', text: `"${item}" silindi.` })
    refresh()
  }

  return (
    <div className="distributor-panel">
      <h2>Tedarikçi / Distribütör</h2>
      <p className="section-desc">
        Sıfır disk stoğa eklerken distribütör zorunlu. 2. el stokta bu alan yok. Garanti
        süresi satış kaydında seçilir.
      </p>
      <form className="panel-form" onSubmit={handleAdd}>
        <div className="field">
          <label htmlFor="dist-name">Distribütör adı</label>
          <div className="inline-actions">
            <input
              id="dist-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: TechData, Ingram…"
              required
            />
            <button type="submit" className="btn primary">
              Ekle
            </button>
          </div>
        </div>
      </form>
      {message && (
        <p className={message.type === 'ok' ? 'msg ok' : 'msg err'}>{message.text}</p>
      )}

      <h3 className="distributor-list-title">Kayıtlı tedarikçiler</h3>
      {list.length === 0 ? (
        <p className="empty-list">Henüz tedarikçi yok.</p>
      ) : (
        <ul className="staff-list">
          {list.map((item) => (
            <li key={item}>
              <span>{item}</span>
              <button
                type="button"
                className="btn small danger"
                onClick={() => handleRemove(item)}
              >
                Sil
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
