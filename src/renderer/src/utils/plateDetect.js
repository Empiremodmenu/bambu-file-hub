import JSZip from 'jszip'

// Read a 3MF file and return { plateCount, plateThumbnails: string[] }
export async function detect3mfPlates(filePath) {
  try {
    const bufArray = await window.electronAPI.readFileBuffer(filePath)
    if (!bufArray) return { plateCount: 1, plateThumbnails: [] }

    const zip = await JSZip.loadAsync(new Uint8Array(bufArray))
    const thumbnails = []
    let plate = 1

    while (true) {
      const pngFile = zip.file(`Metadata/plate_${plate}.png`)
        || zip.file(`Metadata/plate_${plate}.jpg`)

      if (!pngFile) break

      const ext  = pngFile.name.endsWith('.jpg') ? 'jpeg' : 'png'
      const b64  = await pngFile.async('base64')
      thumbnails.push(`data:image/${ext};base64,${b64}`)
      plate++
    }

    // If no plate thumbnails found, assume 1 plate
    return { plateCount: Math.max(1, thumbnails.length), plateThumbnails: thumbnails }
  } catch {
    return { plateCount: 1, plateThumbnails: [] }
  }
}
