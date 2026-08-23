import { useEffect, useState, type FormEvent } from 'react'
import { OwnerPanel } from './auth/OwnerPanel'

/** Masaüstü Yönetici / Lisans paneli — yalnızca aktivasyonlu PC’de açılır */
export default function OwnerDesktopApp() {
  const [access, setAccess] = useState<'loading' | 'denied' | 'allowed'>('loading')
  const [unlocked, setUnlocked] = useState(false)
  const [shortcutMsg, setShortcutMsg] = useState('')
  const [code, setCode] = useState('')
  const [codeMsg, setCodeMsg] = useState('')

  async function refreshAccess() {
    const res = await window.hddTakip?.getOwnerAccess?.()
    setAccess(res?.allowed ? 'allowed' : 'denied')
  }

  useEffect(() => {
    void refreshAccess()
  }, [])

  async function pinToDesktop() {
    const res = await window.hddTakip?.createOwnerDesktopShortcut?.()
    if (!res?.ok) {
      setShortcutMsg(res?.error || 'Kısayol oluşturulamadı')
      return
    }
    setShortcutMsg(`Masaüstüne eklendi: ${res.path}`)
  }

  async function enablePanel(e: FormEvent) {
    e.preventDefault()
    setCodeMsg('')
    const res = await window.hddTakip?.enableOwnerPanel?.(code)
    if (!res?.ok) {
      setCodeMsg(res?.error || 'Aktivasyon başarısız.')
      return
    }
    setCode('')
    setAccess('allowed')
  }

  if (access === 'loading') {
    return (
      <div className="auth-screen">
        <p className="muted">Kontrol ediliyor…</p>
      </div>
    )
  }

  if (access === 'denied') {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <p className="login-kicker">NEXTSOFTWARE</p>
          <h1>Yönetici paneli</h1>
          <p className="section-desc">
            Bu özellik yalnızca yetkili kurulumda çalışır. Müşteri kurulumlarında
            yönetim paneli yoktur.
          </p>
          <form className="panel-form" onSubmit={enablePanel}>
            <div className="field">
              <label htmlFor="owner-code">Aktivasyon kodu</label>
              <input
                id="owner-code"
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Kod"
                required
                autoComplete="off"
              />
            </div>
            <button type="submit" className="btn primary">
              Bu PC’de etkinleştir
            </button>
          </form>
          {codeMsg && <p className="msg err">{codeMsg}</p>}
          <button
            type="button"
            className="btn"
            onClick={() => window.hddTakip?.quit?.()}
          >
            Kapat
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={unlocked ? 'owner-desktop' : undefined}>
      {unlocked && (
        <header className="owner-desktop-bar">
          <div>
            <p className="login-kicker">NEXTSOFTWARE</p>
            <h1>HDD TAKİP · Yönetici Paneli</h1>
            <p className="muted">Şahıs / firma hesapları ve lisans yönetimi</p>
          </div>
          <div className="owner-desktop-actions">
            <button type="button" className="btn small primary" onClick={pinToDesktop}>
              Masaüstüne kısayol
            </button>
            <button type="button" className="btn small" onClick={() => window.hddTakip?.quit?.()}>
              Kapat
            </button>
          </div>
        </header>
      )}
      {unlocked && shortcutMsg && (
        <p className="msg ok owner-desktop-toast">{shortcutMsg}</p>
      )}
      <div className={unlocked ? 'owner-desktop-main' : undefined}>
        <OwnerPanel
          onBack={() => window.hddTakip?.quit?.()}
          onUnlockedChange={setUnlocked}
        />
      </div>
    </div>
  )
}
