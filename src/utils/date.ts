/** PC saatinden anlık Date */
export function nowFromPc(): Date {
  return new Date()
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Görüntü: GG/AA/YYYY */
export function formatDate(iso?: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

/** Form input için GG/AA/YYYY (PC saati) */
export function toDayMonthYear(date: Date = nowFromPc()): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

/** GG/AA/YYYY → ISO (saat PC'nin o anki saatiyle birleştirilir) */
export function fromDayMonthYear(
  value: string,
  timeSource: Date = nowFromPc(),
): string | null {
  const trimmed = value.trim()
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)
  if (!match) return null

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])

  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const date = new Date(
    year,
    month - 1,
    day,
    timeSource.getHours(),
    timeSource.getMinutes(),
    timeSource.getSeconds(),
    timeSource.getMilliseconds(),
  )

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date.toISOString()
}

export function formatLiveClock(date: Date = nowFromPc()): string {
  return `${toDayMonthYear(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
