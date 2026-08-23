import { useEffect, useState } from 'react'
import type { UpdaterStatus } from '../types/electron'

/** Giriş ekranı sol alt — oturum açmadan güncelleme */
export function LoginUpdateBar() {
  const [version, setVersion] = useState('')
  const [status, setStatus] = useState<UpdaterStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState('')

  useEffect(() => {
    window.hddTakip?.getVersion?.().then(setVersion).catch(() => {})
  }, [])

  useEffect(() => {
    if (!window.hddTakip?.onUpdaterStatus) return
    return window.hddTakip.onUpdaterStatus((payload) => {
      setStatus(payload)
      if (payload.status === 'checking') {
        setHint('PC taranıyor…')
        setBusy(true)
      } else if (payload.status === 'not-available') {
        setHint(
          version
            ? `Mevcut güncelleme yok (v${version}).`
            : 'Mevcut güncelleme yok.',
        )
        setBusy(false)
      } else if (payload.status === 'available') {
        setHint(`Yeni sürüm bulundu: v${payload.version}`)
        setBusy(false)
      } else if (payload.status === 'downloading') {
        setHint(`İndiriliyor… %${Math.round(payload.percent || 0)}`)
        setBusy(true)
      } else if (payload.status === 'downloaded') {
        setHint(`v${payload.version} indirildi — kuruluma hazır.`)
        setBusy(false)
      } else if (payload.status === 'error') {
        setHint(payload.message || 'Güncelleme hatası.')
        setBusy(false)
      }
    })
  }, [version])

  async function sorgula() {
    if (!window.hddTakip?.checkForUpdates) {
      setHint('Güncelleme yalnızca kurulu uygulamada çalışır.')
      return
    }
    setBusy(true)
    setHint('PC taranıyor…')
    setStatus({ status: 'checking' })
    try {
      const result = await window.hddTakip.checkForUpdates()
      const current = result?.current || version
      if (current) setVersion(current)
      if (result?.available && result.version) {
        setStatus({ status: 'available', version: result.version })
        setHint(`Yeni sürüm bulundu: v${result.version}`)
      } else {
        setStatus({ status: 'not-available' })
        setHint(
          current
            ? `Mevcut güncelleme yok (v${current}).`
            : 'Mevcut güncelleme yok.',
        )
      }
    } catch (err) {
      setStatus({
        status: 'error',
        message: err instanceof Error ? err.message : 'Kontrol başarısız.',
      })
      setHint(err instanceof Error ? err.message : 'Kontrol başarısız.')
    } finally {
      setBusy(false)
    }
  }

  async function simdiGuncelle() {
    if (!window.hddTakip?.downloadUpdate) return
    setBusy(true)
    setHint('Güncelleme başlatılıyor…')
    try {
      await window.hddTakip.downloadUpdate()
    } catch (err) {
      setBusy(false)
      const msg =
        err instanceof Error ? err.message : 'Güncelleme indirilemedi.'
      setStatus({ status: 'error', message: msg })
      setHint(msg)
    }
  }

  async function kur() {
    if (!window.hddTakip?.installUpdate) return
    setBusy(true)
    setHint('Kuruluyor, uygulama yeniden başlayacak…')
    try {
      await window.hddTakip.installUpdate()
    } catch (err) {
      setBusy(false)
      const msg = err instanceof Error ? err.message : 'Kurulum başarısız.'
      setStatus({ status: 'error', message: msg })
      setHint(msg)
    }
  }

  const available = status?.status === 'available'
  const downloading = status?.status === 'downloading'
  const downloaded = status?.status === 'downloaded'
  const percent = downloading ? Math.round(status.percent || 0) : 0

  return (
    <div className="login-update-dock" role="region" aria-label="Güncelleme">
      <p className="login-update-ver">{version ? `Sürüm v${version}` : 'HDD TAKİP'}</p>

      {hint && <p className="login-update-hint">{hint}</p>}

      {downloading && (
        <div className="login-update-progress" aria-hidden>
          <div className="login-update-progress-bar" style={{ width: `${percent}%` }} />
        </div>
      )}

      {!available && !downloading && !downloaded && (
        <button
          type="button"
          className="btn small login-update-btn"
          disabled={busy}
          onClick={() => void sorgula()}
        >
          {busy ? 'Taranıyor…' : 'Güncelleme sorgula'}
        </button>
      )}

      {available && (
        <button
          type="button"
          className="btn small accent login-update-btn"
          disabled={busy}
          onClick={() => void simdiGuncelle()}
        >
          Şimdi güncelle
        </button>
      )}

      {downloaded && (
        <button
          type="button"
          className="btn small primary login-update-btn"
          disabled={busy}
          onClick={() => void kur()}
        >
          Kur ve yeniden başlat
        </button>
      )}
    </div>
  )
}
