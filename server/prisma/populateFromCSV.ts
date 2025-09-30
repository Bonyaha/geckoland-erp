import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import csv from 'csv-parser'
import { nanoid } from 'nanoid'

const prisma = new PrismaClient()

interface ProductCSV {
  ID: string
  Назва: string
  Артикул: string
  Кількість: string
  Ціна: string
  'Собівр.': string
  Зображення: string
  Категорія: string
  Опис: string
  'Од.вим.': string
}

async function populateProductsFromCSV() {
  const csvFilePath = path.join(__dirname, 'data', 'products.csv')
  const products: any[] = []

  if (!fs.existsSync(csvFilePath)) {
    console.error(`Error: The file was not found at ${csvFilePath}`)
    console.error(
      'Please place your products.csv file in the geckoland-erp/server/prisma/data/ directory.'
    )
    return
  }

  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (data: ProductCSV) => {
      const quantity = parseInt(data['Кількість'], 10) || 0
      const price = parseFloat(data['Ціна']) || 0
      const sku = data['Артикул'] || ''

      // Determine availability based on quantity
      const available = quantity > 0      

      // Parse images - split by comma if multiple URLs
      const imageUrls = data['Зображення']
        ? data['Зображення']
            .split(',')
            .map((url) => url.trim())
            .filter((url) => url)
        : []

      const mainImage = imageUrls.length > 0 ? imageUrls[0] : null

      const product = {
        productId: `csv_${data.ID}_${nanoid(6)}`, // Generate unique ID
        sku: sku || null,
        name: data['Назва'] || 'Unnamed Product',
        price: price,
        costPrice: parseFloat(data['Собівр.']) || null,
        stockQuantity: quantity,
        source: 'prom', // Default source, adjust as needed
        externalIds: { prom: null, rozetka: null },
        description: data['Опис'] || null,
        mainImage: mainImage,
        images: imageUrls,
        inStock: quantity,
        available: available,
        priceOld: null,
        pricePromo: null,
        updatedPrice: null,
        currency: 'UAH',
        dateModified: null,
        lastSynced: new Date(),
        needsSync: false,
        multilangData: null,
        categoryData: data['Категорія']
          ? {
              name: data['Категорія'],
            }
          : null,
        measureUnit: data['Од.вим.'] || 'шт',
        status: 'active',
        lastPromSync: null,
        lastRozetkaSync: null,
        needsPromSync: true, // Set to true to sync with Prom later
        needsRozetkaSync: false,
        promQuantity: null,
        rozetkaQuantity: null,
      }

      products.push(product)
    })
    .on('end', async () => {
      try {
        console.log(`Found ${products.length} products in the CSV file.`)

        if (products.length > 0) {
          console.log('Clearing the Products table...')
          await prisma.products.deleteMany({})

          console.log('Populating the Products table...')

          // Insert products one by one to handle Decimal types properly
          let successCount = 0
          for (const product of products) {
            try {
              await prisma.products.create({
                data: product,
              })
              successCount++
            } catch (error) {
              console.error(`Failed to insert product ${product.name}:`, error)
            }
          }

          console.log(
            `Successfully inserted ${successCount} out of ${products.length} products.`
          )
        }
      } catch (error) {
        console.error('An error occurred during the database operation:', error)
      } finally {
        await prisma.$disconnect()
      }
    })
}

populateProductsFromCSV()
