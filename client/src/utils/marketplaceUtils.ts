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

/*
 * Canonical list of payment options used for <select> dropdowns.
 * Import this wherever you render a payment method picker.
 */
export const PAYMENT_OPTIONS = [
  { value: '', label: 'Оберіть спосіб' },
  { value: 'CashOnDelivery', label: 'Післяплата' },
  { value: 'IBAN', label: 'IBAN' },
  { value: 'PromPayment', label: 'Пром оплата' },
  { value: 'RozetkaPay', label: 'Rozetka Pay' },
  { value: 'ApplePay', label: 'Apple Pay' },
  { value: 'GooglePay', label: 'Google Pay' },
]

/*
 * Maps a payment option enum value to its Ukrainian display label.
 * Falls back to the raw value if no match is found.
 */
export const getPaymentOptionLabel = (name?: string | null): string => {
  if (!name) return '—'
  const option = PAYMENT_OPTIONS.find((o) => o.value === name)
  return option ? option.label : name
}