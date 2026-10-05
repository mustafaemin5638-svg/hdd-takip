import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { parseSerialList } from '../storage/hddStore'

interface Props {
  values: string[]
  onChange: (values: string[]) => void
  /** Her satırın altında gösterilecek ek bilgi (satış önizlemesi vb.) */
  renderHint?: (serial: string, index: number) => ReactNode
  placeholder?: string
  idPrefix?: string
}

/** Barkod okuyucu karakter aralığı (ms) — insan yazımından ayırt etmek için */
const SCAN_CHAR_GAP_MS = 45
/** Son karakterden sonra satıra geçmeden önce bekleme */
const SCAN_IDLE_MS = 90
/** Otomatik geçiş için minimum S/N uzunluğu */
const SCAN_MIN_LEN = 4

function ensureTrailingEmpty(list: string[]): string[] {
  if (list.length === 0) return ['']
  if (list[list.length - 1].trim() !== '') return [...list, '']
  return list
}

export function SerialRows({
  values,
  onChange,
  renderHint,
  placeholder = 'S/N yaz…',
  idPrefix = 'sn',
}: Props) {
  const filled = values.filter((v) => v.trim()).length
  const focusIndex = useRef<number | null>(null)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const [focusTick, setFocusTick] = useState(0)

  const lastCharAt = useRef(0)
  const rapidCount = useRef(0)
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const valuesRef = useRef(values)
  valuesRef.current = values

  function requestFocus(index: number) {
    focusIndex.current = index
    setFocusTick((t) => t + 1)
  }

  useEffect(() => {
    if (focusIndex.current == null) return
    const idx = focusIndex.current

    const tryFocus = () => {
      const el = inputRefs.current[idx]
      if (!el) return false
      el.focus()
      focusIndex.current = null
      return true
    }

    if (tryFocus()) return

    const raf = requestAnimationFrame(() => {
      if (!tryFocus()) {
        setTimeout(tryFocus, 0)
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [values.length, focusTick])

  function advanceFrom(index: number) {
    if (scanTimer.current) {
      clearTimeout(scanTimer.current)
      scanTimer.current = null
    }
    rapidCount.current = 0

    const current = valuesRef.current
    const nextIndex = index + 1
    if (nextIndex < current.length) {
      requestFocus(nextIndex)
      return
    }
    onChange(ensureTrailingEmpty([...current, '']))
    requestFocus(current.length)
  }

  function setAt(index: number, value: string): boolean {
    // Bazı okuyucular CR/LF'yi karaktere gömer
    if (/[\r\n]/.test(value)) {
      const cleaned = value.replace(/[\r\n]+/g, '')
      const next = [...valuesRef.current]
      next[index] = cleaned
      onChange(ensureTrailingEmpty(next))
      if (cleaned.trim()) advanceFrom(index)
      return true
    }

    const next = [...valuesRef.current]
    next[index] = value
    onChange(ensureTrailingEmpty(next))
    return false
  }

  function removeAt(index: number) {
    const next = values.filter((_, i) => i !== index)
    onChange(ensureTrailingEmpty(next))
  }

  function handlePaste(index: number, e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text')
    if (!/[\n\r,;\t]/.test(text)) return

    e.preventDefault()
    const pasted = parseSerialList(text)
    if (pasted.length === 0) return

    const before = values.slice(0, index).filter((v) => v.trim())
    const after = values
      .slice(index + 1)
      .filter((v) => v.trim())
    const merged = ensureTrailingEmpty([...before, ...pasted, ...after])
    onChange(merged)
    requestFocus(Math.min(before.length + pasted.length, merged.length - 1))
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    const isEnter =
      e.key === 'Enter' || e.code === 'NumpadEnter' || e.key === 'NumpadEnter'
    const isTab = e.key === 'Tab' && !e.shiftKey && values[index].trim() !== ''

    if (isEnter || isTab) {
      e.preventDefault()
      e.stopPropagation()
      // Boş satırda Enter: form submit olmasın, ekstra satır da açılmasın
      if (values[index].trim() !== '') {
        advanceFrom(index)
      }
      return
    }

    if (e.key === 'Backspace' && values[index] === '' && values.length > 1 && index > 0) {
      e.preventDefault()
      removeAt(index)
      requestFocus(index - 1)
    }
  }

  function handleChange(index: number, raw: string) {
    const now = Date.now()
    const gap = now - lastCharAt.current
    lastCharAt.current = now

    if (gap > 0 && gap <= SCAN_CHAR_GAP_MS) {
      rapidCount.current += 1
    } else {
      rapidCount.current = 1
    }

    const advanced = setAt(index, raw)
    if (advanced) return

    if (scanTimer.current) clearTimeout(scanTimer.current)

    // Enter/Tab göndermeyen okuyucular: hızlı yazım bittikten sonra sonraki satıra geç
    const cleaned = raw.replace(/[\r\n]+/g, '')
    scanTimer.current = setTimeout(() => {
      scanTimer.current = null
      if (
        rapidCount.current >= SCAN_MIN_LEN &&
        cleaned.trim().length >= SCAN_MIN_LEN
      ) {
        advanceFrom(index)
      }
    }, SCAN_IDLE_MS)
  }

  useEffect(() => {
    return () => {
      if (scanTimer.current) clearTimeout(scanTimer.current)
    }
  }, [])

  return (
    <div className="serial-rows">
      <div className="serial-rows-head">
        <label>S/N listesi</label>
        <span className="serial-count">{filled} adet</span>
      </div>
      <p className="hint">
        Barkod okutunca otomatik sonraki satıra geçer. Enter / Tab ile de geçebilirsin.
        Toplu yapıştırma desteklenir.
      </p>
      <div className="serial-list">
        {values.map((value, index) => (
          <div key={`${idPrefix}-${index}`} className="serial-row">
            <span className="serial-index">{index + 1}</span>
            <div className="serial-input-wrap">
              <input
                ref={(el) => {
                  inputRefs.current[index] = el
                }}
                id={`${idPrefix}-${index}`}
                className="mono"
                value={value}
                onChange={(e) => handleChange(index, e.target.value)}
                onPaste={(e) => handlePaste(index, e)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                placeholder={placeholder}
                autoComplete="off"
                enterKeyHint="next"
              />
              {renderHint?.(value, index)}
            </div>
            {value.trim() !== '' || index < values.length - 1 ? (
              <button
                type="button"
                className="serial-remove"
                onClick={() => removeAt(index)}
                aria-label="Satırı sil"
                title="Sil"
              >
                ×
              </button>
            ) : (
              <span className="serial-remove spacer" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
