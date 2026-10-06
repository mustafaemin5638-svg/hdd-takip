import type { Hdd, HddBoyut, HddTur } from '../types/hdd'
import {
  BOYUT_SECENEKLERI,
  DEPOLAMA_SECENEKLERI,
  GARANTI_AY_SECENEKLERI,
  HDD_TUR_SECENEKLERI,
  normalizeTur,
} from '../types/hdd'
import { addDistributor, loadDistributors } from '../storage/distributorStore'
import { updateDiskBySerial } from '../storage/hddStore'
import { fromDayMonthYear, nowFromPc, toDayMonthYear } from '../utils/date'
import { useEffect, useState, type FormEvent } from 'react'

interface Props {
  disk: Hdd
  onSaved: (disk: Hdd) => void
  onCancel: () => void
}

export function HddEditForm({ disk, onSaved, onCancel }: Props) {
  const [serialNumber, setSerialNumber] = useState(disk.serialNumber)
  const [boyut, setBoyut] = useState<HddBoyut>(disk.boyut)
  const [depolama, setDepolama] = useState(disk.depolama)
  const [ozelDepolama, setOzelDepolama] = useState(
    () => !DEPOLAMA_SECENEKLERI.includes(disk.depolama as (typeof DEPOLAMA_SECENEKLERI)[number]),
  )
  const [tur, setTur] = useState<HddTur>(normalizeTur(disk.tur))
  const [distributor, setDistributor] = useState(disk.distributor || '')
  const [distributors, setDistributors] = useState<string[]>([])
  const [stokTarih, setStokTarih] = useState(() =>
    toDayMonthYear(new Date(disk.stokGirisTarihi)),
  )
  const [satilanKisi, setSatilanKisi] = useState(disk.satilanKisi || '')
  const [garantiAy, setGarantiAy] = useState(disk.garantiAy ?? 0)
  const [satisTarih, setSatisTarih] = useState(() =>
    disk.satisTarihi ? toDayMonthYear(new Date(disk.satisTarihi)) : toDayMonthYear(),
  )
  const [notlar, setNotlar] = useState(disk.notlar || '')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  )

  const sold = disk.durum === 'satildi'

  useEffect(() => {
    setDistributors(loadDistributors())
  }, [])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const stokGirisTarihi = fromDayMonthYear(stokTarih, nowFromPc())
    if (!stokGirisTarihi) {
      setMessage({ type: 'err', text: 'Stok tarihi GG/AA/YYYY olmalı.' })
      return
    }

    let satisTarihi: string | undefined
    if (sold) {
      const prev = disk.satisTarihi ? new Date(disk.satisTarihi) : nowFromPc()
      const iso = fromDayMonthYear(satisTarih, Number.isNaN(prev.getTime()) ? nowFromPc() : prev)
      if (!iso) {
        setMessage({ type: 'err', text: 'Satış tarihi GG/AA/YYYY olmalı.' })
        return
      }
      satisTarihi = iso
    }

    const result = updateDiskBySerial(disk.serialNumber, {
      serialNumber,
      boyut,
      depolama,
      tur,
      distributor: tur === 'sifir' ? distributor : undefined,
      stokGirisTarihi,
      notlar,
      satilanKisi: sold ? satilanKisi : undefined,
      satisTarihi,
      garantiAy: sold ? garantiAy : undefined,
    })

    if (!result.ok) {
      setMessage({ type: 'err', text: result.error })
      return
    }

    if (tur === 'sifir' && distributor.trim()) {
      addDistributor(distributor.trim())
      setDistributors(loadDistributors())
    }

    setMessage({ type: 'ok', text: 'Kayıt güncellendi.' })
    onSaved(result.disk)
  }

  return (
    <form className="panel-form edit-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="edit-sn">S/N</label>
        <input
          id="edit-sn"
          className="mono"
          value={serialNumber}
          onChange={(e) => setSerialNumber(e.target.value)}
          autoComplete="off"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="edit-tur">Tür</label>
        <select
          id="edit-tur"
          value={tur}
          onChange={(e) => {
            const next = e.target.value as HddTur
            setTur(next)
            if (next === 'ikinci_el') setDistributor('')
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
          <label htmlFor="edit-distributor">Distribütör / tedarikçi</label>
          <input
            id="edit-distributor"
            list="edit-distributor-list"
            value={distributor}
            onChange={(e) => setDistributor(e.target.value)}
            placeholder="Seç veya yaz"
            required
          />
          <datalist id="edit-distributor-list">
            {distributors.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>
      )}

      <div className="field-row">
        <div className="field">
          <label htmlFor="edit-boyut">Boyut</label>
          <select
            id="edit-boyut"
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
          <label htmlFor="edit-depolama">Depolama</label>
          {ozelDepolama ? (
            <input
              id="edit-depolama"
              value={depolama}
              onChange={(e) => setDepolama(e.target.value)}
              placeholder="Örn: 1.5TB"
              required
            />
          ) : (
            <select
              id="edit-depolama"
              value={depolama}
              onChange={(e) => setDepolama(e.target.value)}
            >
              {!DEPOLAMA_SECENEKLERI.includes(
                depolama as (typeof DEPOLAMA_SECENEKLERI)[number],
              ) && <option value={depolama}>{depolama}</option>}
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
              if (!ozelDepolama) setDepolama(depolama)
              else if (
                !DEPOLAMA_SECENEKLERI.includes(
                  depolama as (typeof DEPOLAMA_SECENEKLERI)[number],
                )
              ) {
                setDepolama('500GB')
              }
            }}
          >
            {ozelDepolama ? 'Listeden seç' : 'Özel değer gir'}
          </button>
        </div>
      </div>

      <div className="field">
        <label htmlFor="edit-stok-tarih">Stoğa giriş tarihi (Gün/Ay/Yıl)</label>
        <div className="inline-actions">
          <input
            id="edit-stok-tarih"
            className="mono"
            inputMode="numeric"
            placeholder="GG/AA/YYYY"
            value={stokTarih}
            onChange={(e) => setStokTarih(e.target.value)}
            required
          />
          <button
            type="button"
            className="btn small primary"
            onClick={() => setStokTarih(toDayMonthYear())}
          >
            Bugün
          </button>
        </div>
      </div>

      {sold && (
        <>
          <div className="field">
            <label htmlFor="edit-kisi">Kime verildi</label>
            <input
              id="edit-kisi"
              value={satilanKisi}
              onChange={(e) => setSatilanKisi(e.target.value)}
              placeholder="Alıcı adı / firma"
              required
            />
            <p className="hint">Aynı satış paketindeki diğer disklere de uygulanır.</p>
          </div>

          <div className="field">
            <label htmlFor="edit-garanti">Garanti süresi</label>
            <select
              id="edit-garanti"
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

          <div className="field">
            <label htmlFor="edit-satis-tarih">Satış tarihi (Gün/Ay/Yıl)</label>
            <div className="inline-actions">
              <input
                id="edit-satis-tarih"
                className="mono"
                inputMode="numeric"
                placeholder="GG/AA/YYYY"
                value={satisTarih}
                onChange={(e) => setSatisTarih(e.target.value)}
                required
              />
              <button
                type="button"
                className="btn small primary"
                onClick={() => setSatisTarih(toDayMonthYear())}
              >
                Bugün
              </button>
            </div>
          </div>
        </>
      )}

      <div className="field">
        <label htmlFor="edit-not">Not</label>
        <input
          id="edit-not"
          value={notlar}
          onChange={(e) => setNotlar(e.target.value)}
          placeholder="İsteğe bağlı"
        />
      </div>

      <div className="inline-actions">
        <button type="submit" className="btn primary">
          Kaydet
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          İptal
        </button>
      </div>

      {message && (
        <p className={message.type === 'ok' ? 'msg ok' : 'msg err'} role="status">
          {message.text}
        </p>
      )}
    </form>
  )
}
