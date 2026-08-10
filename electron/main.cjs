const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { autoUpdater } = require('electron-updater')

const isDev = !app.isPackaged

/** @type {BrowserWindow | null} */
let mainWindow = null

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 900,
    minHeight: 640,
    title: 'HDD TAKİP',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function setupAutoUpdater() {
  if (isDev) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    sendToRenderer('updater:status', { status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    sendToRenderer('updater:status', {
      status: 'available',
      version: info.version,
      releaseNotes: info.releaseNotes ?? null,
    })
  })

  autoUpdater.on('update-not-available', () => {
    sendToRenderer('updater:status', { status: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('updater:status', {
      status: 'downloading',
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    sendToRenderer('updater:status', {
      status: 'downloaded',
      version: info.version,
    })
  })

  autoUpdater.on('error', (err) => {
    const raw = err?.message || String(err)
    // İlk kurulum / repo yokken 404 gürültüsünü kullanıcıya ham gösterme
    const friendly = /404|CHANGE_ME|releases\.atom/i.test(raw)
      ? 'Güncelleme sunucusuna ulaşılamadı. İnternet veya GitHub Release ayarını kontrol et.'
      : raw
    sendToRenderer('updater:status', {
      status: 'error',
      message: friendly,
    })
  })

  ipcMain.handle('updater:check', async () => {
    const result = await autoUpdater.checkForUpdates()
    return result?.updateInfo?.version ?? null
  })

  ipcMain.handle('updater:download', async () => {
    await autoUpdater.downloadUpdate()
    return true
  })

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall(false, true)
    return true
  })

  // Açılışta ve sonra periyodik kontrol
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 2500)

  setInterval(
    () => {
      autoUpdater.checkForUpdates().catch(() => {})
    },
    1000 * 60 * 60 * 4,
  )
}

ipcMain.handle('app:getVersion', () => app.getVersion())

app.whenReady().then(() => {
  createWindow()
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
