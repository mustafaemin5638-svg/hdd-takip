const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { autoUpdater } = require('electron-updater')
const auth = require('./authStore.cjs')

const isDev = !app.isPackaged
const isOwnerMode =
  process.argv.includes('--owner') || process.env.HDD_OWNER_PANEL === '1'

/** @type {BrowserWindow | null} */
let mainWindow = null

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
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
    const result = await autoUpdater.checkForUpdates()
    return result?.updateInfo?.version ?? null
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
    autoUpdater.checkForUpdates().catch(() => {})
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
    try {
      const fs = require('fs')
      const os = require('os')
      const { execFileSync } = require('child_process')
      const projectRoot = path.join(__dirname, '..')
      const home = os.homedir()

      // OneDrive kullanma — sadece klasik Masaüstü
      const desktop = path.join(home, 'Desktop')
      fs.mkdirSync(desktop, { recursive: true })

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

  ipcMain.handle('auth:getSession', () => auth.getSession())
  ipcMain.handle('auth:logout', () => auth.logout())
  ipcMain.handle('auth:getRemembered', () => auth.getRemembered())
  ipcMain.handle('auth:getMachineBinding', () => auth.getMachineBinding())
  ipcMain.handle('auth:hasMasterPassword', () => auth.hasMasterPassword())
  ipcMain.handle('auth:setMasterPassword', (_e, password) => auth.setMasterPassword(password))
  ipcMain.handle('auth:listCredentials', (_e, masterPassword) =>
    auth.listDirectory(masterPassword),
  )
  ipcMain.handle('auth:grantLicense', (_e, payload) => auth.grantOrExtendLicense(payload))
  ipcMain.handle('auth:setLicenseStatus', (_e, payload) => auth.setLicenseStatus(payload))
  ipcMain.handle('auth:setRemoteLicenseUrl', (_e, payload) => auth.setRemoteLicenseUrl(payload))
  ipcMain.handle('auth:getRemoteLicenseUrl', (_e, masterPassword) =>
    auth.getRemoteLicenseUrl(masterPassword),
  )
  ipcMain.handle('auth:updateIndividual', (_e, payload) => auth.updateIndividual(payload))
  ipcMain.handle('auth:updateCompany', (_e, payload) => auth.updateCompany(payload))
  ipcMain.handle('auth:updateStaffMember', (_e, payload) => auth.updateStaffMember(payload))
  ipcMain.handle('auth:deleteIndividual', (_e, payload) => auth.deleteIndividual(payload))
  ipcMain.handle('auth:deleteCompany', (_e, payload) => auth.deleteCompany(payload))
  ipcMain.handle('auth:deleteStaffMember', (_e, payload) => auth.deleteStaffMember(payload))
  ipcMain.handle('auth:setAccountStatus', (_e, payload) => auth.setAccountStatus(payload))
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
