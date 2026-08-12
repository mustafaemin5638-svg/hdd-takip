import { GARANTI_AY_SECENEKLERI } from '../types/hdd'
import { findBySerial, sellManyDisks } from '../storage/hddStore'
import { fromDayMonthYear, nowFromPc, toDayMonthYear } from '../utils/date'
import { SerialRows } from './SerialRows'
import { useMemo, useState, type FormEvent } from 'react'

interface Props {
  onChanged: () => void
  initialSerial?: string
}

export function SaleForm({ onChanged, initialSerial = '' }: Props) {
  const [serials, setSerials] = useState<string[]>(
    initialSerial ? [initialSerial, ''] : [''],
  )
  const [satilanKisi, setSatilanKisi] = useState('')
  const [garantiAy, setGarantiAy] = useState(12)
  const [tarih, setTarih] = useState(() => toDayMonthYear())
  const [notlar, setNotlar] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const preview = useMemo(() => {
    return serials.map((raw) => {
      const sn = raw.trim().toUpperCase()
      if (!sn) return null
      const disk = findBySerial(sn)
      if (!disk) return { kind: 'missing' as const, sn }
      if (disk.durum === 'satildi') {
        return {
          kind: 'sold' as const,
          sn,
          text: `Zaten satılmış → ${disk.satilanKisi || '—'}`,
        }
      }
      const tur = disk.tur === 'sifir' ? 'Sıfır' : '2. El'
      return {
        kind: 'ok' as const,
        sn,
        text: `${tur} · ${disk.depolama} · ${disk.boyut} · Stokta`,
      }
    })
  }, [serials])

  const readyCount = preview.filter((p) => p?.kind === 'ok').length

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const satisTarihi = fromDayMonthYear(tarih, nowFromPc())
    if (!satisTarihi) {
      setMessage({ type: 'err', text: 'Tarih GG/AA/YYYY olmalı (örn: 10/08/2026).' })
      return
    }

    const result = sellManyDisks({
      serialNumbers: serials,
      satilanKisi,
      garantiAy,
      satisTarihi,
      notlar,
    })

    if (!result.ok) {
      setMessage({ type: 'err', text: result.error })
      return
    }

    const garantiText = garantiAy <= 0 ? 'garanti yok' : `${garantiAy} ay garanti`
    const parts = [
      `${result.sold.length} satış kaydedildi → ${satilanKisi.trim()} (${garantiText}).`,
    ]
    if (result.failed.length > 0) {
      parts.push(
        `Atlanan ${result.failed.length}: ${result.failed
          .slice(0, 5)
          .map((s) => `${s.serialNumber} (${s.error})`)
          .join(', ')}${result.failed.length > 5 ? '…' : ''}`,
      )
    }

    setMessage({
      type: result.sold.length > 0 ? 'ok' : 'err',
      text: parts.join(' '),
    })

    if (result.sold.length > 0) {
      setSerials([''])
      setNotlar('')
      setTarih(toDayMonthYear())
      onChanged()
    }
  }

  return (
    <form className="panel-form" onSubmit={handleSubmit}>
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
        <label htmlFor="satis-garanti">Garanti süresi</label>
        <select
          id="satis-garanti"
          value={garantiAy}
          onChange={(e) => setGarantiAy(Number(e.target.value))}
        >
          <option value={0}>Garanti yok</option>
          {GARANTI_AY_SECENEKLERI.map((ay) => (
            <option key={ay} value={ay}>
              {ay} ay
            </option>
          ))}
        </select>
      </div>

      <p className="bulk-chip">
        Sadece S/N yaz — özellikler stoktan gelir; garanti bu satışa uygulanır
        {garantiAy <= 0 ? (
          <>
            {' '}
            · <strong>garanti yok</strong>
          </>
        ) : (
          <>
            {' '}
            · <strong>{garantiAy} ay</strong>
          </>
        )}
      </p>

      <SerialRows
        values={serials}
        onChange={setSerials}
        idPrefix="satis-sn"
        placeholder="Satılacak S/N…"
        renderHint={(_value, index) => {
          const info = preview[index]
          if (!info) return null
          const cls =
            info.kind === 'ok'
              ? 'sn-hint ok'
              : info.kind === 'sold'
                ? 'sn-hint warn'
                : 'sn-hint err'
          const text =
            info.kind === 'missing' ? 'Stokta bulunamadı' : info.text
          return <span className={cls}>{text}</span>
        }}
      />

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

      <button type="submit" className="btn accent" disabled={readyCount === 0}>
        {readyCount > 1 ? `${readyCount} Satışı Kaydet` : 'Satışı Kaydet'}
      </button>

      {message && (
        <p className={message.type === 'ok' ? 'msg ok' : 'msg err'} role="status">
          {message.text}
        </p>
      )}
    </form>
  )
}
