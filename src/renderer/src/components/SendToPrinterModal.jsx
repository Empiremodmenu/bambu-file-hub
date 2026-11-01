import React, { useState, useEffect } from 'react'
import {
  X, Printer, Wifi, WifiOff, Loader, CheckCircle,
  AlertCircle, Send, Layers, Settings2, Plus, Cloud
} from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { detect3mfPlates } from '../utils/plateDetect'

// Which options each printer family supports
function getModelCaps(model) {
  const m = (model || '').toLowerCase()
  if (m.includes('x1')) {
    return { useAms: true, bedLeveling: true, flowCalibration: true, vibrationCalibration: true, timelapse: true, layerInspect: true }
  }
  if (m.includes('a1 mini') || m.includes('a1mini')) {
    return { useAms: true, bedLeveling: true, flowCalibration: true, vibrationCalibration: false, timelapse: true, layerInspect: false }
  }
  if (m.includes('a1')) {
    return { useAms: true, bedLeveling: true, flowCalibration: true, vibrationCalibration: true, timelapse: true, layerInspect: false }
  }
  // P1S, P1P, and unknown — conservative default
  return { useAms: true, bedLeveling: true, flowCalibration: true, vibrationCalibration: true, timelapse: true, layerInspect: false }
}

const STATE_LABELS = {
  IDLE:    { label: 'Ready',    color: 'text-bambu-400' },
  RUNNING: { label: 'Printing', color: 'text-yellow-400' },
  PAUSE:   { label: 'Paused',   color: 'text-orange-400' },
  FAILED:  { label: 'Error',    color: 'text-red-400' },
  FINISH:  { label: 'Done',     color: 'text-bambu-400' },
}

export default function SendToPrinterModal({ file, onClose, onNavigatePrinters }) {
  const { state } = useStore()
  const { printers, cloudAccount } = state

  const [selectedPrinter, setSelectedPrinter] = useState(printers[0]?.id || null)
  const [connectionMode, setConnectionMode] = useState(printers[0]?.defaultMode || 'lan')
  const [printerStatuses, setPrinterStatuses] = useState({})
  const [loadingStatuses, setLoadingStatuses] = useState(true)

  // Plate state (3MF only)
  const [plateCount, setPlateCount]   = useState(1)
  const [plateThumbs, setPlateThumbs] = useState([])
  const [selectedPlate, setSelectedPlate] = useState(1)
  const [loadingPlates, setLoadingPlates] = useState(false)

  // Selected AMS slot (null = let printer decide)
  const [selectedSlot, setSelectedSlot] = useState(null)

  // Print options
  const [opts, setOpts] = useState({
    useAms:               true,
    bedLeveling:          true,
    flowCalibration:      false,
    vibrationCalibration: true,
    timelapse:            false,
    layerInspect:         false,
  })

  // Send state
  const [sending, setSending]     = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [result, setResult]       = useState(null)

  // Load printer statuses
  useEffect(() => {
    if (printers.length === 0) { setLoadingStatuses(false); return }
    setLoadingStatuses(true)
    Promise.all(
      printers.map(async p => {
        const useCloud = connectionMode === 'cloud' && cloudAccount
        const s = useCloud
          ? await window.electronAPI.cloudPrinterStatus(cloudAccount, p)
          : await window.electronAPI.printerStatus(p)
        return { id: p.id, status: s }
      })
    ).then(results => {
      const map = {}
      results.forEach(r => { map[r.id] = r.status })
      setPrinterStatuses(map)
      setLoadingStatuses(false)
    })
  }, [printers, connectionMode])

  // When printer changes, reset slot selection
  useEffect(() => { setSelectedSlot(null) }, [selectedPrinter, connectionMode])

  // Detect plates for 3MF
  useEffect(() => {
    if (file.type !== '3mf') return
    setLoadingPlates(true)
    detect3mfPlates(file.path).then(({ plateCount, plateThumbnails }) => {
      setPlateCount(plateCount)
      setPlateThumbs(plateThumbnails)
      setSelectedPlate(1)
      setLoadingPlates(false)
    })
  }, [file])

  // Subscribe to upload progress
  useEffect(() => {
    const unsub = window.electronAPI.onUploadProgress(({ pct }) => setUploadPct(pct))
    return unsub
  }, [])

  const handleSend = async () => {
    const printer = printers.find(p => p.id === selectedPrinter)
    if (!printer) return
    setSending(true)
    setUploadPct(0)
    setResult(null)

    const sendOpts = { ...opts, amsSlot: selectedSlot, amsMapping: selectedSlot ? [{ ams: selectedSlot.amsId, slot: selectedSlot.slot }] : undefined }

    let res
    if (connectionMode === 'cloud' && cloudAccount) {
      res = await window.electronAPI.cloudSend(cloudAccount, printer, file.path, selectedPlate, sendOpts)
    } else {
      res = await window.electronAPI.printerSend(printer, file.path, selectedPlate, sendOpts)
    }

    setSending(false)
    setResult(res)
  }

  const printer   = printers.find(p => p.id === selectedPrinter)
  const status    = selectedPrinter ? printerStatuses[selectedPrinter] : null
  const isBusy    = status?.state === 'RUNNING'
  const amsTrays  = status?.amsTrays || []
  const hasAms    = amsTrays.length > 0
  const caps      = getModelCaps(printer?.model)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={e => { if (e.target === e.currentTarget && !sending) onClose() }}
    >
      <div className="w-full max-w-2xl rounded-2xl shadow-2xl animate-slide-up flex flex-col max-h-[90vh]"
        style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}>

        {/* Header */}
        <div className="flex items-center gap-3 p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(0,212,160,0.15)' }}>
            <Send size={15} className="text-bambu-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-white">Send to Printer</h2>
            <p className="text-xs text-gray-500 truncate">{file.name}.{file.type}</p>
          </div>

          {/* LAN / Cloud toggle */}
          <div className="flex items-center rounded-xl p-1 gap-1 shrink-0" style={{ background: '#222' }}>
            {[
              { value: 'lan',   icon: Wifi,  label: 'LAN'   },
              { value: 'cloud', icon: Cloud, label: 'Cloud', disabled: !cloudAccount },
            ].map(({ value, icon: Icon, label, disabled }) => (
              <button
                key={value}
                onClick={() => !disabled && setConnectionMode(value)}
                title={disabled ? 'Sign in to Bambu Lab in Settings to use Cloud mode' : label}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${connectionMode === value
                    ? 'bg-bambu-500 text-black'
                    : disabled
                      ? 'text-gray-600 cursor-not-allowed'
                      : 'text-gray-400 hover:text-white'
                  }`}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>

          {!sending && (
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors ml-1">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* Left: Printer list */}
          <div className="w-56 shrink-0 p-3 overflow-y-auto" style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="section-header px-1 mb-2">Select Printer</p>

            {printers.length === 0 ? (
              <div className="text-center py-6">
                <Printer size={28} className="text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500 mb-3">No printers added yet</p>
                <button
                  onClick={() => { onClose(); onNavigatePrinters() }}
                  className="btn-primary text-xs px-3 py-1.5 mx-auto"
                >
                  <Plus size={12} /> Add Printer
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {printers.map(p => {
                  const s        = printerStatuses[p.id]
                  const online   = s?.online
                  const stateInfo = STATE_LABELS[s?.state] || STATE_LABELS.IDLE
                  const selected = selectedPrinter === p.id

                  return (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPrinter(p.id); setResult(null) }}
                      className={`w-full text-left p-3 rounded-xl transition-all`}
                      style={selected
                        ? { background: 'rgba(0,212,160,0.1)', border: '1px solid rgba(0,212,160,0.4)' }
                        : { border: '1px solid transparent' }}
                      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {loadingStatuses
                          ? <Loader size={10} className="animate-spin text-gray-500" />
                          : online
                            ? <Wifi size={10} className="text-bambu-400" />
                            : <WifiOff size={10} className="text-gray-600" />
                        }
                        <span className={`text-xs font-medium ${selected ? 'text-white' : 'text-gray-300'}`}>
                          {p.name}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{p.model}</p>
                      {s?.online && s.state && (
                        <p className={`text-xs font-medium mt-0.5 ${stateInfo.color}`}>
                          {stateInfo.label}
                          {s.state === 'RUNNING' && ` · ${s.progress}%`}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right: Options */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* AMS Filament picker */}
            {hasAms && opts.useAms && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-bambu-400" />
                  <p className="text-sm font-semibold text-white">Filament / AMS Slot</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {/* Auto option */}
                  <button
                    onClick={() => setSelectedSlot(null)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all"
                    style={selectedSlot === null
                      ? { background: 'rgba(0,212,160,0.15)', border: '1px solid rgba(0,212,160,0.4)', color: '#00d4a0' }
                      : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#888' }}
                  >
                    <div className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                      style={{ background: 'linear-gradient(135deg,#00d4a0,#00a8ff)' }}>
                      A
                    </div>
                    <span className="text-left">
                      <span className="block font-semibold">Auto</span>
                      <span className="text-gray-500 font-normal">Let printer decide</span>
                    </span>
                  </button>

                  {amsTrays.map(tray => {
                    const active = selectedSlot?.id === tray.id
                    return (
                      <button
                        key={tray.id}
                        onClick={() => setSelectedSlot(active ? null : tray)}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all"
                        style={active
                          ? { background: `${tray.color}22`, border: `1px solid ${tray.color}66`, color: tray.color }
                          : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#ccc' }}
                      >
                        <div
                          className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                          style={{ background: tray.color, boxShadow: active ? `0 0 6px ${tray.color}88` : 'none' }}
                        />
                        <span className="text-left min-w-0">
                          <span className="block font-semibold truncate">
                            {tray.external ? 'Ext' : `AMS ${tray.amsId + 1}·${tray.slot + 1}`}
                          </span>
                          <span className="block text-gray-500 font-normal truncate">
                            {tray.brand ? `${tray.brand} ` : ''}{tray.type}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Plate selector — 3MF only */}
            {file.type === '3mf' && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Layers size={14} className="text-bambu-400" />
                  <p className="text-sm font-semibold text-white">Select Plate</p>
                  {loadingPlates && <Loader size={12} className="animate-spin text-gray-500" />}
                </div>

                {plateCount <= 1 && !loadingPlates ? (
                  <div className="p-3 rounded-xl text-xs text-gray-500" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    Single-plate file — plate 1 will be printed.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: plateCount }, (_, i) => i + 1).map(n => (
                      <button
                        key={n}
                        onClick={() => setSelectedPlate(n)}
                        className="rounded-xl overflow-hidden transition-all"
                        style={selectedPlate === n
                          ? { border: '1px solid rgba(0,212,160,0.6)', boxShadow: '0 0 0 2px rgba(0,212,160,0.2)' }
                          : { border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        {plateThumbs[n - 1] ? (
                          <img src={plateThumbs[n - 1]} alt={`Plate ${n}`} className="w-full aspect-square object-cover" />
                        ) : (
                          <div className="w-full aspect-square flex items-center justify-center" style={{ background: '#222' }}>
                            <span className="text-2xl font-bold text-gray-500">{n}</span>
                          </div>
                        )}
                        <div className={`py-1 text-center text-xs font-medium
                          ${selectedPlate === n ? 'text-bambu-400' : 'text-gray-500'}`}
                          style={{ background: selectedPlate === n ? 'rgba(0,212,160,0.08)' : 'transparent' }}>
                          Plate {n}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Print options */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Settings2 size={14} className="text-bambu-400" />
                <p className="text-sm font-semibold text-white">Print Options</p>
              </div>
              <div className="space-y-0.5">
                {[
                  { key: 'useAms',               label: 'Use AMS',               desc: 'Use automatic material system' },
                  { key: 'bedLeveling',           label: 'Bed Leveling',          desc: 'Auto-level before printing' },
                  { key: 'flowCalibration',       label: 'Flow Calibration',      desc: 'Calibrate filament flow' },
                  { key: 'vibrationCalibration',  label: 'Vibration Calibration', desc: 'Compensate for vibrations' },
                  { key: 'timelapse',             label: 'Timelapse',             desc: 'Record a timelapse video' },
                  { key: 'layerInspect',          label: 'Layer Inspect',         desc: 'AI-powered layer inspection (X1 series only)' },
                ].filter(({ key }) => caps[key]).map(({ key, label, desc }) => (
                  <label key={key} className="flex items-center justify-between py-2.5 cursor-pointer group">
                    <div>
                      <p className="text-sm text-gray-200 group-hover:text-white transition-colors">{label}</p>
                      <p className="text-xs text-gray-600">{desc}</p>
                    </div>
                    <div
                      onClick={() => setOpts(o => ({ ...o, [key]: !o[key] }))}
                      className="relative shrink-0 ml-4 cursor-pointer rounded-full transition-colors"
                      style={{ width: 36, height: 20, background: opts[key] ? '#00d4a0' : '#333' }}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
                        ${opts[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Printer live temps */}
            {status?.online && status.nozzleTemp > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p className="text-xs text-gray-500">Nozzle</p>
                  <p className="text-lg font-bold text-white">{status.nozzleTemp}°</p>
                </div>
                <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p className="text-xs text-gray-500">Bed</p>
                  <p className="text-lg font-bold text-white">{status.bedTemp}°</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {sending && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span>{uploadPct < 90 ? 'Uploading file…' : uploadPct < 100 ? 'Creating print task…' : 'Starting print…'}</span>
                <span>{uploadPct}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${uploadPct}%`, background: 'linear-gradient(90deg, #00d4a0, #00a8ff)' }}
                />
              </div>
            </div>
          )}

          {result && (
            <div className={`flex items-center gap-2 p-3 rounded-xl text-sm mb-4`}
              style={result.success
                ? { background: 'rgba(0,212,160,0.1)', border: '1px solid rgba(0,212,160,0.2)', color: '#7ef5d8' }
                : { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
              {result.success
                ? <CheckCircle size={14} className="text-bambu-400 shrink-0" />
                : <AlertCircle size={14} className="text-red-400 shrink-0" />}
              {result.success ? `Print started on ${printer?.name}!` : result.error}
            </div>
          )}

          <div className="flex gap-3">
            {!result && (
              <button onClick={onClose} disabled={sending} className="btn-secondary flex-1 justify-center">
                Cancel
              </button>
            )}
            {result?.success ? (
              <button onClick={onClose} className="btn-primary flex-1 justify-center">
                Done
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={sending || !selectedPrinter || isBusy || printers.length === 0}
                className="btn-primary flex-1 justify-center disabled:opacity-40"
              >
                {sending
                  ? <><Loader size={14} className="animate-spin" /> Sending…</>
                  : isBusy
                    ? 'Printer Busy'
                    : <><Send size={14} /> Send to {printer?.name || 'Printer'}</>
                }
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
