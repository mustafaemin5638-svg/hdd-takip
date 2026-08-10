export type UpdaterStatus =
  | { status: 'checking' }
  | { status: 'available'; version: string; releaseNotes?: string | null }
  | { status: 'not-available' }
  | { status: 'downloading'; percent: number; transferred: number; total: number }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string }

export interface HddTakipApi {
  getVersion: () => Promise<string>
  checkForUpdates: () => Promise<string | null>
  downloadUpdate: () => Promise<boolean>
  installUpdate: () => Promise<boolean>
  onUpdaterStatus: (callback: (payload: UpdaterStatus) => void) => () => void
}

declare global {
  interface Window {
    hddTakip?: HddTakipApi
  }
}

export {}
