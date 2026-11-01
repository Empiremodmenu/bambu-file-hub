import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron'
import { join } from 'path'
import { existsSync, statSync } from 'fs'
import { spawn } from 'child_process'
import Store from 'electron-store'
import { getPrinterStatus, sendToPrinter, testConnection } from './printer.js'
import { cloudLoginBrowser, getCloudPrinterStatus, sendToCloudPrinter, getCloudDevices } from './bambuCloud.js'

const store = new Store({ defaults: { appState: null } })

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    backgroundColor: '#111111',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    show: false,
    roundedCorners: true,
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  })

  mainWindow.webContents.on('did-fail-load', (_, code, desc) => {
    console.error('Renderer failed to load:', code, desc)
  })

  Menu.setApplicationMenu(null)
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── Window controls ──────────────────────────────────────────────────────────
ipcMain.handle('window-minimize', () => mainWindow?.minimize())
ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.handle('window-close', () => mainWindow?.close())
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false)

// ── Store ─────────────────────────────────────────────────────────────────────
ipcMain.handle('store-get', (_, key) => store.get(key))
ipcMain.handle('store-set', (_, key, value) => { store.set(key, value) })

// ── Dialogs ───────────────────────────────────────────────────────────────────
ipcMain.handle('dialog-open-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Add 3D Print Files',
    filters: [
      { name: '3D Print Files', extensions: ['stl', '3mf', 'gcode'] },
      { name: 'STL Files', extensions: ['stl'] },
      { name: '3MF Files', extensions: ['3mf'] },
      { name: 'GCode Files', extensions: ['gcode'] },
    ],
    properties: ['openFile', 'multiSelections'],
  })
  return result.canceled ? [] : result.filePaths
})

ipcMain.handle('dialog-select-bambu-studio', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Bambu Studio Executable',
    filters: [{ name: 'Executable', extensions: ['exe'] }],
    properties: ['openFile'],
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog-select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Default Folder',
    properties: ['openDirectory'],
  })
  return result.canceled ? null : result.filePaths[0]
})

// ── File operations ───────────────────────────────────────────────────────────
ipcMain.handle('file-exists', (_, filePath) => existsSync(filePath))

ipcMain.handle('file-stat', (_, filePath) => {
  try {
    const s = statSync(filePath)
    return { size: s.size, mtime: s.mtime.toISOString() }
  } catch { return null }
})

ipcMain.handle('show-in-folder', (_, filePath) => shell.showItemInFolder(filePath))

// ── Bambu Studio ──────────────────────────────────────────────────────────────
ipcMain.handle('detect-bambu-studio', () => {
  const localAppData = process.env.LOCALAPPDATA || ''
  const pf  = process.env['ProgramFiles']      || 'C:\\Program Files'
  const pf86= process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  for (const p of [
    join(pf,   'Bambu Studio', 'bambu-studio.exe'),
    join(pf86, 'Bambu Studio', 'bambu-studio.exe'),
    join(localAppData, 'Programs', 'Bambu Studio', 'bambu-studio.exe'),
    join(localAppData, 'BambuStudio', 'bambu-studio.exe'),
  ]) { if (existsSync(p)) return p }
  return null
})

ipcMain.handle('open-in-bambu-studio', (_, filePath, bambuPath) => {
  if (!bambuPath || !existsSync(bambuPath))
    return { success: false, error: 'Bambu Studio path not configured. Go to Settings.' }
  if (!existsSync(filePath))
    return { success: false, error: 'File not found: ' + filePath }
  try {
    const child = spawn(bambuPath, [filePath], { detached: true, stdio: 'ignore' })
    child.unref()
    return { success: true }
  } catch (err) { return { success: false, error: err.message } }
})

// ── File buffer ───────────────────────────────────────────────────────────────
ipcMain.handle('read-file-buffer', async (_, filePath) => {
  try {
    const { readFileSync } = await import('fs')
    return Array.from(readFileSync(filePath))
  } catch { return null }
})

// ── Printer: status ───────────────────────────────────────────────────────────
ipcMain.handle('printer-status', async (_, printer) => {
  try { return await getPrinterStatus(printer) }
  catch (err) { return { online: false, error: err.message } }
})

// ── Printer: test connection ──────────────────────────────────────────────────
ipcMain.handle('printer-test', async (_, printer) => {
  try { return await testConnection(printer) }
  catch (err) { return { success: false, error: err.message } }
})

// ── Printer: send print job (streams progress back via event) ─────────────────
ipcMain.handle('printer-send', async (event, printer, filePath, plate, opts) => {
  try {
    return await sendToPrinter(printer, filePath, plate, opts, (pct) => {
      event.sender.send('printer-upload-progress', { printerId: printer.id, pct })
    })
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ── Cloud auth (opens real Bambu Lab website in a popup) ─────────────────────
ipcMain.handle('cloud-login', async (_, region) => {
  try { return await cloudLoginBrowser(mainWindow, region) }
  catch (err) { return { success: false, error: err.message } }
})

// ── Cloud printer status ──────────────────────────────────────────────────────
ipcMain.handle('cloud-printer-status', async (_, account, printer) => {
  try { return await getCloudPrinterStatus(account, printer) }
  catch (err) { return { online: false, error: err.message } }
})

// ── Cloud device list ─────────────────────────────────────────────────────────
ipcMain.handle('cloud-get-devices', async (_, account) => {
  try { return await getCloudDevices(account) }
  catch (err) { return { error: err.message } }
})

// ── Cloud send ────────────────────────────────────────────────────────────────
ipcMain.handle('cloud-send', async (event, account, printer, filePath, plate, opts) => {
  try {
    return await sendToCloudPrinter(account, printer, filePath, plate, opts, (pct) => {
      event.sender.send('printer-upload-progress', { printerId: printer.id, pct })
    })
  } catch (err) {
    return { success: false, error: err.message }
  }
})
