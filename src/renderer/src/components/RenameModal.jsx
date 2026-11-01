import React, { useState, useEffect, useRef } from 'react'
import { Pencil, X } from 'lucide-react'
import { useStore } from '../store/StoreContext'

export default function RenameModal({ file, onClose }) {
  const { actions } = useStore()
  const [name, setName] = useState(file.name)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed && trimmed !== file.name) {
      actions.renameFile(file.id, trimmed)
    }
    onClose()
  }

  const handleKey = (e) => {
    if (e.key === 'Escape') onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={handleKey}
    >
      <div className="w-full max-w-sm bg-dark-600 rounded-2xl border border-white/10 shadow-2xl shadow-black/60 p-6 animate-slide-up">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-bambu-500/20 flex items-center justify-center">
            <Pencil size={16} className="text-bambu-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Rename File</h2>
            <p className="text-xs text-gray-500 mt-0.5">Enter a new name for this file</p>
          </div>
          <button onClick={onClose} className="ml-auto text-gray-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="input-field mb-4"
            placeholder="File name"
            maxLength={200}
          />

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!name.trim() || name.trim() === file.name}
            >
              Rename
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
