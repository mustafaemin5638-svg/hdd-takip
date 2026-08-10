import { useEffect, useState } from 'react'
import { formatLiveClock, nowFromPc } from '../utils/date'

/** PC saatini saniyede bir günceller */
export function LiveClock() {
  const [now, setNow] = useState(() => nowFromPc())

  useEffect(() => {
    const id = window.setInterval(() => setNow(nowFromPc()), 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="live-clock" title="Bilgisayar saati">
      <span className="stat-label">PC Tarihi (Gün/Ay/Yıl)</span>
      <strong className="clock-text">{formatLiveClock(now)}</strong>
    </div>
  )
}
