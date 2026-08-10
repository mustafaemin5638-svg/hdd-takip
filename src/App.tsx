import { useCallback, useEffect, useState } from 'react'
import { LiveClock } from './components/LiveClock'
import { QueryPanel } from './components/QueryPanel'
import { SaleForm } from './components/SaleForm'
import { StockForm } from './components/StockForm'
import { StockList } from './components/StockList'
import { UpdateBanner } from './components/UpdateBanner'
import { getStockCounts, loadDiskler } from './storage/hddStore'
import type { Hdd } from './types/hdd'

type Tab = 'sorgu' | 'stok' | 'satis' | 'liste'

export default function App() {
  const [diskler, setDiskler] = useState<Hdd[]>([])
  const [tab, setTab] = useState<Tab>('sorgu')
  const [saleSerial, setSaleSerial] = useState('')
  const [appVersion, setAppVersion] = useState('')

  const refresh = useCallback(() => {
    setDiskler(loadDiskler())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!window.hddTakip) return
    window.hddTakip.getVersion().then(setAppVersion).catch(() => {})
  }, [])

  const counts = getStockCounts(diskler)

  function goSell(serialNumber: string) {
    setSaleSerial(serialNumber)
    setTab('satis')
  }

  return (
    <div className="app">
      <UpdateBanner />
      <header className="topbar">
        <div className="brand-block">
          <p className="brand">HDD TAKİP</p>
          <p className="tagline">
            Disk S/N · stok · satış kaydı
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
        </div>
      </header>

      <nav className="nav" aria-label="Ana menü">
        {(
          [
            ['sorgu', 'Sorgulama'],
            ['stok', 'Stoğa Ekle'],
            ['satis', 'Satış'],
            ['liste', 'Liste'],
          ] as const
        ).map(([key, label]) => (
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
      </main>
    </div>
  )
}
