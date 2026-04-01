/**
Utility function to normalize quantity
* This ensures that null or undefined quantities are treated as *0
* It prevents issues when a product has null or undefined stock
* quantities, which could lead to incorrect updates or comparisons
* @param quantity - The quantity to normalize (can be number, string, null, or undefined)
 * @returns A valid non-negative number
 * 
 * @example 
 * normalizeQuantity(5)          // Returns: 5
 * normalizeQuantity("10")       // Returns: 10
 * normalizeQuantity(null)       // Returns: 0
 * normalizeQuantity(undefined)  // Returns: 0
 * normalizeQuantity(-5)         // Returns: 0
 * normalizeQuantity("abc")      // Returns: 0
 */

export const normalizeQuantity = (
  quantity: number | string | null | undefined
): number => {
  if (typeof quantity === 'string') {
    const parsed = parseInt(quantity, 10)
    return isNaN(parsed) || parsed < 0 ? 0 : parsed
  }
  if (typeof quantity === 'number') {
    return quantity < 0 ? 0 : quantity
  }
  return 0
}
