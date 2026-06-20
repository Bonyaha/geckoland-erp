// server/src/utils/gmailHistoryStore.ts
import { promises as fs } from 'fs'
import { config } from '../config/environment'

const HISTORY_PATH = config.paths.historyFile

/**
 * Load the last known Gmail history ID from persistent storage.
 * Returns null if nothing has been saved yet (or file is missing/corrupted).
 */
export async function loadLastHistoryId(): Promise<string | null> {
  try {
    const content = await fs.readFile(HISTORY_PATH)
    const raw = content.toString().trim()
    if (!raw) return null

    const data = JSON.parse(raw)
    return data.historyId ?? null
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as any).code === 'ENOENT'
    ) {
      return null
    }
    if (error instanceof SyntaxError) {
      console.warn('gmail-history.json is corrupted, starting fresh')
      return null
    }
    throw error
  }
}

/**
 * Save the latest Gmail history ID to persistent storage.
 * Called after processing notifications AND whenever the Gmail watch
 * is (re)started, so the cursor stays as fresh as possible.
 */
export async function saveLastHistoryId(historyId: string): Promise<void> {
  await fs.writeFile(HISTORY_PATH, JSON.stringify({ historyId }))
}
