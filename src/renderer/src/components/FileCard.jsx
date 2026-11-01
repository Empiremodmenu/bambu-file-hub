import React, { useEffect, useRef } from 'react'
import { Star, Play, FileBox, Send, Printer } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { formatFileSize, formatDate, getFileTypeColor, getFileTypeLabel } from '../utils/fileHelpers'
import { generateThumbnail } from '../utils/thumbnails'

export default function FileCard({ file, selected, onSelect, onContextMenu, onDoubleClick, onSendToPrinter }) {
  const { actions } = useStore()
  const thumbAttempted = useRef(false)

  useEffect(() => {
    if (file.thumbnail || thumbAttempted.current) return
    if (file.type !== 'stl' && file.type !== '3mf') return
    thumbAttempted.current = true
    generateThumbnail(file).then(thumb => {
      if (thumb) actions.setThumbnail(file.id, thumb)
    })
  }, [file.id])

  const handleClick = (e) => {
    onSelect(file.id, e.ctrlKey || e.metaKey)
  }

  const handlePrint = async (e) => {
    e.stopPropagation()
    const result = await actions.openInBambuStudio(file)
    if (!result?.success) alert(result?.error || 'Failed to open file.')
  }

  const handleSend = (e) => {
    e.stopPropagation()
    onSendToPrinter(file)
  }

  const handleFavorite = (e) => {
    e.stopPropagation()
    actions.toggleFavorite(file.id)
  }

  return (
    <div
      className={`group animate-scale-in relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-200
        hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-black/60
        ${selected ? 'ring-2 ring-bambu-500/60' : ''}`}
      style={{
        background: '#16162a',
        border: selected ? '1px solid rgba(0,212,160,0.4)' : '1px solid rgba(255,255,255,0.06)',
      }}
      onClick={handleClick}
      onDoubleClick={() => onDoubleClick(file)}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, file) }}
    >
      {/* Thumbnail — 4:3 ratio */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '4/3' }}>
        <div className="absolute inset-0" style={{ background: '#1e1e30' }}>
          {file.thumbnail ? (
            <img src={file.thumbnail} alt={file.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <FileBox size={32} className="text-gray-600" />
            </div>
          )}
        </div>

        {/* Teal glow bottom-right */}
        <div
          className="pointer-events-none absolute bottom-0 right-0 w-24 h-24 opacity-30"
          style={{ background: 'radial-gradient(circle at 100% 100%, #00d4a0 0%, transparent 70%)' }}
        />

        {/* Always-visible type badge */}
        <div
          className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-wide"
          style={{ background: 'rgba(0,212,160,0.2)', color: '#00d4a0', border: '1px solid rgba(0,212,160,0.3)' }}
        >
          {getFileTypeLabel(file.type)}
        </div>

        {/* Favorite */}
        <button
          onClick={handleFavorite}
          className={`absolute top-2 right-2 p-1.5 rounded-lg transition-all
            ${file.isFavorite
              ? 'text-yellow-400 bg-yellow-400/20 opacity-100'
              : 'text-gray-500 bg-black/40 opacity-0 group-hover:opacity-100 hover:text-yellow-400'
            }`}
        >
          <Star size={12} fill={file.isFavorite ? 'currentColor' : 'none'} />
        </button>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-xl transition-all w-full justify-center"
          >
            <Play size={11} fill="currentColor" />
            Open in Studio
          </button>
          <button
            onClick={handleSend}
            className="flex items-center gap-1.5 px-3 py-1.5 text-black text-xs font-bold rounded-xl transition-all w-full justify-center"
            style={{ background: '#00d4a0' }}
            onMouseEnter={e => e.currentTarget.style.background = '#00e6ae'}
            onMouseLeave={e => e.currentTarget.style.background = '#00d4a0'}
          >
            <Send size={11} />
            Send to Printer
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-semibold text-white truncate mb-1.5" title={file.name}>{file.name}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Printer size={10} className="text-gray-600" />
            <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
          </div>
          <span className="text-xs text-gray-600">{formatDate(file.dateAdded)}</span>
        </div>
      </div>
    </div>
  )
}
