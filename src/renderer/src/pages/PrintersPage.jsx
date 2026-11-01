import React, { useState, useEffect } from 'react'
import {
  Printer, Plus, Wifi, WifiOff, Loader, Pencil,
  Trash2, RefreshCw, Thermometer, Activity, Cloud, CheckCircle
} from 'lucide-react'
import { useStore } from '../store/StoreContext'
import AddPrinterModal from '../components/AddPrinterModal'

const STATE_LABELS = {
  IDLE:    { label: 'Ready to Print', color: 'text-bambu-400',  dot: 'bg-bambu-400' },
  RUNNING: { label: 'Printing',       color: 'text-yellow-400', dot: 'bg-yellow-400' },
  PAUSE:   { label: 'Paused',         color: 'text-orange-400', dot: 'bg-orange-400' },
  FAILED:  { label: 'Error',          color: 'text-red-400',    dot: 'bg-red-400' },
  FINISH:  { label: 'Finished',       color: 'text-bambu-400',  dot: 'bg-bambu-400' },
}

export default function PrintersPage() {
  const { state, actions } = useStore()
  const { printers, cloudAccount } = state

  const [showAdd, setShowAdd] = useState(false)
  const [editPrinter, setEditPrinter] = useState(null)
  const [statuses, setStatuses] = useState({})
  const [refreshing, setRefreshing] = useState({})
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')

  const handleImportFromCloud = async () => {
    if (!cloudAccount) return
    setImporting(true)
    setImportMsg('')
    try {
      const devices = await window.electronAPI.cloudGetDevices(cloudAccount)
      if (devices.error) { setImportMsg('Import failed: ' + devices.error); return }
      if (!devices.length) { setImportMsg('No printers found in your Bambu Lab account.'); return }

      let added = 0
      for (const d of devices) {
        const alreadyExists = printers.some(p => p.serial === d.serial)
        if (!alreadyExists && d.serial) {
          actions.addPrinter({ ...d, id: d.serial })
          added++
        }
      }
      setImportMsg(added > 0 ? `Imported ${added} printer${added !== 1 ? 's' : ''}!` : 'All printers already added.')
    } catch (e) {
      setImportMsg('Import failed: ' + e.message)
    } finally {
      setImporting(false)
      setTimeout(() => setImportMsg(''), 4000)
    }
  }

  const fetchStatus = async (printer) => {
    setRefreshing(r => ({ ...r, [printer.id]: true }))
    const useCloud = printer.defaultMode === 'cloud' && cloudAccount
    const s = useCloud
      ? await window.electronAPI.cloudPrinterStatus(cloudAccount, printer)
      : await window.electronAPI.printerStatus(printer)
    setStatuses(prev => ({ ...prev, [printer.id]: s }))
    setRefreshing(r => ({ ...r, [printer.id]: false }))
  }

  useEffect(() => {
    printers.forEach(fetchStatus)
  }, [printers.length])

  const handleDelete = (id) => {
    if (confirm('Remove this printer?')) actions.removePrinter(id)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">My Printers</h1>
            <p className="text-sm text-gray-500 mt-1">
              {printers.length} printer{printers.length !== 1 ? 's' : ''} configured
            </p>
          </div>
          <div className="flex items-center gap-2">
            {importMsg && (
              <span className="flex items-center gap-1.5 text-xs text-bambu-400 animate-fade-in">
                <CheckCircle size={13} /> {importMsg}
              </span>
            )}
            {cloudAccount && (
              <button onClick={handleImportFromCloud} disabled={importing} className="btn-secondary">
                {importing ? <Loader size={14} className="animate-spin" /> : <Cloud size={14} />}
                {importing ? 'Importing…' : 'Import from Cloud'}
              </button>
            )}
            <button onClick={() => setShowAdd(true)} className="btn-primary">
              <Plus size={15} />
              Add Printer
            </button>
          </div>
        </div>

        {/* Empty */}
        {printers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-5">
            <div className="w-20 h-20 rounded-3xl bg-[#222] flex items-center justify-center">
              <Printer size={36} className="text-gray-600" />
            </div>
            <div className="text-center">
              <p className="text-gray-300 font-semibold text-lg">No printers yet</p>
              <p className="text-gray-500 text-sm mt-1">
                Add your Bambu Lab printers to send files directly
              </p>
            </div>
            <button onClick={() => setShowAdd(true)} className="btn-primary">
              <Plus size={15} />
              Add Your First Printer
            </button>
          </div>
        )}

        {/* Printer cards */}
        <div className="space-y-4">
          {printers.map(printer => {
            const s = statuses[printer.id]
            const isRefreshing = refreshing[printer.id]
            const stateInfo = s?.state ? (STATE_LABELS[s.state] || STATE_LABELS.IDLE) : null

            return (
              <div key={printer.id} className="glass-panel p-5">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    s?.online ? 'bg-bambu-500/15' : 'bg-white/5'
                  }`}>
                    <Printer size={22} className={s?.online ? 'text-bambu-400' : 'text-gray-600'} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{printer.name}</h3>
                      <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                        {printer.model}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 mt-0.5 font-mono">{printer.ip}</p>

                    {/* Status */}
                    <div className="flex items-center gap-3 mt-2">
                      {isRefreshing ? (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Loader size={11} className="animate-spin" />
                          Connecting…
                        </div>
                      ) : s?.online ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${stateInfo?.dot || 'bg-bambu-400'} animate-pulse`} />
                            <span className={`text-xs font-medium ${stateInfo?.color || 'text-bambu-400'}`}>
                              {stateInfo?.label || 'Online'}
                            </span>
                          </div>
                          {s.state === 'RUNNING' && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                              <Activity size={11} />
                              {s.progress}% · {s.remaining}m left
                              {s.fileName && <span className="text-gray-600 truncate max-w-32">· {s.fileName}</span>}
                            </div>
                          )}
                          {s.nozzleTemp > 0 && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Thermometer size={11} />
                              {s.nozzleTemp}° / {s.bedTemp}°
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <WifiOff size={11} />
                          Offline
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => fetchStatus(printer)}
                      disabled={isRefreshing}
                      className="btn-ghost p-2"
                      title="Refresh status"
                    >
                      <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                    <button
                      onClick={() => setEditPrinter(printer)}
                      className="btn-ghost p-2"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(printer.id)}
                      className="btn-ghost p-2 hover:text-red-400"
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {(showAdd || editPrinter) && (
        <AddPrinterModal
          editPrinter={editPrinter}
          onClose={() => { setShowAdd(false); setEditPrinter(null) }}
        />
      )}
    </div>
  )
}
