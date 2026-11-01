import React, { useState } from 'react'
import { Grid3X3 } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import FileGrid from '../components/FileGrid'
import SearchBar from '../components/SearchBar'
import { filterFiles, sortFiles } from '../utils/fileHelpers'

export default function AllPrintsPage({ searchQuery, onContextMenu, onRename, onDelete, onSendToPrinter }) {
  const { state } = useStore()
  const [sortBy, setSortBy] = useState('date')
  const filtered = filterFiles(sortFiles(state.files, sortBy), searchQuery)

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-5 pb-2">
          <h1 className="text-xl font-bold text-white">All Prints</h1>
          <p className="text-sm text-gray-500 mt-1">{state.files.length} file{state.files.length !== 1 ? 's' : ''} in your library</p>
        </div>
        <FileGrid files={filtered} onContextMenu={onContextMenu} onSendToPrinter={onSendToPrinter}
          emptyMessage="Your library is empty" emptyIcon={Grid3X3} />
      </div>
    </div>
  )
}
