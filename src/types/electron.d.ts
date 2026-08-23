import type { AuthApi } from './auth'

export type UpdaterStatus =
  | { status: 'checking' }
  | { status: 'available'; version: string; releaseNotes?: string | null }
  | { status: 'not-available' }
  | { status: 'downloading'; percent: number; transferred: number; total: number }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string }

export interface HddTakipApi {
  getVersion: () => Promise<string>
  installGuard: () => Promise<{ ok: boolean; mode?: string; error?: string }>
  quit: () => Promise<boolean>
  savePdf: (payload: {
    html: string
    defaultFileName?: string
  }) => Promise<{ ok: boolean; path?: string; canceled?: boolean; error?: string }>
  createOwnerDesktopShortcut: () => Promise<{ ok: boolean; path?: string; error?: string }>
  getOwnerAccess: () => Promise<{ allowed: boolean; wantsOwner: boolean }>
  enableOwnerPanel: (code: string) => Promise<{ ok: boolean; error?: string }>
  checkForUpdates: () => Promise<{
    available: boolean
    version: string | null
    current: string
  }>
  downloadUpdate: () => Promise<boolean>
  installUpdate: () => Promise<boolean>
  onUpdaterStatus: (callback: (payload: UpdaterStatus) => void) => () => void
  auth: AuthApi
}

declare global {
  interface Window {
    hddTakip?: HddTakipApi
  }
}
