import { useState } from 'react'
import { OwnerPanel } from './auth/OwnerPanel'

/** Masaüstü Yönetici / Lisans paneli — ayrı kısayol ile açılır (--owner) */
export default function OwnerDesktopApp() {
  const [unlocked, setUnlocked] = useState(false)
  const [shortcutMsg, setShortcutMsg] = useState('')

  async function pinToDesktop() {
    const res = await window.hddTakip?.createOwnerDesktopShortcut?.()
    if (!res?.ok) {
      setShortcutMsg(res?.error || 'Kısayol oluşturulamadı')
      return
    }
    setShortcutMsg(`Masaüstüne eklendi: ${res.path}`)
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
