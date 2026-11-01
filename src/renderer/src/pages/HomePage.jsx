import React, { useState } from 'react'
import { Star, TrendingUp, ChevronRight } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import FileGrid from '../components/FileGrid'
import { filterFiles, sortFiles } from '../utils/fileHelpers'

export default function HomePage({ searchQuery, onContextMenu, onRename, onDelete, onSendToPrinter, onNavigate }) {
  const { state } = useStore()
  const { files } = state
  const [sortBy] = useState('date')

  const favoriteFiles = files.filter(f => f.isFavorite).slice(0, 8)
  const allFiltered = filterFiles(sortFiles(files, sortBy), searchQuery)

  const gridProps = { onContextMenu, onSendToPrinter, onRename, onDelete }

  if (searchQuery) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="px-6 pt-4 pb-2">
          <p className="text-sm text-gray-500">
            {allFiltered.length} result{allFiltered.length !== 1 ? 's' : ''} for "{searchQuery}"
          </p>
        </div>
        <FileGrid files={allFiltered} {...gridProps} emptyMessage="No files match your search" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-6 space-y-8">
        {favoriteFiles.length > 0 && (
          <Section title="Favorites" icon={Star} onViewAll={() => onNavigate?.('favorites')}>
            <FileGrid files={favoriteFiles} {...gridProps} />
          </Section>
        )}
        <Section title="All Prints" icon={TrendingUp} onViewAll={() => onNavigate?.('all')}>
          <FileGrid files={sortFiles(files, sortBy).slice(0, 12)} {...gridProps} emptyMessage="Your library is empty" />
        </Section>
      </div>
    </div>
  )
}

function Section({ title, icon: Icon, children, onViewAll }) {
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-4">
        <Icon size={16} className="text-bambu-400" />
        <h2 className="text-base font-semibold text-white flex-1">{title}</h2>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-bambu-400 transition-colors"
          >
            View all <ChevronRight size={13} />
          </button>
        )}
      </div>
      {children}
    </div>
  )
}
