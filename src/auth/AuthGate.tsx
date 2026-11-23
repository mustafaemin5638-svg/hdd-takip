import { useEffect, useState, type ReactNode } from 'react'
import type { AuthSession } from '../types/auth'
import { LoginFlow } from './LoginFlow'
import { setTenantKey } from '../storage/hddStore'
import { setDistributorTenantKey } from '../storage/distributorStore'

interface Props {
  children: (session: AuthSession, logout: () => void) => ReactNode
}

export function AuthGate({ children }: Props) {
  const [phase, setPhase] = useState<'splash' | 'blocked' | 'login' | 'app'>('splash')
  const [blockMsg, setBlockMsg] = useState('')
  const [session, setSession] = useState<AuthSession | null>(null)

  useEffect(() => {
    let cancelled = false
    const minSplash = new Promise((r) => setTimeout(r, 1400))

    ;(async () => {
      await minSplash
      if (cancelled) return

      if (!window.hddTakip?.auth) {
        setBlockMsg(
          'Kimlik sistemi Electron uygulaması gerektirir. Lütfen Setup ile kurulu HDD TAKİP üzerinden aç.',
        )
        setPhase('blocked')
        return
      }

      const guard = await window.hddTakip.installGuard()
      if (!guard.ok) {
        setBlockMsg(guard.error || 'Kurulum doğrulanamadı.')
        setPhase('blocked')
        return
      }

      const existing = await window.hddTakip.auth.getSession()
      if (existing) {
        setTenantKey(existing.tenantKey)
        setDistributorTenantKey(existing.tenantKey)
        setSession(existing)
        setPhase('app')
        return
      }

      setPhase('login')
    })()

    return () => {
      cancelled = true
    }
  }, [])

  function handleLoggedIn(s: AuthSession) {
    setTenantKey(s.tenantKey)
    setDistributorTenantKey(s.tenantKey)
    setSession(s)
    setPhase('app')
  }

  async function logout() {
    await window.hddTakip?.auth.logout()
    setSession(null)
    setTenantKey('default')
    setDistributorTenantKey('default')
    setPhase('login')
  }

  if (phase === 'splash') {
    return (
      <div className="splash">
        <div className="splash-inner">
          <p className="splash-brand">HDD TAKİP</p>
          <p className="splash-sub">Yükleniyor…</p>
          <div className="splash-bar">
            <span />
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'blocked') {
    return (
      <div className="splash">
        <div className="auth-card">
          <h1>Kurulum Gerekli</h1>
          <p className="msg err">{blockMsg}</p>
        </div>
      </div>
    )
  }

  if (phase === 'login' || !session) {
    return (
      <div className="auth-screen">
        <LoginFlow onLoggedIn={handleLoggedIn} />
      </div>
    )
  }

  return <>{children(session, logout)}</>
}
