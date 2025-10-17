import * as fs from 'fs/promises'

/**
 * Reads promProducts.json and enriches each product’s categoryData
 * with Prom category info (id + name).
 */
export async function enrichWithPromCategories(products: any[]) {
  const promProductsData = await fs.readFile(
    'prisma/data/promProducts.json',
    'utf-8'
  )
  const promProducts = JSON.parse(promProductsData)

  // Map Prom products by SKU for quick lookup
  const promMap = new Map()
  promProducts.forEach((p: any) => {
    promMap.set(p.sku, {
      id: p.categoryData?.group?.id || null,
      name: p.categoryData?.group?.name_multilang?.uk || null,
    })
  })

  let updatedCount = 0
  let notFoundCount = 0

  const enrichedProducts = products.map((product) => {
    const category = promMap.get(product.sku)

    if (category && category.id && category.name) {
      updatedCount++
      return {
        ...product,
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
