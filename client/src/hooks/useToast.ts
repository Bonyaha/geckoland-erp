// client/src/hooks/useToast.ts
'use client'

import { useState, useCallback } from 'react'
import { ToastType } from '@/app/(components)/Toast'

interface ToastState {
  message: string
  type: ToastType
  isVisible: boolean
}

export const useToast = () => {
  const [toast, setToast] = useState<ToastState>({
    message: '',
    type: 'success',
    isVisible: false,
  })

  const showToast = useCallback(
    (message: string, type: ToastType = 'success') => {
      setToast({
        message,
        type,
        isVisible: true,
      })
    },
    [],
  )

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, isVisible: false }))
  }, [])

  return {
    toast,
    showToast,
    hideToast,
  }
}
