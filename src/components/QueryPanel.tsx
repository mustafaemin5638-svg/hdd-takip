import type { Hdd } from '../types/hdd'
import {
  garantiBitisTarihi,
  garantiMetin,
  isGarantiAktif,
  normalizeTur,
  turLabel,
} from '../types/hdd'
import { findBySerial, findSaleBatch } from '../storage/hddStore'
import { formatDate } from '../utils/date'
import { GarantiIsik } from './GarantiIsik'
import { HddEditForm } from './HddEditForm'
import { SalePackageView } from './SalePackageView'
import { useState, type FormEvent } from 'react'

interface Props {
  onChanged?: () => void
}

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

export function QueryPanel({ onChanged }: Props) {
  const [serialNumber, setSerialNumber] = useState('')
  const [result, setResult] = useState<Hdd | null | undefined>(undefined)
  const [batch, setBatch] = useState<Hdd[]>([])
  const [searched, setSearched] = useState('')
  const [editing, setEditing] = useState(false)

  function showDisk(found: Hdd | null) {
    setResult(found)
    setBatch(found && found.durum === 'satildi' ? findSaleBatch(found) : found ? [found] : [])
    setEditing(false)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const sn = serialNumber.trim()
    setSearched(sn.toUpperCase())
    setEditing(false)
    if (!sn) {
      setResult(undefined)
      setBatch([])
      return
    }
    showDisk(findBySerial(sn) ?? null)
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
            <div className="result-head-actions">
              <span className={`badge ${result.durum}`}>
                {result.durum === 'stokta' ? 'Stokta' : 'Satıldı'}
              </span>
              {!editing && (
                <button
                  type="button"
                  className="btn small"
                  onClick={() => setEditing(true)}
                >
                  Düzenle
                </button>
              )}
            </div>
          </div>

          {editing ? (
            <HddEditForm
              key={result.id}
              disk={result}
              onCancel={() => setEditing(false)}
              onSaved={(disk) => {
                setSerialNumber(disk.serialNumber)
                setSearched(disk.serialNumber)
                showDisk(disk)
                onChanged?.()
              }}
            />
          ) : (
            <>
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
                {result.satanDisplayName && (
                  <div className="span-2">
                    <dt>İşlemi yapan</dt>
                    <dd>{result.satanDisplayName}</dd>
                  </div>
                )}
                {result.notlar && (
                  <div className="span-2">
                    <dt>Not</dt>
                    <dd>{result.notlar}</dd>
                  </div>
                )}
              </dl>

              {result.durum === 'satildi' && (
                <SalePackageView diskler={batch.length ? batch : [result]} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
