import { useEffect, useState, type FormEvent } from 'react'

interface StaffRow {
  id: string
  username: string
  password?: string
  accountStatus?: string
}

export function CompanyAdminPanel() {
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('1234')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function refresh() {
    const res = await window.hddTakip?.auth.listStaff()
    if (res?.ok && res.staff) setStaff(res.staff)
  }

  useEffect(() => {
    refresh()
  }, [])

  async function addStaff(e: FormEvent) {
    e.preventDefault()
    const res = await window.hddTakip?.auth.addStaff({ username, password })
    if (!res?.ok) {
      setMessage({ type: 'err', text: res?.error || 'Eklenemedi' })
      return
    }
    setMessage({
      type: 'ok',
      text:
        res.message ||
        `${username} eklendi. Yönetici onayından sonra giriş yapabilir.`,
    })
    setUsername('')
    setPassword('1234')
    refresh()
  }

  return (
    <div className="company-admin">
      <section className="section">
        <h2>Personel Tanıt</h2>
        <p className="section-desc">
          Default şifre verebilirsin; personel sonra Hesap sekmesinden şifresini değiştirebilir
          (kullanıcı adı sabit).
        </p>
        <form className="panel-form" onSubmit={addStaff}>
          <div className="field-row">
            <div className="field">
              <label>Kullanıcı adı</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="field">
              <label>Default şifre</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>
          <button type="submit" className="btn primary">
            Personel Ekle
          </button>
        </form>
      </section>

      <section className="section">
        <h2>Personel Listesi</h2>
        {staff.length === 0 ? (
          <p className="empty-list">Henüz personel yok.</p>
        ) : (
          <ul className="staff-list">
            {staff.map((s) => (
              <li key={s.id}>
                <span className="mono">{s.username}</span>
                {s.password != null && <span className="muted">şifre: {s.password}</span>}
                {s.accountStatus === 'pending' && (
                  <span className="sn-hint">Onay bekliyor</span>
                )}
                {s.accountStatus === 'rejected' && (
                  <span className="sn-hint err">Reddedildi</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {message && (
        <p className={message.type === 'ok' ? 'msg ok' : 'msg err'}>{message.text}</p>
      )}
    </div>
  )
}
