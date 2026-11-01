import React, { useState } from 'react'
import { FileBox, Plus } from 'lucide-react'
import FileCard from './FileCard'
import { useStore } from '../store/StoreContext'

export default function FileGrid({ files, onContextMenu, onSendToPrinter, emptyMessage, emptyIcon }) {
  const { actions } = useStore()
  const [selectedIds, setSelectedIds] = useState(new Set())

  const handleSelect = (id, multi) => {
    setSelectedIds(prev => {
      const next = new Set(multi ? prev : [])
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDoubleClick = async (file) => {
    const result = await actions.openInBambuStudio(file)
    if (!result?.success) alert(result?.error || 'Failed to open file.')
  }

  const handleContextMenu = (e, file) => {
    if (!selectedIds.has(file.id)) setSelectedIds(new Set([file.id]))
    onContextMenu(e, file)
  }

  const handleAddFiles = async () => {
    const paths = await window.electronAPI.dialogOpenFiles()
    if (paths.length > 0) await actions.addFiles(paths)
  }

  if (files.length === 0) {
    const Icon = emptyIcon || FileBox
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 text-center py-20">
        <div className="w-20 h-20 rounded-3xl bg-[#1e1e1e] flex items-center justify-center">
          <Icon size={36} className="text-gray-600" />
        </div>
        <div>
          <p className="text-gray-400 font-medium">{emptyMessage || 'No files here yet'}</p>
          <p className="text-gray-600 text-sm mt-1">Add some 3D print files to get started</p>
        </div>
        <button onClick={handleAddFiles} className="btn-primary">
          <Plus size={15} /> Add Files
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 p-6 animate-fade-in">
      {files.map(file => (
        <FileCard
          key={file.id}
          file={file}
          selected={selectedIds.has(file.id)}
          onSelect={handleSelect}
          onContextMenu={handleContextMenu}
          onDoubleClick={handleDoubleClick}
          onSendToPrinter={onSendToPrinter}
        />
      ))}
    </div>
  )
}
