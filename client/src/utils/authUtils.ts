// client/src/utils/authUtils.ts

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

const isClient = typeof window !== 'undefined'

/**
 * Store authentication token in localStorage
 */
export const setAuthToken = (token: string): void => {
  if (!isClient) return
  localStorage.setItem(TOKEN_KEY, token)
}

/**
 * Get authentication token from localStorage
 */
export const getAuthToken = (): string | null => {
  if (!isClient) return null
  return localStorage.getItem(TOKEN_KEY)
}

/**
 * Remove authentication token from localStorage
 */
export const removeAuthToken = (): void => {
  if (!isClient) return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

/**
 * Store user data in localStorage
 */
export const setUserData = (user: any): void => {
  if (!isClient) return
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

/**
 * Get user data from localStorage
 */
export const getUserData = (): any | null => {
  if (!isClient) return null
  const userData = localStorage.getItem(USER_KEY)
  return userData ? JSON.parse(userData) : null
}

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  if (!isClient) return false
  const token = getAuthToken()
  return token !== null
}

/**
 * Check if a JWT token is expired by reading its payload 
 */
export const isTokenExpired = (token: string): boolean => { 
  try { 
    const payload = JSON.parse(atob(token.split('.')[1])) 
    return payload.exp * 1000 < Date.now() // exp is in seconds 
  } catch { 
    return true // treat malformed tokens as expired 
  } 
} 

/**
 * Get token only if it exists and is not expired 
 */
export const getValidToken = (): string | null => { 
  const token = getAuthToken() 
  if (!token) return null 
  if (isTokenExpired(token)) { 
    removeAuthToken() 
    return null 
  } 
  return token 
} 