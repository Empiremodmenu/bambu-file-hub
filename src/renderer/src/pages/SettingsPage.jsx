import React, { useState, useEffect } from 'react'
import {
  Settings, FolderOpen, Monitor, Zap,
  CheckCircle, AlertCircle, RefreshCw,
  Cloud, LogIn, LogOut, Loader
} from 'lucide-react'
import { useStore } from '../store/StoreContext'

export default function SettingsPage() {
  const { state, actions } = useStore()
  const { settings, cloudAccount } = state

  const [detecting, setDetecting]   = useState(false)
  const [bambuExists, setBambuExists]= useState(null)
  const [saved, setSaved]           = useState(false)
  const [loggingIn, setLoggingIn]   = useState(false)
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    if (settings.bambuStudioPath)
      window.electronAPI.fileExists(settings.bambuStudioPath).then(setBambuExists)
  }, [settings.bambuStudioPath])

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1800) }

  const handleSelectBambu = async () => {
    const path = await window.electronAPI.dialogSelectBambuStudio()
    if (path) { actions.updateSettings({ bambuStudioPath: path }); flash() }
  }

  const handleSelectFolder = async () => {
    const path = await window.electronAPI.dialogSelectFolder()
    if (path) { actions.updateSettings({ defaultFolder: path }); flash() }
  }

  const handleDetect = async () => {
    setDetecting(true)
    const path = await window.electronAPI.detectBambuStudio()
    setDetecting(false)
    if (path) { actions.updateSettings({ bambuStudioPath: path }); flash() }
    else alert('Bambu Studio not found. Please select it manually.')
  }

  const handleToggle = (key) => { actions.updateSettings({ [key]: !settings[key] }); flash() }

  const handleLogin = async () => {
    setLoggingIn(true)
    setLoginError('')
    const result = await window.electronAPI.cloudLogin(settings.cloudRegion || 'us')
    setLoggingIn(false)
    if (result.success) {
      actions.setCloudAccount(result.account)
      // Auto-import any printers returned with the login
      if (result.devices?.length) {
        result.devices.forEach(d => {
          if (d.serial) actions.addPrinter({ ...d, id: d.serial })
        })
      }
      flash()
    } else {
      setLoginError(result.error || 'Login window was closed without signing in.')
    }
  }

  const handleLogout = () => { actions.setCloudAccount(null); flash() }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-sm text-gray-500 mt-1">Configure Bambu File Hub</p>
          </div>
          {saved && (
            <div className="flex items-center gap-2 text-bambu-400 text-sm animate-fade-in">
              <CheckCircle size={15} /> Saved
            </div>
          )}
        </div>

        <div className="space-y-6">

          {/* ── Bambu Lab Account (Cloud) ─────────────────────────────── */}
          <SettingsCard title="Bambu Lab Account" icon={Cloud} iconColor="text-blue-400 bg-blue-400/10">
            {cloudAccount ? (
              <div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-bambu-500/10 border border-bambu-500/20 mb-4">
                  <CheckCircle size={16} className="text-bambu-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">Signed in</p>
                    <p className="text-xs text-grayb-500 truncate">{cloudAccount.email}</p>
                  </div>
                  <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full uppercase">
                    {cloudAccount.region}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Cloud mode is active. You can send prints from anywhere — even when away from home.
                </p>
                <button onClick={handleLogout} className="btn-ghost text-sm">
                  <LogOut size={13} /> Sign Out
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">
                  Sign in to enable Cloud mode — send prints from anywhere, even away from home.
                </p>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Region</label>
                  <select
                    className="input-field w-48 cursor-pointer"
                    value={settings.cloudRegion || 'us'}
                    onChange={e => actions.updateSettings({ cloudRegion: e.target.value })}
                  >
                    <option value="us">Global (US)</option>
                    <option value="cn">China (CN)</option>
                  </select>
                </div>

                {loginError && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                    <AlertCircle size={13} className="shrink-0" />
                    {loginError}
                  </div>
                )}

                <button
                  onClick={handleLogin}
                  disabled={loggingIn}
                  className="btn-primary disabled:opacity-40"
                >
                  {loggingIn
                    ? <><Loader size={13} className="animate-spin" /> Opening login…</>
                    : <><LogIn size={13} /> Sign In with Bambu Lab</>
                  }
                </button>

                <p className="text-xs text-gray-600">
                  Opens the official Bambu Lab website in a popup. Sign in there as normal.
                </p>
              </div>
            )}
          </SettingsCard>

          {/* ── Bambu Studio ─────────────────────────────────────────── */}
          <SettingsCard title="Bambu Studio" icon={Zap} iconColor="text-bambu-400 bg-bambu-400/10">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Executable Path</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text" readOnly
                      value={settings.bambuStudioPath || ''}
                      placeholder="No path selected…"
                      className="input-field pr-8 text-xs cursor-default"
                    />
                    {settings.bambuStudioPath && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {bambuExists === true  && <CheckCircle size={13} className="text-bambu-400" />}
                        {bambuExists === false && <AlertCircle size={13} className="text-red-400" />}
                      </div>
                    )}
                  </div>
                  <button onClick={handleSelectBambu} className="btn-secondary shrink-0">
                    <FolderOpen size={14} /> Browse
                  </button>
                </div>
                {bambuExists === false && <p className="text-xs text-red-400 mt-1.5">File not found — please re-select.</p>}
                {bambuExists === true  && <p className="text-xs text-bambu-400 mt-1.5">Bambu Studio found and ready.</p>}
              </div>
              <button onClick={handleDetect} disabled={detecting} className="btn-ghost text-xs">
                <RefreshCw size={13} className={detecting ? 'animate-spin' : ''} />
                {detecting ? 'Detecting…' : 'Auto-detect Bambu Studio'}
              </button>
            </div>
          </SettingsCard>

          {/* ── Default Folder ────────────────────────────────────────── */}
          <SettingsCard title="Default Folder" icon={FolderOpen} iconColor="text-yellow-400 bg-yellow-400/10">
            <div className="flex gap-2">
              <input
                type="text" readOnly
                value={settings.defaultFolder || ''}
                placeholder="Not set — files can be added from anywhere"
                className="input-field flex-1 text-xs cursor-default"
              />
              <button onClick={handleSelectFolder} className="btn-secondary shrink-0">
                <FolderOpen size={14} /> Browse
              </button>
            </div>
          </SettingsCard>

          {/* ── Preferences ───────────────────────────────────────────── */}
          <SettingsCard title="Preferences" icon={Monitor} iconColor="text-purple-400 bg-purple-400/10">
            <div className="space-y-1">
              <Toggle label="Auto-save recent files" desc="Track files opened in Bambu Studio"
                checked={settings.autoSaveRecent} onChange={() => handleToggle('autoSaveRecent')} />
              <Toggle label="Dark mode" desc="Dark interface (recommended)"
                checked={settings.darkMode} onChange={() => handleToggle('darkMode')} />
              <Toggle label="Launch on startup" desc="Open Bambu File Hub when Windows starts"
                checked={settings.launchOnStartup} onChange={() => handleToggle('launchOnStartup')} />
            </div>
          </SettingsCard>

          {/* ── About ─────────────────────────────────────────────────── */}
          <SettingsCard title="About" icon={Settings} iconColor="text-gray-400 bg-gray-400/10">
            <div className="space-y-2 text-sm">
              <Row label="Version"    value="1.0.0" />
              <Row label="Platform"   value="Windows" />
              <Row label="Built with" value="Electron + React" />
            </div>
          </SettingsCard>

        </div>
      </div>
    </div>
  )
}

function SettingsCard({ title, icon: Icon, iconColor, children }) {
  return (
    <div className="glass-panel p-5">
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconColor}`}>
          <Icon size={15} />
        </div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Toggle({ label, desc, checked, onChange }) {
  return (
    <label className="flex items-center justify-between py-3 cursor-pointer group">
      <div>
        <p className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">{label}</p>
        {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
      </div>
      <div onClick={onChange} className="relative shrink-0 ml-4 cursor-pointer rounded-full transition-colors"
        style={{ width: 40, height: 22, background: checked ? '#00d4a0' : '#333' }}>
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
          ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
    </label>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300 font-medium">{value}</span>
    </div>
  )
}
