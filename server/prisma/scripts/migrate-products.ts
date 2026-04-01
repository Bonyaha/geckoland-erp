// This file contains a script to modify the products table in Prisma: adding or updating the externalIds field for each product
import prisma from '../../src/config/database'
import fs from 'fs'
import path from 'path'

async function migrateProductsFromJson() {
  try {
    // Read your local JSON file
    const jsonPath = path.join(__dirname, 'data/products.json')
    console.log('Looking for JSON file at:', jsonPath)
    console.log('File exists:', fs.existsSync(jsonPath))
    const productsData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))

    // If it's an array of products
    const products = Array.isArray(productsData) ? productsData : [productsData]

    for (const product of products) {
      console.log(`Updating externalIds for product ${product.productId}...`)

      try {
        await prisma.products.update({
          where: { productId: product.productId },
          data: {
            externalIds: product.externalIds,
          },
        })

        console.log(
          `✅ Product ${product.productId} externalIds updated successfully`
        )
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        console.error(
          `❌ Failed to update product ${product.productId}:`,
          errorMessage
        )
        // Continue with other products even if one fails
      }
    }

    console.log('Migration completed!')
  } catch (error) {
    console.error('Migration failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

migrateProductsFromJson()
