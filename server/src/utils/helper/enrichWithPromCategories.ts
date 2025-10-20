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
  const promMapCategory = new Map()
  const promMapDescription = new Map()
  promProducts.forEach((p: any) => {
    promMapCategory.set(p.sku, {
      id: p.categoryData?.group?.id || null,
      name: p.categoryData?.group?.name_multilang?.uk || null      
    })
    promMapDescription.set(p.sku, {
      description: p.multilangData?.description_uk || null,
    })
  })

  let updatedCount = 0
  let notFoundCount = 0

  const enrichedProducts = products.map((product) => {
    const category = promMapCategory.get(product.sku)
    const descriptionData = promMapDescription.get(product.sku)

    if (category && category.id && category.name) {
      updatedCount++
      return {
        ...product,
        description: descriptionData?.description || product.description,
        categoryData: {
          prom: {
            id: category.id,
            name: category.name,
          }
        }
      }
    } else {
      notFoundCount++
      return product
    }
  })

  console.log(`✅ Prom categories enriched: ${updatedCount}`)
  console.log(`⚠️ Prom categories missing: ${notFoundCount}`)

  return enrichedProducts
}
