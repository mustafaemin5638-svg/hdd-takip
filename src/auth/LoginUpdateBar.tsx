import { useEffect, useState } from 'react'
import type { UpdaterStatus } from '../types/electron'

function friendlyUpdateError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || '')
  if (/mevcut güncelleme yok/i.test(raw)) return 'Mevcut güncelleme yok.'
  const m = raw.match(/Error: (.+)$/i)
  if (m?.[1]) return m[1].trim()
  if (/invoking remote method/i.test(raw)) {
    return 'Güncelleme işlemi başarısız. Tekrar dene.'
  }
  return raw || 'Güncelleme hatası.'
}

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
        setHint(friendlyUpdateError(payload.message))
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
      const msg = friendlyUpdateError(err)
      setStatus({ status: 'error', message: msg })
      setHint(msg)
    } finally {
      setBusy(false)
    }
  }

  async function simdiGuncelle() {
    if (!window.hddTakip?.downloadUpdate) return
    setBusy(true)
    setHint('Güncelleme başlatılıyor…')
    try {
      const res = await window.hddTakip.downloadUpdate()
      if (res && typeof res === 'object' && 'ok' in res && res.ok === false) {
        const msg = friendlyUpdateError(res.error || 'Mevcut güncelleme yok.')
        if (/mevcut güncelleme yok/i.test(msg)) {
          setStatus({ status: 'not-available' })
          setHint(version ? `Mevcut güncelleme yok (v${version}).` : msg)
        } else {
          setStatus({ status: 'error', message: msg })
          setHint(msg)
        }
        setBusy(false)
      }
    } catch (err) {
      setBusy(false)
      const msg = friendlyUpdateError(err)
      if (/mevcut güncelleme yok/i.test(msg)) {
        setStatus({ status: 'not-available' })
        setHint(version ? `Mevcut güncelleme yok (v${version}).` : msg)
      } else {
        setStatus({ status: 'error', message: msg })
        setHint(msg)
      }
    }
  }

  async function kur() {
    if (!window.hddTakip?.installUpdate) return
    setBusy(true)
    setHint('Kuruluyor, uygulama yeniden başlayacak…')
    try {
      const res = await window.hddTakip.installUpdate()
      if (res && typeof res === 'object' && 'ok' in res && res.ok === false) {
        setBusy(false)
        const msg = friendlyUpdateError(res.error || 'Kurulum başarısız.')
        setStatus({ status: 'error', message: msg })
        setHint(msg)
      }
    } catch (err) {
      setBusy(false)
      const msg = friendlyUpdateError(err)
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
