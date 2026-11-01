import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Window
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose:    () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // Store
  storeGet: (key)        => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),

  // Dialogs
  dialogOpenFiles:        () => ipcRenderer.invoke('dialog-open-files'),
  dialogSelectBambuStudio:() => ipcRenderer.invoke('dialog-select-bambu-studio'),
  dialogSelectFolder:     () => ipcRenderer.invoke('dialog-select-folder'),

  // File ops
  fileExists:   (path) => ipcRenderer.invoke('file-exists', path),
  fileStat:     (path) => ipcRenderer.invoke('file-stat', path),
  showInFolder: (path) => ipcRenderer.invoke('show-in-folder', path),

  // Bambu Studio
  detectBambuStudio: () => ipcRenderer.invoke('detect-bambu-studio'),
  openInBambuStudio: (filePath, bambuPath) =>
    ipcRenderer.invoke('open-in-bambu-studio', filePath, bambuPath),

  // File reading
  readFileBuffer: (path) => ipcRenderer.invoke('read-file-buffer', path),

  // Printers (LAN)
  printerStatus: (printer) => ipcRenderer.invoke('printer-status', printer),
  printerTest:   (printer) => ipcRenderer.invoke('printer-test', printer),
  printerSend:   (printer, filePath, plate, opts) =>
    ipcRenderer.invoke('printer-send', printer, filePath, plate, opts),

  // Cloud
  cloudLogin:         (region) => ipcRenderer.invoke('cloud-login', region),
  cloudGetDevices:    (account) => ipcRenderer.invoke('cloud-get-devices', account),
  cloudPrinterStatus: (account, printer)        => ipcRenderer.invoke('cloud-printer-status', account, printer),
  cloudSend:          (account, printer, filePath, plate, opts) =>
    ipcRenderer.invoke('cloud-send', account, printer, filePath, plate, opts),

  onUploadProgress: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('printer-upload-progress', handler)
    return () => ipcRenderer.removeListener('printer-upload-progress', handler)
  },

  platform: process.platform,
})
