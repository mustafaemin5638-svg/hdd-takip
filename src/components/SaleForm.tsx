import { sellDisk } from '../storage/hddStore'
import { fromDayMonthYear, nowFromPc, toDayMonthYear } from '../utils/date'
import { useState, type FormEvent } from 'react'

interface Props {
  onChanged: () => void
  initialSerial?: string
}

export function SaleForm({ onChanged, initialSerial = '' }: Props) {
  const [serialNumber, setSerialNumber] = useState(initialSerial)
  const [satilanKisi, setSatilanKisi] = useState('')
  const [tarih, setTarih] = useState(() => toDayMonthYear())
  const [notlar, setNotlar] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const satisTarihi = fromDayMonthYear(tarih, nowFromPc())
    if (!satisTarihi) {
      setMessage({ type: 'err', text: 'Tarih GG/AA/YYYY olmalı (örn: 10/08/2026).' })
      return
    }

    const result = sellDisk({ serialNumber, satilanKisi, satisTarihi, notlar })
    if (!result.ok) {
      setMessage({ type: 'err', text: result.error })
      return
    }

    setMessage({
      type: 'ok',
      text: `${result.disk.serialNumber} → ${result.disk.satilanKisi} satış kaydedildi.`,
    })
    setSerialNumber('')
    setSatilanKisi('')
    setNotlar('')
    setTarih(toDayMonthYear())
    onChanged()
  }

  return (
    <form className="panel-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="satis-sn">S/N</label>
        <input
          id="satis-sn"
          className="mono"
          value={serialNumber}
          onChange={(e) => setSerialNumber(e.target.value)}
          placeholder="Satılacak diskin S/N"
          autoComplete="off"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="satis-kisi">Kime verildi</label>
        <input
          id="satis-kisi"
          value={satilanKisi}
          onChange={(e) => setSatilanKisi(e.target.value)}
          placeholder="Alıcı adı / firma"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="satis-tarih">Satış tarihi (Gün/Ay/Yıl)</label>
        <div className="inline-actions">
          <input
            id="satis-tarih"
            className="mono"
            inputMode="numeric"
            placeholder="GG/AA/YYYY"
            value={tarih}
            onChange={(e) => setTarih(e.target.value)}
            required
          />
          <button
            type="button"
            className="btn small accent"
            onClick={() => setTarih(toDayMonthYear())}
            title="PC tarihini al"
          >
            Bugün
          </button>
        </div>
        <span className="hint">Format: GG/AA/YYYY — örn. 10/08/2026</span>
      </div>

      <div className="field">
        <label htmlFor="satis-not">Not (opsiyonel)</label>
        <input
          id="satis-not"
          value={notlar}
          onChange={(e) => setNotlar(e.target.value)}
          placeholder="İsteğe bağlı açıklama"
        />
      </div>

      <button type="submit" className="btn accent">
        Satışı Kaydet
      </button>

      {message && (
        <p className={message.type === 'ok' ? 'msg ok' : 'msg err'} role="status">
          {message.text}
        </p>
      )}
    </form>
  )
}
