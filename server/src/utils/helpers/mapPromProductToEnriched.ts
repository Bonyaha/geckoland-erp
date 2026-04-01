// server/src/utils/helpers/mapPromProductToEnriched.ts
import type { PromProductData, EnrichedProductData } from '../../types/products'

/**
 * Maps a PromProductData object (returned by fetchPromProductsWithTransformation)
 * to the EnrichedProductData shape expected by enrichAndInsertProducts().
 *
 * Key decisions:
 * - externalIds.prom is set from the known Prom ID.
 * - externalIds.rozetka is intentionally omitted so enrichWithRozetkaIds()
 *   can fill it in by SKU matching during the enrichment pipeline.
 * - All extra Prom-specific fields (lastPromSync, needsSync, etc.) are
 *   preserved via the index signature on EnrichedProductData, so nothing is
 *   lost after the enrichment spread.
 *
 * @param p - A single Prom product as returned by fetchPromProductsWithTransformation
 * @returns An EnrichedProductData object ready to be passed to enrichAndInsertProducts
 */
export function mapPromProductToEnriched(
  p: PromProductData,
): EnrichedProductData {
  return {
    productId: p.productId,
    sku: p.sku ?? null,
    name: p.name,
    price: p.price,
    stockQuantity: p.stockQuantity,
    available: p.available,
    externalIds: {
      prom: p.externalIds.prom,
      // rozetka is intentionally absent — enrichWithRozetkaIds() fills it in
    },
    description: p.description ?? null,
    mainImage: p.mainImage ?? null,
    images: p.images,
    currency: p.currency,
    measureUnit: p.measureUnit ?? null,
    categoryData: p.categoryData?.group?.id
      ? {
          prom: {
            id: p.categoryData.group.id,
            name:
              p.categoryData.group.name_multilang?.uk ??
              p.categoryData.group.name ??
              '',
          },
        }
      : undefined,    
    // Preserve all Prom-specific sync fields via the index signature
    priceOld: p.priceOld ?? null,
    pricePromo: p.pricePromo ?? null,
    updatedPrice: p.updatedPrice ?? null,
    dateModified: p.dateModified ?? null,
    lastSynced: p.lastSynced,
    lastPromSync: p.lastPromSync,
    needsSync: p.needsSync,
    needsPromSync: p.needsPromSync,
    needsRozetkaSync: p.needsRozetkaSync,
  }
}
