export const parseExternalIds = (
  externalIds: string | Record<string, any> | undefined
): Record<string, any> | null => {
  if (!externalIds) return null

  if (typeof externalIds === 'object') return externalIds

  if (typeof externalIds === 'string') {
    try {
      return JSON.parse(externalIds)
    } catch {
      return null
    }
  }

  return null
}
