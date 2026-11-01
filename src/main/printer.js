import mqtt from 'mqtt'
import { Client as FtpClient } from 'basic-ftp'
import { basename } from 'path'
import { parseAmsTrays } from './bambuCloud.js'

// ── Status poll ───────────────────────────────────────────────────────────────
export async function getPrinterStatus(printer) {
  return new Promise((resolve) => {
    const client = mqtt.connect(`mqtts://${printer.ip}:8883`, {
      username: 'bblp',
      password: printer.accessCode,
      rejectUnauthorized: false,
      clientId: `bfh_status_${Date.now()}`,
      connectTimeout: 5000,
    })

    const done = (result) => {
      try { client.end(true) } catch {}
      resolve(result)
    }

    const timer = setTimeout(() => done({ online: false }), 6000)

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

// ── FTP upload ────────────────────────────────────────────────────────────────
async function uploadFile(printer, localPath, onProgress) {
  const ftp = new FtpClient()
  ftp.ftp.verbose = false

  try {
    await ftp.access({
      host: printer.ip,
      port: 990,
      user: 'bblp',
      password: printer.accessCode,
      secure: 'implicit',
      secureOptions: { rejectUnauthorized: false },
    })

    const name = basename(localPath)

    if (onProgress) {
      ftp.trackProgress(info => {
        if (info.bytes && info.fileSize) {
          onProgress(Math.round((info.bytes / info.fileSize) * 100))
        }
      })
    }

    await ftp.uploadFrom(localPath, name)
    ftp.trackProgress()
    return { success: true, filename: name }
  } catch (err) {
    return { success: false, error: err.message }
  } finally {
    ftp.close()
  }
}

// ── MQTT print command ────────────────────────────────────────────────────────
async function sendPrintCommand(printer, filename, plate, opts) {
  return new Promise((resolve) => {
    const client = mqtt.connect(`mqtts://${printer.ip}:8883`, {
      username: 'bblp',
      password: printer.accessCode,
      rejectUnauthorized: false,
      clientId: `bfh_print_${Date.now()}`,
      connectTimeout: 8000,
    })

    const done = (r) => { try { client.end(true) } catch {}; resolve(r) }
    const timer = setTimeout(() => done({ success: false, error: 'Timeout connecting to printer' }), 10000)

    client.on('connect', () => {
      const ext  = filename.split('.').pop().toLowerCase()
      const url  = `ftp://${printer.ip}/${filename}`
      const name = filename.replace(/\.[^.]+$/, '')

      // Build ams_mapping if user selected a specific slot
      let amsMapping
      if (opts.useAms && opts.amsSlot) {
        amsMapping = [{ ams: opts.amsSlot.amsId, slot: opts.amsSlot.slot }]
      }

      const payload = {
        print: {
          sequence_id:    '1',
          command:        ext === 'gcode' ? 'gcode_file' : 'project_file',
          param:          ext === 'gcode' ? `/${filename}` : `Metadata/plate_${plate}.gcode`,
          url,
          timelapse:      opts.timelapse ?? false,
          bed_leveling:   opts.bedLeveling ?? true,
          flow_cali:      opts.flowCalibration ?? false,
          vibration_cali: opts.vibrationCalibration ?? true,
          layer_inspect:  opts.layerInspect ?? false,
          use_ams:        opts.useAms ?? true,
          subtask_name:   name,
          md5:            '',
          ...(amsMapping ? { ams_mapping: amsMapping } : {}),
        }
      }

      client.publish(
        `device/${printer.serial}/request`,
        JSON.stringify(payload),
        (err) => {
          clearTimeout(timer)
          done(err ? { success: false, error: err.message } : { success: true })
        }
      )
    })

    client.on('error', (err) => { clearTimeout(timer); done({ success: false, error: err.message }) })
  })
}

// ── Public: full send flow ────────────────────────────────────────────────────
export async function sendToPrinter(printer, filePath, plate, opts, onProgress) {
  const upload = await uploadFile(printer, filePath, onProgress)
  if (!upload.success) return { success: false, error: `Upload failed: ${upload.error}` }
  return sendPrintCommand(printer, upload.filename, plate, opts)
}

// ── Connection test ───────────────────────────────────────────────────────────
export async function testConnection(printer) {
  const status = await getPrinterStatus(printer)
  return { success: status.online, error: status.online ? null : 'Could not reach printer. Check IP and Access Code.' }
}
