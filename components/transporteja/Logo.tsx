'use client'

import { motion } from 'framer-motion'
import { Truck } from 'lucide-react'

interface LogoProps {
  className?: string
  size?: number
}

export default function Logo({ className = '', size = 20 }: LogoProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.1 }}
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <Truck className="text-white" style={{ width: size, height: size }} aria-hidden />
    </motion.div>
  )
}
