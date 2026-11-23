/**
 * Yönetici paneli — CMD/konsol açmadan.
 * shell:true KULLANMA (Windows'ta siyah cmd bırakır).
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import net from 'node:net'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const electronExe = require('electron')
const viteJs = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1')
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
  })
}

function hideSpawn(command, args, { hide = true } = {}) {
  const child = spawn(command, args, {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    windowsHide: hide,
    shell: false,
    env: { ...process.env },
  })
  child.unref()
  return child
}

async function waitForPort(port, timeoutMs = 90000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await portOpen(port)) return true
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

const busy = await portOpen(5173)

if (!busy) {
  hideSpawn(process.execPath, [viteJs], { hide: true })
  const ok = await waitForPort(5173)
  if (!ok) {
    process.exit(1)
  }
}

// Electron GUI — windowsHide kullanma (pencere görünmez kalabiliyor)
hideSpawn(electronExe, ['.', '--', '--owner'], { hide: false })
process.exit(0)
