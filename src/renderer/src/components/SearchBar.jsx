import React, { useRef } from 'react'
import { Search, X, Plus, Send } from 'lucide-react'
import { useStore } from '../store/StoreContext'

export default function SearchBar({ value, onChange, sortBy, onSortChange, onQuickSend }) {
  const { actions } = useStore()
  const inputRef = useRef(null)

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
    // Build a temporary file object — not saved to the library
    const tempFile = {
      id: '__quicksend__',
      name: base.replace(/\.[^.]+$/, ''),
      path: filePath,
      type: ext,
      size: 0,
      thumbnail: null,
    }
    onQuickSend(tempFile)
  }

  return (
    <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5 shrink-0">
      {/* Search */}
      <div className="relative flex-1 max-w-lg">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Search files, types…"
          className="input-field pl-10 pr-8"
        />
        {value && (
          <button
            onClick={() => { onChange(''); inputRef.current?.focus() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Sort */}
      {onSortChange && (
        <select
          value={sortBy}
          onChange={e => onSortChange(e.target.value)}
          className="input-field w-auto px-3 py-2 text-xs cursor-pointer"
        >
          <option value="date">Sort: Date Added</option>
          <option value="name">Sort: Name</option>
          <option value="size">Sort: File Size</option>
          <option value="favorites">Sort: Favorites</option>
        </select>
      )}

      {/* Quick Send — any file, no library needed */}
      <button onClick={handleQuickSend} className="btn-secondary shrink-0">
        <Send size={14} />
        Quick Send
      </button>

      {/* Add to Library */}
      <button onClick={handleAddFiles} className="btn-primary shrink-0">
        <Plus size={15} strokeWidth={2.5} />
        Add Files
      </button>
    </div>
  )
}
