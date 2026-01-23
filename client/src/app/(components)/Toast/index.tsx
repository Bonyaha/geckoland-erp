// client/src/app/(components)/Toast/index.tsx
'use client'

import React, { useEffect } from 'react'
import { CheckCircle, AlertCircle, Info, X, XCircle } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastProps {
  message: string
  type?: ToastType
  isVisible: boolean
  onClose: () => void
  duration?: number
  position?: 'top' | 'bottom'
}

const Toast = ({
  message,
  type = 'success',
  isVisible,
  onClose,
  duration = 3000,
  position = 'top',
}: ToastProps) => {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [isVisible, duration, onClose])

  if (!isVisible) return null

  const typeConfig = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-gray-900',
      iconColor: 'text-green-400',
    },
    error: {
      icon: XCircle,
      bgColor: 'bg-gray-900',
      iconColor: 'text-red-400',
    },
    warning: {
      icon: AlertCircle,
      bgColor: 'bg-gray-900',
      iconColor: 'text-yellow-400',
    },
    info: {
      icon: Info,
      bgColor: 'bg-gray-900',
      iconColor: 'text-blue-400',
    },
  }

  const config = typeConfig[type]
  const Icon = config.icon

  const positionClasses =
    position === 'top'
      ? 'top-4 left-1/2 -translate-x-1/2'
      : 'bottom-10 left-1/2 -translate-x-1/2'

  return (
    <div
      className={`fixed ${positionClasses} z-[100] animate-in fade-in slide-in-from-${position}-4 duration-300`}
    >
      <div
        className={`${config.bgColor} text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 min-w-[300px] max-w-[500px]`}
      >
        <div className={`${config.iconColor} rounded-full p-1`}>
          <Icon className='w-5 h-5' />
        </div>
        <span className='text-sm font-medium flex-1'>{message}</span>
        <button
          onClick={onClose}
          className='text-gray-400 hover:text-white transition-colors ml-2'
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}

export default Toast
