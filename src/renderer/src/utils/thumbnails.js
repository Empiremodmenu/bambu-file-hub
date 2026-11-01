import * as THREE from 'three'
import JSZip from 'jszip'

// Generate a thumbnail for an STL file using Three.js offscreen rendering
export async function generateStlThumbnail(filePath) {
  try {
    const bufferArray = await window.electronAPI.readFileBuffer(filePath)
    if (!bufferArray) return null

    const buffer = new Uint8Array(bufferArray).buffer

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })
    renderer.setSize(280, 280)
    renderer.setPixelRatio(1)
    renderer.setClearColor(0x1a1a1a, 1)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000)

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)
    const dir1 = new THREE.DirectionalLight(0xffffff, 0.8)
    dir1.position.set(1, 2, 3)
    scene.add(dir1)
    const dir2 = new THREE.DirectionalLight(0x00d4a0, 0.3)
    dir2.position.set(-2, -1, -1)
    scene.add(dir2)

    // Parse STL
    const geometry = parseStl(buffer)
    geometry.computeBoundingBox()
    geometry.computeVertexNormals()

    const bbox = geometry.boundingBox
    const center = new THREE.Vector3()
    bbox.getCenter(center)
    const size = new THREE.Vector3()
    bbox.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)

    geometry.translate(-center.x, -center.y, -center.z)

    const material = new THREE.MeshPhongMaterial({
      color: 0x00d4a0,
      specular: 0x224444,
      shininess: 30,
      side: THREE.DoubleSide,
    })

    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const distance = maxDim * 1.8
    camera.position.set(distance * 0.7, distance * 0.5, distance)
    camera.lookAt(0, 0, 0)

    renderer.render(scene, camera)

    const dataUrl = renderer.domElement.toDataURL('image/jpeg', 0.85)

    // Cleanup
    geometry.dispose()
    material.dispose()
    renderer.dispose()

    return dataUrl
  } catch (err) {
    console.warn('STL thumbnail failed:', err)
    return null
  }
}

// Parse binary or ASCII STL
function parseStl(buffer) {
  const geometry = new THREE.BufferGeometry()

  const isBinary = checkBinary(buffer)
  if (isBinary) {
    return parseBinaryStl(buffer)
  } else {
    return parseAsciiStl(new TextDecoder().decode(buffer))
  }
}

function checkBinary(buffer) {
  const header = new Uint8Array(buffer, 0, 80)
  // ASCII STL starts with "solid"
  const text = String.fromCharCode(...header.slice(0, 5)).toLowerCase()
  if (text !== 'solid') return true

  // Could still be binary — check triangle count
  const view = new DataView(buffer)
  const triangleCount = view.getUint32(80, true)
  const expectedSize = 84 + triangleCount * 50
  return buffer.byteLength === expectedSize
}

function parseBinaryStl(buffer) {
  const geometry = new THREE.BufferGeometry()
  const view = new DataView(buffer)
  const triangleCount = view.getUint32(80, true)
  const positions = new Float32Array(triangleCount * 9)
  const normals = new Float32Array(triangleCount * 9)

  for (let i = 0; i < triangleCount; i++) {
    const offset = 84 + i * 50
    const nx = view.getFloat32(offset, true)
    const ny = view.getFloat32(offset + 4, true)
    const nz = view.getFloat32(offset + 8, true)

    for (let v = 0; v < 3; v++) {
      const vOffset = offset + 12 + v * 12
      positions[i * 9 + v * 3] = view.getFloat32(vOffset, true)
      positions[i * 9 + v * 3 + 1] = view.getFloat32(vOffset + 4, true)
      positions[i * 9 + v * 3 + 2] = view.getFloat32(vOffset + 8, true)
      normals[i * 9 + v * 3] = nx
      normals[i * 9 + v * 3 + 1] = ny
      normals[i * 9 + v * 3 + 2] = nz
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  return geometry
}

function parseAsciiStl(text) {
  const geometry = new THREE.BufferGeometry()
  const positions = []

  const vertexRe = /vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)/g
  let match
  while ((match = vertexRe.exec(text)) !== null) {
    positions.push(parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]))
  }

  const arr = new Float32Array(positions)
  geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  geometry.computeVertexNormals()
  return geometry
}

// Extract thumbnail from 3MF file (they're ZIP archives)
export async function generate3mfThumbnail(filePath) {
  try {
    const bufferArray = await window.electronAPI.readFileBuffer(filePath)
    if (!bufferArray) return null

    const zip = await JSZip.loadAsync(new Uint8Array(bufferArray))

    // Common thumbnail paths inside 3MF
    const thumbPaths = [
      'Metadata/thumbnail.png',
      'Metadata/thumbnail.jpg',
      'thumbnail.png',
      'thumbnail.jpg',
      '3D/thumbnail.png',
    ]

    for (const thumbPath of thumbPaths) {
      const file = zip.file(thumbPath)
      if (file) {
        const data = await file.async('base64')
        const ext = thumbPath.endsWith('.jpg') ? 'jpeg' : 'png'
        return `data:image/${ext};base64,${data}`
      }
    }

    // Try to find any image in Metadata/
    for (const [name, file] of Object.entries(zip.files)) {
      if (!file.dir && /\.(png|jpg|jpeg)$/i.test(name)) {
        const data = await file.async('base64')
        const ext = name.toLowerCase().endsWith('.jpg') ? 'jpeg' : 'png'
        return `data:image/${ext};base64,${data}`
      }
    }

    return null
  } catch (err) {
    console.warn('3MF thumbnail failed:', err)
    return null
  }
}

export async function generateThumbnail(file) {
  if (file.type === 'stl') return generateStlThumbnail(file.path)
  if (file.type === '3mf') return generate3mfThumbnail(file.path)
  return null
}
