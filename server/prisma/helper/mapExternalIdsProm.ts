import * as fs from 'fs/promises'

async function updateProductsExternalIds() {
  try {
    // Read products.json
    const productsData = await fs.readFile(
      'prisma/data/products.json',
      'utf-8'
    )
    let products = JSON.parse(productsData)

    // Read promProducts.json
    const promProductsData = await fs.readFile(
      'prisma/data/promProductsNew.json',
      'utf-8'
    )
    const promProducts = JSON.parse(promProductsData)

    // Create a map for quick lookup: uniqueProductKey -> productId
    const promProductsMap = new Map()
    promProducts.forEach((promProduct: any) => {
      promProductsMap.set(promProduct.sku, promProduct.promId)
    })

    let updatedCount = 0
    let notFoundCount = 0

    // Update products with matching SKUs
    products = products.map((product: any) => {
      const matchingPromProductId = promProductsMap.get(product.sku)

      if (matchingPromProductId) {
        updatedCount++
        return {
          ...product,
          externalIds: {
            ...product.externalIds,
            prom: matchingPromProductId,
          },
        }
      } else {
        notFoundCount++
        // Keep the product as is if no match found
        return product
      }
    })

    // Write the updated products back to the file
    await fs.writeFile(
      'prisma/data/products.json',
      JSON.stringify(products, null, 2)
    )

    console.log('Products external IDs updated successfully!')
    console.log(`Total products processed: ${products.length}`)
    console.log(`Products updated with prom ID: ${updatedCount}`)
    console.log(`Products without matching prom ID: ${notFoundCount}`)
    console.log(`Available prom products: ${promProducts.length}`)
  } catch (error) {
    console.error('Error updating products external IDs:', error)
    throw error
  }
}

/* 
//Function similar to the one above, but it takes an array of products instead of reading from a file and returns the enriched array, not writing to a file 
*/

export async function enrichWithPromIds(products: any[]) {
  const promProductsData = await fs.readFile(
    'prisma/data/promProducts.json',
    'utf-8'
  )
  const promProducts = JSON.parse(promProductsData)

  const promProductsMap = new Map()
  promProducts.forEach((promProduct: any) => {
    promProductsMap.set(promProduct.sku, promProduct.productId)
  })

  let updatedCount = 0
  let notFoundCount = 0

  const enrichedProducts = products.map((product) => {
    const matchingPromProductId = promProductsMap.get(product.sku)

    if (matchingPromProductId) {
      updatedCount++
      return {
        ...product,
        externalIds: {
          ...product.externalIds,
          prom: matchingPromProductId,
        },
      }
    } else {
      notFoundCount++
      return product
    }
  })

  console.log(`Products updated with prom ID: ${updatedCount}`)
  console.log(`Products without matching prom ID: ${notFoundCount}`)

  return enrichedProducts
}



//updateProductsExternalIds()
