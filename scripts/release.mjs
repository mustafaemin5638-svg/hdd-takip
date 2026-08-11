/**
 * Sürüm yükseltir ve GitHub Release olarak yayınlar.
 *
 * Kullanım:
 *   node scripts/release.mjs           -> patch (1.0.0 -> 1.0.1)
 *   node scripts/release.mjs minor     -> 1.1.0
 *   node scripts/release.mjs major     -> 2.0.0
 *   node scripts/release.mjs 1.2.3     -> tam sürüm
 *
 * Gerekli:
 *   - electron-builder.yml içinde publish.owner = GitHub kullanıcı adın
 *   - GH_TOKEN ortam değişkeni (repo yazma yetkili personal access token)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkgPath = path.join(root, 'package.json')
const builderPath = path.join(root, 'electron-builder.yml')

const arg = process.argv[2] || 'patch'

function bump(version, kind) {
  if (/^\d+\.\d+\.\d+$/.test(kind)) return kind
  const [major, minor, patch] = version.split('.').map(Number)
  if (kind === 'major') return `${major + 1}.0.0`
  if (kind === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const next = bump(pkg.version, arg)

const builderYml = readFileSync(builderPath, 'utf8')
if (builderYml.includes('owner: CHANGE_ME')) {
  console.error(
    'Hata: electron-builder.yml içinde publish.owner değerini GitHub kullanıcı adınla değiştir (CHANGE_ME).',
  )
  process.exit(1)
}

if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
  console.error(
    'Hata: GH_TOKEN (veya GITHUB_TOKEN) gerekli. GitHub Personal Access Token ayarla.',
  )
  process.exit(1)
}

pkg.version = next
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
console.log(`Sürüm: ${next}`)

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run('npm', ['run', 'build'])
run('npx', ['electron-builder', '--win', '--publish', 'always'])

// Yayın sonrası latest.yml doğrula (yanlış sürüm = eski istemciler güncelleme görmez)
try {
  const latestPath = 'C:/hdd-takip-release/latest.yml'
  const latest = readFileSync(latestPath, 'utf8')
  if (!latest.includes(`version: ${next}`)) {
    console.error(
      `Uyarı: ${latestPath} sürümü ${next} değil. electron-updater bozulabilir — dosyayı kontrol et.`,
    )
    process.exit(1)
  }
  console.log(`latest.yml doğrulandı: v${next}`)
} catch (err) {
  console.error('Uyarı: latest.yml okunamadı:', err?.message || err)
}

console.log(`Yayın tamam: v${next}`)
