import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { AuthSession, RememberedLogin } from '../types/auth'
import { LoginUpdateBar } from './LoginUpdateBar'

type GateView =
  | 'chooser'
  | 'individual-login'
  | 'individual-register'
  | 'company-chooser'
  | 'company-admin-login'
  | 'company-admin-register'
  | 'company-staff-login'

interface Props {
  onLoggedIn: (session: AuthSession) => void
}

function authApi() {
  return window.hddTakip?.auth
}

export function LoginFlow({ onLoggedIn }: Props) {
  const [view, setView] = useState<GateView>('chooser')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [remember, setRemember] = useState(true)
  const [remembered, setRemembered] = useState<RememberedLogin | null>(null)
  const [binding, setBinding] = useState<{ boundCompanyName: string | null } | null>(null)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')

  useEffect(() => {
    const api = authApi()
    if (!api) return
    Promise.all([api.getRemembered(), api.getMachineBinding()]).then(([rem, bind]) => {
      setRemembered(rem)
      setBinding(bind)
      if (rem) {
        setUsername(rem.username)
        setPassword(rem.password)
        setCompanyName(rem.companyName || '')
        setRemember(true)
        if (rem.mode === 'individual') setView('individual-login')
        if (rem.mode === 'company-admin') setView('company-admin-login')
        if (rem.mode === 'company-staff') setView('company-staff-login')
      }
    })
  }, [])

  async function finish(result: { ok: boolean; error?: string; session?: AuthSession }) {
    if (!result.ok || !result.session) {
      setError(result.error || 'Giriş başarısız.')
      return
    }
    setError('')
    onLoggedIn(result.session)
  }

  async function handleIndividualLogin(e: FormEvent) {
    e.preventDefault()
    setInfo('')
    const api = authApi()
    if (!api) return setError('Uygulamayı Setup / Electron ile aç.')
    finish(await api.loginIndividual({ username, password, remember }))
  }

  async function handleIndividualRegister(e: FormEvent) {
    e.preventDefault()
    const api = authApi()
    if (!api) return setError('Uygulamayı Setup / Electron ile aç.')
    const reg = await api.registerIndividual({ username, password })
    if (!reg.ok) return setError(reg.error || 'Kayıt başarısız.')
    setError('')
    const base =
      reg.message ||
      'Kayıt alındı. Yönetici onayından sonra giriş yapabilirsin.'
    setInfo(reg.syncWarning ? `${base} (${reg.syncWarning})` : base)
    setView('individual-login')
  }

  async function handleCompanyAdminRegister(e: FormEvent) {
    e.preventDefault()
    const api = authApi()
    if (!api) return setError('Uygulamayı Setup / Electron ile aç.')
    const reg = await api.registerCompanyAdmin({ companyName, username, password })
    if (!reg.ok) return setError(reg.error || 'Firma kaydı başarısız.')
    setError('')
    const base =
      reg.message ||
      'Firma kaydı alındı. Yönetici onayından sonra giriş yapabilirsin.'
    setInfo(reg.syncWarning ? `${base} (${reg.syncWarning})` : base)
    setView('company-admin-login')
  }

  async function handleCompanyAdminLogin(e: FormEvent) {
    e.preventDefault()
    setInfo('')
    const api = authApi()
    if (!api) return setError('Uygulamayı Setup / Electron ile aç.')
    finish(await api.loginCompanyAdmin({ companyName, username, password, remember }))
  }

  async function handleCompanyStaffLogin(e: FormEvent) {
    e.preventDefault()
    setInfo('')
    const api = authApi()
    if (!api) return setError('Uygulamayı Setup / Electron ile aç.')
    finish(await api.loginCompanyStaff({ companyName, username, password, remember }))
  }

  function rememberBox() {
    return (
      <label className="remember-row">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />
        <span>Bilgilerimi Hatırla</span>
      </label>
    )
  }

  function shell(title: string, body: ReactNode, foot?: ReactNode) {
    return (
      <div className="login-shell">
        <aside className="login-brand">
          <div className="login-brand-top">
            <p className="login-kicker">NEXTSOFTWARE</p>
            <h1 className="login-brand-title">HDD TAKİP</h1>
            <p className="login-brand-copy">
              Disk stok ve satış takibi. Şahıs veya firma hesabıyla güvenli giriş.
            </p>
            <ul className="login-brand-points">
              <li>Aylık / yıllık lisans</li>
              <li>Firma personeli ortak stok</li>
              <li>S/N ile hızlı sorgu</li>
            </ul>
          </div>
          <LoginUpdateBar />
        </aside>
        <section className="login-panel">
          <div className="login-panel-inner">
            <h2>{title}</h2>
            {body}
            {error && <p className="msg err">{error}</p>}
            {info && <p className="msg ok">{info}</p>}
            {foot}
          </div>
        </section>
      </div>
    )
  }

  if (view === 'chooser') {
    return shell(
      'Nasıl giriş yapmak istiyorsun?',
      <div className="login-path-grid">
        <button
          type="button"
          className="login-path"
          onClick={() => {
            setError('')
            setInfo('')
            setView('individual-login')
          }}
        >
          <span className="login-path-label">Şahıs</span>
          <span className="login-path-desc">Bireysel hesap · kendi stokun</span>
        </button>
        <button
          type="button"
          className="login-path"
          onClick={() => {
            setError('')
            setInfo('')
            setView('company-chooser')
          }}
        >
          <span className="login-path-label">Firma</span>
          <span className="login-path-desc">Yetkili veya personel · ortak stok</span>
        </button>
        {binding?.boundCompanyName && (
          <p className="auth-bind">
            Bu PC firma kilidi: <strong>{binding.boundCompanyName}</strong>
          </p>
        )}
        {remembered && (
          <p className="hint">Hatırlanan hesap hazır — ilgili girişte Giriş Yap yeterli.</p>
        )}
      </div>,
    )
  }

  if (view === 'company-chooser') {
    return shell(
      'Firma girişi',
      <div className="login-path-grid">
        <button
          type="button"
          className="login-path"
          onClick={() => setView('company-admin-login')}
        >
          <span className="login-path-label">Firma yetkilisi</span>
          <span className="login-path-desc">Hesap aç, personel tanıt, lisanslı stok</span>
        </button>
        <button
          type="button"
          className="login-path"
          onClick={() => setView('company-staff-login')}
        >
          <span className="login-path-label">Firma personeli</span>
          <span className="login-path-desc">Firma adı + kullanıcı ile giriş</span>
        </button>
      </div>,
      <button type="button" className="linkish" onClick={() => setView('chooser')}>
        ← Ana seçim
      </button>,
    )
  }

  if (view === 'individual-login' || view === 'individual-register') {
    const isReg = view === 'individual-register'
    return shell(
      isReg ? 'Şahıs hesabı oluştur' : 'Şahıs girişi',
      <form
        className="panel-form"
        onSubmit={isReg ? handleIndividualRegister : handleIndividualLogin}
      >
        <div className="field">
          <label>Kullanıcı adı</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className="field">
          <label>Şifre</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {!isReg && rememberBox()}
        {isReg && (
          <p className="hint">
            Kayıt yönetici onayına düşer. Onayda 7 gün deneme lisansı açılır.
          </p>
        )}
        <button type="submit" className="btn primary login-submit">
          {isReg ? 'Kayıt ol' : 'Giriş yap'}
        </button>
      </form>,
      <div className="auth-links">
        {!isReg ? (
          <button type="button" className="linkish" onClick={() => setView('individual-register')}>
            Yeni kullanıcı
          </button>
        ) : (
          <button type="button" className="linkish" onClick={() => setView('individual-login')}>
            Hesabım var
          </button>
        )}
        <button type="button" className="linkish" onClick={() => setView('chooser')}>
          ← Geri
        </button>
      </div>,
    )
  }

  if (view === 'company-admin-register' || view === 'company-admin-login') {
    const isReg = view === 'company-admin-register'
    return shell(
      isReg ? 'Firma yetkilisi kaydı' : 'Firma yetkilisi girişi',
      <form
        className="panel-form"
        onSubmit={isReg ? handleCompanyAdminRegister : handleCompanyAdminLogin}
      >
        <div className="field">
          <label>Firma adı</label>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Yetkili kullanıcı adı</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className="field">
          <label>Şifre</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {!isReg && rememberBox()}
        {isReg && (
          <p className="hint">
            Kayıt yönetici onayına düşer. Onayda 7 gün deneme lisansı açılır.
          </p>
        )}
        <button type="submit" className="btn primary login-submit">
          {isReg ? 'Firma hesabı oluştur' : 'Giriş yap'}
        </button>
      </form>,
      <div className="auth-links">
        {!isReg ? (
          <button
            type="button"
            className="linkish"
            onClick={() => setView('company-admin-register')}
          >
            Yeni firma kaydı
          </button>
        ) : (
          <button type="button" className="linkish" onClick={() => setView('company-admin-login')}>
            Hesabım var
          </button>
        )}
        <button type="button" className="linkish" onClick={() => setView('company-chooser')}>
          ← Geri
        </button>
      </div>,
    )
  }

  // staff
  return shell(
    'Firma personeli girişi',
    <form className="panel-form" onSubmit={handleCompanyStaffLogin}>
      <div className="field">
        <label>Firma adı</label>
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder={binding?.boundCompanyName || ''}
          required
        />
      </div>
      <div className="field">
        <label>Kullanıcı adı</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} required />
      </div>
      <div className="field">
        <label>Şifre</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {rememberBox()}
      <button type="submit" className="btn accent login-submit">
        Giriş yap
      </button>
    </form>,
    <button type="button" className="linkish" onClick={() => setView('company-chooser')}>
      ← Geri
    </button>,
  )
}
