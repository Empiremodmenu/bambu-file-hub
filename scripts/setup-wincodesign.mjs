/**
 * Pre-build helper: downloads and extracts winCodeSign-2.6.0 into the
 * electron-builder cache, ignoring the macOS symlinks that Windows can't create.
 *
 * Without this, electron-builder retries forever and the build never succeeds
 * unless Developer Mode (or admin) is enabled.
 */

import https from 'https'
import http  from 'http'
import fs    from 'fs'
import path  from 'path'
import { execFileSync }     from 'child_process'
import { fileURLToPath }    from 'url'
import { homedir, platform } from 'os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Config ────────────────────────────────────────────────────────────────────
const VERSION    = 'winCodeSign-2.6.0'
const DOWNLOAD   = `https://github.com/electron-userland/electron-builder-binaries/releases/download/${VERSION}/${VERSION}.7z`
const CACHE_BASE = path.join(homedir(), 'AppData', 'Local', 'electron-builder', 'Cache', 'winCodeSign')
const FINAL_DIR  = path.join(CACHE_BASE, VERSION)
const SEVEN_ZA   = path.join(__dirname, '..', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe')
const ARCHIVE    = path.join(CACHE_BASE, `${VERSION}.7z`)

// ── Helpers ───────────────────────────────────────────────────────────────────
function log(msg) { console.log(`[setup-wincodesign] ${msg}`) }

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http
    proto.get(url, { timeout: 60000 }, (res) => {
      // Follow redirects (GitHub releases → CDN)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`))
      }
      const total = parseInt(res.headers['content-length'] || '0', 10)
      let received = 0
      let lastPct  = -1
      const file   = fs.createWriteStream(dest)
      res.on('data', (chunk) => {
        received += chunk.length
        if (total) {
          const pct = Math.floor((received / total) * 100)
          if (pct !== lastPct && pct % 10 === 0) { log(`  ${pct}%`); lastPct = pct }
        }
      })
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
      file.on('error', reject)
    }).on('error', reject)
  })
}

function isOnlySymlinkErrors(stdoutStr, stderrStr) {
  const combined = (stdoutStr + stderrStr)
  const errorLines = combined.split('\n').filter(l => l.startsWith('ERROR:'))
  return errorLines.length > 0 && errorLines.every(l => l.includes('Cannot create symbolic link'))
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (platform() !== 'win32') {
    log('Not on Windows, skipping.')
    return
  }

  if (fs.existsSync(FINAL_DIR)) {
    log(`Cache hit: ${FINAL_DIR}`)
    return
  }

  log(`Cache miss — preparing ${VERSION}`)
  fs.mkdirSync(CACHE_BASE, { recursive: true })

  // Download archive if needed
  if (!fs.existsSync(ARCHIVE)) {
    log(`Downloading ${DOWNLOAD} …`)
    await download(DOWNLOAD, ARCHIVE)
    log('Download complete.')
  } else {
    log('Archive already downloaded.')
  }

  // Extract, tolerating the macOS symlink failures
  const tempDir = `${FINAL_DIR}-extracting`
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true })
  fs.mkdirSync(tempDir, { recursive: true })

  log('Extracting (macOS symlink errors will be patched)…')
  let stdout = '', stderr = ''
  try {
    const result = execFileSync(SEVEN_ZA, ['x', ARCHIVE, `-o${tempDir}`, '-y'], { encoding: 'utf8' })
    stdout = result
  } catch (err) {
    stdout = err.stdout?.toString() ?? ''
    stderr = err.stderr?.toString() ?? ''

    if (!isOnlySymlinkErrors(stdout, stderr)) {
      throw new Error(`Extraction failed with unexpected errors:\n${stderr}\n${stdout}`)
    }

    // Patch: create empty placeholder files for the macOS symlinks
    log('Creating placeholder files for macOS symlinks…')
    const darwinLib = path.join(tempDir, 'darwin', '10.12', 'lib')
    fs.mkdirSync(darwinLib, { recursive: true })
    for (const name of ['libcrypto.dylib', 'libssl.dylib']) {
      const p = path.join(darwinLib, name)
      if (!fs.existsSync(p)) fs.writeFileSync(p, '')
    }
  }

  // Rename temp → final
  fs.renameSync(tempDir, FINAL_DIR)
  log(`✓ ${FINAL_DIR} ready.`)
}

main().catch((err) => {
  console.error('[setup-wincodesign] FATAL:', err.message)
  process.exit(1)
})
