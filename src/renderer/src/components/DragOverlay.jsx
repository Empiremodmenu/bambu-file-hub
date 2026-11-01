import React from 'react'
import { Upload } from 'lucide-react'

export default function DragOverlay() {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
      <div className="absolute inset-4 rounded-3xl border-2 border-dashed border-bambu-500 bg-bambu-500/5 flex flex-col items-center justify-center gap-4 animate-fade-in">
        <div className="w-20 h-20 rounded-3xl bg-bambu-500/20 flex items-center justify-center">
          <Upload size={36} className="text-bambu-400" />
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-white">Drop files here</p>
          <p className="text-gray-400 mt-1">Supports STL, 3MF, and GCODE files</p>
        </div>
      </div>
    </div>
  )
}
