// server/src/services/settings/settingsService.ts
import prisma from '../../config/database'

class SettingsService {
  private cache: Map<string, { value: string; cachedAt: number }> = new Map()
  private CACHE_TTL_MS = 60_000 // 1 minute cache

  async get(key: string): Promise<string | null> {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.value
    }

    const setting = await prisma.settings.findUnique({ where: { key } })
    if (setting) {
      this.cache.set(key, { value: setting.value, cachedAt: Date.now() })
      return setting.value
    }
    return null
  }

  async isRozetkaStoreActive(): Promise<boolean> {
    const value = await this.get('rozetka_store_active')
    return value !== 'false' // Default to true if not set
  }

  async setRozetkaStoreActive(active: boolean): Promise<void> {
    await prisma.settings.upsert({
      where: { key: 'rozetka_store_active' },
      update: { value: String(active) },
      create: { key: 'rozetka_store_active', value: String(active) },
    })
    this.cache.delete('rozetka_store_active') // Invalidate cache
    console.log(
      `🏪 Rozetka store status set to: ${active ? 'ACTIVE' : 'INACTIVE'}`,
    )
  }
}

export const settingsService = new SettingsService()
