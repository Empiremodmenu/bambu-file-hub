import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'

const StoreContext = createContext(null)

const initialState = {
  files: [],
  recentFileIds: [],
  printers: [],
  cloudAccount: null, // { accessToken, refreshToken, userId, region, email }
  settings: {
    bambuStudioPath: '',
    defaultFolder: '',
    darkMode: true,
    autoSaveRecent: true,
    launchOnStartup: false,
    cloudRegion: 'us',
  },
  folders: [],
  isLoaded: false,
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_STATE':
      return { ...initialState, ...action.payload, isLoaded: true }

    case 'ADD_FILES':
      return { ...state, files: [...state.files, ...action.payload] }

    case 'REMOVE_FILE':
      return {
        ...state,
        files: state.files.filter(f => f.id !== action.payload),
        recentFileIds: state.recentFileIds.filter(id => id !== action.payload),
      }

    case 'UPDATE_FILE':
      return {
        ...state,
        files: state.files.map(f =>
          f.id === action.payload.id ? { ...f, ...action.payload } : f
        ),
      }

    case 'TOGGLE_FAVORITE':
      return {
        ...state,
        files: state.files.map(f =>
          f.id === action.payload ? { ...f, isFavorite: !f.isFavorite } : f
        ),
      }

    case 'ADD_RECENT': {
      const filtered = state.recentFileIds.filter(id => id !== action.payload)
      return { ...state, recentFileIds: [action.payload, ...filtered].slice(0, 20) }
    }

    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } }

    case 'ADD_FOLDER':
      return { ...state, folders: [...state.folders, action.payload] }

    case 'REMOVE_FOLDER':
      return { ...state, folders: state.folders.filter(f => f.id !== action.payload) }

    case 'SET_THUMBNAIL':
      return {
        ...state,
        files: state.files.map(f =>
          f.id === action.payload.id ? { ...f, thumbnail: action.payload.thumbnail } : f
        ),
      }

    case 'SET_CLOUD_ACCOUNT':
      // Clear cloud-mode printers on logout
      if (action.payload === null) {
        return { ...state, cloudAccount: null, printers: state.printers.filter(p => p.defaultMode !== 'cloud') }
      }
      return { ...state, cloudAccount: action.payload }

    // ── Printers ────────────────────────────────────────────────────────────
    case 'ADD_PRINTER':
      return { ...state, printers: [...state.printers, action.payload] }

    case 'UPDATE_PRINTER':
      return {
        ...state,
        printers: state.printers.map(p =>
          p.id === action.payload.id ? { ...p, ...action.payload } : p
        ),
      }

    case 'REMOVE_PRINTER':
      return { ...state, printers: state.printers.filter(p => p.id !== action.payload) }

    default:
      return state
  }
}

async function persistState(state) {
  const { isLoaded, ...data } = state
  await window.electronAPI.storeSet('appState', data)
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    async function load() {
      const saved = await window.electronAPI.storeGet('appState')
      if (saved && typeof saved === 'object') {
        dispatch({ type: 'LOAD_STATE', payload: saved })
      } else {
        dispatch({ type: 'LOAD_STATE', payload: initialState })
        const detected = await window.electronAPI.detectBambuStudio()
        if (detected) dispatch({ type: 'UPDATE_SETTINGS', payload: { bambuStudioPath: detected } })
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (state.isLoaded) persistState(state)
  }, [state])

  const actions = {
    addFiles: useCallback(async (filePaths) => {
      const newFiles = []
      for (const filePath of filePaths) {
        if (state.files.some(f => f.path === filePath)) continue
        const stat = await window.electronAPI.fileStat(filePath)
        const parts = filePath.replace(/\\/g, '/').split('/')
        const base = parts[parts.length - 1]
        const ext = base.split('.').pop().toLowerCase()
        newFiles.push({
          id: uuidv4(),
          name: base.replace(/\.[^.]+$/, ''),
          path: filePath,
          type: ext,
          size: stat?.size || 0,
          dateAdded: new Date().toISOString(),
          lastOpened: null,
          isFavorite: false,
          tags: [],
          thumbnail: null,
          estimatedTime: null,
        })
      }
      if (newFiles.length > 0) dispatch({ type: 'ADD_FILES', payload: newFiles })
      return newFiles
    }, [state.files]),

    removeFile:      useCallback((id) => dispatch({ type: 'REMOVE_FILE', payload: id }), []),
    renameFile:      useCallback((id, name) => dispatch({ type: 'UPDATE_FILE', payload: { id, name } }), []),
    toggleFavorite:  useCallback((id) => dispatch({ type: 'TOGGLE_FAVORITE', payload: id }), []),
    addRecent:       useCallback((id) => dispatch({ type: 'ADD_RECENT', payload: id }), []),
    updateSettings:  useCallback((s) => dispatch({ type: 'UPDATE_SETTINGS', payload: s }), []),
    addFolder:       useCallback((name) => dispatch({ type: 'ADD_FOLDER', payload: { id: uuidv4(), name } }), []),
    removeFolder:    useCallback((id) => dispatch({ type: 'REMOVE_FOLDER', payload: id }), []),
    setThumbnail:    useCallback((id, thumbnail) => dispatch({ type: 'SET_THUMBNAIL', payload: { id, thumbnail } }), []),

    openInBambuStudio: useCallback(async (file) => {
      dispatch({ type: 'ADD_RECENT', payload: file.id })
      dispatch({ type: 'UPDATE_FILE', payload: { id: file.id, lastOpened: new Date().toISOString() } })
      return window.electronAPI.openInBambuStudio(file.path, state.settings.bambuStudioPath)
    }, [state.settings.bambuStudioPath]),

    // Printers
    addPrinter:    useCallback((p) => dispatch({ type: 'ADD_PRINTER', payload: { ...p, id: p.id || uuidv4() } }), []),
    updatePrinter: useCallback((p) => dispatch({ type: 'UPDATE_PRINTER', payload: p }), []),
    removePrinter: useCallback((id) => dispatch({ type: 'REMOVE_PRINTER', payload: id }), []),

    // Cloud account
    setCloudAccount: useCallback((account) => dispatch({ type: 'SET_CLOUD_ACCOUNT', payload: account }), []),
  }

  useEffect(() => {
    window.__bambuAddFiles = actions.addFiles
    return () => { delete window.__bambuAddFiles }
  }, [actions.addFiles])

  return (
    <StoreContext.Provider value={{ state, actions }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
