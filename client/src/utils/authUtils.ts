// client/src/utils/authUtils.ts

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

const isClient = typeof window !== 'undefined'

/**
 * Store authentication token in localStorage
 */
export const setAuthToken = (token: string): void => {
  //CHANGE - Add client-side check
  if (!isClient) return
  localStorage.setItem(TOKEN_KEY, token)
}

/**
 * Get authentication token from localStorage
 */
export const getAuthToken = (): string | null => {
  //CHANGE - Add client-side check
  if (!isClient) return null
  return localStorage.getItem(TOKEN_KEY)
}

/**
 * Remove authentication token from localStorage
 */
export const removeAuthToken = (): void => {
  //CHANGE - Add client-side check
  if (!isClient) return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

/**
 * Store user data in localStorage
 */
export const setUserData = (user: any): void => {
  //CHANGE - Add client-side check
  if (!isClient) return
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

/**
 * Get user data from localStorage
 */
export const getUserData = (): any | null => {
  //CHANGE - Add client-side check
  if (!isClient) return null
  const userData = localStorage.getItem(USER_KEY)
  return userData ? JSON.parse(userData) : null
}

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  //CHANGE - Add client-side check
  if (!isClient) return false
  const token = getAuthToken()
  return token !== null
}
