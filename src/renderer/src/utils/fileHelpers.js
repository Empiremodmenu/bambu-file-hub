export function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatDate(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function getFileTypeColor(type) {
  switch (type) {
    case 'stl': return 'text-blue-400 bg-blue-400/10'
    case '3mf': return 'text-bambu-400 bg-bambu-400/10'
    case 'gcode': return 'text-orange-400 bg-orange-400/10'
    default: return 'text-gray-400 bg-gray-400/10'
  }
}

export function getFileTypeLabel(type) {
  return type?.toUpperCase() || 'FILE'
}

export function filterFiles(files, query) {
  if (!query.trim()) return files
  const q = query.toLowerCase()
  return files.filter(f =>
    f.name.toLowerCase().includes(q) ||
    f.type.toLowerCase().includes(q) ||
    f.path.toLowerCase().includes(q)
  )
}

export function sortFiles(files, sortBy) {
  const arr = [...files]
  switch (sortBy) {
    case 'name':
      return arr.sort((a, b) => a.name.localeCompare(b.name))
    case 'date':
      return arr.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
    case 'size':
      return arr.sort((a, b) => b.size - a.size)
    case 'favorites':
      return arr.sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || a.name.localeCompare(b.name))
    default:
      return arr
  }
}
