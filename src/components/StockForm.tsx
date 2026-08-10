import type { HddBoyut } from '../types/hdd'
import { BOYUT_SECENEKLERI, DEPOLAMA_SECENEKLERI } from '../types/hdd'
import { addToStock } from '../storage/hddStore'
import { fromDayMonthYear, nowFromPc, toDayMonthYear } from '../utils/date'
import { useState, type FormEvent } from 'react'

interface Props {
  onChanged: () => void
}

export function StockForm({ onChanged }: Props) {
  const [serialNumber, setSerialNumber] = useState('')
  const [boyut, setBoyut] = useState<HddBoyut>('3.5"')
  const [depolama, setDepolama] = useState<string>('500GB')
  const [ozelDepolama, setOzelDepolama] = useState(false)
  const [tarih, setTarih] = useState(() => toDayMonthYear())
  const [notlar, setNotlar] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const stokGirisTarihi = fromDayMonthYear(tarih, nowFromPc())
    if (!stokGirisTarihi) {
      setMessage({ type: 'err', text: 'Tarih GG/AA/YYYY olmalı (örn: 10/08/2026).' })
      return
    }

    const result = addToStock({
      serialNumber,
      boyut,
      depolama,
      stokGirisTarihi,
      notlar,
    })
    if (!result.ok) {
      setMessage({ type: 'err', text: result.error })
      return
    }

    setMessage({ type: 'ok', text: `${result.disk.serialNumber} stoğa eklendi.` })
    setSerialNumber('')
    setNotlar('')
    setTarih(toDayMonthYear())
    onChanged()
  }

  return (
    <form className="panel-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="stok-sn">S/N</label>
        <input
          id="stok-sn"
          className="mono"
          value={serialNumber}
          onChange={(e) => setSerialNumber(e.target.value)}
          placeholder="Örn: WX12A3456789"
          autoComplete="off"
          required
        />
      </div>

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
              else setDepolama('500GB')
            }}
          >
            {ozelDepolama ? 'Listeden seç' : 'Özel değer gir'}
          </button>
        </div>
      </div>

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
        <span className="hint">Format: GG/AA/YYYY — örn. 10/08/2026</span>
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

      <button type="submit" className="btn primary">
        Stoğa Ekle
      </button>

      {message && (
        <p className={message.type === 'ok' ? 'msg ok' : 'msg err'} role="status">
          {message.text}
        </p>
      )}
    </form>
  )
}
