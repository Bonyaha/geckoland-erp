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
    const salesDataPath = path.join(
      __dirname,
      '../../../prisma/data/sales.json'
    )
    const salesData = await fs.readFile(salesDataPath, 'utf-8')
    let sales = JSON.parse(salesData)

    // Randomly map productIds for each sale
    sales = sales.map((sale: any) => ({
      ...sale,
      productId: productIds[Math.floor(Math.random() * productIds.length)],
    }))

    // Write the updated sales to a new file
    const newSalesDataPath = path.join(
      __dirname,
      '../../../prisma/data/sales_real.json'
    )
    await fs.writeFile(newSalesDataPath, JSON.stringify(sales, null, 2))

    console.log(
      'Sales product IDs mapped successfully. Updated file: sales_real.json'
    )
    console.log(`Total sales records: ${sales.length}`)
    console.log(
      `Unique product IDs mapped: ${
        new Set(sales.map((sale: any) => sale.productId)).size
      } out of ${productIds.length} available`
    )
  } catch (error) {
    console.error('Error mapping sales product IDs:', error)
    throw error
  }
}

mapSalesProductIds()
