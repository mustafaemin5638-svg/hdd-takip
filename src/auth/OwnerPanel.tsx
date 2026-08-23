import { Fragment, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { BoundPcInfo } from '../types/auth'

interface Props {
  onBack: () => void
  onUnlockedChange?: (unlocked: boolean) => void
}

interface LicInfo {
  id: string
  plan: string
  status: string
  expiresAt: string
}

interface StaffRow {
  id: string
  username: string
  password: string
  accountStatus?: string
  boundPc?: BoundPcInfo | null
}

interface Directory {
  individuals: {
    id: string
    username: string
    password: string
    accountStatus?: string
    createdAt?: string
    license?: LicInfo | null
    boundPc?: BoundPcInfo | null
  }[]
  companies: {
    id: string
    name: string
    adminUsername: string
    adminPassword: string
    accountStatus?: string
    createdAt?: string
    adminBoundPc?: BoundPcInfo | null
    staff: StaffRow[]
    license?: LicInfo | null
  }[]
}

function statusLabel(status?: string) {
  if (status === 'pending') return 'Onay bekliyor'
  if (status === 'rejected') return 'Reddedildi'
  return 'Onaylı'
}

function fmtDate(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function pcLabel(pc?: BoundPcInfo | null) {
  if (!pc?.machineId) return null
  return pc.label || pc.hostname || pc.machineId.slice(0, 8)
}

export function OwnerPanel({ onBack, onUnlockedChange }: Props) {
  const [masterPw, setMasterPw] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [hasMaster, setHasMaster] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [dir, setDir] = useState<Directory | null>(null)
  const [centralToken, setCentralToken] = useState('')
  const [centralStatus, setCentralStatus] = useState('')
  const [editIndividual, setEditIndividual] = useState<string | null>(null)
  const [editCompany, setEditCompany] = useState<string | null>(null)
  const [draftInd, setDraftInd] = useState({ username: '', password: '' })
  const [draftCo, setDraftCo] = useState({
    name: '',
    adminUsername: '',
    adminPassword: '',
  })
  const [draftStaff, setDraftStaff] = useState<Record<string, { username: string; password: string }>>(
    {},
  )

  useEffect(() => {
    window.hddTakip?.auth.hasMasterPassword().then((v) => setHasMaster(Boolean(v)))
  }, [])

  useEffect(() => {
    onUnlockedChange?.(unlocked)
  }, [unlocked, onUnlockedChange])

  function gateShell(title: string, body: ReactNode, foot?: ReactNode) {
    return (
      <div className="login-shell">
        <aside className="login-brand">
          <p className="login-kicker">NEXTSOFTWARE</p>
          <h1 className="login-brand-title">HDD TAKİP</h1>
          <p className="login-brand-copy">
            Yönetici paneli. Hesaplar, personel ve lisansları buradan yönet.
          </p>
          <ul className="login-brand-points">
            <li>Aylık / yıllık lisans ver</li>
            <li>Şahıs ve firma hesapları</li>
            <li>Destek için şifre sıfırla</li>
          </ul>
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

  async function setupMaster(e: FormEvent) {
    e.preventDefault()
    const res = await window.hddTakip?.auth.setMasterPassword(masterPw)
    if (!res?.ok) return setError(res?.error || 'Kurulum başarısız')
    setHasMaster(true)
    setError('')
    setInfo('Yönetici şifresi kaydedildi.')
  }

  async function unlock(e: FormEvent) {
    e.preventDefault()
    const res = await window.hddTakip?.auth.listCredentials(masterPw)
    if (!res?.ok) return setError(res?.error || 'Şifre hatalı')
    setDir({
      individuals: (res.individuals || []) as Directory['individuals'],
      companies: (res.companies || []) as Directory['companies'],
    })
    const st = await window.hddTakip?.auth.getCentralStatus?.()
    if (st?.configured) {
      setCentralStatus(
        `Senkron açık · bekleyen ${st.pending ?? 0} · hesap ${st.individuals ?? 0}/${st.companies ?? 0}`,
      )
    } else {
      setCentralStatus(st?.message || 'Senkron kapalı — diğer PC kayıtları gelmez.')
    }
    setUnlocked(true)
    setError('')
  }

  async function refresh() {
    const res = await window.hddTakip?.auth.listCredentials(masterPw)
    if (!res?.ok) return
    setDir({
      individuals: (res.individuals || []) as Directory['individuals'],
      companies: (res.companies || []) as Directory['companies'],
    })
    const st = await window.hddTakip?.auth.getCentralStatus?.()
    if (st?.ok && st.configured) {
      setCentralStatus(
        `Senkron açık · bekleyen ${st.pending ?? 0} · güncelleme ${st.updatedAt || '—'}`,
      )
    }
  }

  async function saveCentral(e: FormEvent) {
    e.preventDefault()
    const save = await window.hddTakip?.auth.setCentralToken?.(centralToken)
    if (!save?.ok && (save as { error?: string } | undefined)?.error) {
      return setError((save as { error?: string }).error || 'Anahtar kaydedilemedi')
    }
    const sync = await window.hddTakip?.auth.syncCentralNow?.()
    if (!sync?.ok) {
      setError(sync?.error || 'Senkron başarısız — anahtarı kontrol et.')
      return
    }
    setInfo('Merkezi senkron etkin. Diğer PC kayıtları bu panele düşer.')
    setError('')
    setCentralToken('')
    await refresh()
  }

  async function syncNow() {
    const sync = await window.hddTakip?.auth.syncCentralNow?.()
    if (!sync?.ok) return setError(sync?.error || 'Senkron başarısız')
    setInfo('Merkezi senkron yenilendi.')
    setError('')
    await refresh()
  }

  async function grant(
    targetType: 'individual' | 'company',
    targetId: string,
    targetLabel: string,
    plan: 'monthly' | 'yearly',
  ) {
    const res = await window.hddTakip?.auth.grantLicense?.({
      masterPassword: masterPw,
      targetType,
      targetId,
      targetLabel,
      plan,
    })
    if (!res?.ok) {
      setError(res?.error || 'Lisans verilemedi')
      return
    }
    setInfo(
      `${targetLabel} → ${plan === 'yearly' ? 'yıllık' : 'aylık'} (+). Bitiş: ${fmtDate(res.license?.expiresAt)}`,
    )
    setError('')
    refresh()
  }

  async function suspend(licenseId?: string | null) {
    if (!licenseId) return
    const res = await window.hddTakip?.auth.setLicenseStatus?.({
      masterPassword: masterPw,
      licenseId,
      status: 'suspended',
    })
    if (!res?.ok) return setError(res?.error || 'Askıya alınamadı')
    setInfo('Lisans askıya alındı.')
    refresh()
  }

  async function setStatus(
    targetType: 'individual' | 'company' | 'staff',
    targetId: string,
    status: 'approved' | 'rejected',
    companyId?: string,
    label?: string,
  ) {
    const res = await window.hddTakip?.auth.setAccountStatus?.({
      masterPassword: masterPw,
      targetType,
      targetId,
      companyId,
      status,
    })
    if (!res?.ok) {
      setError(res?.error || 'Durum güncellenemedi')
      return
    }
    setInfo(
      status === 'approved'
        ? `${label || 'Hesap'} onaylandı.${targetType !== 'staff' ? ' 7 gün deneme verildi.' : ''}`
        : `${label || 'Hesap'} reddedildi.`,
    )
    setError('')
    refresh()
  }

  async function removeIndividual(id: string, label: string) {
    if (!window.confirm(`Şahıs hesabını sil: ${label}?`)) return
    const res = await window.hddTakip?.auth.deleteIndividual?.({
      masterPassword: masterPw,
      id,
    })
    if (!res?.ok) return setError(res?.error || 'Silinemedi')
    setInfo(`${label} silindi.`)
    setError('')
    setEditIndividual(null)
    refresh()
  }

  async function removeCompany(id: string, label: string) {
    if (!window.confirm(`Firmayı ve personellerini sil: ${label}?`)) return
    const res = await window.hddTakip?.auth.deleteCompany?.({
      masterPassword: masterPw,
      id,
    })
    if (!res?.ok) return setError(res?.error || 'Silinemedi')
    setInfo(`${label} silindi.`)
    setError('')
    setEditCompany(null)
    refresh()
  }

  async function removeStaff(companyId: string, staffId: string, label: string) {
    if (!window.confirm(`Personeli sil: ${label}?`)) return
    const res = await window.hddTakip?.auth.deleteStaffMember?.({
      masterPassword: masterPw,
      companyId,
      staffId,
    })
    if (!res?.ok) return setError(res?.error || 'Silinemedi')
    setInfo(`${label} silindi.`)
    setError('')
    refresh()
  }

  async function unbindPc(
    targetType: 'individual' | 'company-admin' | 'staff',
    targetId: string,
    label: string,
    companyId?: string,
  ) {
    if (
      !window.confirm(
        `${label} için PC bağlantısını kes? Sonraki giriş yaptığı bilgisayar yeni kayıtlı PC olur.`,
      )
    ) {
      return
    }
    const res = await window.hddTakip?.auth.unbindBoundPc?.({
      masterPassword: masterPw,
      targetType,
      targetId,
      companyId,
    })
    if (!res?.ok) return setError(res?.error || 'PC bağlantısı kesilemedi')
    setInfo(`${label} — PC bağlantısı kesildi.`)
    setError('')
    refresh()
  }

  async function saveIndividual(id: string) {
    const res = await window.hddTakip?.auth.updateIndividual?.({
      masterPassword: masterPw,
      id,
      username: draftInd.username,
      password: draftInd.password,
    })
    if (!res?.ok) return setError(res?.error || 'Güncellenemedi')
    setInfo('Şahıs bilgileri güncellendi.')
    setEditIndividual(null)
    setError('')
    refresh()
  }

  async function saveCompany(id: string) {
    const res = await window.hddTakip?.auth.updateCompany?.({
      masterPassword: masterPw,
      id,
      name: draftCo.name,
      adminUsername: draftCo.adminUsername,
      adminPassword: draftCo.adminPassword,
    })
    if (!res?.ok) return setError(res?.error || 'Güncellenemedi')
    setInfo('Firma bilgileri güncellendi.')
    setEditCompany(null)
    setError('')
    refresh()
  }

  async function saveStaff(companyId: string, staffId: string) {
    const draft = draftStaff[staffId]
    if (!draft) return
    const res = await window.hddTakip?.auth.updateStaffMember?.({
      masterPassword: masterPw,
      companyId,
      staffId,
      username: draft.username,
      password: draft.password,
    })
    if (!res?.ok) return setError(res?.error || 'Personel güncellenemedi')
    setInfo('Personel bilgileri güncellendi.')
    setError('')
    refresh()
  }

  const backLabel = 'Kapat'

  if (!hasMaster) {
    return gateShell(
      'Yönetici kurulumu',
      <>
        <p className="section-desc">
          Lisans panelini açmak için bir kez yönetici şifresi belirle.
        </p>
        <form className="panel-form" onSubmit={setupMaster}>
          <div className="field">
            <label>Yönetici şifresi</label>
            <input
              type="password"
              value={masterPw}
              onChange={(e) => setMasterPw(e.target.value)}
              required
              autoFocus
            />
          </div>
          <button type="submit" className="btn primary">
            Kaydet ve devam et
          </button>
        </form>
      </>,
      <button type="button" className="linkish" onClick={onBack}>
        {backLabel}
      </button>,
    )
  }

  if (!unlocked) {
    return gateShell(
      'Yönetici girişi',
      <form className="panel-form" onSubmit={unlock}>
        <div className="field">
          <label>Yönetici şifresi</label>
          <input
            type="password"
            value={masterPw}
            onChange={(e) => setMasterPw(e.target.value)}
            required
            autoFocus
          />
        </div>
        <button type="submit" className="btn primary">
          Paneli aç
        </button>
      </form>,
      <button type="button" className="linkish" onClick={onBack}>
        {backLabel}
      </button>,
    )
  }

  return (
    <div className="owner-panel">
      <div className="owner-head">
        <h2>Lisans & hesap yönetimi</h2>
        <div className="owner-head-actions">
          <button type="button" className="linkish" onClick={onBack}>
            {backLabel}
          </button>
        </div>
      </div>
      {info && <p className="msg ok">{info}</p>}
      {error && <p className="msg err">{error}</p>}

      {(() => {
        const pendingInd = (dir?.individuals || []).filter((u) => u.accountStatus === 'pending')
        const pendingCo = (dir?.companies || []).filter((c) => c.accountStatus === 'pending')
        const pendingStaff = (dir?.companies || []).flatMap((c) =>
          c.staff
            .filter((s) => s.accountStatus === 'pending')
            .map((s) => ({ company: c, staff: s })),
        )
        const total = pendingInd.length + pendingCo.length + pendingStaff.length
        if (total === 0) return null
        return (
          <section className="owner-pending">
            <h3>Onay bekleyenler ({total})</h3>
            <ul className="owner-pending-list">
              {pendingInd.map((u) => (
                <li key={`i-${u.id}`}>
                  <div>
                    <strong>Şahıs</strong> · <span className="mono">{u.username}</span>
                    <div className="muted">Kayıt {fmtDate(u.createdAt)}</div>
                  </div>
                  <div className="owner-actions">
                    <button
                      type="button"
                      className="btn small primary"
                      onClick={() => setStatus('individual', u.id, 'approved', undefined, u.username)}
                    >
                      Onayla
                    </button>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => setStatus('individual', u.id, 'rejected', undefined, u.username)}
                    >
                      Reddet
                    </button>
                  </div>
                </li>
              ))}
              {pendingCo.map((c) => (
                <li key={`c-${c.id}`}>
                  <div>
                    <strong>Firma</strong> · {c.name}
                    <div className="muted mono">
                      {c.adminUsername} / {c.adminPassword}
                    </div>
                  </div>
                  <div className="owner-actions">
                    <button
                      type="button"
                      className="btn small primary"
                      onClick={() => setStatus('company', c.id, 'approved', undefined, c.name)}
                    >
                      Onayla
                    </button>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => setStatus('company', c.id, 'rejected', undefined, c.name)}
                    >
                      Reddet
                    </button>
                  </div>
                </li>
              ))}
              {pendingStaff.map(({ company, staff }) => (
                <li key={`s-${staff.id}`}>
                  <div>
                    <strong>Personel</strong> · {company.name} /{' '}
                    <span className="mono">{staff.username}</span>
                  </div>
                  <div className="owner-actions">
                    <button
                      type="button"
                      className="btn small primary"
                      onClick={() =>
                        setStatus('staff', staff.id, 'approved', company.id, staff.username)
                      }
                    >
                      Onayla
                    </button>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() =>
                        setStatus('staff', staff.id, 'rejected', company.id, staff.username)
                      }
                    >
                      Reddet
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })()}

      <h3>Şahıs</h3>
      <div className="owner-table-wrap">
        {(dir?.individuals || []).length === 0 ? (
          <p className="empty-list">Şahıs hesabı yok.</p>
        ) : (
          <table className="owner-table">
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>Şifre</th>
                <th>Durum / Lisans</th>
                <th>Kayıtlı PC</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {dir!.individuals.map((u) => {
                const editing = editIndividual === u.id
                const pc = pcLabel(u.boundPc)
                return (
                  <tr key={u.id}>
                    <td>
                      {editing ? (
                        <input
                          className="mono owner-edit-input"
                          value={draftInd.username}
                          onChange={(e) =>
                            setDraftInd((d) => ({ ...d, username: e.target.value }))
                          }
                        />
                      ) : (
                        <span className="mono">{u.username}</span>
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <input
                          className="mono owner-edit-input"
                          value={draftInd.password}
                          onChange={(e) =>
                            setDraftInd((d) => ({ ...d, password: e.target.value }))
                          }
                        />
                      ) : (
                        <span className="mono">{u.password}</span>
                      )}
                    </td>
                    <td>
                      <div
                        className={
                          u.accountStatus === 'pending'
                            ? 'sn-hint'
                            : u.accountStatus === 'rejected'
                              ? 'sn-hint err'
                              : 'muted'
                        }
                      >
                        {statusLabel(u.accountStatus)}
                      </div>
                      {u.license ? (
                        <>
                          {u.license.plan === 'yearly' ? 'Yıllık' : 'Aylık'} · {u.license.status}
                          <div className="muted">Bitiş {fmtDate(u.license.expiresAt)}</div>
                        </>
                      ) : (
                        <span className="sn-hint err">Lisans yok</span>
                      )}
                    </td>
                    <td>
                      {pc ? (
                        <div className="owner-pc-cell">
                          <div className="mono">{pc}</div>
                          {u.boundPc?.lanIp ? (
                            <div className="muted">IP {u.boundPc.lanIp}</div>
                          ) : null}
                          {u.boundPc?.lastLoginAt ? (
                            <div className="muted">
                              Son giriş {fmtDate(u.boundPc.lastLoginAt)}
                            </div>
                          ) : null}
                          {!editing && (
                            <button
                              type="button"
                              className="btn small"
                              onClick={() => unbindPc('individual', u.id, u.username)}
                            >
                              PC bağlantısını kes
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="muted">Henüz bağlanmadı</span>
                      )}
                    </td>
                    <td>
                      <div className="owner-actions">
                      {editing ? (
                        <>
                          <button
                            type="button"
                            className="btn small primary"
                            onClick={() => saveIndividual(u.id)}
                          >
                            Kaydet
                          </button>
                          <button
                            type="button"
                            className="btn small"
                            onClick={() => setEditIndividual(null)}
                          >
                            İptal
                          </button>
                        </>
                      ) : (
                        <>
                          {u.accountStatus === 'pending' && (
                            <>
                              <button
                                type="button"
                                className="btn small primary"
                                onClick={() =>
                                  setStatus('individual', u.id, 'approved', undefined, u.username)
                                }
                              >
                                Onayla
                              </button>
                              <button
                                type="button"
                                className="btn small"
                                onClick={() =>
                                  setStatus('individual', u.id, 'rejected', undefined, u.username)
                                }
                              >
                                Reddet
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className="btn small"
                            onClick={() => {
                              setEditIndividual(u.id)
                              setDraftInd({ username: u.username, password: u.password })
                            }}
                          >
                            Düzenle
                          </button>
                          <button
                            type="button"
                            className="btn small primary"
                            onClick={() => grant('individual', u.id, u.username, 'monthly')}
                          >
                            +1 ay
                          </button>
                          <button
                            type="button"
                            className="btn small accent"
                            onClick={() => grant('individual', u.id, u.username, 'yearly')}
                          >
                            +1 yıl
                          </button>
                          {u.license?.id && (
                            <button
                              type="button"
                              className="btn small"
                              onClick={() => suspend(u.license?.id)}
                            >
                              Askı
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn small danger"
                            onClick={() => removeIndividual(u.id, u.username)}
                          >
                            Sil
                          </button>
                        </>
                      )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <h3>Firma</h3>
      <div className="owner-table-wrap">
        {(dir?.companies || []).length === 0 ? (
          <p className="empty-list">Firma yok.</p>
        ) : (
          <table className="owner-table">
            <thead>
              <tr>
                <th>Firma / personel</th>
                <th>Yetkili</th>
                <th>Durum / Lisans</th>
                <th>Kayıtlı PC</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {dir!.companies.map((c) => {
                const editing = editCompany === c.id
                const adminPc = pcLabel(c.adminBoundPc)
                return (
                  <Fragment key={c.id}>
                    <tr>
                      <td>
                        {editing ? (
                          <input
                            className="owner-edit-input"
                            value={draftCo.name}
                            onChange={(e) =>
                              setDraftCo((d) => ({ ...d, name: e.target.value }))
                            }
                          />
                        ) : (
                          <>
                            <strong>{c.name}</strong>
                            <div className="muted">{c.staff.length} personel</div>
                          </>
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <div className="owner-edit-stack">
                            <input
                              className="mono owner-edit-input"
                              value={draftCo.adminUsername}
                              onChange={(e) =>
                                setDraftCo((d) => ({
                                  ...d,
                                  adminUsername: e.target.value,
                                }))
                              }
                              placeholder="Yetkili kullanıcı"
                            />
                            <input
                              className="mono owner-edit-input"
                              value={draftCo.adminPassword}
                              onChange={(e) =>
                                setDraftCo((d) => ({
                                  ...d,
                                  adminPassword: e.target.value,
                                }))
                              }
                              placeholder="Yetkili şifre"
                            />
                          </div>
                        ) : (
                          <span className="mono">
                            {c.adminUsername} / {c.adminPassword}
                          </span>
                        )}
                      </td>
                      <td>
                        <div
                          className={
                            c.accountStatus === 'pending'
                              ? 'sn-hint'
                              : c.accountStatus === 'rejected'
                                ? 'sn-hint err'
                                : 'muted'
                          }
                        >
                          {statusLabel(c.accountStatus)}
                        </div>
                        {c.license ? (
                          <>
                            {c.license.plan === 'yearly' ? 'Yıllık' : 'Aylık'} · {c.license.status}
                            <div className="muted">Bitiş {fmtDate(c.license.expiresAt)}</div>
                          </>
                        ) : (
                          <span className="sn-hint err">Lisans yok</span>
                        )}
                      </td>
                      <td>
                        {adminPc ? (
                          <div className="owner-pc-cell">
                            <div className="muted">Yetkili PC</div>
                            <div className="mono">{adminPc}</div>
                            {c.adminBoundPc?.lanIp ? (
                              <div className="muted">IP {c.adminBoundPc.lanIp}</div>
                            ) : null}
                            {!editing && (
                              <button
                                type="button"
                                className="btn small"
                                onClick={() =>
                                  unbindPc('company-admin', c.id, `${c.name} yetkili`)
                                }
                              >
                                PC bağlantısını kes
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="muted">Yetkili: henüz bağlanmadı</span>
                        )}
                      </td>
                      <td>
                        <div className="owner-actions">
                        {editing ? (
                          <>
                            <button
                              type="button"
                              className="btn small primary"
                              onClick={() => saveCompany(c.id)}
                            >
                              Kaydet
                            </button>
                            <button
                              type="button"
                              className="btn small"
                              onClick={() => setEditCompany(null)}
                            >
                              İptal
                            </button>
                          </>
                        ) : (
                          <>
                            {c.accountStatus === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  className="btn small primary"
                                  onClick={() =>
                                    setStatus('company', c.id, 'approved', undefined, c.name)
                                  }
                                >
                                  Onayla
                                </button>
                                <button
                                  type="button"
                                  className="btn small"
                                  onClick={() =>
                                    setStatus('company', c.id, 'rejected', undefined, c.name)
                                  }
                                >
                                  Reddet
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              className="btn small"
                              onClick={() => {
                                setEditCompany(c.id)
                                setDraftCo({
                                  name: c.name,
                                  adminUsername: c.adminUsername,
                                  adminPassword: c.adminPassword,
                                })
                                const map: Record<
                                  string,
                                  { username: string; password: string }
                                > = {}
                                for (const s of c.staff) {
                                  map[s.id] = {
                                    username: s.username,
                                    password: s.password,
                                  }
                                }
                                setDraftStaff(map)
                              }}
                            >
                              Düzenle
                            </button>
                            <button
                              type="button"
                              className="btn small primary"
                              onClick={() => grant('company', c.id, c.name, 'monthly')}
                            >
                              +1 ay
                            </button>
                            <button
                              type="button"
                              className="btn small accent"
                              onClick={() => grant('company', c.id, c.name, 'yearly')}
                            >
                              +1 yıl
                            </button>
                            {c.license?.id && (
                              <button
                                type="button"
                                className="btn small"
                                onClick={() => suspend(c.license?.id)}
                              >
                                Askı
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn small danger"
                              onClick={() => removeCompany(c.id, c.name)}
                            >
                              Sil
                            </button>
                          </>
                        )}
                        </div>
                      </td>
                    </tr>
                    {!editing &&
                      c.staff.map((s) => (
                        <tr key={`${c.id}-view-${s.id}`} className="owner-staff-row">
                          <td>
                            <span className="muted">Personel · </span>
                            <span className="mono">{s.username}</span>
                          </td>
                          <td className="mono">{s.password}</td>
                          <td>
                            <div className="muted">{statusLabel(s.accountStatus)}</div>
                          </td>
                          <td>
                            {pcLabel(s.boundPc) ? (
                              <div className="owner-pc-cell">
                                <div className="mono">{pcLabel(s.boundPc)}</div>
                                {s.boundPc?.lanIp ? (
                                  <div className="muted">IP {s.boundPc.lanIp}</div>
                                ) : null}
                                <button
                                  type="button"
                                  className="btn small"
                                  onClick={() =>
                                    unbindPc('staff', s.id, s.username, c.id)
                                  }
                                >
                                  PC bağlantısını kes
                                </button>
                              </div>
                            ) : (
                              <span className="muted">Henüz bağlanmadı</span>
                            )}
                          </td>
                          <td />
                        </tr>
                      ))}
                    {editing &&
                      c.staff.map((s) => (
                        <tr key={`${c.id}-${s.id}`} className="owner-staff-row">
                          <td colSpan={2}>
                            <div className="owner-edit-stack">
                              <span className="muted">Personel</span>
                              <input
                                className="mono owner-edit-input"
                                value={draftStaff[s.id]?.username || ''}
                                onChange={(e) =>
                                  setDraftStaff((prev) => ({
                                    ...prev,
                                    [s.id]: {
                                      username: e.target.value,
                                      password: prev[s.id]?.password || s.password,
                                    },
                                  }))
                                }
                              />
                              <input
                                className="mono owner-edit-input"
                                value={draftStaff[s.id]?.password || ''}
                                onChange={(e) =>
                                  setDraftStaff((prev) => ({
                                    ...prev,
                                    [s.id]: {
                                      username: prev[s.id]?.username || s.username,
                                      password: e.target.value,
                                    },
                                  }))
                                }
                              />
                            </div>
                          </td>
                          <td>
                            <div className="muted">{statusLabel(s.accountStatus)}</div>
                          </td>
                          <td>
                            {pcLabel(s.boundPc) ? (
                              <div className="owner-pc-cell">
                                <div className="mono">{pcLabel(s.boundPc)}</div>
                                <button
                                  type="button"
                                  className="btn small"
                                  onClick={() =>
                                    unbindPc('staff', s.id, s.username, c.id)
                                  }
                                >
                                  PC bağlantısını kes
                                </button>
                              </div>
                            ) : (
                              <span className="muted">Henüz bağlanmadı</span>
                            )}
                          </td>
                          <td>
                            <div className="owner-actions">
                              {s.accountStatus === 'pending' && (
                                <>
                                  <button
                                    type="button"
                                    className="btn small primary"
                                    onClick={() =>
                                      setStatus('staff', s.id, 'approved', c.id, s.username)
                                    }
                                  >
                                    Onayla
                                  </button>
                                  <button
                                    type="button"
                                    className="btn small"
                                    onClick={() =>
                                      setStatus('staff', s.id, 'rejected', c.id, s.username)
                                    }
                                  >
                                    Reddet
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                className="btn small primary"
                                onClick={() => saveStaff(c.id, s.id)}
                              >
                                Personeli kaydet
                              </button>
                              <button
                                type="button"
                                className="btn small danger"
                                onClick={() => removeStaff(c.id, s.id, s.username)}
                              >
                                Sil
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <form className="panel-form owner-remote" onSubmit={saveCentral}>
        <h3>Merkezi senkron (diğer PC kayıtları)</h3>
        <p className="hint">
          Başka bilgisayardan gelen kayıt taleplerinin bu panele düşmesi için GitHub senkron
          anahtarı gerekir. Anahtar bir kez kaydedilir; istemci kurulumlarında da paket içine
          gömülür.
        </p>
        {centralStatus && <p className="muted">{centralStatus}</p>}
        <div className="field">
          <label>GitHub token (repo erişimli)</label>
          <input
            type="password"
            value={centralToken}
            onChange={(e) => setCentralToken(e.target.value)}
            placeholder="ghp_… veya gho_…"
            autoComplete="off"
          />
        </div>
        <div className="inline-actions">
          <button type="submit" className="btn primary">
            Anahtarı kaydet ve senkronla
          </button>
          <button type="button" className="btn" onClick={() => void syncNow()}>
            Şimdi yenile
          </button>
        </div>
      </form>
    </div>
  )
}
