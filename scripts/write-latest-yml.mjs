/**
 * electron-builder latest.yml üret (manuel release yüklemesi için).
 * Kullanım: node scripts/write-latest-yml.mjs [sürüm]
 * Sürüm verilmezse package.json okunur.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const version = process.argv[2] || pkg.version
const exe = `C:/hdd-takip-release/HDD-TAKIP-Setup-${version}.exe`
const buf = readFileSync(exe)
const sha = createHash('sha512').update(buf).digest('base64')
const size = buf.length
const yml = `version: ${version}
files:
  - url: HDD-TAKIP-Setup-${version}.exe
    sha512: ${sha}
    size: ${size}
path: HDD-TAKIP-Setup-${version}.exe
sha512: ${sha}
releaseDate: '${new Date().toISOString()}'
`
writeFileSync('C:/hdd-takip-release/latest.yml', yml)
console.log(yml)
