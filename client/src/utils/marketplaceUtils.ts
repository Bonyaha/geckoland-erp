// client/src/utils/marketplaceUtils.ts

/**
 * Constructs the edit URL for a product in Prom marketplace
 * @param promId - The Prom product ID
 * @returns Full URL to edit the product in Prom
 *
 * @example
 * getPromEditUrl('2854074799')
 * // Returns: 'https://my.prom.ua/cms/product/edit/2854074799'
 */
export function getPromEditUrl(promId: string): string {
  return `https://my.prom.ua/cms/product/edit/${promId}`
}

/**
 * Constructs the product page URL for Rozetka marketplace
 * @param rozetkaId - The Rozetka rz_item_id
 * @returns Full URL to the product page in Rozetka
 *
 * @example
 * getRozetkaProductUrl('401577765')
 * // Returns: 'https://rozetka.com.ua/401577765/p401577765'
 */
export function getRozetkaProductUrl(rozetkaId: string): string {
  return `https://rozetka.com.ua/${rozetkaId}/p${rozetkaId}`
}

/**
 * Opens a URL in a new browser tab safely
 * @param url - The URL to open
 *
 * @remarks
 * Uses 'noopener,noreferrer' for security
 */
export function openInNewTab(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * Type guard to check if external IDs contain Prom ID
 */
export function hasPromId(externalIds: any): externalIds is { prom: string } {
  return externalIds?.prom && typeof externalIds.prom === 'string'
}

/**
 * Type guard to check if external IDs contain Rozetka ID
 */
export function hasRozetkaId(externalIds: any): externalIds is {
  rozetka: { rz_item_id: string; item_id: string }
} {
  return (
    externalIds?.rozetka?.rz_item_id &&
    typeof externalIds.rozetka.rz_item_id === 'string'
  )
}

/**
 * Safely parses externalIds JSON string or object
 * @param externalIds - Either a JSON string or object
 * @returns Parsed external IDs object or null
 */
export function parseExternalIds(
  externalIds: string | Record<string, any> | undefined,
): Record<string, any> | null {
  if (!externalIds) return null

  if (typeof externalIds === 'string') {
    try {
      return JSON.parse(externalIds)
    } catch {
      return null
    }
  }

  return externalIds
}

/*
 * Maps internal payment status codes to user-friendly labels in Ukrainian. This is used to display the payment status in the UI based on the API response.
 */

export const getPaymentStatusLabel = (status?: string) => {
  const statusMap: Record<string, string> = {
    PAID: 'Оплачено',
    UNPAID: 'Не оплачено',
    PART_PAID: 'Частково оплачено',
    CANCELLED: 'Скасовано',
  }
  return status ? statusMap[status] || status : '—'
}
