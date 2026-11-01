import React, { useState, useCallback, useEffect } from 'react'
import { StoreProvider, useStore } from './store/StoreContext'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import ContextMenu from './components/ContextMenu'
import RenameModal from './components/RenameModal'
import DeleteModal from './components/DeleteModal'
import DragOverlay from './components/DragOverlay'
import SendToPrinterModal from './components/SendToPrinterModal'
import HomePage from './pages/HomePage'
import RecentPage from './pages/RecentPage'
import FavoritesPage from './pages/FavoritesPage'
import AllPrintsPage from './pages/AllPrintsPage'
import PrintersPage from './pages/PrintersPage'
import SettingsPage from './pages/SettingsPage'

function AppContent() {
  const { state } = useStore()
  const [currentPage, setCurrentPage] = useState('home')
  const [searchQuery, setSearchQuery] = useState('')
  const [contextMenu, setContextMenu] = useState(null)
  const [renameFile, setRenameFile] = useState(null)
  const [deleteFile, setDeleteFile] = useState(null)
  const [sendFile, setSendFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragCounter, setDragCounter] = useState(0)

  // Apply dark/light mode to root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.settings.darkMode !== false ? 'dark' : 'light')
  }, [state.settings.darkMode])

  const navigate = useCallback((page) => {
    setCurrentPage(page)
    setSearchQuery('')
  }, [])

  const handleContextMenu = useCallback((e, file) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, file })
  }, [])

  const handleRename = useCallback((file) => setRenameFile(file), [])
  const handleDelete = useCallback((file) => setDeleteFile(file), [])
  const handleSendToPrinter = useCallback((file) => setSendFile(file), [])

  // Drag and drop
  const handleDragEnter = (e) => {
    e.preventDefault()
    setDragCounter(c => c + 1)
    setIsDragging(true)
  }
  const handleDragLeave = (e) => {
    e.preventDefault()
    setDragCounter(c => {
      const next = c - 1
      if (next <= 0) setIsDragging(false)
      return Math.max(0, next)
    })
  }
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }
  const handleDrop = async (e) => {
    e.preventDefault()
    setIsDragging(false)
    setDragCounter(0)
    const paths = []
    for (const item of e.dataTransfer.items) {
      if (item.kind === 'file') {
        const f = item.getAsFile()
        if (f?.path) paths.push(f.path)
      }
    }
    if (paths.length > 0) window.__bambuAddFiles?.(paths)
  }

  const pageProps = {
    searchQuery,
    onContextMenu: handleContextMenu,
    onRename: handleRename,
    onDelete: handleDelete,
    onSendToPrinter: handleSendToPrinter,
    onNavigate: navigate,
  }

  return (
    <div
      className="flex flex-col h-screen text-white overflow-hidden"
      style={{ background: '#0a0a0e' }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <TitleBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onQuickSend={handleSendToPrinter}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentPage={currentPage} onNavigate={navigate} />

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden page-enter">
            {currentPage === 'home'      && <HomePage      {...pageProps} />}
            {currentPage === 'recent'    && <RecentPage    {...pageProps} />}
            {currentPage === 'favorites' && <FavoritesPage {...pageProps} />}
            {currentPage === 'all'       && <AllPrintsPage {...pageProps} />}
            {currentPage === 'printers'  && <PrintersPage />}
            {currentPage === 'settings'  && <SettingsPage />}
          </div>
        </main>
      </div>

      {/* Modals & overlays */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y} file={contextMenu.file}
          onClose={() => setContextMenu(null)}
          onRename={handleRename}
          onDelete={handleDelete}
          onSendToPrinter={handleSendToPrinter}
        />
      )}
      {renameFile && <RenameModal file={renameFile} onClose={() => setRenameFile(null)} />}
      {deleteFile && <DeleteModal file={deleteFile} onClose={() => setDeleteFile(null)} />}
      {sendFile && (
        <SendToPrinterModal
          file={sendFile}
          onClose={() => setSendFile(null)}
          onNavigatePrinters={() => { setSendFile(null); navigate('printers') }}
        />
      )}
      {isDragging && <DragOverlay />}
    </div>
  )
}

function AppWithDrop() {
  useEffect(() => {
    const handler = (e) => window.__bambuAddFiles?.(e.detail)
    window.addEventListener('app:add-files', handler)
    return () => window.removeEventListener('app:add-files', handler)
  }, [])
  return <AppContent />
}

export default function App() {
  return (
    <StoreProvider>
      <AppWithDrop />
    </StoreProvider>
  )
}
