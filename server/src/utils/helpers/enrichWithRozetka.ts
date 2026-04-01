// server/src/utils/helpers/enrichWithRozetka.ts
import { fetchRozetkaProductsWithTransformation } from '../../services/data-fetchers/fetchRozetkaProducts'
import { EnrichedProductData } from '../../types/products'

export async function enrichWithRozetka(
  products: EnrichedProductData[]
): Promise<EnrichedProductData[]> {
  const rozetkaProducts = await fetchRozetkaProductsWithTransformation()

  interface RozetkaMatchData {
    rz_item_id: string
    item_id: string
    quantity: number
    categoryId: number | null
    categoryName: string | null
  }

  const rozetkaMap = new Map<string, RozetkaMatchData>()

  rozetkaProducts.forEach((p) => {
    if (!p.sku) return
    rozetkaMap.set(p.sku, {
      rz_item_id: p.productId,
      item_id: p.externalIds.rozetka,
      quantity: p.stockQuantity,
      categoryId: p.categoryData?.id ?? null,
      categoryName: p.categoryData?.title ?? null,
    })
  })

  let matchedCount = 0
  let unmatchedCount = 0

  const enrichedProducts = products.map((product) => {
    if (!product.sku) {
      unmatchedCount++
      return product
    }

    const match = rozetkaMap.get(product.sku)

    if (!match) {
      unmatchedCount++
      return product
    }

    matchedCount++
    return {
      ...product,
      externalIds: {
        ...product.externalIds,
        rozetka: {
          rz_item_id: match.rz_item_id,
          item_id: match.item_id,
        },
      },
      rozetkaQuantity: match.quantity,
      categoryData:
        match.categoryId && match.categoryName
          ? {
              ...product.categoryData,
              rozetka: {
                id: match.categoryId,
                name: match.categoryName,
              },
            }
          : product.categoryData,
    }
  })

  console.log(`✅ Rozetka enrichment matched: ${matchedCount}`)
  console.log(`⚠️  Rozetka enrichment unmatched: ${unmatchedCount}`)

  return enrichedProducts
}