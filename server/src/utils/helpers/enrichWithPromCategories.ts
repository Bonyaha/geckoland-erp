import * as fs from 'fs/promises'

/**
 * Reads promProducts.json and enriches each product’s categoryData
 * with Prom category info (id + name) and description based on SKU matching.
 *
 * @param products - Array of products to be enriched
 * @returns Enriched array of products
 */
export async function enrichWithPromCategoriesAndDescription(products: any[]) {
  const promProductsData = await fs.readFile(
    'prisma/data/promProducts.json',
    'utf-8'
  )
  const promProducts = JSON.parse(promProductsData)

  // Map Prom products by SKU for quick lookup
 const promProductDetailsMap = new Map<string, any>()

  promProducts.forEach((p: any) => {
    const promId = p.productId

    const category = {
      id: p.categoryData?.group?.id || null,
      // Use fallback to 'name' if 'uk' name isn't present
      name:
        p.categoryData?.group?.name_multilang?.uk ||
        p.categoryData?.group?.name ||
        null,
    }

    const description = p.description || null

    promProductDetailsMap.set(promId, { category, description })
  }) 

  let updatedCount = 0
  let notFoundCount = 0

  const enrichedProducts = products.map((product) => {
    // Get the unique prom ID that was assigned in the previous step
    const promId = product.externalIds?.prom

    // If this product doesn't have a promId, we can't look it up.
    if (!promId) {
      notFoundCount++
      return product
    }

    // Find the details using the unique promId
    const details = promProductDetailsMap.get(promId)

    // Check if we found details AND the category data is valid
    if (details && details.category && details.category.id && details.category.name) {
      updatedCount++
      return {
        ...product,
        // Use the specific description for this promId
        description: details.description || product.description,
        // Merge with existing categoryData (to keep CSV or Rozetka data)
        categoryData: {
          prom: { // Add the new prom-specific data
            id: details.category.id,
            name: details.category.name,
          },
        },
      }
    } else {
      // Had a promId, but no matching category was found in the JSON
      notFoundCount++
      return product
    }
  })

  console.log(`✅ Prom categories/descriptions enriched: ${updatedCount}`)
  console.log(`⚠️ Prom categories/descriptions missing: ${notFoundCount}`)

  return enrichedProducts
}
