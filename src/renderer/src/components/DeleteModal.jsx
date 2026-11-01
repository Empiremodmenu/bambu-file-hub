import React from 'react'
import { Trash2, X } from 'lucide-react'
import { useStore } from '../store/StoreContext'

export default function DeleteModal({ file, onClose }) {
  const { actions } = useStore()

  const handleDelete = () => {
    actions.removeFile(file.id)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm bg-dark-600 rounded-2xl border border-white/10 shadow-2xl shadow-black/60 p-6 animate-slide-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center">
            <Trash2 size={16} className="text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Remove File</h2>
            <p className="text-xs text-gray-500 mt-0.5">This removes it from your library only</p>
          </div>
          <button onClick={onClose} className="ml-auto text-gray-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <p className="text-sm text-gray-300 mb-5">
          Remove <span className="font-semibold text-white">"{file.name}"</span> from Bambu File Hub?
          <br />
          <span className="text-gray-500 text-xs mt-1 block">The original file on disk will not be deleted.</span>
        </p>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all text-sm active:scale-95"
          >
            <Trash2 size={14} />
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}
