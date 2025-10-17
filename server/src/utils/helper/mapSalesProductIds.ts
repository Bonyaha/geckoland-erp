import * as fs from 'fs/promises'

async function mapSalesProductIds() {
  try {
    // Read crmProducts.json
    const crmProductsData = await fs.readFile(
      'prisma/data/crmProducts.json',
      'utf-8'
    )

    const crmProducts = JSON.parse(crmProductsData)

    const productIds = crmProducts.map((product: any) => product.productId)

    // Read sales.json
    const salesData = await fs.readFile('prisma/data/sales.json', 'utf-8')
    let sales = JSON.parse(salesData)

    // Randomly map productIds for each sale
    sales = sales.map((sale: any) => ({
      ...sale,
      productId: productIds[Math.floor(Math.random() * productIds.length)],
    }))

    // Write the updated sales to a new file
    await fs.writeFile(
      'prisma/data/sales_real.json',
      JSON.stringify(sales, null, 2)
    )

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
