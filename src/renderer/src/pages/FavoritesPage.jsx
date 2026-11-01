import React, { useState } from 'react'
import { Star } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import FileGrid from '../components/FileGrid'
import SearchBar from '../components/SearchBar'
import { filterFiles, sortFiles } from '../utils/fileHelpers'

export default function FavoritesPage({ searchQuery, onContextMenu, onRename, onDelete, onSendToPrinter }) {
  const { state } = useStore()
  const [sortBy, setSortBy] = useState('name')
  const filtered = filterFiles(sortFiles(state.files.filter(f => f.isFavorite), sortBy), searchQuery)

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-5 pb-2">
          <h1 className="text-xl font-bold text-white">Favorites</h1>
          <p className="text-sm text-gray-500 mt-1">Your pinned and starred prints</p>
        </div>
        <FileGrid files={filtered} onContextMenu={onContextMenu} onSendToPrinter={onSendToPrinter}
          emptyMessage="No favorites yet" emptyIcon={Star} />
      </div>
    </div>
  )
}
