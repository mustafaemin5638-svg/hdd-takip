const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { autoUpdater } = require('electron-updater')
const auth = require('./authStore.cjs')

const isDev = !app.isPackaged
const wantsOwnerMode =
  process.argv.includes('--owner') || process.env.HDD_OWNER_PANEL === '1'

/** Tek seferlik aktivasyon kodu özeti — müşteri kurulumlarında panel açılmaz */
const OWNER_UNLOCK_HASH =
  'a9fd7c0509a45f948e783074c7ab9c3e85028d6df9d9d87b1b4df70ca006336e'

function ownerUnlockPath() {
  return path.join(app.getPath('userData'), 'owner-panel.enabled')
}

function isOwnerPanelAllowed() {
  if (isDev) return true
  if (process.env.HDD_OWNER_PANEL === '1') return true
  try {
    return fs.existsSync(ownerUnlockPath())
  } catch {
    return false
  }
}

function writeOwnerUnlock() {
  fs.writeFileSync(
    ownerUnlockPath(),
    JSON.stringify({ enabledAt: new Date().toISOString() }, null, 2),
    'utf8',
  )
}

/** Pencere / hash için: --owner isteği var mı (kilit ekranı dahil) */
const isOwnerMode = wantsOwnerMode

/** @type {BrowserWindow | null} */
let mainWindow = null

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

function denyUnlessOwner() {
  if (isOwnerPanelAllowed()) return null
  return { ok: false, error: 'Yönetici paneli bu kurulumda etkin değil.' }
}

/** Setup ile kurulum kontrolü — taşınabilir kopyayı engellemeye çalışır */
function checkInstallGuard() {
  if (isDev) return { ok: true, mode: 'dev' }
  // Yönetici paneli de kurulu Setup üzerinden çalışır
  const exe = app.getPath('exe').toLowerCase()
  const local = (process.env.LOCALAPPDATA || '').toLowerCase()
  const pf = (process.env.ProgramFiles || '').toLowerCase()
  const pf86 = (process.env['ProgramFiles(x86)'] || '').toLowerCase()

  const allowedRoots = [local, pf, pf86].filter(Boolean)
  const inAllowed = allowedRoots.some((root) => root && exe.startsWith(root))
  const looksInstalled = /hdd.?takip|programs\\/.test(exe)

  if (!inAllowed && !looksInstalled) {
    return {
      ok: false,
      error:
        'HDD TAKİP yalnızca kurulum (Setup) dosyası ile çalışır. Klasörü kopyalayarak kullanamazsın. Lütfen Setup ile kur.',
    }
  }
  return { ok: true, mode: 'installed' }
}

function createWindow() {
  const iconPath = path.join(__dirname, '../build/icon.ico')
  mainWindow = new BrowserWindow({
    width: isOwnerMode ? 1280 : 1180,
    height: isOwnerMode ? 860 : 800,
    minWidth: isOwnerMode ? 980 : 900,
    minHeight: 640,
    title: isOwnerMode ? 'HDD TAKİP Yönetici Paneli' : 'HDD TAKİP',
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (isDev) {
    const url = isOwnerMode
      ? 'http://localhost:5173/#owner'
      : 'http://localhost:5173/'
    mainWindow.loadURL(url)
  } else {
    const indexHtml = path.join(__dirname, '..', 'dist', 'index.html')
    if (isOwnerMode) {
      mainWindow.loadFile(indexHtml, { hash: 'owner' })
    } else {
      mainWindow.loadFile(indexHtml)
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function setupAutoUpdater() {
  if (isDev) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  // Hataları yutma — banner'da görünsün
  autoUpdater.logger = {
    info: (...args) => console.log('[updater]', ...args),
    warn: (...args) => console.warn('[updater]', ...args),
    error: (...args) => console.error('[updater]', ...args),
    debug: (...args) => console.log('[updater:debug]', ...args),
  }

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
    const friendly = /404|CHANGE_ME|releases\.atom/i.test(raw)
      ? 'Güncelleme sunucusuna ulaşılamadı. İnternet veya GitHub Release ayarını kontrol et.'
      : raw
    sendToRenderer('updater:status', {
      status: 'error',
      message: friendly,
    })
  })

  ipcMain.handle('updater:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return result?.updateInfo?.version ?? null
    } catch (err) {
      const raw = err?.message || String(err)
      sendToRenderer('updater:status', { status: 'error', message: raw })
      throw err
    }
  })

  ipcMain.handle('updater:download', async () => {
    await autoUpdater.downloadUpdate()
    return true
  })

  ipcMain.handle('updater:install', () => {
    // Sessiz kurulum: NSIS "Yükleniyor" penceresini gösterme
    autoUpdater.quitAndInstall(true, true)
    return true
  })

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      sendToRenderer('updater:status', {
        status: 'error',
        message: err?.message || String(err),
      })
    })
  }, 2500)

  setInterval(
    () => {
      autoUpdater.checkForUpdates().catch(() => {})
    },
    1000 * 60 * 60 * 4,
  )
}

function setupAuthIpc() {
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:installGuard', () => checkInstallGuard())
  ipcMain.handle('app:quit', () => {
    app.quit()
    return true
  })
  ipcMain.handle('app:createOwnerDesktopShortcut', async () => {
    const denied = denyUnlessOwner()
    if (denied) return denied
    try {
      const os = require('os')
      const { execFileSync } = require('child_process')
      const projectRoot = path.join(__dirname, '..')
      const home = os.homedir()

      // OneDrive kullanma — sadece klasik Masaüstü
      const desktop = path.join(home, 'Desktop')
      fs.mkdirSync(desktop, { recursive: true })
      writeOwnerUnlock()

      if (isDev) {
        // Türkçe klasör yolu .lnk içinde bozuluyor → 8.3 kısa yol kullan
        const vbsPath = path.join(projectRoot, 'scripts', 'start-owner.vbs')
        const shortcutPath = path.join(desktop, 'HDD TAKIP Yonetici.lnk')
        const wscript = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'wscript.exe')

        for (const junk of [
          path.join(desktop, 'HDD TAKIP Yonetici.bat'),
          path.join(desktop, 'HDD TAKIP Yonetici.vbs'),
          path.join(desktop, 'HDD TAKIP Yonetici.cmd'),
        ]) {
          try {
            if (fs.existsSync(junk)) fs.unlinkSync(junk)
          } catch {
            /* ignore */
          }
        }

        const ps = `
$ErrorActionPreference = 'Stop'
$fso = New-Object -ComObject Scripting.FileSystemObject
$projectRoot = ${JSON.stringify(projectRoot)}
$vbsPath = ${JSON.stringify(vbsPath)}
$shortcutPath = ${JSON.stringify(shortcutPath)}
$wscript = ${JSON.stringify(wscript)}
$rootShort = $fso.GetFolder($projectRoot).ShortPath
$vbsShort = $fso.GetFile($vbsPath).ShortPath
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $wscript
$Shortcut.Arguments = "//B $vbsShort"
$Shortcut.WorkingDirectory = $rootShort
$Shortcut.WindowStyle = 7
$Shortcut.Description = 'NEXTSOFTWARE HDD TAKIP Yonetici Paneli'
$Shortcut.Save()
Write-Output $shortcutPath
`
        const psFile = path.join(os.tmpdir(), 'hdd-owner-shortcut-dev.ps1')
        fs.writeFileSync(psFile, `\uFEFF${ps}`, 'utf8')
        const out = execFileSync(
          'powershell.exe',
          ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psFile],
          { windowsHide: true, encoding: 'utf8' },
        )
        return { ok: true, path: String(out).trim() || shortcutPath }
      }

      const shortcutPath = path.join(desktop, 'HDD TAKIP Yonetici.lnk')
      const targetPath = app.getPath('exe')
      const workDir = path.dirname(targetPath)

      const ps = `
$shortcutPath = ${JSON.stringify(shortcutPath)}
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = ${JSON.stringify(targetPath)}
$Shortcut.Arguments = '--owner'
$Shortcut.WorkingDirectory = ${JSON.stringify(workDir)}
$Shortcut.WindowStyle = 1
$Shortcut.Description = 'NEXTSOFTWARE HDD TAKIP Yonetici Paneli'
$Shortcut.Save()
Write-Output $shortcutPath
`
      const psFile = path.join(os.tmpdir(), 'hdd-owner-shortcut.ps1')
      fs.writeFileSync(psFile, `\uFEFF${ps}`, 'utf8')
      const out = execFileSync(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psFile],
        { windowsHide: true, encoding: 'utf8' },
      )
      return { ok: true, path: String(out).trim() || shortcutPath }
    } catch (err) {
      return { ok: false, error: err?.message || String(err) }
    }
  })

  ipcMain.handle('app:getOwnerAccess', () => ({
    allowed: isOwnerPanelAllowed(),
    wantsOwner: wantsOwnerMode,
  }))

  ipcMain.handle('app:enableOwnerPanel', (_e, code) => {
    const raw = String(code || '').trim()
    if (!raw) return { ok: false, error: 'Aktivasyon kodu gerekli.' }
    const hash = crypto.createHash('sha256').update(raw).digest('hex')
    if (hash !== OWNER_UNLOCK_HASH) {
      return { ok: false, error: 'Aktivasyon kodu hatalı.' }
    }
    try {
      writeOwnerUnlock()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err?.message || String(err) }
    }
  })

  const ownerOnly = (handler) => (_e, ...args) => {
    const denied = denyUnlessOwner()
    if (denied) return denied
    return handler(...args)
  }

  ipcMain.handle('auth:getSession', () => auth.getSession())
  ipcMain.handle('auth:logout', () => auth.logout())
  ipcMain.handle('auth:getRemembered', () => auth.getRemembered())
  ipcMain.handle('auth:getMachineBinding', () => auth.getMachineBinding())
  ipcMain.handle(
    'auth:hasMasterPassword',
    ownerOnly(() => auth.hasMasterPassword()),
  )
  ipcMain.handle(
    'auth:setMasterPassword',
    ownerOnly((password) => auth.setMasterPassword(password)),
  )
  ipcMain.handle(
    'auth:listCredentials',
    ownerOnly((masterPassword) => auth.listDirectory(masterPassword)),
  )
  ipcMain.handle(
    'auth:grantLicense',
    ownerOnly((payload) => auth.grantOrExtendLicense(payload)),
  )
  ipcMain.handle(
    'auth:setLicenseStatus',
    ownerOnly((payload) => auth.setLicenseStatus(payload)),
  )
  ipcMain.handle(
    'auth:setRemoteLicenseUrl',
    ownerOnly((payload) => auth.setRemoteLicenseUrl(payload)),
  )
  ipcMain.handle(
    'auth:getRemoteLicenseUrl',
    ownerOnly((masterPassword) => auth.getRemoteLicenseUrl(masterPassword)),
  )
  ipcMain.handle(
    'auth:updateIndividual',
    ownerOnly((payload) => auth.updateIndividual(payload)),
  )
  ipcMain.handle(
    'auth:updateCompany',
    ownerOnly((payload) => auth.updateCompany(payload)),
  )
  ipcMain.handle(
    'auth:updateStaffMember',
    ownerOnly((payload) => auth.updateStaffMember(payload)),
  )
  ipcMain.handle(
    'auth:deleteIndividual',
    ownerOnly((payload) => auth.deleteIndividual(payload)),
  )
  ipcMain.handle(
    'auth:deleteCompany',
    ownerOnly((payload) => auth.deleteCompany(payload)),
  )
  ipcMain.handle(
    'auth:deleteStaffMember',
    ownerOnly((payload) => auth.deleteStaffMember(payload)),
  )
  ipcMain.handle(
    'auth:setAccountStatus',
    ownerOnly((payload) => auth.setAccountStatus(payload)),
  )
  ipcMain.handle('auth:registerIndividual', (_e, payload) => auth.registerIndividual(payload))
  ipcMain.handle('auth:loginIndividual', (_e, payload) => auth.loginIndividual(payload))
  ipcMain.handle('auth:registerCompanyAdmin', (_e, payload) => auth.registerCompanyAdmin(payload))
  ipcMain.handle('auth:loginCompanyAdmin', (_e, payload) => auth.loginCompanyAdmin(payload))
  ipcMain.handle('auth:loginCompanyStaff', (_e, payload) => auth.loginCompanyStaff(payload))
  ipcMain.handle('auth:addStaff', (_e, payload) => auth.addStaff(payload))
  ipcMain.handle('auth:listStaff', () => auth.listStaff())
  ipcMain.handle('auth:changeOwnPassword', (_e, payload) => auth.changeOwnPassword(payload))
}

app.whenReady().then(() => {
  auth.ensureMachineFile()
  setupAuthIpc()
  createWindow()
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
