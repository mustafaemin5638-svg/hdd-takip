import {
  useEffect,
  useRef,
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

  useEffect(() => {
    if (focusIndex.current == null) return
    const el = inputRefs.current[focusIndex.current]
    el?.focus()
    focusIndex.current = null
  }, [values.length])

  function setAt(index: number, value: string) {
    const next = [...values]
    next[index] = value
    onChange(ensureTrailingEmpty(next))
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
    focusIndex.current = Math.min(before.length + pasted.length, merged.length - 1)
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const nextIndex = index + 1
      if (nextIndex < values.length) {
        inputRefs.current[nextIndex]?.focus()
      } else {
        onChange(ensureTrailingEmpty([...values, '']))
        focusIndex.current = values.length
      }
    }
    if (e.key === 'Backspace' && values[index] === '' && values.length > 1 && index > 0) {
      e.preventDefault()
      removeAt(index)
      focusIndex.current = index - 1
    }
  }

  return (
    <div className="serial-rows">
      <div className="serial-rows-head">
        <label>S/N listesi</label>
        <span className="serial-count">{filled} adet</span>
      </div>
      <p className="hint">
        Satır satır yaz. Enter ile sonraki satıra geç. Toplu yapıştırma desteklenir.
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
                onChange={(e) => setAt(index, e.target.value)}
                onPaste={(e) => handlePaste(index, e)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                placeholder={placeholder}
                autoComplete="off"
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
