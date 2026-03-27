'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import { Truck } from 'lucide-react'

interface LogoProps {
  className?: string
  size?: number
}

export default function Logo({ className = "", size = 20 }: LogoProps) {
  const [imageError, setImageError] = useState(false)

  // Se a imagem não carregar, mostra um fallback
  if (imageError) {
    return (
      <Truck className="text-white" style={{ width: size, height: size }} />
    )
  }

  return (
    <motion.div
      whileHover={{ scale: 1.1 }}
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-icon.png"
        alt="Transporte Já"
        width={size}
        height={size}
        className="object-contain"
        style={{ 
          width: `${size}px`, 
          height: `${size}px`,
          maxWidth: '100%', 
          maxHeight: '100%' 
        }}
        onError={() => {
          console.warn('Logo image not found at /logo-icon.png - using fallback icon')
          setImageError(true)
        }}
        onLoad={() => {
          console.log('Logo image loaded successfully')
        }}
      />
    </motion.div>
  )
}

