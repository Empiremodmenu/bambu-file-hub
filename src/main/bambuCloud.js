import mqtt from 'mqtt'
import { readFileSync } from 'fs'
import { basename } from 'path'
import { createServer } from 'http'
import { networkInterfaces } from 'os'

const REGIONS = {
  us: {
    auth: 'https://bambulab.com/api/sign-in/legacy',
    api:  'https://api.bambulab.com',
    mqtt: 'mqtts://us.mqtt.bambulab.com:8883',
  },
  cn: {
    auth: 'https://bambulab.cn/api/sign-in/legacy',
    api:  'https://api.bambulab.cn',
    mqtt: 'mqtts://cn.mqtt.bambulab.com:8883',
  },
}

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(Buffer.from(payload, 'base64url').toString())
  } catch { return {} }
}

// ── Auth via browser window (bypasses Cloudflare) ────────────────────────────
export async function cloudLoginBrowser(mainWindow, region = 'us') {
  const { BrowserWindow } = await import('electron')
  const domain   = region === 'cn' ? 'bambulab.cn' : 'bambulab.com'
  const loginUrl = `https://${domain}/sign-in`

  return new Promise((resolve) => {
    const loginWin = new BrowserWindow({
      width: 520, height: 720,
      title: 'Sign in to Bambu Lab',
      parent: mainWindow, modal: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })

    let resolved = false
    const done = (result) => {
      if (resolved) return
      resolved = true
      try { loginWin.webContents.debugger.detach() } catch {}
      try { loginWin.close() } catch {}
      resolve(result)
    }

    let capturedJwt = ''
    try {
      loginWin.webContents.debugger.attach('1.3')
      loginWin.webContents.debugger.sendCommand('Network.enable').catch(() => {})

      loginWin.webContents.debugger.on('message', async (_event, method, params) => {
        if (method === 'Network.requestWillBeSent') {
          const auth = params.request?.headers?.Authorization || params.request?.headers?.authorization || ''
          if (auth.startsWith('Bearer eyJ') && !capturedJwt) {
            capturedJwt = auth.slice(7)
            console.log('[CDP] Captured JWT, prefix:', capturedJwt.slice(0, 30))
          }
          return
        }

        if (method !== 'Network.responseReceived') return
        const url = params.response?.url || ''
        if (!url.includes('/user-service/my/profile')) return

        try {
          const body = await loginWin.webContents.debugger.sendCommand(
            'Network.getResponseBody', { requestId: params.requestId }
          )
          const profile  = JSON.parse(body.body || '{}')
          const email    = profile.account || profile.email || ''
          const userId   = String(profile.uid || profile.uidStr || '')

          const devRaw = await loginWin.webContents.executeJavaScript(`
            fetch('/api/v1/iot-service/api/user/bind', { credentials: 'include' })
              .then(r => r.text()).catch(() => '{}')
          `).catch(() => '{}')

          const cookies = await loginWin.webContents.session.cookies.get({ domain: 'bambulab.com' })
          const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')
          const sessionToken = capturedJwt
                            || cookies.find(c => c.value?.startsWith('eyJ'))?.value
                            || cookies.find(c => c.name === 'token')?.value
                            || ''

          console.log('[CDP] Token prefix:', sessionToken.slice(0, 30))
          if (!sessionToken) { console.log('[CDP] No usable token'); return }

          const claims      = decodeJwt(sessionToken)
          const finalUserId = userId || claims.sub || ''
          const finalEmail  = email  || claims.email || ''

          let devices = []
          try {
            const devData = JSON.parse(devRaw)
            const raw = devData.devices || devData.data || (Array.isArray(devData) ? devData : [])
            devices = raw.map(mapDevice)
          } catch {}

          done({
            success: true,
            account: { accessToken: sessionToken, cookieHeader, refreshToken: '', userId: finalUserId, region, email: finalEmail },
            devices,
          })
        } catch (e) {
          console.log('[CDP] Error:', e.message)
        }
      })
    } catch (err) {
      console.error('CDP attach failed:', err)
    }

    loginWin.loadURL(loginUrl)
    loginWin.on('closed', () => done({ success: false, error: 'Login window was closed.' }))
  })
}

function mapDevice(d) {
  return {
    serial:      d.dev_id           || d.serial || '',
    name:        d.name             || d.dev_product_name || d.dev_model_name || 'Printer',
    model:       d.dev_product_name || d.dev_model_name   || '',
    ip:          d.dev_ip           || '',
    accessCode:  d.dev_access_code  || '',
    defaultMode: 'cloud',
  }
}

// ── Fetch cloud device list ───────────────────────────────────────────────────
export async function getCloudDevices(account) {
  const { net } = await import('electron')
  const r   = REGIONS[account.region] || REGIONS.us
  const res = await net.fetch(`${r.api}/v1/iot-service/api/user/bind`, {
    headers: {
      'Authorization': `Bearer ${account.accessToken}`,
      'Cookie': account.cookieHeader || '',
    },
  })
  if (!res.ok) throw new Error(`Device list failed: ${res.status}`)
  const data = await res.json()
  const list  = data.devices || data.data || (Array.isArray(data) ? data : [])
  return list.map(mapDevice)
}

// ── Local IP — prefer real LAN, skip VPN / overlay network addresses ──────────
function getLocalIP() {
  const nets = networkInterfaces()
  const lan = [], other = []

  for (const iface of Object.values(nets)) {
    for (const net of iface || []) {
      if (net.family !== 'IPv4' || net.internal) continue
      const ip  = net.address
      const oct = ip.split('.').map(Number)
      const isLan =
        oct[0] === 10 ||
        oct[0] === 192 && oct[1] === 168 ||
        oct[0] === 172 && oct[1] >= 16 && oct[1] <= 31
      ;(isLan ? lan : other).push(ip)
    }
  }

  const chosen = lan[0] || other[0] || null
  console.log('[LocalServer] Available IPs — LAN:', lan, '  Other:', other, '  Using:', chosen)
  return chosen
}

// ── Serve file from local HTTP server ─────────────────────────────────────────
async function hostFileLocally(filePath) {
  const fileData = readFileSync(filePath)
  const filename = basename(filePath)

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      res.writeHead(200, {
        'Content-Type':        'application/octet-stream',
        'Content-Length':      String(fileData.byteLength),
        'Content-Disposition': `attachment; filename="${filename}"`,
      })
      res.end(fileData)
    })

    server.listen(0, '0.0.0.0', () => {
      const ip = getLocalIP()
      if (!ip) { server.close(); reject(new Error('Could not find a LAN IP address on this machine')); return }
      const { port } = server.address()
      const url = `http://${ip}:${port}/${encodeURIComponent(filename)}`
      console.log('[LocalServer] Serving file at:', url)
      resolve({ server, url })
    })

    server.on('error', reject)
  })
}

// ── Send print command via cloud MQTT ─────────────────────────────────────────
// Connects to Bambu's cloud broker with the user's credentials.
// The cloud broker relays the print command to the printer, which then
// downloads the file from the URL we provide (our local HTTP server).
async function sendPrintViaCloudMQTT(account, printer, fileUrl, filename, plate, opts) {
  const r = REGIONS[account.region] || REGIONS.us
  return new Promise((resolve) => {
    const client = mqtt.connect(r.mqtt, {
      username:          `u_${account.userId}`,
      password:          account.accessToken,
      rejectUnauthorized: true,
      clientId:          `bfh_print_${Date.now()}`,
      connectTimeout:    10000,
    })

    const done = (result) => { try { client.end(true) } catch {}; resolve(result) }
    const timer = setTimeout(
      () => done({ success: false, error: 'Timeout — could not connect to Bambu cloud MQTT. Check your internet connection.' }),
      14000
    )

    client.on('connect', () => {
      const ext  = filename.split('.').pop().toLowerCase()
      const name = filename.replace(/\.[^.]+$/, '')

      const payload = {
        print: {
          sequence_id:    '1',
          command:        ext === 'gcode' ? 'gcode_file' : 'project_file',
          param:          ext === 'gcode' ? `/${filename}` : `Metadata/plate_${plate}.gcode`,
          url:            fileUrl,
          timelapse:      opts.timelapse       ?? false,
          bed_leveling:   opts.bedLeveling     ?? true,
          flow_cali:      opts.flowCalibration ?? false,
          vibration_cali: opts.vibrationCalibration ?? true,
          layer_inspect:  opts.layerInspect    ?? false,
          use_ams:        opts.useAms          ?? true,
          subtask_name:   name,
          md5:            '',
          ...(opts.amsMapping ? { ams_mapping: opts.amsMapping } : {}),
        },
      }

      console.log('[CloudMQTT] Publishing print command to device:', printer.serial)
      client.publish(
        `device/${printer.serial}/request`,
        JSON.stringify(payload),
        (err) => {
          clearTimeout(timer)
          if (err) done({ success: false, error: err.message })
          else done({ success: true })
        }
      )
    })

    client.on('error', (err) => {
      clearTimeout(timer)
      done({ success: false, error: `Cloud MQTT error: ${err.message}` })
    })
  })
}

// ── Cloud printer status (via cloud MQTT) ─────────────────────────────────────
export async function getCloudPrinterStatus(account, printer) {
  const r = REGIONS[account.region] || REGIONS.us
  return new Promise((resolve) => {
    const client = mqtt.connect(r.mqtt, {
      username:          `u_${account.userId}`,
      password:          account.accessToken,
      rejectUnauthorized: true,
      clientId:          `bfh_status_${Date.now()}`,
      connectTimeout:    6000,
    })

    const done = (result) => { try { client.end(true) } catch {}; resolve(result) }
    const timer = setTimeout(() => done({ online: false }), 8000)

    client.on('connect', () => {
      client.subscribe(`device/${printer.serial}/report`)
      client.publish(
        `device/${printer.serial}/request`,
        JSON.stringify({ pushing: { sequence_id: '1', command: 'pushall' } })
      )
    })

    client.on('message', (_, payload) => {
      try {
        const data = JSON.parse(payload.toString())
        if (data.print) {
          clearTimeout(timer)
          done({
            online:     true,
            state:      data.print.gcode_state || 'IDLE',
            fileName:   data.print.subtask_name || '',
            progress:   data.print.mc_percent || 0,
            remaining:  data.print.mc_remaining_time || 0,
            nozzleTemp: Math.round(data.print.nozzle_temper || 0),
            bedTemp:    Math.round(data.print.bed_temper || 0),
            amsTrays:   parseAmsTrays(data.print),
          })
        }
      } catch {}
    })

    client.on('error', () => { clearTimeout(timer); done({ online: false }) })
  })
}

// ── LAN discovery — find a printer by its access code on the local subnet ─────
async function tryPrinterIP(ip, serial, accessCode, timeoutMs = 1800) {
  return new Promise((resolve) => {
    const client = mqtt.connect(`mqtts://${ip}:8883`, {
      username:          'bblp',
      password:          accessCode,
      rejectUnauthorized: false,
      clientId:          `bfh_disco_${ip.split('.').pop()}_${Date.now()}`,
      connectTimeout:    Math.min(timeoutMs, 1500),
      reconnectPeriod:   0,
    })

    const done = (found) => { try { client.end(true) } catch {}; resolve(found) }
    const timer = setTimeout(() => done(false), timeoutMs)

    client.on('connect', () => {
      // Connected — send pushall and wait for a response on this device's topic
      client.subscribe(`device/${serial}/report`)
      client.publish(`device/${serial}/request`,
        JSON.stringify({ pushing: { sequence_id: '1', command: 'pushall' } }))
      client.on('message', () => { clearTimeout(timer); done(true) })
    })

    client.on('error', () => done(false))
  })
}

async function discoverPrinterOnLAN(serial, accessCode, localIP) {
  if (!localIP || !accessCode) return null

  const parts  = localIP.split('.')
  if (parts.length !== 4) return null
  const subnet = parts.slice(0, 3).join('.')
  const myLast = parseInt(parts[3])

  // Candidates: IPs ±25 from ours, plus common printer positions
  const set = new Set([1, 100, 101, 150, 200, 254])
  for (let i = Math.max(1, myLast - 25); i <= Math.min(254, myLast + 25); i++) set.add(i)
  set.delete(myLast) // skip our own IP

  const ips = [...set].map(n => `${subnet}.${n}`)
  console.log(`[Discovery] Scanning ${ips.length} IPs on ${subnet}.x for printer ${serial}…`)

  return new Promise((resolve) => {
    let found    = false
    let pending  = ips.length

    for (const ip of ips) {
      tryPrinterIP(ip, serial, accessCode).then(ok => {
        if (ok && !found) {
          found = true
          console.log('[Discovery] Found printer at:', ip)
          resolve(ip)
        } else {
          pending--
          if (pending === 0 && !found) resolve(null)
        }
      })
    }
  })
}

// ── Full cloud send flow ──────────────────────────────────────────────────────
export async function sendToCloudPrinter(account, printer, filePath, plate, opts, onProgress) {
  onProgress?.(3)

  let p = { ...printer }

  // 1. If no IP/accessCode, try to refresh from the cloud API
  if (!p.ip || !p.accessCode) {
    console.log('[CloudSend] Fetching fresh device info from cloud API…')
    try {
      const devices = await getCloudDevices(account)
      const fresh   = devices.find(d => d.serial === p.serial)
      if (fresh) p = { ...p, ...fresh }
      console.log('[CloudSend] After refresh — IP:', p.ip || '(none)', '  accessCode:', p.accessCode ? 'yes' : 'NO')
    } catch (e) {
      console.log('[CloudSend] Cloud refresh failed:', e.message)
    }
  }

  // 2. If we have accessCode but still no IP, scan the LAN to find the printer
  if (!p.ip && p.accessCode) {
    onProgress?.(8)
    console.log('[CloudSend] No IP from API — scanning LAN for printer…')
    const localIP     = getLocalIP()
    const discoveredIP = await discoverPrinterOnLAN(p.serial, p.accessCode, localIP)
    if (discoveredIP) p = { ...p, ip: discoveredIP }
  }

  // 3. If we now have IP + accessCode, use reliable FTP + LAN MQTT
  if (p.ip && p.accessCode) {
    console.log('[CloudSend] Using FTP + LAN MQTT →', p.ip)
    const { sendToPrinter } = await import('./printer.js')
    return sendToPrinter(p, filePath, plate, opts, onProgress)
  }

  // 4. No LAN info at all — give a clear error
  return {
    success: false,
    error: `Could not find printer ${p.serial} on your network.\n\nTo fix: open the printer touchscreen → Settings → Network, find the IP address, then edit this printer in the Printers page to add it manually.`,
  }
}

// ── Parse AMS tray info from MQTT pushall payload ─────────────────────────────
export function parseAmsTrays(print) {
  const trays = []
  if (print.ams?.ams) {
    for (const unit of print.ams.ams) {
      for (const tray of unit.tray || []) {
        if (tray.tray_type && tray.tray_type !== '') {
          trays.push({
            id:       `${unit.id}_${tray.id}`,
            amsId:    parseInt(unit.id),
            slot:     parseInt(tray.id),
            type:     tray.tray_type || 'Unknown',
            color:    tray.tray_color ? `#${tray.tray_color.slice(0, 6)}` : '#888888',
            brand:    tray.tray_sub_brands || '',
            external: false,
          })
        }
      }
    }
  }
  if (print.vt_tray?.tray_type && print.vt_tray.tray_type !== '') {
    const vt = print.vt_tray
    trays.push({
      id: 'ext', amsId: 255, slot: 0,
      type:     vt.tray_type || 'Unknown',
      color:    vt.tray_color ? `#${vt.tray_color.slice(0, 6)}` : '#888888',
      brand:    vt.tray_sub_brands || '',
      external: true,
    })
  }
  return trays
}
