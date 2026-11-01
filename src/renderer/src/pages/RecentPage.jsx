import React from 'react'
import { Clock } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import FileGrid from '../components/FileGrid'
import SearchBar from '../components/SearchBar'
import { filterFiles } from '../utils/fileHelpers'

export default function RecentPage({ searchQuery, onContextMenu, onRename, onDelete, onSendToPrinter }) {
  const { state } = useStore()
  const recentFiles = state.recentFileIds.map(id => state.files.find(f => f.id === id)).filter(Boolean)
  const filtered = filterFiles(recentFiles, searchQuery)

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-5 pb-2">
          <h1 className="text-xl font-bold text-white">Recent Files</h1>
          <p className="text-sm text-gray-500 mt-1">Files you've opened in Bambu Studio</p>
        </div>
        <FileGrid files={filtered} onContextMenu={onContextMenu} onSendToPrinter={onSendToPrinter}
          emptyMessage="No recently opened files" emptyIcon={Clock} />
      </div>
    </div>
  )
}
