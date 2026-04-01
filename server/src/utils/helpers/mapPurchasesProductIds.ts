import * as fs from 'fs/promises'
import * as path from 'path'

async function mapSalesProductIds() {
  try {
    // Read crmProducts.json
    const crmDataPath = path.join(
      __dirname,
      '../../../prisma/data/crmProducts.json'
    )
    const crmProductsData = await fs.readFile(crmDataPath, 'utf-8')

    const crmProducts = JSON.parse(crmProductsData)

    const productIds = crmProducts.map((product: any) => product.productId)

    // Read sales.json
    const purchasesDataPath = path.join(
      __dirname,
      '../../../prisma/data/purchases.json'
    )
    const purchasesData = await fs.readFile(purchasesDataPath, 'utf-8')
    let purchases = JSON.parse(purchasesData)

    // Randomly map productIds for each sale
    purchases = purchases.map((sale: any) => ({
      ...sale,
      productId: productIds[Math.floor(Math.random() * productIds.length)],
    }))

    // Write the updated sales to a new file
    const newPurchasesDataPath = path.join(
      __dirname,
      '../../../prisma/data/purchases_real.json'
    )
    await fs.writeFile(newPurchasesDataPath, JSON.stringify(purchases, null, 2))

    console.log(
      'Sales product IDs mapped successfully. Updated file: sales_real.json'
    )
    console.log(`Total purchases records: ${purchases.length}`)
    console.log(
      `Unique product IDs mapped: ${
        new Set(purchases.map((purchase: any) => purchase.productId)).size
      } out of ${productIds.length} available`
    )
  } catch (error) {
    console.error('Error mapping purchases product IDs:', error)
    throw error
  }
}

mapSalesProductIds()
