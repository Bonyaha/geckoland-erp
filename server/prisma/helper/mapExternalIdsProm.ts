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
      'prisma/data/promProducts.json',
      'utf-8'
    )
    const promProducts = JSON.parse(promProductsData)

    // Create a map for quick lookup: uniqueProductKey -> productId
    const promProductsMap = new Map()
    promProducts.forEach((promProduct: any) => {
      promProductsMap.set(promProduct.uniqueProductKey, promProduct.productId)
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

updateProductsExternalIds()
