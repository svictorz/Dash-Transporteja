'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import Image from 'next/image'
import { Truck } from 'lucide-react'

interface LogoProps {
  className?: string
  size?: number
}

export default function Logo({ className = '', size = 20 }: LogoProps) {
  const [imageError, setImageError] = useState(false)

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
      <Image
        src="/logo-icon.png"
        alt="Transporte Já"
        width={size}
        height={size}
        sizes={`${size}px`}
        className="object-contain"
        priority
        onError={() => setImageError(true)}
      />
    </motion.div>
  )
}

