import React, { useState } from 'react'
import { X, Printer, CheckCircle, AlertCircle, Loader, Info, Wifi, Cloud } from 'lucide-react'
import { useStore } from '../store/StoreContext'

const MODELS = ['P1S', 'P1P', 'X1C', 'X1E', 'A1', 'A1 Mini', 'H2D', 'H2C']

export default function AddPrinterModal({ onClose, editPrinter }) {
  const { actions, state } = useStore()
  const [form, setForm] = useState({
    name:        editPrinter?.name        || '',
    model:       editPrinter?.model       || 'P1S',
    ip:          editPrinter?.ip          || '',
    serial:      editPrinter?.serial      || '',
    accessCode:  editPrinter?.accessCode  || '',
    defaultMode: editPrinter?.defaultMode || 'lan', // 'lan' | 'cloud'
  })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setTestResult(null) }

  const handleTest = async () => {
    if (!form.ip || !form.serial || !form.accessCode) {
      setTestResult({ success: false, error: 'Fill in IP, Serial, and Access Code first.' })
      return
    }
    setTesting(true)
    setTestResult(null)
    const result = await window.electronAPI.printerTest(form)
    setTesting(false)
    setTestResult(result)
  }

  const handleSave = () => {
    if (!form.name || !form.ip || !form.serial || !form.accessCode) return
    if (editPrinter) {
      actions.updatePrinter({ ...editPrinter, ...form })
    } else {
      actions.addPrinter(form)
    }
    onClose()
  }

  const valid = form.name && form.ip && form.serial && form.accessCode

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl p-6 animate-slide-up">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-bambu-500/20 flex items-center justify-center">
            <Printer size={16} className="text-bambu-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              {editPrinter ? 'Edit Printer' : 'Add Printer'}
            </h2>
            <p className="text-xs text-gray-500">Connect via local network</p>
          </div>
          <button onClick={onClose} className="ml-auto text-gray-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Name + Model */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Printer Name</label>
              <input
                className="input-field"
                placeholder="e.g. Workshop P1S"
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Model</label>
              <select
                className="input-field cursor-pointer"
                value={form.model}
                onChange={e => set('model', e.target.value)}
              >
                {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* IP */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">IP Address</label>
            <input
              className="input-field font-mono"
              placeholder="192.168.1.x"
              value={form.ip}
              onChange={e => set('ip', e.target.value)}
            />
            <p className="text-xs text-gray-600 mt-1">Find this on your printer screen under Network</p>
          </div>

          {/* Serial */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Serial Number</label>
            <input
              className="input-field font-mono uppercase"
              placeholder="01S00C..."
              value={form.serial}
              onChange={e => set('serial', e.target.value.toUpperCase())}
            />
          </div>

          {/* Access Code */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Access Code</label>
            <input
              className="input-field font-mono"
              placeholder="8-digit code"
              value={form.accessCode}
              onChange={e => set('accessCode', e.target.value)}
            />
            <p className="text-xs text-gray-600 mt-1">Printer screen → Settings → Network → Access Code</p>
          </div>

          {/* Default connection mode */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Default Connection Mode</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'lan',   icon: Wifi,  label: 'LAN',   desc: 'Same network only' },
                { value: 'cloud', icon: Cloud, label: 'Cloud', desc: 'Works from anywhere' },
              ].map(({ value, icon: Icon, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set('defaultMode', value)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all
                    ${form.defaultMode === value
                      ? 'border-bambu-500/60 bg-bambu-500/10'
                      : 'border-white/10 hover:border-white/20'
                    }`}
                >
                  <Icon size={14} className={form.defaultMode === value ? 'text-bambu-400' : 'text-gray-500'} />
                  <div>
                    <p className={`text-xs font-semibold ${form.defaultMode === value ? 'text-white' : 'text-gray-300'}`}>{label}</p>
                    <p className="text-xs text-gray-600">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
            {form.defaultMode === 'cloud' && !state.cloudAccount && (
              <p className="text-xs text-yellow-400 mt-2">⚠ Sign in to Bambu Lab in Settings first to use Cloud mode.</p>
            )}
          </div>

          {/* How to find details hint */}
          <div className="flex gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <Info size={13} className="text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-300">
              On your printer touchscreen: <strong>Settings → Network</strong> shows the IP, Serial, and Access Code.
            </p>
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
              testResult.success
                ? 'bg-bambu-500/10 border border-bambu-500/20 text-bambu-300'
                : 'bg-red-500/10 border border-red-500/20 text-red-300'
            }`}>
              {testResult.success
                ? <CheckCircle size={14} className="text-bambu-400 shrink-0" />
                : <AlertCircle size={14} className="text-red-400 shrink-0" />}
              {testResult.success ? 'Printer connected successfully!' : testResult.error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={handleTest}
            disabled={testing || !form.ip || !form.serial || !form.accessCode}
            className="btn-secondary flex-1 justify-center disabled:opacity-40"
          >
            {testing
              ? <><Loader size={13} className="animate-spin" /> Testing…</>
              : 'Test Connection'
            }
          </button>
          <button
            onClick={handleSave}
            disabled={!valid}
            className="btn-primary flex-1 justify-center disabled:opacity-40"
          >
            {editPrinter ? 'Save Changes' : 'Add Printer'}
          </button>
        </div>
      </div>
    </div>
  )
}
