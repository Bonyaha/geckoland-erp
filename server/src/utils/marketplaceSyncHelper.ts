// server/src/utils/marketplaceSyncHelper.ts

type MarketplaceSyncStatus = {
  promSynced: boolean
  rozetkaSynced: boolean
}

interface MarketplaceUpdateOptions {
  marketplaceName: 'Prom' | 'Rozetka'
  productId?: string
  count?: number
  updateFunction: () => Promise<any>
  onSuccess?: () => void
  resultsArray: string[]
  errorsArray: Array<{ marketplace: string; error: string }>
  isBatch?: boolean
}

/**
 * Unified helper for both single and batch marketplace updates.
 */
export async function createMarketplaceUpdatePromise({
  marketplaceName,
  productId,
  count,
  updateFunction,
  onSuccess,
  resultsArray,
  errorsArray,
  isBatch = false,
}: MarketplaceUpdateOptions) {
  try {
    await updateFunction()
    resultsArray.push(marketplaceName)

    const message = isBatch
      ? `✅ Batch updated ${count} ${marketplaceName} products`
      : `✅ ${marketplaceName} product ${productId} updated successfully`
    console.log(message)

    if (onSuccess) onSuccess()
  } catch (error: any) {
    errorsArray.push({
      marketplace: marketplaceName,
      error: error.message || String(error),
    })

    const message = isBatch
      ? `❌ Failed to batch update ${marketplaceName} products`
      : `❌ Failed to update ${marketplaceName} product ${productId}`
    console.error(message, error)
  }
}

export function createMarketplaceSyncStatus(): MarketplaceSyncStatus {
  return { promSynced: false, rozetkaSynced: false }
}
