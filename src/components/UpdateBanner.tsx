import { useEffect, useState } from 'react'
import type { UpdaterStatus } from '../types/electron'

export function UpdateBanner() {
  const [status, setStatus] = useState<UpdaterStatus | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!window.hddTakip) return
    return window.hddTakip.onUpdaterStatus((payload) => {
      setStatus(payload)
      if (payload.status === 'downloaded' || payload.status === 'error') {
        setBusy(false)
      }
    })
  }, [])

  if (!window.hddTakip || !status) return null
  if (status.status === 'not-available' || status.status === 'checking') return null

  async function handleDownload() {
    if (!window.hddTakip) return
    setBusy(true)
    try {
      await window.hddTakip.downloadUpdate()
    } catch {
      setBusy(false)
      setStatus({ status: 'error', message: 'Güncelleme indirilemedi.' })
    }
  }

  async function handleInstall() {
    if (!window.hddTakip) return
    setBusy(true)
    await window.hddTakip.installUpdate()
  }

  return (
    <div className="update-banner" role="status">
      {status.status === 'available' && (
        <>
          <div>
            <strong>Yeni sürüm hazır</strong>
            <span className="update-meta">v{status.version} — uygulama içinden indirilir</span>
          </div>
          <button
            type="button"
            className="btn small primary"
            disabled={busy}
            onClick={handleDownload}
          >
            {busy ? 'Hazırlanıyor…' : 'İndir ve kur'}
          </button>
        </>
      )}

      {status.status === 'downloading' && (
        <>
          <div>
            <strong>Güncelleme indiriliyor</strong>
            <span className="update-meta">%{Math.round(status.percent || 0)}</span>
          </div>
          <div className="update-progress">
            <div
              className="update-progress-bar"
              style={{ width: `${Math.min(100, Math.max(0, status.percent || 0))}%` }}
            />
          </div>
        </>
      )}

      {status.status === 'downloaded' && (
        <>
          <div>
            <strong>İndirme tamam</strong>
            <span className="update-meta">
              v{status.version} — kurulum arka planda sessiz yapılır
            </span>
          </div>
          <button
            type="button"
            className="btn small accent"
            disabled={busy}
            onClick={handleInstall}
          >
            Kur ve yeniden başlat
          </button>
        </>
      )}

      {status.status === 'error' && (
        <div>
          <strong>Güncelleme hatası</strong>
          <span className="update-meta">{status.message}</span>
        </div>
      )}
    </div>
  )
}
