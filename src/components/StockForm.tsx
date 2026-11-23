import type { HddBoyut, HddTur } from '../types/hdd'
import {
  BOYUT_SECENEKLERI,
  DEPOLAMA_SECENEKLERI,
  HDD_TUR_SECENEKLERI,
} from '../types/hdd'
import { addDistributor, loadDistributors } from '../storage/distributorStore'
import { addManyToStock } from '../storage/hddStore'
import { fromDayMonthYear, nowFromPc, toDayMonthYear } from '../utils/date'
import { SerialRows } from './SerialRows'
import { useEffect, useState, type FormEvent } from 'react'

interface Props {
  onChanged: () => void
}

export function StockForm({ onChanged }: Props) {
  const [serials, setSerials] = useState<string[]>([''])
  const [boyut, setBoyut] = useState<HddBoyut>('3.5"')
  const [depolama, setDepolama] = useState<string>('1TB')
  const [ozelDepolama, setOzelDepolama] = useState(false)
  const [tur, setTur] = useState<HddTur>('ikinci_el')
  const [distributor, setDistributor] = useState('')
  const [distributors, setDistributors] = useState<string[]>([])
  const [tarih, setTarih] = useState(() => toDayMonthYear())
  const [notlar, setNotlar] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function refreshDistributors() {
    setDistributors(loadDistributors())
  }

  useEffect(() => {
    refreshDistributors()
  }, [])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const stokGirisTarihi = fromDayMonthYear(tarih, nowFromPc())
    if (!stokGirisTarihi) {
      setMessage({ type: 'err', text: 'Tarih GG/AA/YYYY olmalı (örn: 10/08/2026).' })
      return
    }

    if (tur === 'sifir' && !distributor.trim()) {
      setMessage({ type: 'err', text: 'Sıfır disk için distribütör seç / gir.' })
      return
    }

    const result = addManyToStock({
      serialNumbers: serials,
      boyut,
      depolama,
      tur,
      distributor: tur === 'sifir' ? distributor : undefined,
      stokGirisTarihi,
      notlar,
    })

    if (!result.ok) {
      setMessage({ type: 'err', text: result.error })
      return
    }

    const turText = tur === 'sifir' ? 'Sıfır' : '2. El'
    const parts = [
      `${result.added.length} disk stoğa eklendi (${turText} · ${boyut} · ${depolama}).`,
    ]
    if (result.skipped.length > 0) {
      parts.push(
        `Atlanan ${result.skipped.length}: ${result.skipped
          .slice(0, 5)
          .map((s) => `${s.serialNumber} (${s.error})`)
          .join(', ')}${result.skipped.length > 5 ? '…' : ''}`,
      )
    }

    setMessage({
      type: result.added.length > 0 ? 'ok' : 'err',
      text: parts.join(' '),
    })

    if (result.added.length > 0) {
      if (tur === 'sifir' && distributor.trim()) {
        addDistributor(distributor.trim())
        refreshDistributors()
      }
      setSerials([''])
      setNotlar('')
      setTarih(toDayMonthYear())
      onChanged()
    }
  }

  const readyCount = serials.filter((s) => s.trim()).length

  return (
    <form className="panel-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="stok-tur">Tür</label>
        <select
          id="stok-tur"
          value={tur}
          onChange={(e) => {
            const next = e.target.value as HddTur
            setTur(next)
            if (next === 'ikinci_el') {
              setDistributor('')
              setMessage(null)
            }
          }}
        >
          {HDD_TUR_SECENEKLERI.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {tur === 'sifir' && (
        <div className="field">
          <label htmlFor="stok-distributor">Distribütör / tedarikçi (zorunlu)</label>
          <input
            id="stok-distributor"
            list="stok-distributor-list"
            value={distributor}
            onChange={(e) => setDistributor(e.target.value)}
            placeholder="Seç veya yaz"
            required
          />
          <datalist id="stok-distributor-list">
            {distributors.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          <button type="button" className="linkish" onClick={refreshDistributors}>
            Tedarikçi listesini yenile
          </button>
        </div>
      )}

      <div className="field-row">
        <div className="field">
          <label htmlFor="stok-boyut">Boyut</label>
          <select
            id="stok-boyut"
            value={boyut}
            onChange={(e) => setBoyut(e.target.value as HddBoyut)}
          >
            {BOYUT_SECENEKLERI.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="stok-depolama">Depolama</label>
          {ozelDepolama ? (
            <input
              id="stok-depolama"
              value={depolama}
              onChange={(e) => setDepolama(e.target.value)}
              placeholder="Örn: 1.5TB"
              required
            />
          ) : (
            <select
              id="stok-depolama"
              value={depolama}
              onChange={(e) => setDepolama(e.target.value)}
            >
              {DEPOLAMA_SECENEKLERI.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="linkish"
            onClick={() => {
              setOzelDepolama((v) => !v)
              if (!ozelDepolama) setDepolama('')
              else setDepolama('1TB')
            }}
          >
            {ozelDepolama ? 'Listeden seç' : 'Özel değer gir'}
          </button>
        </div>
      </div>

      <p className="bulk-chip">
        Ortak: <strong>{tur === 'sifir' ? 'Sıfır' : '2. El'}</strong> ·{' '}
        <strong>{boyut}</strong> · <strong>{depolama}</strong>
        {tur === 'sifir' && distributor.trim() ? (
          <>
            {' '}
            · <strong>{distributor.trim()}</strong>
          </>
        ) : null}{' '}
        — tüm S/N’lere uygulanır
      </p>

      <SerialRows
        values={serials}
        onChange={setSerials}
        idPrefix="stok-sn"
        placeholder="S/N yaz, Enter ile sonraki…"
      />

      <div className="field">
        <label htmlFor="stok-tarih">Stoğa giriş tarihi (Gün/Ay/Yıl)</label>
        <div className="inline-actions">
          <input
            id="stok-tarih"
            className="mono"
            inputMode="numeric"
            placeholder="GG/AA/YYYY"
            value={tarih}
            onChange={(e) => setTarih(e.target.value)}
            required
          />
          <button
            type="button"
            className="btn small primary"
            onClick={() => setTarih(toDayMonthYear())}
            title="PC tarihini al"
          >
            Bugün
          </button>
        </div>
      </div>

      <div className="field">
        <label htmlFor="stok-not">Not (opsiyonel)</label>
        <input
          id="stok-not"
          value={notlar}
          onChange={(e) => setNotlar(e.target.value)}
          placeholder="İsteğe bağlı açıklama"
        />
      </div>

      <button type="submit" className="btn primary" disabled={readyCount === 0}>
        {readyCount > 1 ? `${readyCount} Diski Stoğa Ekle` : 'Stoğa Ekle'}
      </button>

      {message && (
        <p className={message.type === 'ok' ? 'msg ok' : 'msg err'} role="status">
          {message.text}
        </p>
      )}
    </form>
  )
}
