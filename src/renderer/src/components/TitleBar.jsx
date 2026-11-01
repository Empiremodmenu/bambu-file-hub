import React, { useState, useEffect, useRef } from 'react'
import { Minus, Square, X, Printer, Search, Send, Plus, Sparkles } from 'lucide-react'
import { useStore } from '../store/StoreContext'

export default function TitleBar({ searchQuery, onSearchChange, onQuickSend }) {
  const { actions } = useStore()
  const [isMaximized, setIsMaximized] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    window.electronAPI.windowIsMaximized().then(setIsMaximized)
  }, [])

  const handleMaximize = async () => {
    await window.electronAPI.windowMaximize()
    const m = await window.electronAPI.windowIsMaximized()
    setIsMaximized(m)
  }

  const handleAddFiles = async () => {
    const paths = await window.electronAPI.dialogOpenFiles()
    if (paths.length > 0) await actions.addFiles(paths)
  }

  const handleQuickSend = async () => {
    const paths = await window.electronAPI.dialogOpenFiles()
    if (!paths.length) return
    const filePath = paths[0]
    const parts = filePath.replace(/\\/g, '/').split('/')
    const base = parts[parts.length - 1]
    const ext = base.split('.').pop().toLowerCase()
    onQuickSend?.({ id: '__quicksend__', name: base.replace(/\.[^.]+$/, ''), path: filePath, type: ext, size: 0, thumbnail: null })
  }

  return (
    <div
      className="flex items-center gap-3 h-14 shrink-0 select-none px-4 border-b border-white/5"
      style={{ WebkitAppRegion: 'drag', background: '#0a0a0e' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 shrink-0" style={{ WebkitAppRegion: 'no-drag' }}>
        <div className="w-8 h-8 rounded-xl bg-bambu-500 flex items-center justify-center shadow-lg shadow-bambu-500/30">
          <Printer size={15} className="text-black" strokeWidth={2.5} />
        </div>
        <span className="text-[15px] font-bold text-white tracking-tight">Bambu File Hub</span>
      </div>

      {/* Search — center */}
      <div className="flex-1 max-w-xl relative" style={{ WebkitAppRegion: 'no-drag' }}>
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery || ''}
          onChange={e => onSearchChange?.(e.target.value)}
          placeholder="Search files, types…"
          className="w-full rounded-xl px-4 pl-10 py-2 text-sm text-white placeholder-gray-600 outline-none transition-all"
          style={{ background: '#18181f', border: '1px solid rgba(255,255,255,0.07)' }}
          onFocus={e => e.target.style.borderColor = 'rgba(0,212,160,0.4)'}
          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.07)'}
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 shrink-0" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={handleQuickSend}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
        >
          <Send size={13} />
          Quick Send
        </button>
        <button
          onClick={handleAddFiles}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bambu-500 hover:bg-bambu-400 text-black text-sm font-bold transition-all shadow-lg shadow-bambu-500/20"
        >
          <Plus size={15} strokeWidth={2.5} />
          Add Files
        </button>
        <button
          className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-500 hover:text-white transition-all"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          title="What's new"
        >
          <Sparkles size={14} />
        </button>
      </div>

      {/* Powered by ReRideCo */}
      <div className="shrink-0 px-2" style={{ WebkitAppRegion: 'no-drag' }}>
        <span style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontWeight: 'bold',
          fontStyle: 'italic',
          fontSize: '12px',
          letterSpacing: '0.04em',
          background: 'linear-gradient(90deg, #5100d4, #00a8ff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Powered by ReRideCo
        </span>
      </div>

      {/* Window controls */}
      <div className="flex items-center h-full shrink-0" style={{ WebkitAppRegion: 'no-drag' }}>
        <button onClick={() => window.electronAPI.windowMinimize()}
          className="h-full px-3 text-gray-500 hover:text-white transition-colors"
          style={{ '--tw-bg-opacity': 1 }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          title="Minimize">
          <Minus size={14} />
        </button>
        <button onClick={handleMaximize}
          className="h-full px-3 text-gray-500 hover:text-white transition-colors"
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          title={isMaximized ? 'Restore' : 'Maximize'}>
          <Square size={12} />
        </button>
        <button onClick={() => window.electronAPI.windowClose()}
          className="h-full px-3 text-gray-500 hover:text-white transition-colors"
          onMouseEnter={e => e.currentTarget.style.background = '#dc2626'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          title="Close">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
