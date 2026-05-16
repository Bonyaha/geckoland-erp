// client/src/hooks/useTokenExpiry.ts
'use client'

import { useEffect, useRef } from 'react'
import {
  getAuthToken,
  getValidToken,
  removeAuthToken,
} from '@/utils/authUtils'

/**
 * Calculates ms remaining until the JWT expires.
 * Returns null if no token or token is already expired.
 */
function getMsUntilExpiry(): number | null {
  const token = getAuthToken()
  if (!token) return null

  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const msRemaining = payload.exp * 1000 - Date.now()
    return msRemaining > 0 ? msRemaining : null
  } catch {
    return null
  }
}

/**
 * Sets a countdown timer that fires exactly when the JWT expires,
 * then redirects to /login. Also checks on tab focus/visibility restore.
 */
export function useTokenExpiry(onExpired: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const scheduleExpiry = () => {
    clearTimer()

    const msRemaining = getMsUntilExpiry()

    if (msRemaining === null) {
      // Token already gone or expired — act immediately
      const token = getAuthToken()
      if (token) {
        removeAuthToken()
        onExpired()
      }
      return
    }

    console.log(`⏱️ Token expires in ${Math.round(msRemaining / 1000)}s`)

    timerRef.current = setTimeout(() => {
      console.log('⌛ Token expired — redirecting to login')
      removeAuthToken()
      onExpired()
    }, msRemaining)
  }

  // Method 3 (bonus): also re-check when the user returns to the tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const token = getValidToken() // checks expiry internally
        if (!token) {
          clearTimer()
          removeAuthToken()
          onExpired()
        }
      }
    }

    const handleFocus = () => {
      const token = getValidToken()
      if (!token) {
        clearTimer()
        removeAuthToken()
        onExpired()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [onExpired])

  return { scheduleExpiry, clearTimer }
}
