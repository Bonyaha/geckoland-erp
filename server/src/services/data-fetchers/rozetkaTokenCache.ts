import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { config } from '../../config/environment'

interface TokenCache {
  token: string | null
  expiresAt: Date | null
}

class RozetkaTokenManager {
  private tokenCache: TokenCache = {
    token: null,
    expiresAt: null,
  }

  private readonly cacheFilePath = path.join(
    __dirname,
    '.rozetka-token-cache.json'
  )

  constructor() {
    this.loadCacheFromFile()
  }

  private loadCacheFromFile(): void {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const cacheData = JSON.parse(
          fs.readFileSync(this.cacheFilePath, 'utf8')
        )
        this.tokenCache = {
          token: cacheData.token,
          expiresAt: cacheData.expiresAt ? new Date(cacheData.expiresAt) : null,
        }
        console.log('📁 Loaded Rozetka token cache from file')
      }
    } catch (error) {
      console.warn('⚠️ Failed to load token cache from file:', error)
      this.tokenCache = { token: null, expiresAt: null }
    }
  }

  private saveCacheToFile(): void {
    try {
      fs.writeFileSync(
        this.cacheFilePath,
        JSON.stringify({
          token: this.tokenCache.token,
          expiresAt: this.tokenCache.expiresAt?.toISOString(),
        }),
        'utf8'
      )
      console.log('💾 Saved Rozetka token cache to file')
    } catch (error) {
      console.warn('⚠️ Failed to save token cache to file:', error)
    }
  }

  private async fetchNewToken(): Promise<string> {
    const tokenUrl = 'https://api-seller.rozetka.com.ua/sites'
    const credentials = config.marketplaces.rozetka

    console.log('🔑 Fetching new Rozetka access token...')

    try {
      const response = await axios.post(tokenUrl, credentials, {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const {
        content: { access_token },
      } = response.data

      console.log('✅ New Rozetka access token fetched successfully')
      return access_token
    } catch (error: any) {
      console.error(
        '❌ Error fetching Rozetka access token:',
        error.response?.data || error.message
      )
      throw new Error(`Failed to get access token: ${error.message}`)
    }
  }

  async getValidToken(): Promise<string> {
    // Check if we have a valid cached token using the helper method
    if (this.hasCachedToken()) {
      console.log('✅ Using cached Rozetka access token')
      return this.tokenCache.token!
    }

    // Fetch new token if cache is empty or expired
    const newToken = await this.fetchNewToken()

    // Cache the token with 23 hour expiry (1 hour buffer before 24h limit)
    const now = new Date()
    this.tokenCache = {
      token: newToken,
      expiresAt: new Date(now.getTime() + 23 * 60 * 60 * 1000), // 23 hours from now
    }

    this.saveCacheToFile()
    return newToken
  }

  // Method to clear cache if token becomes invalid
  clearCache(): void {
    console.log('🔄 Clearing Rozetka token cache')
    this.tokenCache = {
      token: null,
      expiresAt: null,
    }
    // Also clear the file cache
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        fs.unlinkSync(this.cacheFilePath)
        console.log('🗑️ Deleted token cache file')
      }
    } catch (error) {
      console.warn('⚠️ Failed to delete cache file:', error)
    }
  }

  // Method to check if we have a cached token
  hasCachedToken(): boolean {
    const now = new Date()
    return !!(
      this.tokenCache.token &&
      this.tokenCache.expiresAt &&
      now < this.tokenCache.expiresAt
    )
  }
}

// Create a singleton instance
export const rozetkaTokenManager = new RozetkaTokenManager()
