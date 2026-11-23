import type { Hdd } from '../types/hdd'
import { normalizeTur, turLabel } from '../types/hdd'
import { deleteManyBySerial, findBySerial } from '../storage/hddStore'
import { SerialRows } from './SerialRows'
import { useMemo, useState, type FormEvent } from 'react'

interface Props {
  onChanged: () => void
}

export function DeletePanel({ onChanged }: Props) {
  const [serials, setSerials] = useState<string[]>([''])
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  )

  const preview = useMemo(() => {
    return serials.map((raw) => {
      const sn = raw.trim().toUpperCase()
      if (!sn) return null
      const disk = findBySerial(sn)
      if (!disk) return { kind: 'missing' as const, sn }
      return { kind: 'found' as const, sn, disk }
    })
  }, [serials])

  const found = preview.filter(
    (p): p is { kind: 'found'; sn: string; disk: Hdd } => p?.kind === 'found',
  )
  const readyCount = found.length

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (readyCount === 0) {
      setMessage({ type: 'err', text: 'Silinecek kayıtlı S/N yok.' })
      return
    }

    const stock = found.filter((f) => f.disk.durum === 'stokta').length
    const sold = found.filter((f) => f.disk.durum === 'satildi').length
    const parts = [`${readyCount} kayıt silinecek`]
    if (stock) parts.push(`${stock} stokta`)
    if (sold) parts.push(`${sold} satılmış`)
    if (
      !window.confirm(
        `${parts.join(' · ')}.\n\nBu işlem geri alınamaz. Devam edilsin mi?`,
      )
    ) {
      return
    }

    const result = deleteManyBySerial(serials)
    if (!result.ok) {
      setMessage({ type: 'err', text: result.error })
      return
    }

    const msgParts = [`${result.deleted.length} S/N silindi.`]
    if (result.missing.length > 0) {
      msgParts.push(
        `Bulunamayan ${result.missing.length}: ${result.missing.slice(0, 5).join(', ')}${
          result.missing.length > 5 ? '…' : ''
        }`,
      )
    }
    setMessage({ type: 'ok', text: msgParts.join(' ') })
    setSerials([''])
    onChanged()
  }

  return (
    <form className="panel-form" onSubmit={handleSubmit}>
      <SerialRows
        values={serials}
        onChange={setSerials}
        idPrefix="sil-sn"
        placeholder="Silinecek S/N…"
        renderHint={(_value, index) => {
          const info = preview[index]
          if (!info) return null
          if (info.kind === 'missing') {
            return <span className="sn-hint err">Kayıtta yok</span>
          }
          const { disk } = info
          const tur = turLabel(normalizeTur(disk.tur))
          const durum = disk.durum === 'stokta' ? 'Stokta' : 'Satıldı'
          return (
            <span className={disk.durum === 'stokta' ? 'sn-hint ok' : 'sn-hint warn'}>
              {tur} · {disk.depolama} · {disk.boyut} · {durum}
            </span>
          )
        }}
      />

      <button type="submit" className="btn danger" disabled={readyCount === 0}>
        {readyCount > 1 ? `${readyCount} Kaydı Sil` : 'Kaydı Sil'}
      </button>

      {message && (
        <p className={message.type === 'ok' ? 'msg ok' : 'msg err'} role="status">
          {message.text}
        </p>
      )}
    </form>
  )
}
