import type { Hdd } from '../types/hdd'
import {
  garantiBitisTarihi,
  garantiMetin,
  isGarantiAktif,
  normalizeTur,
  turLabel,
} from '../types/hdd'
import { findBySerial } from '../storage/hddStore'
import { formatDate } from '../utils/date'
import { GarantiIsik } from './GarantiIsik'
import { useState, type FormEvent } from 'react'

function garantiDetay(disk: Hdd): string {
  const base = garantiMetin(disk)
  if (disk.durum !== 'satildi' || !disk.garantiAy || disk.garantiAy <= 0) {
    return base
  }
  if (isGarantiAktif(disk)) {
    const end = garantiBitisTarihi(disk.satisTarihi, disk.garantiAy)
    return `${base} · bitiş ${formatDate(end?.toISOString())}`
  }
  return `${base} · süresi dolmuş`
}

export function QueryPanel() {
  const [serialNumber, setSerialNumber] = useState('')
  const [result, setResult] = useState<Hdd | null | undefined>(undefined)
  const [searched, setSearched] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const sn = serialNumber.trim()
    setSearched(sn.toUpperCase())
    if (!sn) {
      setResult(undefined)
      return
    }
    setResult(findBySerial(sn) ?? null)
  }

  return (
    <div className="query-wrap">
      <form className="panel-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="sorgu-sn">S/N Sorgula</label>
          <div className="inline-actions">
            <input
              id="sorgu-sn"
              className="mono"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="Sorgulamak istediğin S/N"
              autoComplete="off"
            />
            <button type="submit" className="btn primary">
              Sorgula
            </button>
          </div>
        </div>
      </form>

      {result === null && (
        <div className="result empty">
          <p>
            <span className="mono">{searched}</span> sistemde bulunamadı.
          </p>
        </div>
      )}

      {result && (
        <div className="result">
          <div className="result-head">
            <h3 className="mono">{result.serialNumber}</h3>
            <span className={`badge ${result.durum}`}>
              {result.durum === 'stokta' ? 'Stokta' : 'Satıldı'}
            </span>
          </div>

          <dl className="detail-grid">
            <div>
              <dt>Tür</dt>
              <dd>{turLabel(normalizeTur(result.tur))}</dd>
            </div>
            <div>
              <dt>Garanti</dt>
              <dd>
                <span className="garanti-cell">
                  <GarantiIsik disk={result} />
                  <span>{garantiDetay(result)}</span>
                </span>
              </dd>
            </div>
            <div>
              <dt>Distribütör</dt>
              <dd>{result.distributor || '—'}</dd>
            </div>
            <div>
              <dt>Boyut</dt>
              <dd>{result.boyut}</dd>
            </div>
            <div>
              <dt>Depolama</dt>
              <dd>{result.depolama}</dd>
            </div>
            <div>
              <dt>Stoğa giriş (Gün/Ay/Yıl)</dt>
              <dd>{formatDate(result.stokGirisTarihi)}</dd>
            </div>
            <div>
              <dt>Satış tarihi (Gün/Ay/Yıl)</dt>
              <dd>{formatDate(result.satisTarihi)}</dd>
            </div>
            <div className="span-2">
              <dt>Kime verildi</dt>
              <dd>{result.satilanKisi || '—'}</dd>
            </div>
            {result.notlar && (
              <div className="span-2">
                <dt>Not</dt>
                <dd>{result.notlar}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  )
}
