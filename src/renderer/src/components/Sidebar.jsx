import React from 'react'
import { Home, Clock, Star, Grid3X3, Settings, HardDrive, Printer } from 'lucide-react'
import { useStore } from '../store/StoreContext'

const navItems = [
  { id: 'home',      label: 'Home',         icon: Home },
  { id: 'recent',    label: 'Recent Files', icon: Clock },
  { id: 'favorites', label: 'Favorites',    icon: Star },
  { id: 'all',       label: 'All Prints',   icon: Grid3X3 },
  { id: 'printers',  label: 'My Printers',  icon: Printer },
]

export default function Sidebar({ currentPage, onNavigate }) {
  const { state } = useStore()
  const { files, printers } = state

  const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0)
  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const usedPct = Math.min(100, Math.round((totalSize / (5 * 1024 * 1024 * 1024)) * 100))

  return (
    <aside
      className="w-64 shrink-0 flex flex-col overflow-hidden relative"
      style={{ background: '#0d0d12', borderRight: '1px solid rgba(255,255,255,0.05)' }}
    >
      {/* Teal radial glow — bottom left */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 w-64 h-64 opacity-20"
        style={{ background: 'radial-gradient(circle at 0% 100%, #00d4a0 0%, transparent 70%)' }}
      />

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto relative z-10">
        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest px-3 mb-3 mt-1">Menu</p>

        {navItems.map(({ id, label, icon: Icon }) => {
          const active = currentPage === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all duration-150 select-none"
              style={active ? {
                background: 'rgba(0,212,160,0.12)',
                border: '1px solid rgba(0,212,160,0.25)',
                color: '#00d4a0',
              } : {
                border: '1px solid transparent',
                color: '#888',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#888' }}
            >
              <Icon size={17} style={{ color: active ? '#00d4a0' : 'inherit' }} />
              <span className="flex-1">{label}</span>
              {id === 'favorites' && files.filter(f => f.isFavorite).length > 0 && (
                <span className="text-xs bg-bambu-500/20 text-bambu-400 rounded-full px-1.5 py-0.5 font-medium">
                  {files.filter(f => f.isFavorite).length}
                </span>
              )}
              {id === 'all' && files.length > 0 && (
                <span className="text-xs text-gray-600 font-medium">{files.length}</span>
              )}
              {id === 'printers' && printers.length > 0 && (
                <span className="text-xs text-gray-600 font-medium">{printers.length}</span>
              )}
            </button>
          )
        })}

        <div className="h-px my-3" style={{ background: 'rgba(255,255,255,0.05)' }} />

        <button
          onClick={() => onNavigate('settings')}
          className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all duration-150 select-none"
          style={currentPage === 'settings' ? {
            background: 'rgba(0,212,160,0.12)',
            border: '1px solid rgba(0,212,160,0.25)',
            color: '#00d4a0',
          } : {
            border: '1px solid transparent',
            color: '#888',
          }}
          onMouseEnter={e => { if (currentPage !== 'settings') e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { if (currentPage !== 'settings') e.currentTarget.style.color = '#888' }}
        >
          <Settings size={17} style={{ color: currentPage === 'settings' ? '#00d4a0' : 'inherit' }} />
          <span>Settings</span>
        </button>
      </nav>

      {/* Library card */}
      <div className="p-4 relative z-10" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="p-3.5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 mb-3">
            <HardDrive size={13} className="text-gray-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Library</span>
          </div>
          <p className="text-lg font-bold text-white">{files.length} <span className="text-sm font-normal text-gray-500">files</span></p>
          <p className="text-xs text-gray-600 mt-0.5">{formatSize(totalSize)} total</p>
          {files.length > 0 && (
            <div className="mt-3">
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(4, usedPct)}%`, background: 'linear-gradient(90deg, #00d4a0, #00a8ff)' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
