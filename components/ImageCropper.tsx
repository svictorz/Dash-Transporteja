'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Check, ZoomIn, ZoomOut, RotateCw } from 'lucide-react'

interface ImageCropperProps {
  image: string
  onCrop: (croppedImage: string) => void
  onCancel: () => void
  aspectRatio?: number
  maxSize?: number // Tamanho máximo em MB
}

export default function ImageCropper({
  image,
  onCrop,
  onCancel,
  aspectRatio = 1,
  maxSize = 2
}: ImageCropperProps) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, size: 200 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height })
      setImageLoaded(true)
    }
    img.src = image
  }, [image])

  useEffect(() => {
    if (imageLoaded && containerRef.current) {
      const containerSize = Math.min(containerRef.current.offsetWidth, containerRef.current.offsetHeight)
      const initialCropSize = containerSize * 0.8
      setCropArea({
        x: (containerSize - initialCropSize) / 2,
        y: (containerSize - initialCropSize) / 2,
        size: initialCropSize
      })
    }
  }, [imageLoaded])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Verificar se está dentro da área de crop
    if (
      x >= cropArea.x &&
      x <= cropArea.x + cropArea.size &&
      y >= cropArea.y &&
      y <= cropArea.y + cropArea.size
    ) {
      setIsDragging(true)
      setDragStart({
        x: x - cropArea.x,
        y: y - cropArea.y
      })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const newX = e.clientX - rect.left - dragStart.x
    const newY = e.clientY - rect.top - dragStart.y
    
    const containerSize = Math.min(rect.width, rect.height)
    const maxX = containerSize - cropArea.size
    const maxY = containerSize - cropArea.size
    
    setCropArea({
      ...cropArea,
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleCrop = useCallback(() => {
    if (!imageRef.current || !imageLoaded) return

    const img = imageRef.current
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) return

    // Tamanho final da imagem (quadrado 400x400)
    const size = 400
    canvas.width = size
    canvas.height = size

    // Calcular dimensões do crop em relação à imagem original
    const containerSize = containerRef.current?.offsetWidth || 500
    const scale = img.naturalWidth / containerSize
    const cropX = (cropArea.x * scale) / zoom
    const cropY = (cropArea.y * scale) / zoom
    const cropSize = (cropArea.size * scale) / zoom

    // Criar canvas temporário para rotação
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return

    tempCanvas.width = img.naturalWidth
    tempCanvas.height = img.naturalHeight

    // Aplicar rotação
    if (rotation !== 0) {
      tempCtx.save()
      tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2)
      tempCtx.rotate((rotation * Math.PI) / 180)
      tempCtx.translate(-tempCanvas.width / 2, -tempCanvas.height / 2)
    }
    tempCtx.drawImage(img, 0, 0)
    if (rotation !== 0) {
      tempCtx.restore()
    }

    // Desenhar imagem recortada no canvas final
    ctx.drawImage(
      tempCanvas,
      cropX,
      cropY,
      cropSize,
      cropSize,
      0,
      0,
      size,
      size
    )

    // Converter para blob e verificar tamanho
    canvas.toBlob((blob) => {
      if (!blob) return
      
      const sizeInMB = blob.size / (1024 * 1024)
      if (sizeInMB > maxSize) {
        alert(`A imagem é muito grande (${sizeInMB.toFixed(2)}MB). O tamanho máximo é ${maxSize}MB.`)
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        onCrop(reader.result as string)
      }
      reader.readAsDataURL(blob)
    }, 'image/jpeg', 0.9)
  }, [cropArea, zoom, rotation, maxSize, onCrop, imageLoaded])

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Recortar Imagem</h3>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Área de Recorte */}
        <div className="flex-1 p-4 overflow-auto">
          <div
            ref={containerRef}
            className="relative bg-gray-100 rounded-lg overflow-hidden mx-auto cursor-move"
            style={{ width: '100%', maxWidth: '500px', aspectRatio: '1/1' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              ref={imageRef}
              src={image}
              alt="Preview"
              className="w-full h-full object-contain"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center'
              }}
            />
            
            {/* Overlay escuro */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Top */}
              <div
                className="absolute bg-black/50"
                style={{
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: `${cropArea.y}px`
                }}
              />
              {/* Bottom */}
              <div
                className="absolute bg-black/50"
                style={{
                  left: 0,
                  top: `${cropArea.y + cropArea.size}px`,
                  width: '100%',
                  height: `calc(100% - ${cropArea.y + cropArea.size}px)`
                }}
              />
              {/* Left */}
              <div
                className="absolute bg-black/50"
                style={{
                  left: 0,
                  top: `${cropArea.y}px`,
                  width: `${cropArea.x}px`,
                  height: `${cropArea.size}px`
                }}
              />
              {/* Right */}
              <div
                className="absolute bg-black/50"
                style={{
                  left: `${cropArea.x + cropArea.size}px`,
                  top: `${cropArea.y}px`,
                  width: `calc(100% - ${cropArea.x + cropArea.size}px)`,
                  height: `${cropArea.size}px`
                }}
              />
            </div>
            
            {/* Área de Recorte */}
            <div
              className="absolute border-2 border-blue-500 cursor-move rounded-lg"
              style={{
                left: `${cropArea.x}px`,
                top: `${cropArea.y}px`,
                width: `${cropArea.size}px`,
                height: `${cropArea.size}px`
              }}
            />
          </div>
        </div>

        {/* Controles */}
        <div className="p-4 border-t border-gray-200 space-y-4">
          {/* Zoom */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Zoom
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1"
              />
              <button
                onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600 w-12 text-right">
                {Math.round(zoom * 100)}%
              </span>
            </div>
          </div>

          {/* Rotação */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rotação
            </label>
            <button
              onClick={() => setRotation((rotation + 90) % 360)}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCrop}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              Confirmar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

