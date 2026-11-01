import React, { useEffect, useRef } from 'react'
import { Play, Pencil, Trash2, FolderOpen, Star, StarOff, Send } from 'lucide-react'
import { useStore } from '../store/StoreContext'

export default function ContextMenu({ x, y, file, onClose, onRename, onDelete, onSendToPrinter }) {
  const { actions } = useStore()
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
    }
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const adjustedX = Math.min(x, window.innerWidth - 220)
  const adjustedY = Math.min(y, window.innerHeight - 260)

  const Item = ({ icon: Icon, label, onClick, danger, color }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-3 py-2 text-sm rounded-lg transition-colors text-left
        ${danger
          ? 'text-red-400 hover:bg-red-500/15 hover:text-red-300'
          : 'text-gray-300 hover:bg-white/8 hover:text-white'
        }`}
    >
      <Icon size={14} className={color || (danger ? 'text-red-400' : 'text-gray-500')} />
      {label}
    </button>
  )

  const Divider = () => <div className="h-px bg-white/8 my-1" />

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-56 bg-[#222] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 p-1.5 animate-scale-in"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <div className="px-3 py-2 mb-1">
        <p className="text-xs text-gray-500 font-medium truncate">{file.name}</p>
      </div>

      <Item
        icon={Play}
        label="Open in Bambu Studio"
        color="text-bambu-400"
        onClick={async () => {
          onClose()
          const r = await actions.openInBambuStudio(file)
          if (!r?.success) alert(r?.error || 'Failed to open.')
        }}
      />

      <Item
        icon={Send}
        label="Send to Printer"
        color="text-blue-400"
        onClick={() => { onClose(); onSendToPrinter(file) }}
      />

      <Divider />

      <Item
        icon={file.isFavorite ? StarOff : Star}
        label={file.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
        color="text-yellow-400"
        onClick={() => { actions.toggleFavorite(file.id); onClose() }}
      />
      <Item icon={Pencil} label="Rename" onClick={() => { onClose(); onRename(file) }} />
      <Item icon={FolderOpen} label="Show in Folder" onClick={() => { onClose(); window.electronAPI.showInFolder(file.path) }} />

      <Divider />

      <Item icon={Trash2} label="Remove from Library" danger onClick={() => { onClose(); onDelete(file) }} />
    </div>
  )
}
