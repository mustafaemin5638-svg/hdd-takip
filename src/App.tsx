import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AuthGate } from './auth/AuthGate'
import { CompanyAdminPanel } from './auth/CompanyAdminPanel'
import { LiveClock } from './components/LiveClock'
import { QueryPanel } from './components/QueryPanel'
import { SaleForm } from './components/SaleForm'
import { StockForm } from './components/StockForm'
import { StockList } from './components/StockList'
import { StockSummary } from './components/StockSummary'
import { UpdateBanner } from './components/UpdateBanner'
import { getStockCounts, loadDiskler } from './storage/hddStore'
import type { AuthSession } from './types/auth'
import type { Hdd } from './types/hdd'

type Tab = 'sorgu' | 'stok' | 'satis' | 'liste' | 'firma' | 'hesap'

function MainApp({
  session,
  logout,
}: {
  session: AuthSession
  logout: () => void
}) {
  const [diskler, setDiskler] = useState<Hdd[]>([])
  const [tab, setTab] = useState<Tab>('liste')
  const [saleSerial, setSaleSerial] = useState('')
  const [appVersion, setAppVersion] = useState('')
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')

  const refresh = useCallback(() => {
    setDiskler(loadDiskler())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh, session.tenantKey])

  useEffect(() => {
    if (!window.hddTakip) return
    window.hddTakip.getVersion().then(setAppVersion).catch(() => {})
  }, [])

  const counts = getStockCounts(diskler)
  const isCompanyAdmin = session.type === 'company' && session.role === 'admin'

  function goSell(serialNumber: string) {
    setSaleSerial(serialNumber)
    setTab('satis')
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault()
    const res = await window.hddTakip?.auth.changeOwnPassword({
      currentPassword: curPw,
      newPassword: newPw,
    })
    setPwMsg(res?.ok ? 'Şifre güncellendi.' : res?.error || 'Hata')
    if (res?.ok) {
      setCurPw('')
      setNewPw('')
    }
  }

  const navItems: [Tab, string][] = [
    ['liste', 'Liste'],
    ['stok', 'Stoğa Ekle'],
    ['satis', 'Satış'],
    ['sorgu', 'Sorgulama'],
  ]
  if (isCompanyAdmin) navItems.push(['firma', 'Firma / Personel'])
  navItems.push(['hesap', 'Hesap'])

  return (
    <div className="app">
      <UpdateBanner />
      <header className="topbar">
        <div>
          <p className="brand">HDD TAKİP</p>
          <p className="tagline">
            {session.type === 'company'
              ? `${session.companyName} · ${session.role === 'admin' ? 'Yetkili' : 'Personel'}: ${session.username}`
              : `Şahıs: ${session.username}`}
            {session.license
              ? ` · Lisans ${session.license.plan === 'yearly' ? 'yıllık' : 'aylık'} (${session.license.status})`
              : ''}
            {appVersion ? ` · v${appVersion}` : ''}
          </p>
          <LiveClock />
        </div>
        <div className="stats">
          <div>
            <span className="stat-label">Toplam</span>
            <strong>{counts.toplam}</strong>
          </div>
          <div>
            <span className="stat-label">Stokta</span>
            <strong className="ok-text">{counts.stokta}</strong>
          </div>
          <div>
            <span className="stat-label">Satılan</span>
            <strong className="sold-text">{counts.satildi}</strong>
          </div>
          <button type="button" className="btn small" onClick={logout}>
            Çıkış
          </button>
        </div>
      </header>

      <nav className="nav" aria-label="Ana menü">
        {navItems.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="workspace">
        <main className="main">
          {tab === 'sorgu' && (
            <section className="section">
              <h2>S/N Sorgula</h2>
              <p className="section-desc">
                Seri numarasını gir; stoğa giriş, satış tarihi ve alıcı bilgisi buradan çıkar.
              </p>
              <QueryPanel />
            </section>
          )}

          {tab === 'stok' && (
            <section className="section wide">
              <h2>Stoğa Ekle</h2>
              <p className="section-desc">
                Boyut ve depolamayı bir kez seç; istediğin kadar S/N ekle (toplu işlem).
              </p>
              <StockForm onChanged={refresh} />
            </section>
          )}

          {tab === 'satis' && (
            <section className="section wide">
              <h2>Satış Kaydı</h2>
              <p className="section-desc">
                Alıcıyı bir kez yaz, S/N’leri gir — özellikler stoktan otomatik gelir.
              </p>
              <SaleForm
                key={saleSerial || 'empty'}
                initialSerial={saleSerial}
                onChanged={() => {
                  setSaleSerial('')
                  refresh()
                }}
              />
            </section>
          )}

          {tab === 'liste' && (
            <section className="section wide">
              <h2>Disk Listesi</h2>
              <p className="section-desc">Stoktaki ve satılan disklerin özeti.</p>
              <StockList diskler={diskler} onSell={goSell} />
            </section>
          )}

          {tab === 'firma' && isCompanyAdmin && (
            <section className="section wide">
              <CompanyAdminPanel />
            </section>
          )}

          {tab === 'hesap' && (
            <section className="section">
              <h2>Hesap</h2>
              <p className="section-desc">
                Kullanıcı adı değiştirilemez. İstersen şifreni güncelle.
              </p>
              <p>
                Kullanıcı adı: <strong className="mono">{session.username}</strong>
              </p>
              <form className="panel-form" onSubmit={changePassword}>
                <div className="field">
                  <label>Mevcut şifre</label>
                  <input
                    type="password"
                    value={curPw}
                    onChange={(e) => setCurPw(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label>Yeni şifre</label>
                  <input
                    type="password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn primary">
                  Şifreyi Değiştir
                </button>
              </form>
              {pwMsg && <p className="msg ok">{pwMsg}</p>}
            </section>
          )}
        </main>

        <StockSummary diskler={diskler} />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthGate>
      {(session, logout) => <MainApp session={session} logout={logout} />}
    </AuthGate>
  )
}
