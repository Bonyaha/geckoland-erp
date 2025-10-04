// server/prisma/exportPromProductsToJSON.ts
import * as fs from 'fs'
import * as path from 'path'
import csv from 'csv-parser'

interface PromProductCSV {
  Код_товару: string
  Назва_позиції: string
  Назва_позиції_укр: string
  Пошукові_запити: string
  Пошукові_запити_укр: string
  Опис: string
  Опис_укр: string
  Тип_товару: string
  Ціна: string
  Валюта: string
  Одиниця_виміру: string
  Мінімальний_обсяг_замовлення: string
  Оптова_ціна: string
  Мінімальне_замовлення_опт: string
  Посилання_зображення: string
  Наявність: string
  Кількість: string
  Номер_групи: string
  Назва_групи: string
  Посилання_підрозділу: string
  Унікальний_ідентифікатор: string
  Ідентифікатор_товару: string
  Ідентифікатор_підрозділу: string
  Ідентифікатор_групи: string
  Виробник: string
  Країна_виробник: string
  Знижка: string
  ID_групи_різновидів: string
  Особисті_нотатки: string
  Продукт_на_сайті: string
  Термін_дії_знижки_від: string
  Термін_дії_знижки_до: string
  Ціна_від: string
  Ярлик: string
  'Вага,кг': string
  'Ширина,см': string
  'Висота,см': string
  'Довжина,см': string  
}

interface PromProduct {
  promId: string
  sku: string
  nameUkr: string
  descriptionUkr: string
  searchQueriesUkr: string
  type: string
  price: number
  currency: string
  measureUnit: string
  wholesalePrice: number | null
  minWholesaleQuantity: number | null
  images: string[]
  mainImage: string | null
  availability: string
  quantity: number
  available: boolean
  groupNumber: string
  groupName: string
  categoryUrl: string
  manufacturer: string
  country: string
  discount: string
  productUrl: string
  label: string
  personalNotes?: string
  weight: number | null
  width: number | null
  height: number | null
  length: number | null
}

/* 
Function to read Prom products from a CSV file and export them to a JSON file
It's used when fetching Prom products directly from their API is not feasible
 */
async function exportPromProductsToJSON() {
  const csvFilePath = path.join(__dirname, 'data', 'promProducts.csv')
  const outputFilePath = path.join(__dirname, 'data', 'promProductsNew.json')
  const products: PromProduct[] = []

  if (!fs.existsSync(csvFilePath)) {
    console.error(`Error: The file was not found at ${csvFilePath}`)
    console.error(
      'Please place your prom_products.csv file in the server/prisma/data/ directory.'
    )
    return
  }

  console.log('Reading Prom products from CSV...')

  return new Promise<void>((resolve, reject) => {   
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (data: PromProductCSV) => {
        // This callback fires ONCE for EACH row in the CSV
        // 'data' is a single object for that row

        try {
          // Parse numeric values
          const price = parseFloat(data['Ціна']) || 0
          const quantity = parseInt(data['Кількість'], 10) || 0
          const wholesalePrice = data['Оптова_ціна']
            ? parseFloat(data['Оптова_ціна'])
            : null
          const minWholesaleQty = data['Мінімальне_замовлення_опт']
            ? parseFloat(data['Мінімальне_замовлення_опт'])
            : null

          // Parse images
          const imageUrls = data['Посилання_зображення']
            ? data['Посилання_зображення']
                .split(',')
                .map((url) => url.trim())
                .filter((url) => url)
            : []          

          // Determine availability
          const availabilitySymbol = data['Наявність']
          const available =
            availabilitySymbol === '+' ||
            availabilitySymbol === '!' ||
            quantity > 0

          // Parse dimensions and weight
          const weight = data['Вага,кг'] ? parseFloat(data['Вага,кг']) : null
          const width = data['Ширина,см'] ? parseFloat(data['Ширина,см']) : null
          const height = data['Висота,см']
            ? parseFloat(data['Висота,см'])
            : null
          const length = data['Довжина,см']
            ? parseFloat(data['Довжина,см'])
            : null          

          const product: PromProduct = {
            promId: data['Унікальний_ідентифікатор'],
            sku: data['Код_товару'],
            nameUkr: data['Назва_позиції_укр'],
            descriptionUkr: data['Опис_укр'],
            searchQueriesUkr: data['Пошукові_запити_укр'],
            type: data['Тип_товару'],
            price: price,
            currency: data['Валюта'] || 'UAH',
            measureUnit: data['Одиниця_виміру'] || 'шт.',
            wholesalePrice: wholesalePrice,
            minWholesaleQuantity: minWholesaleQty,
            images: imageUrls,
            mainImage: imageUrls.length > 0 ? imageUrls[0] : null,
            availability: data['Наявність'],
            quantity: quantity,
            available: available,
            groupNumber: data['Номер_групи'],
            groupName: data['Назва_групи'],
            categoryUrl: data['Посилання_підрозділу'],
            manufacturer: data['Виробник'],
            country: data['Країна_виробник'],
            discount: data['Знижка'],
            productUrl: data['Продукт_на_сайті'],
            label: data['Ярлик'],
            personalNotes: data['Особисті_нотатки'],
            weight: weight,
            width: width,
            height: height,
            length: length,
          }
          console.log('Parsed product:', product)

          products.push(product)
        } catch (error) {
          console.error(`Error parsing product ${data['Код_товару']}:`, error)
        }
      })
      .on('end', async () => {
        // This fires once when ALL rows have been processed
        try {
          console.log(`Parsed ${products.length} products from Prom CSV.`)          

          if (products.length > 0) {
            // Write to JSON file with pretty formatting
            fs.writeFileSync(
              outputFilePath,
              JSON.stringify(products, null, 2),
              'utf-8'
            )
            console.log(
              `✅ Successfully exported ${products.length} products to ${outputFilePath}`
            )
          } else {
            console.warn('⚠️  No products were parsed from the CSV file.')
          }

          resolve()
        } catch (error) {
          console.error('Error writing JSON file:', error)
          reject(error)
        }
      })
      .on('error', (error) => {
        console.error('Error reading CSV file:', error)
        reject(error)
      })
  })
}

// Execute the export
exportPromProductsToJSON()
/* .then(() => {
    console.log('Export completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Export failed:', error)
    process.exit(1)
  }) */
