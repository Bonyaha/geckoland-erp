import * as fs from 'fs/promises'

async function updateProductsExternalIds() {
  try {
    // Read products.json
    const productsData = await fs.readFile('prisma/data/products.json', 'utf-8')
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
      promProductsMap.set(promProduct.sku, promProduct.productId)
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

  const promProductsMap = new Map<string, string[]>()

  promProducts.forEach((promProduct: any) => {
    const sku = promProduct.sku
    const productId = promProduct.productId

    /* we need to handle multiple products with the same SKU
so we store an array of productIds for each SKU */
    const productIds = promProductsMap.get(sku) || []
    productIds.push(productId)

    promProductsMap.set(sku, productIds)
  })

  let example = products.filter((p) => p.sku === '520D-ZX-050')

  console.log('520D-ZX-050 in input products:')
  console.log(example)

  console.log('520D-ZX-050 in promProductsMap:')
  console.log(promProductsMap.get('520D-ZX-050')) //[ '1940765428', '1729613222' ]

  let updatedCount = 0
  let notFoundCount = 0

  const enrichedProducts = products.map((product) => {
    // This gets the array, e.g., ["1939682231", "1729610009"]
    const matchingPromProductIds = promProductsMap.get(product.sku)

    // Check if we found any IDs
    if (matchingPromProductIds && matchingPromProductIds.length > 0) {
      updatedCount++ // Count this "group" of updates once

      // .shift() takes the *first* ID from the array AND removes it.
      // 1st product with this SKU gets the 1st ID.
      // 2nd product with this SKU gets the 2nd ID.
      const promId = matchingPromProductIds.shift()

      return {
        ...product,
        externalIds: {
          ...product.externalIds,
          prom: promId, // Assign the *individual* promId
        },
      }
    } else {
      // No match found, just return the original product
      notFoundCount++
      return product
    }
  })

  console.log(`Products updated with prom ID: ${updatedCount}`)
  console.log(`Products without matching prom ID: ${notFoundCount}`)

  return enrichedProducts
}

//updateProductsExternalIds()
