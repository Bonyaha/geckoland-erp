import * as fs from 'fs/promises'
import * as path from 'path'

async function updateProductsExternalIds() {
  try {
    // Read products.json
    const productsDataPath = path.join(
      __dirname,
      '../../../prisma/data/products.json'
    )
    const productsData = await fs.readFile(productsDataPath, 'utf-8')
    let products = JSON.parse(productsData)

    // Read rozetkaProducts.json
    const rozetkaDataPath = path.join(
      __dirname,
      '../../../prisma/data/rozetkaProducts.json'
    )
    const rozetkaProductsData = await fs.readFile(rozetkaDataPath, 'utf-8')
    const rozetkaProducts = JSON.parse(rozetkaProductsData)

    // Create a map for quick lookup: uniqueProductKey -> productId
    const rozetkaProductsMap = new Map()
    rozetkaProducts.forEach((rozetkaProduct: any) => {
      rozetkaProductsMap.set(rozetkaProduct.uniqueProductKey, {
        rz_item_id: rozetkaProduct.productId,
        item_id: rozetkaProduct.externalIds.rozetka,
      })
    })

    let updatedCount = 0
    let notFoundCount = 0

    // Update products with matching SKUs
    products = products.map((product: any) => {
      const matchingRozetkaData = rozetkaProductsMap.get(product.sku)

      if (matchingRozetkaData) {
        updatedCount++
        return {
          ...product,
          externalIds: {
            ...product.externalIds,
            rozetka: {
              rz_item_id: matchingRozetkaData.rz_item_id,
              item_id: matchingRozetkaData.item_id,
            },
          },
        }
      } else {
        notFoundCount++
        // Keep the product as is if no match found
        return product
      }
    })

    // Write the updated products back to the file
    await fs.writeFile(productsDataPath, JSON.stringify(products, null, 2))

    console.log('Products external IDs updated successfully!')
    console.log(`Total products processed: ${products.length}`)
    console.log(`Products updated with rozetka ID: ${updatedCount}`)
    console.log(`Products without matching rozetka ID: ${notFoundCount}`)
    console.log(`Available rozetka products: ${rozetkaProducts.length}`)
  } catch (error) {
    console.error('Error updating products external IDs:', error)
    throw error
  }
}

/* 
//Function similar to the one above, but it takes an array of products instead of reading from a file and returns the enriched array, not writing to a file
*/

export async function enrichWithRozetkaIds(products: any[]) {
  //console.log('I am in enrichWithRozetkaIds');
 const rozetkaDataPath = path.join(
   __dirname,
   '../../../prisma/data/rozetkaProducts.json'
 )

  const rozetkaProductsData = await fs.readFile(rozetkaDataPath, 'utf-8')
  const rozetkaProducts = JSON.parse(rozetkaProductsData)
  //console.log('Rozetka products data loaded:', rozetkaProducts);

  // Create a map for quick lookup: uniqueProductKey -> productId
  const rozetkaProductsMap = new Map()
  rozetkaProducts.forEach((rozetkaProduct: any) => {
    rozetkaProductsMap.set(rozetkaProduct.sku, {
      rz_item_id: rozetkaProduct.productId,
      item_id: rozetkaProduct.externalIds.rozetka,
    })
  })
  //console.log('Rozetka products map:', rozetkaProductsMap);

  const enrichedProducts = products.map((product) => {
    const matchingRozetkaData = rozetkaProductsMap.get(product.sku)

    if (matchingRozetkaData) {
      //console.log('Found matching rozetka ID for product SKU:', product.sku);

      return {
        ...product,
        externalIds: {
          ...product.externalIds,
          rozetka: {
            rz_item_id: matchingRozetkaData.rz_item_id,
            item_id: matchingRozetkaData.item_id,
          },
        },
      }
    }
    // Keep the product as is if no match found
    return product
  })

  return enrichedProducts
}

//updateProductsExternalIds()
