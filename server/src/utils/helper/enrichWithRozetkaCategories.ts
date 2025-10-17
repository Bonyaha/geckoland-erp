import * as fs from 'fs/promises'

/**
 * Reads rozetkaProducts.json and enriches each product’s categoryData
 * with Rozetka category info (id + name).
 */
export async function enrichWithRozetkaCategories(products: any[]) {
  const rozetkaData = await fs.readFile(
    'prisma/data/rozetkaProducts.json',
    'utf-8'
  )
  const rozetkaProducts = JSON.parse(rozetkaData)

  // Map Rozetka products by SKU for quick lookup
  const rozetkaMap = new Map()
  rozetkaProducts.forEach((p: any) => {
    rozetkaMap.set(p.sku, {
      id: p.categoryData?.id || null,
      name: p.categoryData?.title || null,
    })
  })

  let updatedCount = 0
  let notFoundCount = 0

  const enrichedProducts = products.map((product) => {
    const category = rozetkaMap.get(product.sku)

    if (category && category.id && category.name) {
      updatedCount++
      return {
        ...product,
        categoryData: {
          ...product.categoryData,
          rozetka: {
            id: category.id,
            name: category.name,
          }
        },
      }
    } else {
      notFoundCount++
      return product
    }
  })

  console.log(`✅ Rozetka categories enriched: ${updatedCount}`)
  console.log(`⚠️ Rozetka categories missing: ${notFoundCount}`)

  return enrichedProducts
}
